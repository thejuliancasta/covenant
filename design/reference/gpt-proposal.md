

I’d give CostShield one clear brand and two distinct workspaces: a simple app for business owners, and a more detailed workspace for the firms providing protection. My recommendation is the Cobalt direction shown above—white, ink, cobalt, and IBM Plex Sans.

The bigger improvement is the product structure. An owner should connect their books, confirm a few facts, review an actual offer, and know when money is moving. The provider needs to assess exposure, quote terms, commit capital, and manage settlement.

I’ve created three visual directions and a detailed handoff you can give Claude:

It includes the brand tokens, typography, both workspaces, desktop and mobile behavior, screen requirements, and instructions for adapting the existing application. The images are visual concepts; their figures are illustrative, and the written brief specifies the intended behavior.

1. What I would change in Claude’s design
I reviewed your design notes and PDF mockup. The notes explicitly preserve the cream background, Instrument Serif headings and large numbers, and muted green/amber palette. That explains the visual character you’re reacting to.

Here are the changes that matter most:

Current design	My recommendation
Cream, serif headlines, large serif financial figures	Crisp surfaces, one strong sans-serif family, aligned financial numbers
Eight steps: Connect → Analyze → Risks → Pool → Protection → Simulate → Payout → Onchain record	Persistent customer navigation: Overview, Costs, Protection, Payments
A required page explaining pool membership	CostShield matches the business automatically; the owner reviews relevant facts and terms
“Confidence 1.00” and a prominent statistical fit score	Separate data completeness, index suitability, and offer availability
First impression dominated by a severe modeled loss	Lead with the business’s important costs and the next useful action
Several connection cards, including unavailable integrations	One prominent working connection, with upload and bookkeeper alternatives
Long mobile screens containing most of the desktop explanation	A concise first screen, accessible details, and a clear action
The current structure follows the engine’s processing sequence. I would reorganize it around the decisions each person needs to make.

The PDF is sufficient to review that hierarchy and visual style. Actual responsive behavior, keyboard navigation, and screen-reader support still need to be checked in the running app.

2. Which design system should you use?
I would separate the visual identity from the component foundation and the interaction patterns.

My preferred combination
Layer	Recommendation	How it helps CostShield
Brand	CostShield’s own typography, colors, spacing, voice, and graphic mark	Gives the product a recognizable identity
Component behavior	Radix Primitives, if it fits the existing React stack	Provides customizable foundations for menus, dialogs, tabs, and disclosures
Provider interface patterns	IBM Carbon	Useful guidance for tables, filtering, sorting, expandable rows, and professional workflows
Owner financial experience	Mercury	Inspiration for readable financial summaries that lead back to underlying transactions
Mobile task design	Ramp	Inspiration for reviewing a decision and taking action with the relevant information together
Radix Primitives is deliberately unstyled, so it gives you control over the appearance while handling substantial interaction and accessibility behavior. It is a foundation for your design system, rather than a finished CostShield look. 

Carbon’s table patterns are particularly relevant to the provider side: sorting, expansion, filtering, and row actions are established parts of its documented approach. 

If you want a more complete component suite for a fresh build, Mantine is my alternative. Its theme centralizes fonts, colors, spacing, and corner radii. I would choose a foundation after inspecting what the app already uses; changing libraries solely to change the appearance adds unnecessary work. 

What to borrow from successful financial products
From Mercury: the ability to start with a financial summary and inspect the transactions behind it. Mercury’s Insights documentation describes category-level analysis, underlying transaction views, and correcting suggested classifications. For CostShield, that becomes: “Here is your diesel exposure; here are the purchases behind it; correct anything we misunderstood.” 

From Ramp: mobile screens organized around useful actions. Ramp presents bill and request review with the information needed to approve them. For CostShield, the equivalent is reviewing a protection offer, fixing a missing fact, or checking a payment while away from the desk. 

Those are the patterns I would adapt. CostShield should have its own identity and financial language.

3. The branding direction
The three boards above explore different personalities using the same underlying product structure.

Direction	Character	My assessment
A — Cobalt	White, cool grey, ink, cobalt; calm and precise	My recommendation. Works across fleets, bakeries, hospitality, and other business categories
B — Signal	White, graphite, saturated orange; sturdy and practical	Strong alternative if you want the brand to feel closer to operators, logistics, and physical businesses
C — Current	White, graphite, electric citron, dark teal; more expressive	More visually distinctive, but needs restraint to keep the financial information dominant
Typography
For Cobalt, I would specify:

