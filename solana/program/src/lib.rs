//! CostShield steps: index-triggered payout steps for a fuel price cap, whose
//! collateral is a program-owned Helius Privacy Rings private balance.
//!
//! Adapted from Equity Floor, our first idea for this hackathon, written during
//! the event and set aside on Nov 20. Public terms live in a step account;
//! amounts never touch this program. Each step's collateral is a private
//! (encrypted) Rings balance owned by the vault PDA ["vault", step]. Only this
//! program can sign for that PDA, and it does so (invoke_signed into Rings
//! `transact`) only when:
//!   * release: a report from the configured oracle for the same index, for a
//!     period inside the step's term [first_period, last_period], crosses the
//!     step's trigger in the step's direction (at or above for a cap); the
//!     fleet signs.
//!   * reclaim: every period of the term has been reported and none crossed the
//!     trigger; the underwriter signs.
//!
//! Instructions (first byte is the tag):
//!   0 init_step    [payer (s,w), step (w), fleet (s), underwriter (s), system]
//!   1 report_index [payer (s,w), oracle (s), report (w), system]
//!   2 release      [step (w), report, fleet (s), ...rings transact accounts]
//!   3 reclaim      [step (w), underwriter (s), report x n, ...rings transact accounts]
//!
//! Periods are calendar months encoded as u32 YYYYMM (2026-09 = 202609).
//! Prices are u64 in 1/1000 $/gal (3.512 $/gal = 3512).
//! Directions: 0 = pays when the index is at or above the trigger (a cap),
//!             1 = pays when the index is at or below the trigger (a floor).
#![allow(unexpected_cfgs)]

extern crate alloc;
use alloc::vec::Vec;

use pinocchio::{
    account_info::AccountInfo,
    cpi::{invoke_signed, slice_invoke_signed},
    entrypoint,
    instruction::{AccountMeta, Instruction, Seed, Signer},
    program_error::ProgramError,
    pubkey::{create_program_address, find_program_address, Pubkey},
    sysvars::{clock::Clock, rent::Rent, Sysvar},
    ProgramResult,
};

entrypoint!(process_instruction);

pub const RINGS_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW");
pub const SYSTEM_PROGRAM_ID: Pubkey = [0u8; 32];
/// The configured index oracle (one trusted key that posts the EIA monthly mean).
pub const ORACLE: Pubkey =
    pinocchio_pubkey::pubkey!("2RECf7GfWRSw8U73tyWJ1ZhTJ5U21FRHPjEaXxTa7EsH");
const RINGS_TRANSACT_TAG: u8 = 16;

pub const STEP_SEED: &[u8] = b"step";
pub const VAULT_SEED: &[u8] = b"vault";
pub const REPORT_SEED: &[u8] = b"report";

pub const DISC_STEP: u8 = 1;
pub const DISC_REPORT: u8 = 2;

pub const STATUS_OPEN: u8 = 0;
pub const STATUS_PAID: u8 = 1;
pub const STATUS_RECLAIMED: u8 = 2;

pub const DIR_AT_OR_ABOVE: u8 = 0;
pub const DIR_AT_OR_BELOW: u8 = 1;

// Step account layout (104 bytes)
//   0 disc u8 | 1 bump u8 | 2 vault_bump u8 | 3 step_index u8 | 4 status u8 | 5 direction u8 | 6 pad[2]
//   8 index_id u32 | 12 first_period u32 | 16 last_period u32 | 20 settled_period u32
//   24 trigger_milli u64 | 32 policy_id [8] | 40 fleet [32] | 72 underwriter [32]
pub const STEP_SIZE: usize = 104;
// Report account layout (96 bytes)
//   0 disc u8 | 1 bump u8 | 2 pad[2] | 4 index_id u32 | 8 period u32 | 12 pad[4]
//   16 value_milli u64 | 24 reported_at i64 | 32 sha256 [32] | 64 oracle [32]
pub const REPORT_SIZE: usize = 96;

