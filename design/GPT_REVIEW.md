# Review of the GPT proposal

The GPT proposal is in `reference/gpt-proposal.md`, unedited. This file records what this design took from it, what it changed, and what it left out, with the reason. The companion file it mentions, `COSTSHIELD_DESIGN_SYSTEM.md`, was not available when this was written. If it is added to `reference/`, check it against `SPEC.md`.

Short version: the product-structure advice is good and almost all of it is adopted. The colour and library advice is optional.

## Adopted

| GPT suggestion | What this design does |
| --- | --- |
| Replace the eight-step tour with persistent navigation: Overview, Costs, Protection, Payments | Adopted as written. These are plainer words than "My Risks" and "Activity". |
| Three onboarding stages: connect, confirm what matters, review an offer | Adopted. `m2-confirm` is new because of this. |
| Pool matching happens in the background, with "Why this match?" for the curious | Adopted. No pool screen. |
| One prominent working connection, with upload, bookkeeper invite and sample business below | Adopted in `m1-connect`. |
| Do not call the QuickBooks grant read-only | Adopted, and it corrects an earlier draft of these screens. Copy is now "We only read your books and never change them". The app has to enforce that. |
| An estimate is not an offer; scheduled is not active; calculated is not received; "no offer" is not "cannot be hedged" | Adopted as the state model in `SPEC.md` section 3. The payout screen shows Calculated, Finalized, Sent, Arrived. |
| The button label matches reality (Explore an example, Request an offer, Review your offer, Accept and pay) | Adopted. |
| The owner pays the premium, the provider posts collateral, each sees its own obligation | Adopted. This was already the model in `docs/CONCEPT.md`. |
| "Payouts follow a public index; your fuel bill may differ" stays visible | Adopted, next to the price on both offer screens. |
| A provider workspace with Opportunities, Quotes, Portfolio, Collateral, Settlements, and economics shown together before committing | Adopted. `p1-provider` draws the first screen. |
| Drop cream and the serif display face | Adopted in every theme except `paper`, which is kept only to compare against main. |
| 44 to 48 px touch targets | Adopted. |

## Changed

| GPT suggestion | What this design does instead | Why |
| --- | --- | --- |
| Remove the fit score; show data completeness, index suitability and offer availability separately | No number in the main flow. Suitability is a sentence ("your fuel bill has followed the index closely"), completeness is the Observed / Estimated labels on Confirm, availability is the status chip. | Agree that "Confidence 1.00" has to go. Three separate meters is more than an owner needs. |
| Do not lead with a severe modelled loss | Lead with a sensitivity: "every 10 cents on diesel costs you $1,000 a month". | Still a dollar figure, which is what makes the product land, but checkable and not alarming. The bad-year figure stays available under the offer. |
| Quarterly contract in the example ($1,800 for Jan to Mar, 10,000 gal a month, $4.18 trigger) | Monthly sample (December, 8,000 of 10,000 gal, $4.20 trigger, $360). | Only to stay consistent with the other screens. Both are placeholders. Period length is a product decision for the engine and providers, not a design one. |
| "A plan for rising costs." as the brand headline | Used on Connect. | It is a good line. Kept. |

## Not adopted, or left open

| GPT suggestion | Position | Why |
| --- | --- | --- |
| Cobalt as the brand: white, ink, cobalt, IBM Plex Sans | Offered as a theme, not the default. | Its best argument is semantic: blue for actions leaves green meaning only "money received". Against it: the app, icon and Tailwind tokens are already green, and blue is what every finance product looks like. Colour is the cheapest thing to change later, so this is left to the team. Flip the theme buttons in the gallery. |
| Radix Primitives, IBM Carbon patterns, or Mantine as a foundation | Not now. | The app is Tailwind with a small hand-written `components/ui.tsx`. A library changes nothing a user sees. Add unstyled primitives only when a dialog, menu or combobox is needed. GPT's own text says the same about switching libraries just for appearance. |
| A new wordmark with an open "C" and bar motif | Not drawn. | A logo is a separate job and needs clearance. The mockups use a plain text wordmark. |
| IBM Plex Mono for identifiers | Fine if Cobalt is chosen. | No identifiers appear in the owner flow, so it only matters in the judge view and provider tables. |

## One thing neither proposal has solved

Whether a payout should be written back into the owner's books. It is useful, and it contradicts "we never change your books". This design leaves it out. If it comes back it should be an explicit opt-in on the receipt, with its own permission step.
