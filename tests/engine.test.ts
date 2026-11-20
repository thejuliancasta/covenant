import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ingestCsv, parseAmount, parseCsv, parseDate, normalizeVendor, IngestError } from "@/lib/engine/ingest";
import { classify } from "@/lib/engine/classify";
import { dieselExposure, financials, monthlyRelation } from "@/lib/engine/exposure";
import { SERIES, annualChanges, monthlyMean } from "@/lib/engine/series";
import { normCdf, normInv, ols, quantile } from "@/lib/engine/stats";
import { black76Call, priceCap } from "@/lib/engine/pricing";
import { backtestCap } from "@/lib/engine/backtest";
import { capPayout, replayPolicy, scenario } from "@/lib/engine/payout";
import { evaluateEventHedge, impliedDistribution, mapEvent, normalizeEvent, replicateCap } from "@/lib/engine/gemini";
import { analyze } from "@/lib/engine/pipeline";

const csv = readFileSync("public/sample/johns-trucking.csv", "utf8");
const fixture = JSON.parse(readFileSync("tests/fixtures/gemini-2026-11-20.json", "utf8"));
const fixtureFetch = (async (url: any) => {
  const body = fixture.responses[String(url)];
  return body ? new Response(JSON.stringify(body)) : new Response("{}", { status: 404 });
}) as typeof fetch;

describe("stats", () => {
  it("recovers known OLS coefficients", () => {
    const X = Array.from({ length: 40 }, (_, i) => [i, (i * 7) % 11]);
    const fit = ols(X, X.map(([a, b]) => 2 + 0.5 * a - 1.5 * b));
    expect(fit.beta[0]).toBeCloseTo(2, 8); expect(fit.beta[1]).toBeCloseTo(0.5, 8); expect(fit.beta[2]).toBeCloseTo(-1.5, 8); expect(fit.r2).toBeCloseTo(1, 10);
  });
  it("normal CDF and inverse agree", () => {
    expect(normCdf(1.96)).toBeCloseTo(0.975, 4);
    for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) expect(normCdf(normInv(p))).toBeCloseTo(p, 5);
  });
  it("interpolates quantiles", () => expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3));
});