pub const ERR_NOT_TRIGGERED: u32 = 6001;
pub const ERR_BAD_ORACLE: u32 = 6002;
pub const ERR_BAD_REPORT_ACCOUNT: u32 = 6003;
pub const ERR_BAD_RINGS_PROGRAM: u32 = 6004;
pub const ERR_MISSING_VAULT_PDA: u32 = 6005;
pub const ERR_BAD_STEP_ACCOUNT: u32 = 6006;
pub const ERR_ALREADY_SETTLED: u32 = 6007;
pub const ERR_WRONG_FLEET: u32 = 6008;
pub const ERR_REPORT_OUT_OF_WINDOW: u32 = 6009;
pub const ERR_INDEX_MISMATCH: u32 = 6010;
pub const ERR_ALREADY_REPORTED: u32 = 6011;
pub const ERR_BAD_TERMS: u32 = 6012;
pub const ERR_WRONG_UNDERWRITER: u32 = 6013;
pub const ERR_TRIGGERED_IN_TERM: u32 = 6014;
pub const ERR_INCOMPLETE_REPORTS: u32 = 6015;
pub const ERR_BAD_SYSTEM_PROGRAM: u32 = 6016;

#[inline(always)]
fn err(code: u32) -> ProgramError {
    ProgramError::Custom(code)
}

fn rd<const N: usize>(data: &[u8], at: usize) -> Result<[u8; N], ProgramError> {
    data.get(at..at + N)
        .ok_or(ProgramError::InvalidInstructionData)?
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)
}
fn rd_u32(d: &[u8], at: usize) -> Result<u32, ProgramError> {
    Ok(u32::from_le_bytes(rd::<4>(d, at)?))
}
fn rd_u64(d: &[u8], at: usize) -> Result<u64, ProgramError> {
    Ok(u64::from_le_bytes(rd::<8>(d, at)?))
}

