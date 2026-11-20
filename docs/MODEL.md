# Quantitative model

All formulas are implemented in `lib/engine/` as pure functions and covered by `tests/engine.test.ts`. Evidence labels: V verified public data, C calculated from data, E estimate, A assumption.

## 1. Ingestion and classification

- CSV parsed per RFC 4180. The header row is the first row within the first 25 that has a Date column and an Amount or Debit column. Dates accept `MM/DD/YYYY` and ISO.
- Direction is income when the transaction type is Invoice, Deposit, Sales Receipt or Payment, or the account name contains income, revenue or sales.
- Classification is an ordered rule list. Each rule can match the normalised vendor, the account and the memo. Confidence is 0.75, 0.92 or 0.98 for one, two or three matching fields.
- Gallons come from the memo when present (`118.42 gal`). Otherwise gallons = amount / regional weekly index, flagged as estimated. Estimated gallons are never used to fit the index relationship.

## 2. Exposure

| Quantity | Formula |
| --- | --- |
| Trailing 12 months | Last 12 complete months in the ledger |
| Spend share | category spend / revenue, and / expenses |
| Volatility | standard deviation of monthly spend / mean |
| Concentration | Herfindahl index of category shares |
| Price paid | sum of fuel dollars / sum of gallons, ledger-quantity lines only |
| Cost model | dCost_t = a + b0 dIndex_t + b1 dIndex_(t-1) + e_t, OLS on monthly changes |
| Hedge ratio | b0 + b1 for the customer; 12-month slope for the wholesale leg |
| Shock sizes | 80th and 95th percentile and maximum of calendar-year average price changes, 2001 to 2025 |
| Shock impact | fuel spend x shock x un-surcharged share |
| Un-surcharged share | 1 - (revenue from customers who pay a fuel surcharge / revenue). A proxy [E], user-adjustable in the simulator |
| Materiality | fuel >= 5% of revenue and 1-in-20 impact >= 25% of operating profit |

## 3. Risk pool

Pool key = cost driver x region x cover period. Criteria and weights: driver identified (0.20, required, confidence >= 0.8), 12 months of history (0.15, required), material (0.20, required), tracks the regional index with R² >= 0.60 (0.20, required), quantities on the record (0.10), some gallons not surcharged (0.15). Member when all required criteria pass and the weighted score is at least 0.70. Sizing: contracts per month = covered gallons x hedge ratio / 42,000.

## 4. Pricing

Black-76 call: `C = e^(-rT) [F N(d1) - K N(d2)]`, `d1 = [ln(F/K) + s²T/2] / (s sqrt(T))`, `d2 = d1 - s sqrt(T)`.

Cap = strip of 12 monthly calls on wholesale ULSD. F = latest EIA NY Harbor ULSD spot (flat curve) [A]. K = F + strike offset, which equals the retail strike less the retail-to-wholesale spread. T_m = (m - 0.5)/12. Hedged gallons = covered gallons x 12-month slope. Premium = hedge cost / (1 - 0.30) [A].

## 5. Backtest

For each inception month t from 2015-01: strike = index(t) + offset; payout per gallon = mean over months t+1..t+12 of max(0, index - strike); cost change per gallon = mean of (index - index(t)). Reported: burn cost, share of cohorts paid, worst cohort, variance reduction `1 - Var(dCost - payout)/Var(dCost)`, and for "bad" cohorts (cost up more than $0.25 per gallon) the share paid and the share of the increase recovered.

## 6. Payout and scenario

`payout_m = max(0, index_m - strike) x min(purchased gallons x covered share, monthly cap)`, limited by the aggregate limit. The scenario screen applies the same formula to one month with a user-chosen price rise. Pricing, the backtest and the replay all use this linear cap.

### Stepped payout on chain

The Solana program cannot read encrypted amounts, so it cannot compute the linear payout. It pays in steps instead.

| Term | Definition |
| --- | --- |
| Strike `K` | inception monthly mean + strike offset ($0.50) |
| Step size `D` | $0.25 per gallon (default; $0.50 if transaction size limits force fewer steps) |
| Number of steps `N` | $2.00 / D, so 8 at $0.25 |
| Trigger of step `i` (1-based) | `K + i x D` |
| Amount of step `i` | `D x covered gallons` tUSD, funded in advance and encrypted |
| Step `i` pays when | attested monthly mean >= `K + i x D` |

`stepped payout_m = D x min(N, floor((index_m - K) / D)) x covered gallons`

This is the linear cap rounded down to the step, with the per-gallon limit at $2.00. Below that limit, the gap to the linear cap is under `D x covered gallons`. The payout screen shows both numbers. Example: index $0.68 above the strike on 5,000 covered gallons. Linear: $3,400. Stepped: 2 steps x $0.25 x 5,000 = $2,500. Prices are stored on chain in 1/1000 $ per gallon and periods as YYYYMM. Money is tUSD at 1 tUSD = $1.

## 7. Gemini evaluation

- Survival curve from a ladder: P(S > K) = mid of bid and ask for each "above K" contract with a two-sided quote and 0.05 <= mid <= 0.95.
- Lognormal fit: regress ln K on z = N⁻¹(1 - P). Intercept is the log median, slope s is the log standard deviation to expiry, sigma_annual = s / sqrt(days/365).
- Ladder replication of a cap: D x width contracts at each strike K_i >= K_0 pays about D per unit above K_0. D = covered gallons x (12-month slope of retail diesel on Brent in $/gal) / 42. Each ask book is walked for the needed size; shortfall is reported.
- Verdict: candidate only if index match, 12-month R² >= 0.90, tenor >= half the cover period, depth >= one pool-month per strike, and two-sided quotes. Otherwise "signal only" when quoted and related, else rejected.

## 8. Validation against the feasibility research

| Target from the research | Engine result | Test |
| --- | --- | --- |
| Diesel 1-in-5 +23%, 1-in-20 +33%, worst +52% (2022) | +23.1%, +33.2%, +52.4% (2022) | yes |
| Retail on ULSD R² 0.67, 0.83 with one lag; 0.62 and 0.35 | 0.668, 0.829; 0.616 and 0.350 | yes |
| 12-month R² and slope 0.96 | 0.959 and 0.957 | yes |
| 131 cohorts, burn about $0.112 per gallon-year | 131, $0.108 | yes |
| About 35% of cohorts paid | 33.6% national, 35.1% Midwest | yes |
| Variance reduction about 51% | 52.7% national, 51.9% Midwest | yes |
| Worst cohort about $109,000 on 121,100 gallons | about $113,000 | yes |
| Recovery in bad periods about 54% | 49.5% with this repo's bad-period definition | reported, not asserted |
| Premium $14,854 and $19,515 at 35% and 40% volatility | Reproduced with a wholesale forward of $2.46, close to the November 2025 ULSD spot of $2.52. The research did not state its forward | yes, within 3% |

**A finding the engine adds.** At the October 2026 ULSD spot of $4.95 and the volatility implied by the live Gemini Brent ladder (about 44%), the same cap costs about 4.4 times what it cost in November 2025. Buyers who arrive after a spike pay for it.
