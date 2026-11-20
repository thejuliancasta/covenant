# CostShield UI/UX spec

The screens in `screens/` are the picture. This file is the rules behind them. Where the two disagree, this file wins and the screen should be fixed.

## 1. Two workspaces, one brand

| Workspace | Who | Job | Primary device |
| --- | --- | --- | --- |
| Owner app | The business owner or their bookkeeper | Connect books, confirm facts, review an offer, know when money moves | Phone and desktop equally |
| Provider workspace | Firms that quote protection and carry the payout obligation | Assess demand, quote, commit collateral, manage settlement | Desktop; phone for approvals and alerts |

"Provider", not "hedger". The owner is also hedging, so "hedger" is ambiguous.

The judge view and the lender link stay as they are. They are evidence surfaces, not part of either workspace's navigation.

## 2. Owner app

### Onboarding: three visible steps

| Step | Screen | The owner does | Rules |
| --- | --- | --- | --- |
| 1 | Connect (`m1-connect`) | Connects books | One primary route that really works. Alternatives below it: upload an export, invite your bookkeeper, explore a sample business. Never show a connection card for something that is not built. |
| 2 | Confirm what matters (`m2-confirm`) | Checks the few facts that change the offer | Ask only what the books cannot say. Label each value Observed, Estimated or Forecast. Link to the transactions behind it. |
| 3 | Review your offer (`m4-offer`, `d3-offer`) | Sees terms, adjusts cover, accepts | See section 4. |

Analysis runs between steps 1 and 2. Show real progress, then go straight to step 2. Pool matching happens in the background and is never a step.

### After onboarding: four destinations

Sidebar on desktop, bottom tab bar on a phone.

| Destination | Answers | Screens |
| --- | --- | --- |
| Overview | What needs my attention? What protection do I have? | `m5-overview`, `d1-overview` |
| Costs | What did CostShield find in my books? What needs correcting? | `m3-costs`, `d2-costs` |
| Protection | What offers, scheduled plans and active plans do I have? | `m4-offer`, `d3-offer` |
| Payments | What did I pay? What am I receiving? Where is the transfer? | `m6-payment` |

Connections and Settings are secondary, at the bottom of the sidebar or behind the avatar.

### Per-screen requirements

**Overview.** A one-line status ("You're up to date" or one concrete action). The active or scheduled plan. The next relevant date. The latest payment. Connection health only if something is wrong. One chart at most. An owner with one plan must not see a wall of equal-weight metrics.

**Costs.** Lead with the cost that has an offer, in dollars, as a sensitivity the owner can check in their head. Then every other exposure found, each with one status (section 3) and one next step. Always offer "see and correct the transactions".

**Offer.** Must answer, without scrolling on desktop: what is protected, dates and quantity, what it costs, what triggers a payout, the payout limit, who provides it, how the owner is paid. The sentence "Payouts follow a public index. Your fuel bill may differ." is always visible next to the price. Cover cannot exceed verified purchases.

**Payments.** Direction is always stated: "Premium paid", "Payout received". A payout shows how it was calculated in one line, and its stage (section 3).

## 3. States and the words for them

Use exactly these words. Do not invent synonyms per screen.

**An exposure has one status**

| Status | Meaning | Next step shown |
| --- | --- | --- |
| Offer available | A provider has quoted it | Review your offer |
| Estimate only | The model can size it, no provider quote yet | Request an offer |
| Better another way | A fixed-price plan or refinance beats a hedge | See the option |
| Needs more data | Books alone cannot size it | Answer N questions |
| No offer yet | No suitable index, out of scope, or no willing provider | None. Say which of the three it is. |

"No offer" is never shown as "cannot be hedged". Missing data, a poor index match, limited scope and no provider are four different explanations.

**A plan has one state:** Offer, Awaiting payment, Scheduled, Active, Settling, Settled, Expired.

**A payment has one stage:** Calculated, Finalized, Sent, Arrived. An onchain event proves Sent at most. Only say "received" at Arrived.

**The primary button matches the state**

| Situation | Button |
| --- | --- |
| Only a model output exists | Explore an example |
| Provider pricing is needed | Request an offer |
| A real offer exists | Review your offer |
| Final purchase | Accept and pay $… |

## 4. Who pays what

- The owner pays the premium for the agreed contract.
- The provider commits collateral against its payout obligation.
- CostShield takes a fee from the premium.