/// YYYYMM with a real month and a year from 1900 to 9999.
fn valid_period(p: u32) -> bool {
    let m = p % 100;
    (1..=12).contains(&m) && (190001..=999912).contains(&p)
}
fn next_period(p: u32) -> u32 {
    if p % 100 == 12 {
        (p / 100 + 1) * 100 + 1
    } else {
        p + 1
    }
}
fn crosses(direction: u8, value: u64, trigger: u64) -> bool {
    if direction == DIR_AT_OR_ABOVE {
        value >= trigger
    } else {
        value <= trigger
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (tag, rest) = data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => init_step(program_id, accounts, rest),
        1 => report_index(program_id, accounts, rest),
        2 => release(program_id, accounts, rest),
        3 => reclaim(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

/// System program CreateAccount for a PDA, signed with `seeds`.
fn create_pda_account(
    payer: &AccountInfo,
    new_account: &AccountInfo,
    space: usize,
    owner: &Pubkey,
    seeds: &[Seed],
) -> ProgramResult {
    let lamports = Rent::get()?.minimum_balance(space);
    let mut data = [0u8; 52];
    // tag 0 = CreateAccount (u32), lamports u64, space u64, owner [32]
    data[4..12].copy_from_slice(&lamports.to_le_bytes());
    data[12..20].copy_from_slice(&(space as u64).to_le_bytes());
    data[20..52].copy_from_slice(owner);
    let metas = [
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::writable_signer(new_account.key()),
    ];
    let ix = Instruction {
        program_id: &SYSTEM_PROGRAM_ID,
        accounts: &metas,
        data: &data,
    };
    invoke_signed(&ix, &[payer, new_account], &[Signer::from(seeds)])
}

// ---------------------------------------------------------------- init_step
// data: policy_id [8] | step_index u8 | index_id u32 | first_period u32 |
//       last_period u32 | direction u8 | trigger_milli u64      (30 bytes)
fn init_step(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [payer, step, fleet, underwriter, system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    if !payer.is_signer() || !fleet.is_signer() || !underwriter.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if system.key() != &SYSTEM_PROGRAM_ID {
        return Err(err(ERR_BAD_SYSTEM_PROGRAM));
    }
    if data.len() < 30 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let policy_id = rd::<8>(data, 0)?;
    let step_index = data[8];
    let index_id = rd_u32(data, 9)?;
    let first_period = rd_u32(data, 13)?;
    let last_period = rd_u32(data, 17)?;
    let direction = data[21];
    let trigger = rd_u64(data, 22)?;
    if !valid_period(first_period)
        || !valid_period(last_period)
        || last_period < first_period
        || direction > DIR_AT_OR_BELOW
        || trigger == 0
    {
        return Err(err(ERR_BAD_TERMS));
    }

    let idx = [step_index];
    let (pda, bump) = find_program_address(
        &[STEP_SEED, fleet.key().as_ref(), &policy_id, &idx],
        program_id,
    );
    if step.key() != &pda {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    let (_vault, vault_bump) = find_program_address(&[VAULT_SEED, step.key().as_ref()], program_id);

    let bump_seed = [bump];
    let seeds = [
        Seed::from(STEP_SEED),
        Seed::from(fleet.key().as_ref()),
        Seed::from(&policy_id[..]),
        Seed::from(&idx[..]),
        Seed::from(&bump_seed[..]),
    ];
    create_pda_account(payer, step, STEP_SIZE, program_id, &seeds)?;

    let mut d = step.try_borrow_mut_data()?;
    d[0] = DISC_STEP;
    d[1] = bump;
    d[2] = vault_bump;
    d[3] = step_index;
    d[4] = STATUS_OPEN;
    d[5] = direction;
    d[8..12].copy_from_slice(&index_id.to_le_bytes());
    d[12..16].copy_from_slice(&first_period.to_le_bytes());
    d[16..20].copy_from_slice(&last_period.to_le_bytes());
    d[24..32].copy_from_slice(&trigger.to_le_bytes());
    d[32..40].copy_from_slice(&policy_id);
    d[40..72].copy_from_slice(fleet.key());
    d[72..104].copy_from_slice(underwriter.key());
    Ok(())
}

// ------------------------------------------------------------- report_index
// data: index_id u32 | period u32 | value_milli u64 | sha256 [32]   (48 bytes)
fn report_index(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [payer, oracle, report, system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    if !payer.is_signer() || !oracle.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if oracle.key() != &ORACLE {
        return Err(err(ERR_BAD_ORACLE));
    }
    if system.key() != &SYSTEM_PROGRAM_ID {
        return Err(err(ERR_BAD_SYSTEM_PROGRAM));
    }
    let index_id = rd::<4>(data, 0)?;
    let period = rd::<4>(data, 4)?;
    let value = rd_u64(data, 8)?;
    let sha = rd::<32>(data, 16)?;
    if !valid_period(u32::from_le_bytes(period)) || value == 0 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let (pda, bump) = find_program_address(&[REPORT_SEED, &index_id, &period], program_id);
    if report.key() != &pda {
        return Err(err(ERR_BAD_REPORT_ACCOUNT));
    }
    // Reports are write-once.
    if report.is_owned_by(program_id) || !report.data_is_empty() {
        return Err(err(ERR_ALREADY_REPORTED));
    }
    let bump_seed = [bump];
    let seeds = [
        Seed::from(REPORT_SEED),
        Seed::from(&index_id[..]),
        Seed::from(&period[..]),
        Seed::from(&bump_seed[..]),
    ];
    create_pda_account(payer, report, REPORT_SIZE, program_id, &seeds)?;
    let now = Clock::get()?.unix_timestamp;

    let mut d = report.try_borrow_mut_data()?;
    d[0] = DISC_REPORT;
    d[1] = bump;
    d[4..8].copy_from_slice(&index_id);
    d[8..12].copy_from_slice(&period);
    d[16..24].copy_from_slice(&value.to_le_bytes());
    d[24..32].copy_from_slice(&now.to_le_bytes());
    d[32..64].copy_from_slice(&sha);
    d[64..96].copy_from_slice(oracle.key());
    Ok(())
}

// -------------------------------------------------------- shared validation
struct StepTerms {
    vault_bump: u8,
    status: u8,
    direction: u8,
    index_id: u32,
    first_period: u32,
    last_period: u32,
    trigger: u64,
    fleet: Pubkey,
    underwriter: Pubkey,
}

fn load_step(program_id: &Pubkey, step: &AccountInfo) -> Result<StepTerms, ProgramError> {
    if !step.is_owned_by(program_id) {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    let d = step.try_borrow_data()?;
    if d.len() < STEP_SIZE || d[0] != DISC_STEP {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    let fleet: Pubkey = rd::<32>(&d, 40)?;
    let policy_id = rd::<8>(&d, 32)?;
    let idx = [d[3]];
    let bump = [d[1]];
    let expected = create_program_address(
        &[STEP_SEED, fleet.as_ref(), &policy_id, &idx, &bump],
        program_id,
    )
    .map_err(|_| err(ERR_BAD_STEP_ACCOUNT))?;
    if &expected != step.key() {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    Ok(StepTerms {
        vault_bump: d[2],
        status: d[4],
        direction: d[5],
        index_id: rd_u32(&d, 8)?,
        first_period: rd_u32(&d, 12)?,
        last_period: rd_u32(&d, 16)?,
        trigger: rd_u64(&d, 24)?,
        fleet,
        underwriter: rd::<32>(&d, 72)?,
    })
}

/// Returns (index_id, period, value_milli) of an authentic report account.
fn load_report(program_id: &Pubkey, report: &AccountInfo) -> Result<(u32, u32, u64), ProgramError> {
    if !report.is_owned_by(program_id) {
        return Err(err(ERR_BAD_REPORT_ACCOUNT));
    }
    let d = report.try_borrow_data()?;
    if d.len() < REPORT_SIZE || d[0] != DISC_REPORT {
        return Err(err(ERR_BAD_REPORT_ACCOUNT));
    }
    let index_id = rd::<4>(&d, 4)?;
    let period = rd::<4>(&d, 8)?;
    let bump = [d[1]];
    let expected = create_program_address(&[REPORT_SEED, &index_id, &period, &bump], program_id)
        .map_err(|_| err(ERR_BAD_REPORT_ACCOUNT))?;
    if &expected != report.key() {
        return Err(err(ERR_BAD_REPORT_ACCOUNT));
    }
    Ok((
        u32::from_le_bytes(index_id),
        u32::from_le_bytes(period),
        rd_u64(&d, 16)?,
    ))
}

/// CPI into Rings `transact` with the step's vault PDA signing.
fn transact_as_vault(
    program_id: &Pubkey,
    step: &AccountInfo,
    vault_bump: u8,
    spp_accounts: &[AccountInfo],
    transact: &[u8],
) -> ProgramResult {
    let bump_seed = [vault_bump];
    let vault = create_program_address(&[VAULT_SEED, step.key().as_ref(), &bump_seed], program_id)?;
    // Rings transact layout: payer, output tree, rings program, system program, ...
    if spp_accounts.len() < 4 || spp_accounts[2].key() != &RINGS_PROGRAM_ID {
        return Err(err(ERR_BAD_RINGS_PROGRAM));
    }
    if !spp_accounts.iter().any(|a| a.key() == &vault) {
        return Err(err(ERR_MISSING_VAULT_PDA));
    }
    let metas: Vec<AccountMeta> = spp_accounts
        .iter()
        .map(|a| {
            let is_signer = a.is_signer() || a.key() == &vault;
            AccountMeta::new(a.key(), a.is_writable(), is_signer)
        })
        .collect();
    let mut ix_data = Vec::with_capacity(1 + transact.len());
    ix_data.push(RINGS_TRANSACT_TAG);
    ix_data.extend_from_slice(transact);
    let ix = Instruction {
        program_id: &RINGS_PROGRAM_ID,
        accounts: &metas,
        data: &ix_data,
    };
    let infos: Vec<&AccountInfo> = spp_accounts.iter().collect();
    let seeds = [
        Seed::from(VAULT_SEED),
        Seed::from(step.key().as_ref()),
        Seed::from(&bump_seed[..]),
    ];
    slice_invoke_signed(&ix, &infos, &[Signer::from(&seeds)])
}

fn settle(step: &AccountInfo, status: u8, period: u32) -> ProgramResult {
    let mut d = step.try_borrow_mut_data()?;
    d[4] = status;
    d[20..24].copy_from_slice(&period.to_le_bytes());
    Ok(())
}

// ------------------------------------------------------------------ release
// data: Rings transact instruction data (without the tag)
fn release(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 3 + 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    let step = &accounts[0];
    let report = &accounts[1];
    let fleet = &accounts[2];
    let spp_accounts = &accounts[3..];

    if !fleet.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !step.is_writable() {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    let t = load_step(program_id, step)?;
    if fleet.key() != &t.fleet {
        return Err(err(ERR_WRONG_FLEET));
    }
    if t.status != STATUS_OPEN {
        return Err(err(ERR_ALREADY_SETTLED));
    }
    let (index_id, period, value) = load_report(program_id, report)?;
    if index_id != t.index_id {
        return Err(err(ERR_INDEX_MISMATCH));
    }
    if period < t.first_period || period > t.last_period {
        return Err(err(ERR_REPORT_OUT_OF_WINDOW));
    }
    // The onchain condition: the reported index crosses the trigger in the step's direction.
    if !crosses(t.direction, value, t.trigger) {
        return Err(err(ERR_NOT_TRIGGERED));
    }
    transact_as_vault(program_id, step, t.vault_bump, spp_accounts, data)?;
    settle(step, STATUS_PAID, period)
}

// ------------------------------------------------------------------ reclaim
// data: n u8 (reports passed, one per period of the term, in order) | Rings transact data
fn reclaim(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (&n, transact) = data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    let n = n as usize;
    if accounts.len() < 2 + n + 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    let step = &accounts[0];
    let underwriter = &accounts[1];
    let reports = &accounts[2..2 + n];
    let spp_accounts = &accounts[2 + n..];

    if !underwriter.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !step.is_writable() {
        return Err(err(ERR_BAD_STEP_ACCOUNT));
    }
    let t = load_step(program_id, step)?;
    if underwriter.key() != &t.underwriter {
        return Err(err(ERR_WRONG_UNDERWRITER));
    }
    if t.status != STATUS_OPEN {
        return Err(err(ERR_ALREADY_SETTLED));
    }
    // Every period of the term must be reported, and none may have crossed the trigger.
    let mut p = t.first_period;
    let mut i = 0usize;
    loop {
        let report = reports.get(i).ok_or(err(ERR_INCOMPLETE_REPORTS))?;
        let (index_id, period, value) = load_report(program_id, report)?;
        if index_id != t.index_id || period != p {
            return Err(err(ERR_INCOMPLETE_REPORTS));
        }
        if crosses(t.direction, value, t.trigger) {
            return Err(err(ERR_TRIGGERED_IN_TERM));
        }
        i += 1;
        if p >= t.last_period {
            break;
        }
        p = next_period(p);
    }
    if i != n {
        return Err(err(ERR_INCOMPLETE_REPORTS));
    }
    transact_as_vault(program_id, step, t.vault_bump, spp_accounts, transact)?;
    settle(step, STATUS_RECLAIMED, t.last_period)
}
