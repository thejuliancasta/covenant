/**
 * Generates the synthetic sample ledger for "John's Trucking LLC".
 *
 * PROVENANCE: this ledger is SYNTHETIC. No real business's records are used.
 * Fuel prices paid are built from the real EIA Midwest (PADD 2) weekly diesel
 * index plus seeded noise, so the fuel lines move with real history. Budget
 * shape (10 trucks, 90,000 miles per truck, about 121,100 gallons a year)
 * follows the ATRI-based persona in docs/MODEL.md. Everything else is an
 * assumption. The generator is deterministic (fixed seed).
 *
 * Output format mirrors a QuickBooks Online "Transaction Detail" CSV export,
 * including the report preamble rows that QuickBooks writes above the header.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import padd2 from "../lib/data/diesel_padd2_weekly.json";
import us from "../lib/data/diesel_us_weekly.json";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261119);
const gauss = () => {
  const u = Math.max(rand(), 1e-9), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const money = (x: number) => x.toFixed(2);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const mdY = (s: string) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
const addDays = (s: string, n: number) => iso(new Date(Date.parse(s + "T00:00:00Z") + n * 864e5));

const START = "2024-11-04"; // first Monday of the 24-month window
const END = "2026-10-31";
const TRUCKS = 10;
const GALLONS_PER_WEEK = 121_100 / 52;
const MILES_PER_WEEK = (TRUCKS * 90_000) / 52;
const CONTRACT_SHARE = 0.7; // share of miles billed with a fuel surcharge (assumption)
const FSC_PEG = 1.2, FSC_MPG = 6.0; // common surcharge table shape (assumption)

type Row = { date: string; type: string; num: string; name: string; memo: string; account: string; amount: number };
const rows: Row[] = [];
let n = 1000;
const add = (date: string, type: string, name: string, memo: string, account: string, amount: number) => {
  if (date < START || date > END) return;
  rows.push({ date, type, num: String(++n), name, memo, account, amount: Math.round(amount * 100) / 100 });
};

const weekly = (padd2.points as [string, number][]).filter(([d]) => d >= "2024-10-28" && d <= END);
const usIdx = new Map((us.points as [string, number][]).map(([d, v]) => [d, v]));
const NETWORK = ["Pilot Travel Centers", "Love's Travel Stops", "TA Petro Stopping Centers", "Casey's General Store"];
const OFFNET = ["Kwik Trip", "Road Ranger", "Circle K"];
const seasonal = (d: string) => 1 + 0.06 * Math.cos(((Number(d.slice(5, 7)) - 9) / 12) * 2 * Math.PI); // autumn peak

for (const [monday, price] of weekly) {
  if (monday < START) continue;
  // Fuel: about two fills per truck per week.
  const weekGallons = GALLONS_PER_WEEK * seasonal(monday) * (1 + 0.05 * gauss());
  const fills = TRUCKS * 2;
  for (let i = 0; i < fills; i++) {
    const unit = String((i % TRUCKS) + 1).padStart(2, "0");
    const gal = Math.max(40, (weekGallons / fills) * (1 + 0.18 * gauss()));
    const date = addDays(monday, Math.floor(rand() * 7));
    if (rand() < 0.86) {
      // Fuel-card fill: statement line carries gallons and unit price.
      const ppg = Math.max(1, price * (1 + 0.022 * gauss()) - 0.06);
      add(date, "Expense", `${pick(NETWORK)} #${1000 + Math.floor(rand() * 8000)}`,
        `WEX FLEET DSL ${gal.toFixed(2)} gal @ $${ppg.toFixed(3)} Unit ${unit}`, "Fuel", gal * ppg);
    } else {
      // Out-of-network fill paid by card: no quantity on the record.
      const ppg = price * (1 + 0.03 * gauss()) + 0.04;
      add(date, "Expense", pick(OFFNET), `Fuel unit ${unit}`, "Fuel", gal * ppg);
    }
  }
  // Revenue: contract customers pay linehaul plus a weekly-indexed fuel surcharge; spot loads do not.
  const miles = MILES_PER_WEEK * seasonal(monday) * (1 + 0.04 * gauss());
  const doe = usIdx.get(monday) ?? price;
  const fscPerMile = Math.max(0, doe - FSC_PEG) / FSC_MPG;
  const friday = addDays(monday, 4);
  const cMiles = miles * CONTRACT_SHARE;
  for (const [cust, w] of [["Midwest Grain Logistics", 0.6], ["Heartland Foods Distribution", 0.4]] as [string, number][]) {
    add(friday, "Invoice", cust, `Linehaul ${Math.round(cMiles * w)} mi`, "Freight Income", cMiles * w * 1.93);
    add(friday, "Invoice", cust, `Fuel surcharge ${Math.round(cMiles * w)} mi @ $${fscPerMile.toFixed(3)}`, "Fuel Surcharge Income", cMiles * w * fscPerMile);
  }
  const sMiles = miles * (1 - CONTRACT_SHARE);
  const spotRate = 2.33 + 0.55 * ((price - 3.6) / FSC_MPG) + 0.05 * gauss(); // spot rates lag fuel (assumption)
  for (const [cust, w] of [["Northline Freight Brokerage", 0.55], ["Great Lakes Load Exchange", 0.45]] as [string, number][]) {
    add(friday, "Invoice", cust, `Spot loads ${Math.round(sMiles * w)} mi all-in`, "Freight Income", sMiles * w * spotRate);
  }
  // Repairs, tires, tolls.
  const jobs = 1 + Math.floor(rand() * 3);
  for (let j = 0; j < jobs; j++) {
    const tire = rand() < 0.25;
    add(addDays(monday, Math.floor(rand() * 6)), "Expense", tire ? "Pomp's Tire Service" : pick(["Rush Truck Centers", "TA Truck Service", "Interstate Diesel Repair"]),
      tire ? "Steer and drive tires" : pick(["PM service", "Brake job", "DOT inspection and repairs", "Aftertreatment repair"]),
      "Repairs and Maintenance", tire ? 900 + rand() * 2600 : 350 + rand() * 2900);
  }
  add(addDays(monday, 2), "Expense", "Illinois Tollway I-PASS", "Fleet replenishment", "Tolls and Permits", 520 + rand() * 260);
}

// Fixed and monthly items.
for (let y = 2024; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
  const mm = String(m).padStart(2, "0"), d = (day: number) => `${y}-${mm}-${String(day).padStart(2, "0")}`;
  const raise = y === 2026 ? 1.03 : 1;
  for (const day of [5, 19]) add(d(day), "Check", "Gusto Payroll", "Driver and office payroll incl. taxes", "Payroll Expenses", 33_900 * raise * (1 + 0.015 * gauss()));
  add(d(1), "Bill", "Penske Truck Leasing", "Tractor lease, 10 units", "Equipment Lease", 24_500);
  add(d(1), "Bill", "Prairie Industrial Park LLC", "Yard and office rent", "Rent", 3_400);
  add(d(3), "Bill", "Progressive Commercial", "Auto liability and cargo", "Insurance", 14_200 * raise);
  add(d(10), "Bill", "BMO Transportation Finance", "Trailer loan interest (variable)", "Interest Expense", 2_150 + 40 * gauss());
  add(d(12), "Expense", "Samsara", "ELD and telematics", "Software and Subscriptions", 520);
  add(d(12), "Expense", "DAT Solutions", "Load board", "Software and Subscriptions", 295);
  add(d(15), "Bill", "Verizon Wireless", "Fleet phones", "Telephone", 380 + 15 * gauss());
  add(d(16), "Bill", "ComEd", "Electric service, yard", "Utilities", 410 * (1 + 0.12 * gauss()));
  const heat = [1, 2, 3, 11, 12].includes(m) ? 430 : [4, 10].includes(m) ? 210 : 95;
  add(d(18), "Bill", "Nicor Gas", "Natural gas service, shop", "Utilities", heat * (1 + 0.15 * gauss()));
  add(d(20), "Bill", "Hartley & Co CPA", "Bookkeeping", "Professional Fees", 650);
  if (m % 3 === 1) add(d(25), "Check", "Illinois Dept of Revenue", "IFTA quarterly fuel tax", "Tolls and Permits", 1_900 + 300 * gauss());
  if (m === 3) add(d(8), "Check", "IRS", "Form 2290 heavy vehicle use tax", "Tolls and Permits", 5_500);
}

rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.num) - Number(b.num)));
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const out = [
  "John's Trucking LLC",
  "Transaction Detail by Account",
  `"November 4, 2024 - October 31, 2026"`,
  "",
  "Date,Transaction Type,Num,Name,Memo/Description,Account,Amount",
  ...rows.map((r) => [mdY(r.date), r.type, r.num, q(r.name), q(r.memo), r.account, money(r.amount)].join(",")),
  "",
  `"Synthetic sample data generated for the CostShield demo. Not a real company."`,
];
mkdirSync("public/sample", { recursive: true });
writeFileSync("public/sample/johns-trucking.csv", out.join("\n") + "\n");
console.log(`wrote ${rows.length} rows`);