Each side sees its own obligation. The owner sees "Payout funded: in full". The provider sees premium, platform fee, net premium, maximum obligation and required collateral together, before committing (`p1-provider`). Premium is never presented as profit.

If the product only supports a wallet, say the asset, network, amount and destination at the payment step, in the owner's words. Wallet addresses and transaction hashes otherwise live in the receipt and the judge view.

## 5. Provider workspace

Navigation: **Opportunities, Quotes, Portfolio, Collateral, Settlements.**

| Destination | Main job |
| --- | --- |
| Opportunities | Evaluate demand by index, region, period, quantity and terms. A table with a detail pane. |
| Quotes | Create and track offers, expiry and allocations |
| Portfolio | Accepted obligations and concentrations |
| Collateral | Available, reserved, committed and releasable funds |
| Settlements | Calculations, payment status, exceptions |

Tables sort, filter and expand. Numbers are right-aligned with tabular figures. Phone is for approvals, expiring quotes and exceptions, and an approval on a phone still shows the full economics.

## 6. Copy rules

1. Dollars before units, units before percentages. No contract counts.
2. Sentences an owner could repeat to their spouse. "Every 10 cents on diesel costs you $1,000 a month."
3. Never "read-only" about QuickBooks. The standard accounting scope can write. Say "We only read your books and never change them", and make the app enforce it.
4. Name the provider on every plan. CostShield is the platform.
5. No pool names, cohort ids, confidence decimals or fit statistics in the main flow. Offer "Why this match?" for anyone who wants them.
6. Every simulated number is labelled as sample or simulation.
7. No crypto or trading vocabulary in the owner app.

## 7. Visual system

- Tokens are in `tokens.css`. Screens use variables only, so a theme never changes layout.
- One sans family for text, one display face for headlines and big numbers. Tabular figures on every amount.
- One emphasised card per screen (`.hero`). One primary button per screen.
- Controls are at least 44 px tall. Body text is at least 14 px, 13 px for secondary notes.
- Text contrast is at least 4.5:1, including muted labels.
- Colour is never the only signal. Chips carry words.
- Phone screens are designed first. Desktop is the same content in a wider column with a summary beside it.
- No fake status bars, no gradients, no emoji.

To adopt a theme in the app, map the variables onto `tailwind.config.ts`:

| Token | Tailwind key today | Evergreen | Cobalt |
| --- | --- | --- | --- |
| `--bg` | `paper` | `#F3F5F4` | `#F4F6FA` |
| `--ink` | `ink` | `#0F1B17` | `#111827` |
| `--muted` | `muted` | `#55635E` | `#526175` |
| `--line` | `line` | `#DDE3E0` | `#D8DEE8` |
| `--action` | `shield.DEFAULT` | `#0B5D4B` | `#2545D3` |
| `--action-soft` | `shield.soft` | `#E3F1EC` | `#E6EBFB` |
| `--warn` / `--warn-soft` | `amber` | `#8A4B08` / `#FBF0DC` | same |
| `--font-display` | `fontFamily.display` | Space Grotesk | IBM Plex Sans |

Do not add a component library to change the look. The app's own `components/ui.tsx` is enough. Reach for unstyled primitives (dialog, menu, tabs) only when a screen needs behaviour that is hard to get right by hand.

## 8. Mapping onto the app as it is on main

| Today | Becomes |
| --- | --- |
| Top step nav in `app/page.tsx` (welcome, connect, analyzing, overview, protection, simulate, payout) | Onboarding steps 1 to 3, then the four destinations |
| `Welcome` and `Connect` in `components/onboarding.tsx` | One Connect screen. The working route is the primary button. |
| `Analyzing` | Kept, between steps 1 and 2 |
| `Overview` in `components/results.tsx` ("Your risks") | Costs |
| Pool assignment section | Background. Surfaces as "Why this match?" and in judge mode. |
| `Protection` in `components/results.tsx` | Offer screen. Hedge test and backtest move to "Why this match?" and judge mode. |
| `Simulator` in `components/simulate.tsx` | The "if diesel averages…" card and slider on the offer screen. The full simulator stays reachable from it. |
| `Payout` in `components/simulate.tsx` and the settle flow | Payments, with the four stages. Chain proof behind "View receipt and proof of payment". |
| `components/judge.tsx` | Unchanged |
| `app/lender` | Unchanged, linked from the receipt |
| Nothing | New Confirm screen; new Provider workspace |

Suggested build order: tokens and type, then navigation, then Costs and Offer, then Overview and Payments, then Confirm, then the provider workspace.