describe("ingest", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b,1","c ""q"""\r\n1,2,3\n')).toEqual([["a", "b,1", 'c "q"'], ["1", "2", "3"]]);
  });
  it("parses amounts and dates in common export formats", () => {
    expect(parseAmount("$1,234.50")).toBe(1234.5); expect(parseAmount("(42.10)")).toBe(-42.1); expect(parseAmount("")).toBeNull();
    expect(parseDate("11/04/2024")).toBe("2024-11-04"); expect(parseDate("2026-9-3")).toBe("2026-09-03"); expect(parseDate("Total")).toBeNull();
  });
  it("normalises store numbers out of vendor names", () => expect(normalizeVendor("Pilot Travel Centers #4521")).toBe("PILOT TRAVEL CENTERS"));
  it("skips the QuickBooks preamble and counts unreadable rows", () => {
    const { lines, report } = ingestCsv(csv);
    expect(report.format).toMatch(/QuickBooks/); expect(report.headerRow).toBe(5); expect(lines.length).toBe(report.imported);
    expect(report.skipped.reduce((a, s) => a + s.count, 0)).toBe(1);
  });
  it("supports Debit/Credit exports", () => {
    const { lines } = ingestCsv("Date,Payee,Category,Debit,Credit\n2026-01-05,Loves #12,Fuel,300.00,\n2026-01-06,Acme Foods,,,5000.00\n");
    expect(lines.map((l) => [l.direction, l.amount])).toEqual([["expense", 300], ["income", 5000]]);
  });
  it("rejects files with no usable columns", () => {
    expect(() => ingestCsv("foo,bar\n1,2\n")).toThrow(IngestError);
    expect(() => ingestCsv("")).toThrow(IngestError);
  });
});

describe("classification and exposure on the sample ledger", () => {
  const { lines } = ingestCsv(csv);
  const cl = classify(lines, SERIES.diesel_padd2_weekly.points);
  const fin = financials(cl);
  const d = dieselExposure(cl, fin, { region: "PADD2" })!;
  it("classifies every expense line and reads gallons from fuel-card memos", () => {
    expect(fin.classifiedShare).toBe(1);
    const fuel = cl.filter((l) => l.category === "fleet_fuel");
    expect(fuel.some((l) => l.quantitySource === "ledger")).toBe(true);
    expect(fuel.some((l) => l.quantitySource === "estimated")).toBe(true);
    expect(cl.find((l) => l.vendor === "ComEd")!.category).toBe("electricity");
  });
  it("leaves unknown vendors unclassified instead of guessing", () => {
    const [x] = classify(ingestCsv("Date,Name,Account,Amount\n2026-01-05,Zorblatt Ventures,Miscellaneous,99\n").lines, []);
    expect(x.category).toBe("unclassified"); expect(x.confidence).toBe(0);
  });
  it("matches the 10-truck persona", () => {
    expect(d.gallonsTtm).toBeGreaterThan(115_000); expect(d.gallonsTtm).toBeLessThan(128_000);
    expect(fin.marginTtm).toBeGreaterThan(0); expect(fin.marginTtm).toBeLessThan(0.02);
    expect(d.material).toBe(true);
  });
  it("measures the fit to the regional index from ledger gallons only", () => {
    expect(d.fit.method).toBe("ledger-regression"); expect(d.fit.r2).toBeGreaterThan(0.9); expect(d.fit.hedgeRatio).toBeGreaterThan(0.9); expect(d.fit.hedgeRatio).toBeLessThan(1.1);
  });
  it("detects fuel surcharges and treats only the remainder as exposed", () => {
    expect(d.surcharge.detected).toBe(true); expect(d.unsurchargedShare).toBeGreaterThan(0.2); expect(d.unsurchargedShare).toBeLessThan(0.4);
  });
  it("falls back to an assumed fit when gallons are not on the record", () => {
    const stripped = cl.map((l) => (l.category === "fleet_fuel" ? { ...l, quantitySource: "estimated" as const } : l));
    expect(dieselExposure(stripped, fin, { region: "PADD2" })!.fit.method).toBe("default");
  });
});

describe("research validation targets (handoff section 7.7)", () => {
  it("diesel shock table: about +23%, +33%, worst +52% in 2022", () => {
    const ch = annualChanges(SERIES.diesel_us_weekly.points, 2001, 2025);
    expect(quantile(ch.map((c) => c.change), 0.8)).toBeCloseTo(0.23, 1);
    expect(quantile(ch.map((c) => c.change), 0.95)).toBeCloseTo(0.33, 1);
    const worst = ch.reduce((a, b) => (b.change > a.change ? b : a));
    expect(worst.year).toBe(2022); expect(worst.change).toBeCloseTo(0.52, 1);
  });
  it("retail diesel on ULSD: R² about 0.67, about 0.83 with one lag, coefficients about 0.62 and 0.35", () => {
    const r = monthlyRelation(monthlyMean(SERIES.diesel_us_weekly.points), monthlyMean(SERIES.ulsd_nyh_monthly.points), "2006-07", "2026-10");
    expect(r.r2NoLag).toBeCloseTo(0.67, 2); expect(r.r2Lag).toBeCloseTo(0.83, 2); expect(r.b0).toBeCloseTo(0.62, 2); expect(r.b1).toBeCloseTo(0.35, 2); expect(r.r2Annual).toBeCloseTo(0.96, 2);
  });
  it("diesel cap backtest: 131 cohorts, burn near $0.112, about 35% paid, about 51% variance removed", () => {
    const b = backtestCap(SERIES.diesel_us_weekly.points, { from: "2015-01", to: "2025-12", strikeOffset: 0.5 });
    expect(b.n).toBe(131);
    expect(b.burnPerGallonYear).toBeGreaterThan(0.1); expect(b.burnPerGallonYear).toBeLessThan(0.12);
    expect(b.shareOfCohortsPaid).toBeGreaterThan(0.3); expect(b.shareOfCohortsPaid).toBeLessThan(0.4);
    expect(b.varianceReduction).toBeGreaterThan(0.48); expect(b.varianceReduction).toBeLessThan(0.56);
    expect(b.worstPayoutPerGallon * 121_100).toBeGreaterThan(100_000);
  });
  it("fleet premium: about $14,854 at 35% and $19,515 at 40% volatility with ULSD near $2.46", () => {
    const p = (sigma: number) => priceCap({ forward: 2.46, strikeOffset: 0.5, sigma, monthlyGallons: Array(12).fill(121_100 / 12), hedgeRatio: 1 }).premium;
    expect(Math.abs(p(0.35) - 14_854) / 14_854).toBeLessThan(0.03);
    expect(Math.abs(p(0.4) - 19_515) / 19_515).toBeLessThan(0.03);
  });
});

describe("pricing and payouts", () => {
  it("Black-76 matches a reference value and its limits", () => {
    expect(black76Call(100, 100, 1, 0.2)).toBeCloseTo(7.9656, 3);
    expect(black76Call(5, 4, 0, 0.4)).toBe(1); expect(black76Call(3, 9, 0.5, 0.3)).toBeLessThan(1e-4);
  });
  it("cap payout is linear above the strike and zero below", () => {
    expect(capPayout(4.0, 4.36, 3000)).toBe(0); expect(capPayout(6.36, 4.36, 3000)).toBeCloseTo(6000, 6);
  });
  it("scenario arithmetic is exact", () => {
    const s = scenario({ gallonsPerMonth: 10_000, coveredShare: 1, priceRise: 0.6, strikeOffset: 0.12, premiumPerMonth: 400, basisStd: 0.06 });
    expect(s.extraCost).toBeCloseTo(6000, 6); expect(s.payout).toBeCloseTo(4800, 6); expect(s.unhedged).toBeCloseTo(1200, 6); expect(s.offsetShare).toBeCloseTo(0.8, 6); expect(s.net).toBeCloseTo(-1600, 6);
  });
  it("replay respects quantity and aggregate limits", () => {
    const rows = [1, 2, 3].map((i) => ({ month: `2026-0${i}`, gallons: 10_000, pricePaid: null, index: 6 }));
    const r = replayPolicy({ inceptionIndex: 4, strikeOffset: 0.5, coveredShare: 0.5, rows, maxCoveredGallons: 4000, aggregateLimit: 15_000 });
    expect(r.map((x) => x.payout)).toEqual([6000, 6000, 3000]);
  });
});

describe("Gemini evaluation on a recorded fixture", () => {
  const events = Object.entries(fixture.responses).filter(([u]) => u.includes("/events")).flatMap(([, j]: any) => j.data.map(normalizeEvent));
  const brent = events.find((e: any) => e.ticker === "BRENT2611302200")!;
  it("maps events to cost drivers", () => {
    expect(mapEvent(brent)).toMatchObject({ factor: "diesel", relation: "proxy" });
    expect(mapEvent(events.find((e: any) => e.ticker.startsWith("NGAS"))!).factor).toBe("natural_gas");
    expect(mapEvent(events.find((e: any) => e.ticker.startsWith("XAU"))!).relation).toBe("unrelated");
  });
  it("recovers a known lognormal from a synthetic ladder", () => {
    const s = 0.08, mu = Math.log(90);
    const ladder = [80, 84, 88, 92, 96, 100].map((k) => { const p = 1 - normCdf((Math.log(k) - mu) / s); return { symbol: `K${k}`, label: "", strike: k, strikeType: "above", bid: p - 0.01, ask: p + 0.01, last: null }; });
    const d = impliedDistribution(ladder, 10)!;
    expect(d.median).toBeCloseTo(90, 0); expect(d.sigmaPeriod).toBeCloseTo(s, 2); expect(d.sigmaAnnual).toBeCloseTo(s / Math.sqrt(10 / 365), 1);
  });
  it("reads a plausible implied volatility from the live Brent ladder", () => {
    const d = impliedDistribution(brent.contracts, 10.7)!;
    expect(d.nUsed).toBeGreaterThanOrEqual(5); expect(d.fitR2).toBeGreaterThan(0.95); expect(d.sigmaAnnual).toBeGreaterThan(0.2); expect(d.sigmaAnnual).toBeLessThan(0.8);
  });
  it("walks the book and reports shortfall as unhedgeable", () => {
    const books = Object.fromEntries(brent.contracts.map((c: any) => [c.symbol, { bids: [], asks: [{ price: c.ask ?? 0.5, amount: 100 }] }]));
    const r = replicateCap(brent.contracts, books, 100, 93, null)!;
    expect(r.legs[0].contracts).toBe(300); expect(r.legs[0].filled).toBe(100); expect(r.legs[0].shortfall).toBe(200); expect(r.filledShare).toBeCloseTo(1 / 3, 6);
  });
  it("rejects a short-dated proxy as a hedge but keeps it as a signal", () => {
    const v = evaluateEventHedge({ relation: "proxy", daysToExpiry: 11, coverDays: 365, r2Annual: 0.77, nearTouchDepth: 250, poolNeed: 4000, settlesOnCustomerIndex: false, hasQuotes: true });
    expect(v.verdict).toBe("signal only"); expect(v.checks.filter((c) => !c.pass).length).toBe(4);
    expect(evaluateEventHedge({ relation: "benchmark", daysToExpiry: 300, coverDays: 365, r2Annual: 0.95, nearTouchDepth: 9000, poolNeed: 4000, settlesOnCustomerIndex: true, hasQuotes: true }).verdict).toBe("candidate");
  });
});

describe("pipeline end to end", () => {
  it("produces a pool, a policy replay and a settlement from the sample ledger", async () => {
    const a = await analyze(csv, { fetcher: fixtureFetch, now: Date.parse(fixture.recordedAt) });
    expect(a.pool!.status).toBe("member"); expect(a.pool!.poolId).toBe("DIESEL-PADD2-2025-12-12M");
    expect(a.markets.status).toBe("live"); expect(a.markets.volatility.evidence).toBe("V");
    expect(a.markets.rows.filter((r) => r.verdict.verdict === "candidate").length).toBe(0);
    expect(a.policy!.settlement.month).toBe("2026-09"); expect(a.policy!.settlement.payout).toBeGreaterThan(4000);
    expect(a.policy!.totalPayout).toBeLessThanOrEqual(a.policy!.aggregateLimit);
    expect(a.eligibility.available).toBe(false);
  });
  it("degrades honestly when Gemini is unreachable", async () => {
    const a = await analyze(csv, { fetcher: (async () => new Response("nope", { status: 503 })) as typeof fetch });
    expect(a.markets.status).toBe("unavailable"); expect(a.markets.volatility.evidence).toBe("A"); expect(a.policy).not.toBeNull();
  });
  it("reports a clear error for a bad file", async () => {
    await expect(analyze("not,a,ledger\n1,2,3\n")).rejects.toThrow(/header row/);
  });
});
