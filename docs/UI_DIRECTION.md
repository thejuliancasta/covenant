# UI direction: dark, crafted, alive

> Update, Nov 20: the theme now has a light default and an opt-in dark mode, and the accent is dark green instead of ember. The token names and roles below still apply; the colour values are in `app/globals.css`. See `docs/DECISIONS.md`.

## Revision 3 (05:00 CST): Linear-style. Overrides everything below, including Revision 2

The user found Revision 2 messy and the background art stock-like. The target is the feel of linear.app: a real startup page, precise, restrained, unique in its details.

- **Structure.** `/` is a real landing page. `/app` is the product (`components/flow.tsx`, mounted by `app/app/page.tsx`, opens at Connect). Every landing CTA leads to `/app` (the sample company: `/app?sample=1` should start the sample analysis).
- **No background art.** Remove `Strata` and the ridgelines everywhere. No full-bleed decoration. The page canvas is flat near-black.
- **Foundation (done by the lead).** Tokens in `app/globals.css`: near-black neutrals (`bg` #08090a, `raised` #0f1011, `panel` #141517, `well` #1c1d20), text ladder `ink` #f7f8f8 → `ink2` → `muted` #8a8f98 → `faint` #62666d, borders `line` at /6 to /10. Ember accent `jade`/`accent` (#f08a4b) used sparingly: primary button, focus, one highlight per view. Font: Inter (`font-sans`) with stylistic sets on; Geist Mono only for hashes and addresses.
- **Type.** Hero H1 56 to 72 px, weight 510 to 560, tracking about -0.03em, line-height 1.02, with a subtle vertical text gradient from `ink` to `ink`/70. Section H2 40 to 48 px. Body 15 to 17 px in `muted`, max 60 characters. Small labels 13 px in `ink2`. Sentence case.
- **Signature visual.** The hero is a crafted **product window**: a framed, slightly tilted (perspective, a few degrees) live rendering of the real app UI with the sample company's real numbers, a 1 px border at /8, a lighter 1 px inner top edge, a soft shadow, and a bottom fade into the page. Below the hero, each feature section has its own small live product fragment (not illustration art): ledger lines sorting into categories, exposure bars, the cap plates with the strike, an encrypted amount decoding, the lender view. All built from real data or real sample output.
- **Details that make it feel built.** Precise 8 px grid and alignment; hairline section separators made of full-width rules only where the page genuinely changes topic; hover states that brighten borders and lift by 1 px; buttons with a subtle top highlight; keyboard focus rings; numbers in `tabular-nums`; reveal-on-scroll (8 px rise and fade, 80 ms stagger, once); a sticky translucent nav with backdrop blur. Restraint: at most one moving thing in view at a time.
- **Still in force.** No pills, chips or circles around text (status is plain colored text). The new logo (`components/brand/logo.tsx`). No green. Honesty labels and evidence letters stay (as plain text). Speed over QA: `npm run build` must pass.

## Revision 2 (user feedback, 04:15 CST): these rules override anything below

1. **No green.** The accent is now **ember** (`#f08a4b`). The token is still named `jade` in code (alias `accent`) so existing classes keep working; `heat` is a lighter ember for market-driven cost; `rust` is now red for refusal. Replace any hard-coded green (`#0B5D4B`, `87 194 154`, etc.) with tokens.
2. **New logo.** Use `components/brand/logo.tsx` (`Logo`, `LogoMark`) everywhere the shield appeared. `app/icon.svg` is updated. Never draw the old shield.
3. **Never enclose text in a box, pill or circle.** No tags, badges, chips, pills, bordered evidence chips, circled step numbers, circled check marks or pill-shaped toggles. Status and evidence become plain text: color, weight, size, an optional leading short dash or small dot that carries state. Buttons may stay as buttons (radius at most 10 px, never fully rounded); secondary actions become text links with an arrow.
4. **Big graphics.** Large, custom, data-driven artwork in the background: full-bleed, behind the content, quiet enough not to fight the text, unmistakably ours. Built from the real EIA series (for example, "pressure strata": dozens of offset, smoothed copies of the diesel curve forming a terrain or contour field, with the part above the strike glowing ember and fading). Full strength on the welcome screen, quieter variants on every other screen.
5. **Elegant and clean.** Fewer cards and borders, more space, larger quiet type, one strong idea per screen. Typography and the artwork carry the hierarchy, not boxes.
6. **Speed over QA.** Only `npm run build` must pass. Skip screenshot and mobile QA.

Branch `ui-redesign`. Goal: a completely unique CostShield interface with custom graphics and micro-interactions throughout, in a dark theme, following the user's UI skill (`~/.codex/skills/user-interface-design/SKILL.md` and `visual-reference.md`; read both in full). UI only: engine, chain, API routes, scripts and tests do not change. Every number stays real.

## Brief

- **Surface.** Cool blue-slate dark. Tokens are already in `tailwind.config.ts` and `app/globals.css` (colors `bg`, `sunken`, `raised`, `panel`, `well`, text ladder `ink` → `ink2` → `muted` → `faint`, borders `line` at /10 to /14). Never pure black or white.
- **Color roles.** `jade` = action, focus, selection, protection in force. `heat` = a cost a market moves, a price above a trigger. `cipher` = encrypted or private state. `rust` = refusal, loss. Everything else is neutral. Never wash a panel in a color.
- **Type.** Geist only (drop Instrument Serif and its import). Headings weight 560 to 600, tracking about -0.04em, line-height ~1.0; body 1.5 line-height with its own max width; `tabular-nums` on every number; Geist Mono only for hashes, addresses and transaction ids. Sentence case everywhere. No eyebrows, no tracked uppercase labels, no ornamental monospace.
- **Logo.** Reuse the existing shield in `app/icon.svg` and the text "CostShield". Do not invent a mark.
- **Primary visual.** Real EIA diesel history rendered as pressure against a cap (below).

## One idea: pressure and release

Costs behave like pressure. A market-driven cost is a fluid column whose level is the real price. Protection is a cap made of stacked plates (the $0.25-per-gallon steps above the strike). When the price pushes through a plate, that plate releases and pays. Private amounts are cipher until the owner decrypts them. Every animation below encodes a real value or a real state change; none animates fake work, progress or success.

### Interaction inventory

1. **Hero (welcome).** The PADD 2 weekly diesel series from `lib/data` drawn as a filled surface with a strike line. The 2026 spike pushes through it and the overflow tints heat. Pointer scrubs a readout (week, price). Static under reduced motion.
2. **Connect.** The sample company and a CSV drop zone first; provider tiles for QuickBooks, Xero, Zoho Books and FreshBooks only when the server holds that provider's keys, otherwise one line saying sign-in is built but switched off in this demo (since Nov 20); a CSV drop zone with a living drag-over state and a file chip that slides in, and the sample company.
3. **Analysis.** A "ledger tape": each real pipeline stage event settles in with its measured duration; transaction counts tick to the real totals; once classification arrives, lines sort into category lanes sized by the real classified counts. Motion only on received events.
4. **Risk profile.** Exposure columns: fill = share of spend; a ripple amplitude encodes the month-to-month swing; market-linked costs in heat. Hover lifts the row and reveals detail. Status chips carry state.
5. **Protection.** The cap drawn as plates above the strike; the price and backtest charts restyled to the same grammar.
6. **Simulator.** A custom price-rise control (track = fuel column, thumb = plate). Numbers roll; the column rises into the plates; crossed plates light; the payout counts up.
7. **Settlement.** Step plates driven by streamed events: fund (plate seals with a cipher pattern), report (the index arrives with its sha256 chip), release (plate slides to the wallet and leaves a payout chip), refusal (one short rust shake with the error text), reclaim (plate returns to the underwriter).
8. **Two views.** A cipher amount: the public view shows slowly morphing glyphs (deterministic, paused offscreen and when the tab is hidden); the fleet view decodes left to right into digits.
9. **Lender.** Copy-link chip with a check animation; the lender page decodes only when the real API response arrives.
10. **Global.** Step navigation with a moving indicator; buttons press to 0.98; cards lift their border on hover; transaction chips copy with feedback; focus always visible.

## Motion rules

Controls 120 to 220 ms on named properties only (never `transition: all`). Springs from the `motion` package (installed): UI `{ stiffness: 380, damping: 32 }`, fluid surfaces `{ stiffness: 140, damping: 18 }`. Stagger semantic chunks 80 to 100 ms. Continuous motion pauses offscreen and when the document is hidden. Respect `prefers-reduced-motion` (final state, no motion). Interruptible and reversible.

## Hard rules from the UI skill

Full-perimeter borders or none (no left rails, bottom hairlines as structure, top accents). No decorative glows, pulses, orbiting specks, scan lines or radial glows that carry no state. Accent marks action and status only. Content sets card height; no sparse tall cards. 40 px minimum hit targets (44 on touch). Preserve approved copy and every honesty label and evidence chip (restyle, don't remove). Desktop and mobile are separate compositions sharing tokens.

## Ownership (two builders in parallel)

- **Builder A (foundation and the first journey):** `components/ui.tsx` (restyle; keep every existing export and its props stable; you may add exports), `components/fx/**` (shared helpers you create), `components/onboarding.tsx`, `components/results.tsx`, `components/charts.tsx`, `app/page.tsx`, `app/layout.tsx`.
- **Builder B (settlement journey):** `components/simulate.tsx`, `components/judge.tsx`, `components/chain.tsx`, `app/lender/**`, `components/settle/**` (your own graphics: plates, cipher amount, transaction chip, price control).
- Neither edits `lib/**`, `app/api/**`, `scripts/**`, `solana/**`, `tests/**`, `package.json`, `tailwind.config.ts` or `app/globals.css` (ask the lead to add a token).