IBM Plex Sans for headings, body text, buttons, and financial amounts.
IBM Plex Mono only for identifiers and technical details.
Weights 400, 500, and 600.
Tabular numerals in financial comparisons and tables.
IBM describes Plex as designed for UI environments and distributes the family under the Open Font License. 

This gives you some character without requiring a decorative display font throughout the application.

Core colors
Purpose	Color
Main surface	#FFFFFF
Secondary surface	#F4F6FA
Main text	#111827
Supporting text	#526175
Primary action	#2545D3
Subtle divider	#D8DEE8
Successful state	#167349
Error	#B42318
Use cobalt to direct attention toward actions and selection. Use green for a confirmed successful state. Most of the application should remain neutral and readable.

Brand expression
I would keep CostShield for now and explore a clean wordmark with a simple open “C” and horizontal-bar motif. That motif can recur in selected navigation, section dividers, and graphic treatments. It is a design exploration, so the final mark still needs refinement and clearance.

The headline I would use is:

A plan for rising costs.

Supporting copy:

Understand your exposure, review protection, and track your payments.

That communicates the product’s purpose without promising that every cost can be eliminated or capped.

4. The customer experience should require very few decisions
For an owner, the main experience should be:

Connect your books → confirm what matters → review available protection.

Those are the three visible onboarding stages. After onboarding, they use the ordinary app.

Stage 1: Connect your books
For an owner who already uses QuickBooks, a working Connect QuickBooks button should be the primary route.

Below it:

Upload an export
Invite your bookkeeper
Explore a sample business
This is where I would adjust Claude’s framing: CSV is an easy initial engineering route. A working accounting connection creates a lower-effort recurring experience for the owner. Your intended product should be designed around that connection.

If QuickBooks is not implemented yet, the live product should honestly offer upload as the working route. The prototype can separately show the intended connection experience.

The connection screen needs a brief explanation of what you use the data for, what happens next, and what connecting does—and does not—authorize.

One specific correction to Claude’s proposed wording: the standard QuickBooks Accounting permission is broad, and the API supports writing records. A promise that CostShield does not change the books must be enforced by your application; it should not be presented as a technically read-only OAuth grant. 

Stage 2: Confirm what matters
CostShield should infer as much as it reasonably can and ask about consequential gaps.

For a trucking business, that could mean:

We found diesel purchases in your books.
Please confirm your expected fuel use and how much of a price increase you pass on to customers.

The owner may need to confirm:

Expected usage.
Where the fuel is purchased or priced.
Customer surcharges.
Existing fixed-price arrangements.
They should also be able to inspect and correct the transactions you classified.

Do not assume that an accounting connection always gives you usable gallons in the memo. The interface should distinguish observed quantities, estimates, and forecasts. If a missing quantity changes the offer materially, ask for it.

The risk pool should happen in the background
The owner should not need to decide whether they belong in “Gulf Coast diesel cohort 4.”

CostShield can match the exposure using the relevant index, region, currency, period, quantity, and contract terms. The customer-facing explanation can be:

“Your fuel costs appear suitable for protection linked to this regional diesel index.”

Then provide Why this match? for someone who wants the explanation.

That preserves transparency without turning the owner into a risk analyst.

Stage 3: Review an actual offer
The screen should answer:

What am I protecting?
What dates and quantity apply?
What will it cost me?
What determines a payout?
What is the payout limit?
Who provides it, and how will I receive money?
Use an ordinary financial summary. A scenario example can explain the payout beneath it.

Crucially, the button must reflect reality:

Situation	Appropriate action
An illustrative model exists	Explore an example
You need provider pricing	Request an offer
A real offer is available	Review your offer
The owner is making the final purchase	Accept and pay $…
If your matching process produces one clearing offer, show one offer. Comparisons should appear when there are genuine alternatives.

5. The customer pays the premium; the provider supplies collateral
This is the most important product correction to the pasted flow.

“Connect your books, then deposit USDC” is too vague. It fails to explain what the customer is purchasing and can blur the two sides’ financial responsibilities.

For the model we have been discussing:

The business owner pays the premium for the agreed contract.
The provider commits collateral against its payout obligation.
CostShield shows each party its own obligation clearly.
If normal bank payment and payout rails are implemented, present those in familiar business terms. If the product currently supports only a wallet, explain the supported asset, network, amount, and destination at the relevant payment step.

The brand can be simple while the financial consequences remain explicit.

An illustrative offer
The concept boards use the following example to demonstrate hierarchy—not to replace your engine’s pricing:

Term	Example
Period	January–March 2027
Covered quantity	10,000 gallons per month
Total premium	$1,800 for the quarter
Index trigger	$4.18 per gallon
Monthly maximum payout	$11,400
Three-month maximum payout	$34,200
The detailed review also needs the exact index, observation rules, limits, provider, and payment method.

