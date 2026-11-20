import { ingestCsv } from "./ingest";
import { classify, CATEGORY_LABEL } from "./classify";
import { dieselExposure, financials, monthlyRelation, otherExposures, type DieselExposure, type Financials, type OtherExposure } from "./exposure";
import { REGIONS, SERIES, addMonths, monthlyMean } from "./series";
import { assignDieselPool, type PoolAssignment } from "./pool";
import { priceCap, type CapPrice } from "./pricing";
import { backtestCap, type Backtest } from "./backtest";
import { replayPolicy, type ReplayRow } from "./payout";
import {
  evaluateEventHedge, fetchBook, fetchEvents, impliedDistribution, mapEvent, replicateCap,
  type Book, type GeminiEvent, type HedgeVerdict, type ImpliedDistribution, type MarketMapping, type Replication,
} from "./gemini";
import type { IngestReport } from "./types";
import { connectionNote } from "@/lib/ledger/csv";
import { sum } from "./stats";

export const STAGES = [
  { id: "ingest", label: "Import transactions" },
  { id: "classify", label: "Normalize vendors and classify expenses" },
  { id: "financials", label: "Measure spending concentration and volatility" },
  { id: "exposure", label: "Quantify exposure to market prices" },
  { id: "pool", label: "Classify risk pools" },
  { id: "markets", label: "Evaluate hedges on live markets" },
  { id: "price", label: "Price and backtest protection" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export interface MarketRow {
  ticker: string; title: string; expiry: string | null; daysToExpiry: number | null; volume: number; index: string | null;
  mapping: MarketMapping; quoted: number; contracts: number; verdict: HedgeVerdict; implied: ImpliedDistribution | null;
}
export interface MarketsResult {
  status: "live" | "unavailable"; fetchedAt: string; error?: string; endpoint: string;
  scanned: number; rows: MarketRow[];
  crude: null | { ticker: string; title: string; index: string | null; implied: ImpliedDistribution; replication: Replication | null; books: Record<string, Book>; relation: ReturnType<typeof monthlyRelation> };
  volatility: { value: number; source: string; evidence: "V" | "A" };
}

export interface HedgeCandidate {
  name: string; venue: string; status: "viable (modelled)" | "signal only" | "rejected" | "no instrument";
  basisR2Annual: number | null; tenor: string; capacity: string; cost: string; note: string;
}

export interface SimPolicy {
  inceptionMonth: string; inceptionIndex: number; strikeOffset: number; strike: number; coveredShare: number;
  coverMonths: string[]; maxCoveredGallonsPerMonth: number; aggregateLimit: number;
  replay: ReplayRow[]; totalPayout: number; totalExtraCost: number;
  priceAtInception: CapPrice; priceToday: CapPrice; todayIndex: number; todayIndexDate: string;
  settlement: { month: string; indexMean: number; coveredGallons: number; payout: number };
}

export interface Analysis {
  company: string | null; region: string; report: IngestReport; generatedAt: string;
  lineCount: number;
  vendors: { vendor: string; category: string; label: string; rule: string; confidence: number; lines: number; total: number }[];
  sampleLines: { date: string; vendor: string; memo: string; account: string; amount: number; category: string; rule: string; confidence: number; quantity?: number; quantitySource?: string }[];
  financials: Financials; diesel: DieselExposure | null; others: OtherExposure[];
  wholesale: ReturnType<typeof monthlyRelation>;
  pool: PoolAssignment | null; markets: MarketsResult; hedges: HedgeCandidate[];
  backtest: Backtest | null; backtestNational: Backtest | null; policy: SimPolicy | null;
  eligibility: { available: false; reasons: string[] };
  provenance: { name: string; source: string; url: string; fetchedAt: string; evidence: string; note: string }[];
}

export type PipelineEvent =
  | { type: "stage"; id: StageId; status: "running" | "done" | "error"; ms?: number; detail?: string }
  | { type: "result"; analysis: Analysis }
  | { type: "error"; message: string };

const daysUntil = (iso: string | null, now: number) => (iso ? (Date.parse(iso) - now) / 864e5 : null);

/** Live Gemini scan and hedge evaluation for the diesel exposure. Never throws: failure is reported as "unavailable". */
export async function evaluateMarkets(d: DieselExposure | null, pool: PoolAssignment | null, fetcher: typeof fetch = fetch, now = Date.now()): Promise<MarketsResult> {
  const endpoint = "GET https://api.gemini.com/v1/prediction-markets/events?status=active&category={Commodities,Economics}";
  const retail = monthlyMean(SERIES.diesel_us_weekly.points);
  const brentGal = new Map([...monthlyMean(SERIES.brent_monthly.points)].map(([k, v]) => [k, v / 42] as [string, number]));
  const last = SERIES.brent_monthly.points[SERIES.brent_monthly.points.length - 1][0].slice(0, 7);
  const relation = monthlyRelation(retail, brentGal, "2015-01", last);
  const fallback = { value: 0.4, source: "Planning assumption from the feasibility research (35% to 40%).", evidence: "A" as const };
  try {
    const events = (await Promise.all(["commodities", "economics"].map((c) => fetchEvents(c, fetcher)))).flat();
    const poolNeedPerStrike = pool ? pool.sizing.fleetsPerContractMonth * pool.sizing.coveredGallonsPerMonth * (relation.slopeAnnual / 42) * 3 : 0;
    const coverDays = 365;
    // Longest-dated crude ladder with a usable implied distribution drives the detailed evaluation.
    const crudeEvents = events.filter((e) => mapEvent(e).relation === "proxy" && e.expiry)
      .map((e) => ({ e, days: daysUntil(e.expiry, now)!, dist: impliedDistribution(e.contracts, daysUntil(e.expiry, now)!) }))
      .filter((x) => x.dist).sort((a, b) => b.days - a.days);
    let crude: MarketsResult["crude"] = null;
    const depth: Record<string, number> = {};
    if (crudeEvents.length && d) {
      const { e, dist } = crudeEvents[0];
      const start = e.contracts.filter((c) => c.strike !== null && c.strike >= dist!.median).sort((a, b) => a.strike! - b.strike!)[0]?.strike ?? dist!.median;
      const legs = e.contracts.filter((c) => c.strike !== null && c.strike >= start).slice(0, 8);
      const books: Record<string, Book> = {};
      await Promise.all(legs.map(async (c) => { try { books[c.symbol] = await fetchBook(c.symbol, fetcher); } catch { /* a missing book is reported as zero depth */ } }));
      const dollarsPerUnit = (d.gallonsTtm / 12) * d.unsurchargedShare * (relation.slopeAnnual / 42);
      crude = { ticker: e.ticker, title: e.title, index: e.index, implied: dist!, replication: replicateCap(e.contracts.filter((c) => books[c.symbol]), books, dollarsPerUnit, start, dist), books, relation };
      const tops = Object.values(books).map((b) => b.asks[0]?.amount ?? 0);
      depth[e.ticker] = tops.length ? Math.min(...tops) : 0;
    }
    const rows: MarketRow[] = events.map((e) => {
      const mapping = mapEvent(e), days = daysUntil(e.expiry, now);
      const quoted = e.contracts.filter((c) => c.bid !== null && c.ask !== null).length;
      const isCrude = mapping.relation === "proxy";
      const verdict = mapping.relation === "unrelated"
        ? { verdict: "rejected" as const, checks: [], summary: "Rejected. No link to an operating cost in this ledger." }
        : evaluateEventHedge({
            relation: mapping.relation, daysToExpiry: days ?? 0, coverDays, r2Annual: mapping.factor === "diesel" && isCrude ? relation.r2Annual : null,
            nearTouchDepth: depth[e.ticker] ?? 0, poolNeed: poolNeedPerStrike, settlesOnCustomerIndex: false, hasQuotes: quoted > 0,
          });
      return { ticker: e.ticker, title: e.title, expiry: e.expiry, daysToExpiry: days, volume: e.volume, index: e.index, mapping, quoted, contracts: e.contracts.length, verdict, implied: days ? impliedDistribution(e.contracts, days) : null };
    }).sort((a, b) => Number(b.mapping.factor === "diesel") - Number(a.mapping.factor === "diesel") || Number(b.mapping.relation !== "unrelated") - Number(a.mapping.relation !== "unrelated"));
    const vol = crude && crude.implied.sigmaAnnual > 0.1 && crude.implied.sigmaAnnual < 1.5
      ? { value: crude.implied.sigmaAnnual, source: `Implied from the live Gemini ${crude.ticker} ladder (${crude.implied.nUsed} strikes, ${crude.implied.days.toFixed(0)} days to expiry). Brent, not ULSD, and a short tenor: a signal, not a quote.`, evidence: "V" as const }
      : fallback;
    return { status: "live", fetchedAt: new Date(now).toISOString(), endpoint, scanned: events.length, rows, crude, volatility: vol };
  } catch (err) {
    return { status: "unavailable", fetchedAt: new Date(now).toISOString(), endpoint, error: err instanceof Error ? err.message : String(err), scanned: 0, rows: [], crude: null, volatility: fallback };
  }
}

export interface PipelineOptions { region?: string; unsurchargedShare?: number; strikeOffset?: number; fetcher?: typeof fetch; now?: number; skipMarkets?: boolean }

export async function* runPipeline(csv: string, opts: PipelineOptions = {}): AsyncGenerator<PipelineEvent> {
  const region = opts.region && REGIONS[opts.region] ? opts.region : "PADD2";
  const strikeOffset = opts.strikeOffset ?? 0.5;
  let current: StageId = "ingest";
  const t = { at: performance.now() };
  const begin = (id: StageId): PipelineEvent => { current = id; t.at = performance.now(); return { type: "stage", id, status: "running" }; };
  const done = (detail: string): PipelineEvent => ({ type: "stage", id: current, status: "done", ms: Math.round((performance.now() - t.at) * 10) / 10, detail });
  try {
    yield begin("ingest");
    const { lines, report } = ingestCsv(csv);
    yield done(`${report.imported.toLocaleString("en-US")} transactions, ${report.dateRange![0]} to ${report.dateRange![1]}`);

    yield begin("classify");
    const regionSeries = SERIES[REGIONS[region].series];
    const classified = classify(lines, regionSeries.points);
    const expenses = classified.filter((l) => l.direction === "expense");
    const groups = new Map<string, Analysis["vendors"][number]>();
    for (const l of expenses) {
      const k = `${l.vendorNorm}|${l.category}`;
      const g = groups.get(k) ?? { vendor: l.vendorNorm || "(no name)", category: l.category, label: CATEGORY_LABEL[l.category], rule: l.rule, confidence: l.confidence, lines: 0, total: 0 };
      g.lines++; g.total += l.amount; g.confidence = Math.min(g.confidence, l.confidence);
      groups.set(k, g);
    }
    const unmatched = expenses.filter((l) => l.category === "unclassified").length;
    yield done(`${groups.size} vendors mapped to ${new Set(expenses.map((l) => l.category)).size} categories, ${unmatched} lines unclassified`);

    yield begin("financials");
    const fin = financials(classified);
    yield done(`${fin.months.length} months, top category is ${(fin.categories[0].shareOfExpenses * 100).toFixed(0)}% of spend`);

    yield begin("exposure");
    const diesel = dieselExposure(classified, fin, { region, unsurchargedShare: opts.unsurchargedShare });
    const others = otherExposures(fin);
    const retail = monthlyMean(SERIES.diesel_us_weekly.points), ulsdM = monthlyMean(SERIES.ulsd_nyh_monthly.points);
    const ulsdPts = SERIES.ulsd_nyh_monthly.points;
    const wholesale = monthlyRelation(retail, ulsdM, "2006-07", ulsdPts[ulsdPts.length - 1][0].slice(0, 7));
    yield done(diesel ? `Diesel: ${(diesel.shareOfRevenue * 100).toFixed(1)}% of revenue, R² ${Number.isNaN(diesel.fit.r2) ? "n/a" : diesel.fit.r2.toFixed(2)} to ${diesel.regionLabel}` : "No fuel exposure found");

    yield begin("pool");
    const inceptionMonth = fin.ttm[0];
    const pool = diesel ? assignDieselPool(diesel, fin, addMonths(inceptionMonth, 1), wholesale.slopeAnnual) : null;
    yield done(pool ? `${pool.poolId}: ${pool.status}, confidence ${(pool.confidence * 100).toFixed(0)}%` : "No poolable exposure");

    yield begin("markets");
    const markets: MarketsResult = opts.skipMarkets
      ? { status: "unavailable", fetchedAt: new Date().toISOString(), endpoint: "", error: "skipped", scanned: 0, rows: [], crude: null, volatility: { value: 0.4, source: "Planning assumption.", evidence: "A" } }
      : await evaluateMarkets(diesel, pool, opts.fetcher, opts.now);
    const relevant = markets.rows.filter((r) => r.mapping.relation !== "unrelated");
    yield done(markets.status === "live"
      ? `Gemini: ${markets.scanned} live events scanned, ${relevant.length} related, ${relevant.filter((r) => r.verdict.verdict === "candidate").length} pass as a hedge`
      : `Gemini unavailable (${markets.error}). Pricing falls back to an assumed volatility.`);

    yield begin("price");
    let backtest: Backtest | null = null, backtestNational: Backtest | null = null, policy: SimPolicy | null = null;
    if (diesel) {
      const bt = { from: "2015-01", to: "2025-12", strikeOffset };
      backtest = backtestCap(regionSeries.points, bt);
      backtestNational = backtestCap(SERIES.diesel_us_weekly.points, bt);
      const idxM = monthlyMean(regionSeries.points);
      const inceptionIndex = idxM.get(inceptionMonth)!;
      const coverMonths = Array.from({ length: 12 }, (_, i) => addMonths(inceptionMonth, i + 1));
      const avgCovered = (diesel.gallonsTtm / 12) * diesel.unsurchargedShare;
      const maxCoveredGallonsPerMonth = Math.round(avgCovered * 1.25);
      const aggregateLimit = Math.round((2.0 * avgCovered * 12) / 100) * 100;
      const replay = replayPolicy({
        inceptionIndex, strikeOffset, coveredShare: diesel.unsurchargedShare, maxCoveredGallons: maxCoveredGallonsPerMonth, aggregateLimit,
        rows: diesel.monthly.filter((m) => coverMonths.includes(m.month)),
      });
      const monthlyGallons = Array(12).fill(avgCovered);
      const ulsdAt = (m: string) => ulsdM.get(m) ?? ulsdPts[ulsdPts.length - 1][1];
      const todayPt = regionSeries.points[regionSeries.points.length - 1];
      // Settle the month with the highest index mean among triggered months (September 2026 in the sample).
      const peak = replay.reduce((a, b) => (b.triggered && b.index > a.index ? b : a), replay[0]);
      policy = {
        inceptionMonth, inceptionIndex, strikeOffset, strike: inceptionIndex + strikeOffset, coveredShare: diesel.unsurchargedShare, coverMonths,
        maxCoveredGallonsPerMonth, aggregateLimit, replay, totalPayout: sum(replay.map((r) => r.payout)), totalExtraCost: sum(replay.map((r) => r.extraCost)),
        priceAtInception: priceCap({ forward: ulsdAt(inceptionMonth), strikeOffset, sigma: 0.35, monthlyGallons, hedgeRatio: wholesale.slopeAnnual }),
        priceToday: priceCap({ forward: ulsdPts[ulsdPts.length - 1][1], strikeOffset, sigma: markets.volatility.value, monthlyGallons, hedgeRatio: wholesale.slopeAnnual }),
        todayIndex: todayPt[1], todayIndexDate: todayPt[0],
        settlement: { month: peak.month, indexMean: peak.index, coveredGallons: peak.coveredGallons, payout: peak.payout },
      };
    }
    yield done(backtest && policy
      ? `${backtest.n} historical cohorts: paid in ${(backtest.shareOfCohortsPaid * 100).toFixed(0)}%, average $${backtest.burnPerGallonYear.toFixed(3)} per gallon-year`
      : "Nothing to price");

    const crude = markets.crude;
    const hedges: HedgeCandidate[] = diesel ? [
      { name: "NY Harbor ULSD call options, 12 monthly expiries", venue: "NYMEX (CME)", status: "viable (modelled)", basisR2Annual: wholesale.r2Annual, tenor: "12 months, matches cover",
        capacity: `Deep. One contract is 42,000 gallons, so about ${pool?.sizing.fleetsPerContractMonth} fleets like this one per contract-month.`,
        cost: policy ? `$${policy.priceToday.hedgeCostPerGallon.toFixed(3)} per covered gallon at ${(policy.priceToday.sigma * 100).toFixed(0)}% volatility (Black-76 model)` : "n/a",
        note: "Priced with a model on EIA spot as the futures proxy. No live options feed, no orders placed." },
      crude
        ? { name: `${crude.title.replace(/\?$/, "")} (binary ladder)`, venue: "Gemini Prediction Markets", status: "signal only", basisR2Annual: crude.relation.r2Annual,
            tenor: `${crude.implied.days.toFixed(0)} days against 365`, capacity: crude.replication ? `${(crude.replication.filledShare * 100).toFixed(0)}% of one fleet-month fillable at displayed size` : "n/a",
            cost: crude.replication ? `$${crude.replication.cost.toFixed(0)} for up to $${crude.replication.maxPayout.toFixed(0)} of payout, one fleet, to expiry` : "n/a",
            note: "Brent is not diesel, the ladder expires in days, and depth covers one fleet, not a pool. Used for implied volatility only." }
        : { name: "Crude oil or diesel event contracts", venue: "Gemini Prediction Markets", status: markets.status === "live" ? "no instrument" : "rejected", basisR2Annual: null, tenor: "n/a", capacity: "n/a", cost: "n/a",
            note: markets.status === "live" ? "No quoted crude or diesel ladder is listed right now." : "Gemini market data could not be reached, so nothing was evaluated." },
    ] : [];

    const prov = (id: keyof typeof SERIES, note: string) => ({ name: SERIES[id].title, source: SERIES[id].source, url: SERIES[id].sourceUrl, fetchedAt: SERIES[id].fetchedAt, evidence: "V", note });
    const analysis: Analysis = {
      company: report.company, region, report, generatedAt: new Date().toISOString(), lineCount: classified.length,
      vendors: [...groups.values()].sort((a, b) => b.total - a.total),
      sampleLines: expenses.slice(-250).reverse().map((l) => ({ date: l.date, vendor: l.vendor, memo: l.memo, account: l.account, amount: l.amount, category: l.category, rule: l.rule, confidence: l.confidence, quantity: l.quantity, quantitySource: l.quantitySource })),
      financials: fin, diesel, others, wholesale, pool, markets, hedges, backtest, backtestNational, policy,
      eligibility: { available: false, reasons: [
        "CostShield is a simulation. It is not an offer of insurance or derivatives.",
        "No licensed insurer or surplus-lines carrier has agreed to owe these payouts.",
        "The ULSD options hedge is modelled, not executed.",
      ] },
      provenance: [
        { name: "Accounting ledger", source: report.format, url: "", fetchedAt: new Date().toISOString(), evidence: /synthetic|john's trucking/i.test(report.company ?? "") ? "A" : "V",
          note: /john's trucking/i.test(report.company ?? "") ? "Synthetic sample company. Fuel prices paid are built on the real EIA Midwest index; budgets are assumptions." : (connectionNote(report) ?? "Uploaded by the user. Processed in memory and not stored.") },
        prov(REGIONS[region].series as keyof typeof SERIES, "Trigger index, shock table and backtest."),
        prov("diesel_us_weekly", "National backtest and wholesale relationship."),
        prov("ulsd_nyh_monthly", "Wholesale hedge proxy for Black-76 pricing."),
        prov("brent_monthly", "Relationship between Brent and retail diesel, for the Gemini ladder."),
        { name: "Gemini Prediction Markets", source: "Gemini public market-data API", url: "https://api.gemini.com/v1/prediction-markets/events", fetchedAt: markets.fetchedAt, evidence: markets.status === "live" ? "V" : "A", note: markets.status === "live" ? "Live quotes and order books at analysis time." : "Unavailable at analysis time." },
      ],
    };
    yield { type: "result", analysis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "stage", id: current, status: "error", detail: message };
    yield { type: "error", message };
  }
}

export async function analyze(csv: string, opts: PipelineOptions = {}): Promise<Analysis> {
  for await (const ev of runPipeline(csv, opts)) {
    if (ev.type === "result") return ev.analysis;
    if (ev.type === "error") throw new Error(ev.message);
  }
  throw new Error("pipeline ended without a result");
}
