#!/usr/bin/env python3
"""Download public EIA price history and write compact JSON snapshots to lib/data/.

Every file records its source URL and the fetch time, so the numbers the engine
uses can be traced to a public series. Run: python3 scripts/fetch_eia.py
"""
import datetime, json, os, sys, urllib.request
import xlrd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "lib", "data")
BASE = "https://www.eia.gov/dnav/pet/hist_xls/"

SERIES = {
    "diesel_us_weekly": ("EMD_EPD2D_PTE_NUS_DPGw.xls", "U.S. No 2 Diesel Retail Prices, weekly, $/gal", "USD/gal"),
    "diesel_padd2_weekly": ("EMD_EPD2D_PTE_R20_DPGw.xls", "Midwest (PADD 2) No 2 Diesel Retail Prices, weekly, $/gal", "USD/gal"),
    "ulsd_nyh_monthly": ("EER_EPD2DXL0_PF4_Y35NY_DPGm.xls", "New York Harbor ULSD No 2 Diesel Spot Price, monthly, $/gal", "USD/gal"),
    "brent_monthly": ("RBRTEm.xls", "Europe Brent Spot Price FOB, monthly, $/bbl", "USD/bbl"),
}

def fetch(name):
    path = os.path.join(RAW, name)
    req = urllib.request.Request(BASE + name, headers={"User-Agent": "costshield-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())
    return path

def parse(path):
    book = xlrd.open_workbook(path)
    sheet = book.sheet_by_name("Data 1")
    rows = []
    for i in range(3, sheet.nrows):
        d, v = sheet.cell_value(i, 0), sheet.cell_value(i, 1)
        if d == "" or v == "":
            continue
        date = xlrd.xldate_as_datetime(d, book.datemode).date().isoformat()
        rows.append([date, round(float(v), 3)])
    return rows

def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for key, (fname, title, unit) in SERIES.items():
        rows = parse(fetch(fname))
        doc = {"id": key, "title": title, "unit": unit, "source": "U.S. Energy Information Administration",
               "sourceUrl": BASE + fname, "fetchedAt": now, "evidence": "V", "points": rows}
        with open(os.path.join(OUT, key + ".json"), "w") as f:
            json.dump(doc, f, separators=(",", ":"))
        print(f"{key}: {len(rows)} points, {rows[0][0]} .. {rows[-1][0]} last={rows[-1][1]}")

if __name__ == "__main__":
    sys.exit(main())
