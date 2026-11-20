# Plain-language pass: understood in 10 seconds by a judge outside insurance or trading

User feedback (05:30 CST): the protection chart is confusing; the app feels generic; it must tie to the hackathon and use wording, UI and display that a non-industry judge understands immediately.

## Update (05:40 CST): no Judge mode, one working app, subtle backdrop

- **Remove Judge mode entirely**: the toggle, the judge view, the "For judges" link, and every mention or link to it. Covenant is one live, working app for everyone. Technical detail that matters to users stays inline and plain (for example, a transaction link at the payout); the rest lives in the README and docs.
- **One example, no wallet needed**: the sample company stays as the single example. Settlement runs on the server's devnet test wallets, so a visitor never needs devnet SOL or a wallet. Say this plainly where the payout happens ("No wallet needed: this demo pays from test wallets on Solana devnet").
- **Subtle backdrop**: one quiet, brand-derived background graphic shared by the landing page and the app, `components/fx/backdrop.tsx` (export `Backdrop`, props `{ variant?: "landing" | "app" }`). It echoes the Stepped C logo: a few long horizontal hairlines that step down and fade, anchored to the top-right of the canvas, plus a very soft top light. At most about 5% opacity, static, never behind body text at full strength, invisible to screen readers. It should make the canvas feel finished, not decorated.

## The test

Every screen must pass this: a judge who has never heard of hedging looks for 10 seconds and can say what the business's problem is, what Covenant does about it, and what happened. One headline sentence with real numbers, one simple visual, one action. Technical detail stays out of the main flow (README and docs keep the precise terms).

## Words: use the right column on every main screen and the landing page

| Do not show (main screens) | Show instead |
| --- | --- |
| strike, strike price | the price where protection starts, "protection starts at $4.36" |
| plates, ladder, chunks | (hide; if needed: "paid in 25-cent steps") |
| index, EIA index, PADD 2 | the official Midwest diesel price (U.S. government data) |
| cap, call strip, Black-76 | protection, the price of protection |
| premium | what protection costs, per month |
| payout | money back, "Covenant paid you $2,602" |
| hedge, hedgeable | protect, can be protected |
| basis, basis risk | "your pump price can differ from the official price" |
| 1-in-20 year | a bad year (the kind that comes about once every 20 years) |
| cohorts, backtest | tested on every year since 2015 |
| exposure, materiality | how much a price you don't control can hurt you |
| collateral, reserve, vault | money set aside in advance to pay you |
| underwriter, specialist | the backer (who puts up the money) |
| oracle attests, report index | the official price is posted on the blockchain |
| reclaim | unused money goes back to the backer |
| tUSD | test dollars |
| evidence V / C / E / A | keep the letters, but each tooltip in plain words |

## One chart for prices: "price vs. where protection starts"

Replace the plates chart (Protection screen), the simulator and replay charts, and the landing cap fragment with one shared component, `components/fx/price-vs-trigger.tsx`:

```ts
export interface PriceMonth { label: string; price: number; payout: number } // label e.g. "Apr '26"; price $/gal; payout $
export function PriceVsTrigger(props: {
  months: PriceMonth[];
  trigger: number;            // $/gal where protection starts
  selected?: number;          // index of the highlighted month (controlled), optional
  onSelect?: (i: number) => void;
  height?: number;            // default 260
  compact?: boolean;          // landing fragment: fewer labels
}): JSX.Element;
```

Visual: one bar per month for the price (neutral), a single dashed line labeled "Protection starts at $4.36", the part of each bar above the line in ember. Bars carry no dollar labels (changed Nov 20: the labels crowded the chart on a phone); the selected month's payout is the one readout under the chart, and the line's price is named on the axis and in the legend so it never covers a bar. Month labels are spaced so each stays readable. Two y-axis ticks at most. A plain legend: "Diesel price that month" and "The part Covenant pays back". Hover, tap or arrow keys select a month and show one sentence under the chart, for example: "April 2026: diesel averaged $5.25 a gallon, 89¢ above where protection starts. Your fuel bill rose $X; Covenant paid you $2,602." Nothing else on the chart.

## Tie it to the hackathon

- **Landing page:** add a "Built for UBC 2026" section with three plain lines and where to see each in the app:
  - DeFi and Onchain Applications: "Small businesses get the price protection big companies use, with the money locked in advance so the payout can't fail."
  - Best use of Solana: "A Solana program holds the backer's money and pays the business automatically when the official price crosses the line. Helius Privacy Rings keeps the amounts private, and the business can prove its cover to a lender with a read-only key."
  - Gemini Prediction Markets: "Covenant reads live Gemini markets to estimate how likely a price jump is, and says plainly when no market fits."
- **Hero:** lead with the problem in one line a judge feels: a 10-truck fleet earning about $6,800 a year loses $56,000 in a bad diesel year. Then what Covenant does: it finds that risk in the books and pays the business back automatically, privately, on Solana.
- **A three-step story with the sample fleet's real numbers:** books → risk → money back (e.g. "$581K a year on diesel" → "a bad year costs 8× their profit" → "protection paid $25,952 through October 2026").
- **App:** at the payout screen, one sentence on what is real onchain ("This payout is a real Solana devnet transaction; the amount is encrypted for everyone except the business").

## Rules still in force

Linear-style look, ember accent used sparingly, no pills or circles around text, no green, every number real (from the engine, lib/data, or the settlement result), honesty labels kept. Only `npm run build` must pass.
