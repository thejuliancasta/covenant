import { describe, expect, it } from "vitest";
import { ingestCsv } from "@/lib/engine/ingest";
import { toLedgerCsv } from "@/lib/ledger/csv";
import { freshbooksLines } from "@/lib/ledger/freshbooks";
import { quickbooksLines } from "@/lib/ledger/quickbooks";
import { issueState, readState } from "@/lib/ledger/state";
import { xeroDate, xeroLines } from "@/lib/ledger/xero";
import { pullLedger } from "@/lib/ledger/pull";
import { zohoLines } from "@/lib/ledger/zoho";

describe("connected ledgers", () => {
  it("turns provider lines into the same ledger the CSV importer already reads", () => {
    const csv = toLedgerCsv("Acme Freight", "Xero connection", [
      { date: "2026-01-05", type: "Expense", vendor: "Pilot #12", memo: "118.42 gal", account: "Fuel", amount: 451.2 },
      { date: "2026-01-06", type: "Invoice", vendor: "Acme Foods", memo: "Load 100", account: "Freight Income", amount: 5000 },
    ]);
    const { lines, report } = ingestCsv(csv);
    expect(report.format).toBe("Xero connection");
    expect(report.company).toBe("Acme Freight");
    expect(lines.map((l) => [l.direction, l.vendor, l.amount])).toEqual([
      ["expense", "Pilot #12", 451.2],
      ["income", "Acme Foods", 5000],
    ]);
  });

  it("reads a QuickBooks transaction list, including rows nested in a section", () => {
    const lines = quickbooksLines({
      Columns: { Column: ["tx_date", "txn_type", "name", "memo", "account_name", "subt_nat_amount"].map((key) => ({ MetaData: [{ Name: "ColKey", Value: key }] })) },
      Rows: { Row: [
        { type: "Section", Rows: { Row: [{ ColData: [{ value: "2026-02-01" }, { value: "Expense" }, { value: "Love's" }, { value: "80 gal" }, { value: "Fuel" }, { value: "320.00" }] }] } },
        { ColData: [{ value: "" }, { value: "Total" }, { value: "" }, { value: "" }, { value: "" }, { value: "320.00" }] },
      ] },
    });
    expect(lines).toEqual([{ date: "2026-02-01", type: "Expense", vendor: "Love's", memo: "80 gal", account: "Fuel", amount: 320 }]);
  });

  it("reads a QuickBooks row addressed by column type, including a parenthetical credit", () => {
    const lines = quickbooksLines({
      Columns: { Column: [{ ColType: "Date" }, { ColType: "Transaction Type" }, { ColType: "Name" }, { ColType: "Memo/Description" }, { ColType: "Account" }, { ColType: "Amount" }] },
      Rows: { Row: { ColData: [{ value: "2026-02-02" }, { value: "Expense" }, { value: "Pilot" }, { value: "refund" }, { value: "Fuel" }, { value: "($18.50)" }] } },
    });
    expect(lines).toEqual([{ date: "2026-02-02", type: "Expense", vendor: "Pilot", memo: "refund", account: "Fuel", amount: -18.5 }]);
  });

  it("maps Xero bills, receipts and posted journals, and skips a voided bill", () => {
    expect(xeroDate("/Date(1735689600000+0000)/")).toBe("2025-01-01");
    const lines = xeroLines(
      [{ Code: "400", Name: "Fuel" }, { AccountID: "sales", Name: "Freight Income" }],
      [{ Type: "ACCPAY", Status: "AUTHORISED", Date: "2026-03-01T00:00:00", Contact: { Name: "Pilot" }, LineItems: [{ Description: "90 gal", AccountCode: "400", LineAmount: 400 }] },
       { Type: "ACCPAY", Status: "VOIDED", Date: "2026-03-02", Contact: { Name: "Gone" }, LineItems: [{ LineAmount: 10, AccountCode: "400" }] }],
      [{ Type: "RECEIVE", Date: "2026-03-04", Contact: { Name: "Shipper" }, Reference: "Load", LineItems: [{ Description: "", AccountID: "sales", LineAmount: 2000 }] }],
      [{ Status: "POSTED", Date: "2026-03-05", Narration: "Accrual", JournalLines: [{ Description: "Fuel accrual", AccountCode: "400", LineAmount: 50 }] },
       { Status: "DRAFT", Date: "2026-03-06", JournalLines: [{ AccountCode: "400", LineAmount: 9 }] }],
    );
    expect(lines.map((l) => [l.type, l.account, l.amount])).toEqual([
      ["Bill", "Fuel", 400],
      ["Deposit", "Freight Income", 2000],
      ["Journal Entry", "Fuel", 50],
    ]);
  });

  it("drops the bank side of a Xero journal and treats a revenue credit as income", () => {
    const lines = xeroLines(
      [{ Code: "090", Name: "Checking", Type: "BANK" }, { Code: "200", Name: "Freight Income", Type: "REVENUE" }, { Code: "400", Name: "Fuel", Type: "EXPENSE" }],
      [{ Type: "ACCRECCREDIT", Status: "AUTHORISED", Date: "2026-03-08", Contact: { Name: "Shipper" }, LineItems: [{ Description: "Credit", AccountCode: "200", LineAmount: 25 }] }],
      [],
      [{ Status: "POSTED", Date: "2026-03-09", JournalLines: [
        { AccountCode: "400", LineAmount: 40, Description: "Fuel" },
        { AccountCode: "090", LineAmount: -40, Description: "Bank" },
        { AccountCode: "200", LineAmount: -15, Description: "Income" },
      ] }],
    );
    expect(lines.map((l) => [l.type, l.account, l.amount])).toEqual([
      ["Invoice", "Freight Income", -25],
      ["Journal Entry", "Fuel", 40],
      ["Invoice", "Freight Income", 15],
    ]);
  });

  it("maps Zoho expenses, bill lines and invoices", () => {
    const lines = zohoLines(
      [{ date: "2026-04-01", vendor_name: "Pilot", description: "40 gal", account_name: "Fuel", total: 160 }],
      [{ date: "2026-04-02", vendor_name: "Yard", line_items: [{ description: "Parts", account_name: "Repairs", item_total: 80 }] }],
      [{ date: "2026-04-03", customer_name: "Shipper", line_items: [{ description: "Load", account_name: "Freight Income", item_total: 900 }] }],
    );
    expect(lines.map((l) => [l.type, l.vendor, l.amount])).toEqual([
      ["Expense", "Pilot", 160], ["Bill", "Yard", 80], ["Invoice", "Shipper", 900],
    ]);
    const summary = zohoLines([], [{ date: "2026-04-04", vendor_name: "Pilot", total: 50, bill_number: "B-9" }], []);
    expect(summary).toEqual([{ date: "2026-04-04", type: "Bill", vendor: "Pilot", memo: "B-9", account: "Expense", amount: 50 }]);
  });

  it("maps FreshBooks expenses and invoices inside the window", () => {
    const lines = freshbooksLines(
      [{ date: "2026-05-01", vendor: "Pilot", notes: "30 gal", amount: { amount: "120.00" }, categoryid: 7 }, { date: "2020-01-01", vendor: "Old", amount: { amount: "5" }, categoryid: 7 }],
      [{ create_date: "2026-05-02", current_organization: "Shipper", description: "Load", amount: { amount: "700" } }],
      new Map([["7", "Fuel"]]),
      "2024-11-01",
    );
    expect(lines).toEqual([
      { date: "2026-05-01", type: "Expense", vendor: "Pilot", memo: "30 gal", account: "Fuel", amount: 120 },
      { date: "2026-05-02", type: "Invoice", vendor: "Shipper", memo: "Load", account: "Income", amount: 700 },
    ]);
  });

  it("rejects a tampered sign-in attempt", () => {
    const token = issueState("xero", "PADD2", "secret");
    expect(readState(token, "secret").provider).toBe("xero");
    expect(() => readState(token.slice(0, -2) + "aa", "secret")).toThrow(/verified/);
    expect(() => readState(token, "other")).toThrow(/verified/);
  });

  it("pulls a QuickBooks company from the token response and the transaction list", async () => {
    const prev = { id: process.env.QUICKBOOKS_CLIENT_ID, secret: process.env.QUICKBOOKS_CLIENT_SECRET, env: process.env.QUICKBOOKS_ENVIRONMENT };
    process.env.QUICKBOOKS_CLIENT_ID = "cid";
    process.env.QUICKBOOKS_CLIENT_SECRET = "csecret";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    try {
      const fetcher = (async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes("/tokens/bearer")) return Response.json({ access_token: "tok" });
        if (u.includes("/companyinfo/")) return Response.json({ CompanyInfo: { CompanyName: "Acme Freight" } });
        if (u.includes("/reports/TransactionList")) {
          expect(u).toContain("sandbox-quickbooks.api.intuit.com/v3/company/123/");
          return Response.json({
            Columns: { Column: ["tx_date", "txn_type", "name", "memo", "account_name", "subt_nat_amount"].map((ColType) => ({ ColType })) },
            Rows: { Row: { ColData: [{ value: "2026-02-01" }, { value: "Expense" }, { value: "Pilot" }, { value: "10 gal" }, { value: "Fuel" }, { value: "320.00" }] } },
          });
        }
        return new Response("missing", { status: 404 });
      }) as typeof fetch;
      const pulled = await pullLedger("quickbooks", "authcode", "http://localhost:3000/api/connect/quickbooks/callback", "123", fetcher);
      expect(pulled.label).toBe("Acme Freight (QuickBooks Online)");
      expect(ingestCsv(pulled.csv).lines[0]).toMatchObject({ vendor: "Pilot", account: "Fuel", amount: 320, direction: "expense" });
      await expect(pullLedger("quickbooks", "authcode", "http://localhost:3000/cb", null, fetcher)).rejects.toThrow(/which company/);
    } finally {
      if (prev.id === undefined) delete process.env.QUICKBOOKS_CLIENT_ID; else process.env.QUICKBOOKS_CLIENT_ID = prev.id;
      if (prev.secret === undefined) delete process.env.QUICKBOOKS_CLIENT_SECRET; else process.env.QUICKBOOKS_CLIENT_SECRET = prev.secret;
      if (prev.env === undefined) delete process.env.QUICKBOOKS_ENVIRONMENT; else process.env.QUICKBOOKS_ENVIRONMENT = prev.env;
    }
  });
});
