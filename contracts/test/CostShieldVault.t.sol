// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CostShieldVault, IERC20} from "../src/CostShieldVault.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes calldata) external;
    function expectRevert(bytes4) external;
}

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[to] += a; return true;
    }
}

contract CostShieldVaultTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockUSDC usdc;
    CostShieldVault vault;
    address underwriter = address(0xA11CE);
    address oracle;
    address fleet = address(0xF1EE7);
    address stranger = address(0xBAD);
    bytes32 constant INDEX = keccak256("EIA:EMD_EPD2D_PTE_R20_DPG:monthly-mean");

    // Sample-policy terms at demo scale (1 testnet USDC = $1,000 notional): strike $4.357, 3,676 gal cap, $70.60 limit.
    uint64 constant STRIKE = 4_356_750;
    uint64 constant MAX_INDEX = 20_000_000;
    uint64 constant MAX_QTY = 3_676;
    uint128 constant LIMIT = 70_600_000;

    function setUp() public {
        oracle = address(0x04AC1E);
        usdc = new MockUSDC();
        vault = new CostShieldVault(IERC20(address(usdc)), oracle);
        usdc.mint(underwriter, 100_000_000);
        vm.startPrank(underwriter);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(80_000_000);
        vm.stopPrank();
    }

    function _open() internal returns (uint256) {
        return vault.openPolicy(fleet, INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202512, 202611, LIMIT);
    }

    function _eq(uint256 a, uint256 b, string memory what) internal pure { require(a == b, what); }

    function test_OpenReservesFullLimit() public {
        _open();
        _eq(vault.reserved(), LIMIT, "reserved");
        _eq(vault.freeCollateral(), 80_000_000 - LIMIT, "free");
    }

    function test_SettlePaysContractComputedAmount() public {
        uint256 id = _open();
        // September 2026: index $6.35025, 2,897 covered gallons -> (6.35025 - 4.35675) * 2.897 = 5.775169 USDC
        vm.prank(oracle);
        uint256 paid = vault.settle(id, 202609, 6_350_250, 2_897);
        _eq(paid, 5_775_169, "payout");
        _eq(usdc.balanceOf(fleet), 5_775_169, "beneficiary balance");
        _eq(vault.reserved(), LIMIT - 5_775_169, "reserved falls by payout");
    }

    function test_BelowStrikeSettlesZeroAndLocksPeriod() public {
        uint256 id = _open();
        vm.prank(oracle);
        _eq(vault.settle(id, 202512, 3_573_000, 2_938), 0, "no payout below strike");
        _eq(usdc.balanceOf(fleet), 0, "nothing paid");
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.AlreadySettled.selector, id, uint32(202512)));
        vault.settle(id, 202512, 9_000_000, 2_938);
    }

    function test_RevertsOnDuplicateSettlement() public {
        uint256 id = _open();
        vm.prank(oracle);
        vault.settle(id, 202609, 6_350_250, 2_897);
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.AlreadySettled.selector, id, uint32(202609)));
        vault.settle(id, 202609, 6_350_250, 2_897);
        _eq(usdc.balanceOf(fleet), 5_775_169, "paid once");
    }

    function test_RevertsWhenCallerIsNotOracle() public {
        uint256 id = _open();
        vm.prank(stranger);
        vm.expectRevert(CostShieldVault.NotOracle.selector);
        vault.settle(id, 202609, 6_350_250, 2_897);
        vm.expectRevert(CostShieldVault.NotOracle.selector); // the owner cannot settle either
        vault.settle(id, 202609, 6_350_250, 2_897);
    }

    function test_RevertsOnPeriodOutsideTerm() public {
        uint256 id = _open();
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.PeriodOutOfTerm.selector, uint32(202612)));
        vault.settle(id, 202612, 6_350_250, 2_897);
    }

    function test_RevertsOnImplausibleIndex() public {
        uint256 id = _open();
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.IndexOutOfBounds.selector, uint64(63_502_500), MAX_INDEX));
        vault.settle(id, 202609, 63_502_500, 2_897);
    }

    function test_QuantityIsCappedPerPeriod() public {
        uint256 id = _open();
        vm.prank(oracle);
        _eq(vault.settle(id, 202609, 6_356_750, 999_999), uint256(2_000_000) * MAX_QTY / 1000, "capped at max quantity");
    }

    function test_AggregateLimitCapsTotalPayout() public {
        uint256 id = vault.openPolicy(fleet, INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202601, 202612, 10_000_000);
        vm.startPrank(oracle);
        _eq(vault.settle(id, 202601, 6_356_750, 3_676), 7_352_000, "first month in full");
        _eq(vault.settle(id, 202602, 6_356_750, 3_676), 2_648_000, "second month capped by remaining limit");
        _eq(vault.settle(id, 202603, 6_356_750, 3_676), 0, "limit exhausted");
        vm.stopPrank();
        _eq(usdc.balanceOf(fleet), 10_000_000, "never more than the limit");
        _eq(vault.reserved(), 0, "nothing left reserved");
    }

    function test_CannotOpenPolicyWithoutCollateral() public {
        _open(); // 70.6 of 80 reserved
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.InsufficientCollateral.selector, uint256(9_400_000), uint256(LIMIT)));
        _open();
    }

    function test_OwnerCannotWithdrawReservedCollateral() public {
        _open();
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.InsufficientCollateral.selector, uint256(9_400_000), uint256(10_000_000)));
        vault.withdraw(address(this), 10_000_000);
        vault.withdraw(address(this), 9_400_000);
        _eq(usdc.balanceOf(address(this)), 9_400_000, "free collateral withdrawn");
    }

    function test_OnlyOwnerOpensClosesAndWithdraws() public {
        uint256 id = _open();
        vm.startPrank(stranger);
        vm.expectRevert(CostShieldVault.NotOwner.selector);
        vault.openPolicy(stranger, INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202601, 202612, 1);
        vm.expectRevert(CostShieldVault.NotOwner.selector);
        vault.closePolicy(id);
        vm.expectRevert(CostShieldVault.NotOwner.selector);
        vault.withdraw(stranger, 1);
        vm.expectRevert(CostShieldVault.NotOwner.selector);
        vault.setOracle(stranger);
        vm.stopPrank();
    }

    function test_CloseReleasesReserveAndBlocksSettlement() public {
        uint256 id = _open();
        vault.closePolicy(id);
        _eq(vault.reserved(), 0, "released");
        vm.prank(oracle);
        vm.expectRevert(abi.encodeWithSelector(CostShieldVault.PolicyNotOpen.selector, id));
        vault.settle(id, 202609, 6_350_250, 2_897);
    }

    function test_RejectsBadTerms() public {
        vm.expectRevert(CostShieldVault.BadTerms.selector);
        vault.openPolicy(fleet, INDEX, STRIKE, STRIKE, MAX_QTY, 202601, 202612, LIMIT); // maxIndex must exceed strike
        vm.expectRevert(CostShieldVault.BadTerms.selector);
        vault.openPolicy(fleet, INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202612, 202601, LIMIT); // term reversed
        vm.expectRevert(CostShieldVault.ZeroAddress.selector);
        vault.openPolicy(address(0), INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202601, 202612, LIMIT);
    }

    function testFuzz_PayoutNeverExceedsLimitOrCollateral(uint64 indexPrice, uint64 qty, uint128 limit) public {
        if (limit == 0 || limit > 80_000_000) limit = 80_000_000;
        if (indexPrice == 0 || indexPrice > MAX_INDEX) indexPrice = MAX_INDEX;
        uint256 id = vault.openPolicy(fleet, INDEX, STRIKE, MAX_INDEX, MAX_QTY, 202601, 202612, limit);
        uint256 before = usdc.balanceOf(address(vault));
        vm.prank(oracle);
        uint256 paid = vault.settle(id, 202606, indexPrice, qty);
        require(paid <= limit, "payout above limit");
        require(usdc.balanceOf(address(vault)) == before - paid, "vault balance mismatch");
        require(vault.reserved() == uint256(limit) - paid, "reserve mismatch");
        require(vault.freeCollateral() == 80_000_000 - uint256(limit), "free collateral changed");
    }
}