A plain-language explanation should remain visible:

“Payouts follow a public index; your fuel bill may differ.”

That helps the owner understand why protection can offset costs without exactly reimbursing every invoice.

6. What the owner sees after onboarding
I would use four destinations on desktop and in mobile bottom navigation:

Destination	What it answers
Overview	What needs my attention? What protection do I have?
Costs	What did CostShield find in my books? What needs correction?
Protection	What offers, scheduled contracts, and active plans do I have?
Payments	What did I pay? What am I receiving? Where is the transfer?
Desktop Overview
The page should primarily contain:

A short status: “You’re up to date” or one concrete action.
The active or scheduled protection plan.
The next relevant date.
A recent payment or payout.
Accounting connection health, if something needs attention.
An owner with one diesel contract should not face a dashboard with twelve equally prominent metrics.

Mobile Overview
The first viewport should show the plan’s status and the most useful next action. Details can open below or on a dedicated page.

Mobile is especially useful for:

Reviewing an offer.
Approving a purchase.
Correcting a missing fact.
Checking a payout.
Reconnecting an account.
Getting help.
Use large, comfortable controls and readable body text. I would make 44–48 px touch targets a CostShield design standard. That is more generous than WCAG 2.2’s general 24 px minimum target rule, which includes exceptions and spacing provisions. 

7. The provider side needs a proper working environment
I would call this Provider workspace. “Hedger” is ambiguous because the business owner is also hedging its costs.

I’m assuming this side is for firms that quote protection and take the payout obligation. A partner that only executes hedges would have a different set of responsibilities.

Provider navigation
Destination	Main job
Opportunities	Evaluate demand by index, region, period, quantity, and terms
Quotes	Create and track offers, expiry, and allocations
Portfolio	Understand accepted obligations and concentrations
Collateral	See available, reserved, committed, and releasable funds
Settlements	Review calculations, payment status, and exceptions
Main desktop screen: Opportunities
This should be a useful table with a detail pane.

The table shows the key terms needed to identify an opportunity. Selecting a row opens:

Exact index and settlement period.
Requested quantity.
Contract trigger and limits.
Relevant data quality and exposure assumptions.
Quote controls.
The capital consequence of the proposed quote.
The provider can work quickly because the information is organized consistently.

Quote review must show the economics together
For the illustrative example:

Item	Amount
Customer premium	$1,800
Platform fee	$216
Provider premium before its own costs and payouts	$1,584
Maximum payout obligation	$34,200
Required collateral in this fully funded example	$34,200
The provider should see these numbers together before submitting or funding a commitment.

Avoid presenting premium income as guaranteed profit. The provider needs to understand the obligation it is accepting, its funding requirements, and when capital can actually be released.

Provider mobile
I would make this an approval and monitoring experience:

A quote is approaching expiry.
A funding action needs attention.
A settlement has an exception.
A permitted approval is waiting.
A position needs inspection.
Complex comparison and bulk quoting can remain primarily desktop tasks. Mobile approval still needs the complete economic review before someone commits capital.

8. Make the ordinary experience quiet and the important states unmistakable
Simplicity comes partly from showing the right information at the right time.

Four distinctions are essential:

An estimate is different from an offer
Your pricing engine can produce a useful estimate before a provider is willing to transact. Label the state clearly and provide the corresponding action.

A scheduled contract is different from an active one
An accepted contract with a future start date should say Scheduled. A contract awaiting required funding or acceptance should explain what remains incomplete.

A calculated payout is different from money received
A receipt should distinguish calculation, finalization, transfer, and arrival where those stages apply. An onchain event does not establish that a bank deposit arrived.

Also label money direction clearly: Premium paid and Payout received.

“No offer available” is different from “this cannot be hedged”
Missing data, a poor index match, limited product scope, and a lack of willing providers are different situations. Each should have a useful explanation and next step.

Those distinctions let you keep the main screens short without misleading either side.

What I would ask Claude to design next
Give Claude the 
complete design handoff
 and have it apply Cobalt to three representative screens first:

Owner desktop Overview — proves the brand and information hierarchy.
Owner mobile offer review — proves that the decision is easy to understand on a phone.
Provider desktop quote review — proves that the same system supports precise professional work.
The handoff includes the instructions for that pass. Once those three screens work together, extend the system through connection, cost confirmation, payments, and the provider lifecycle.


COSTSHIELD_DESIGN_SYSTEM.md
Document

COSTSHIELD_DESIGN_SYSTEM.md