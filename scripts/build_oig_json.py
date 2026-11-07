#!/usr/bin/env python3
"""Rebuild oig-facility-inspections.json for the HadIt OIG inspections tracker.

Input: a JSON list of rows exported from the Notion "OIG Facility Findings" data
source (public fields only), each with these keys:
  Facility, City, State, "date:Report Date:start", "Report Number",
  "Report URL", "Domains Flagged", "Finding Themes", Recommendations
("Domains Flagged" and "Finding Themes" may be JSON-encoded lists or lists.)

For each row it fetches the OIG report page and reads every recommendation's
number, status, closure date, and text. If a page fails or its recommendation
count does not match the row, the previous published entry for that report is
kept and the problem is listed.

Usage: python3 scripts/build_oig_json.py notion_rows.json
Writes oig-facility-inspections.json and build-report.json (problems, open
counts per report URL) in the repo root.
"""
import json, re, sys, html, time, datetime, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "oig-facility-inspections.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
STATUS = {"open": "open", "closed-implemented": "closed", "closed-not-implemented": "closed-not-implemented"}
DOMAINS = {"Culture", "Environment of care", "Patient safety", "Integrated veteran care", "Veteran-centered safety net"}


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s).replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def as_list(v):
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return v
    try:
        x = json.loads(v)
        return x if isinstance(x, list) else [x]
    except Exception:
        return [v]


def fetch(url):
    for attempt in range(3):
        r = subprocess.run(["curl", "-s", "-L", "--max-time", "40", "-A", UA, url], capture_output=True, text=True)
        if r.returncode == 0 and len(r.stdout) > 5000:
            return r.stdout
        time.sleep(3)
    return None


def parse(h):
    items = []
    for blk in h.split('<div class="recommendation-alt-item">')[1:]:
        n = re.search(r'header-number">No\.\s*(\d+)', blk)
        st = re.search(r"recommendation-alt-status-([a-z-]+)", blk)
        cd = re.search(r"Closure Date:\s*([\d/]+)", blk)
        tx = re.search(r'recommendation-alt-item-text">(.*?)</div>\s*</div>', blk, re.S)
        items.append({
            "n": int(n.group(1)) if n else None,
            "raw_status": st.group(1) if st else None,
            "closed": cd.group(1) if cd else None,
            "text": clean(tx.group(1)) if tx else "",
        })
    return items


def main():
    rows = json.load(open(sys.argv[1]))
    prev = {}
    if OUT.exists():
        for r in json.load(open(OUT))["reports"]:
            prev[r["url"]] = r
    problems, reports, open_counts = [], [], {}
    for row in rows:
        url = (row.get("Report URL") or "").strip()
        fac = row.get("Facility", "")
        if not url:
            problems.append(f"{fac}: no Report URL, skipped")
            continue
        want = int(row.get("Recommendations") or 0)
        entry = {
            "facility": clean(fac),
            "city": clean(row.get("City")),
            "state": (row.get("State") or "").strip(),
            "date": row.get("date:Report Date:start") or "",
            "reportNumber": (row.get("Report Number") or "").strip(),
            "url": url,
            "domains": [d for d in as_list(row.get("Domains Flagged")) if d in DOMAINS],
            "themes": sorted(as_list(row.get("Finding Themes"))),
        }
        h = fetch(url)
        items = parse(h) if h else None
        bad = None
        if items is None:
            bad = "page did not load"
        elif len(items) != want:
            bad = f"page lists {len(items)} recommendations, tally says {want}"
        elif any(i["raw_status"] not in STATUS or not i["text"] for i in items):
            bad = "unknown status or missing text: " + ",".join(str(i["raw_status"]) for i in items)
        if bad:
            problems.append(f"{fac} ({entry['date']}): {bad}; kept previous entry" if url in prev else f"{fac} ({entry['date']}): {bad}; NOT published")
            if url in prev:
                old = prev[url]
                entry["recs"] = old["recs"]
                entry["reportNumber"] = entry["reportNumber"] or old.get("reportNumber", "")
                reports.append(entry)
            continue
        m = re.search(r'Report Number</div>\s*<div[^>]*>\s*<div class="field__item">([^<]+)<', h)
        if m:
            entry["reportNumber"] = clean(m.group(1))
        entry["recs"] = [{"n": i["n"], "status": STATUS[i["raw_status"]], "closed": i["closed"], "text": i["text"]} for i in items]
        open_counts[url] = sum(1 for i in items if i["raw_status"] == "open")
        reports.append(entry)
        time.sleep(0.5)
    reports.sort(key=lambda r: (r["date"], r["facility"]), reverse=True)
    doc = {
        "title": "VA OIG Healthcare Facility Inspections",
        "source": "VA Office of Inspector General, Healthcare Facility Inspection reports (vaoig.gov)",
        "compiledBy": "HadIt.com",
        "updated": datetime.date.today().isoformat(),
        "coverage": "Every Healthcare Facility Inspection report OIG has published since the program began on 2024-09-24",
        "notes": "Recommendation text and status are OIG's own, read from each report page. Issue tags are HadIt labels applied to OIG's formal recommendations.",
        "reports": reports,
    }
    s = json.dumps(doc, ensure_ascii=False, indent=1)
    assert "–" not in s and "—" not in s
    OUT.write_text(s, encoding="utf-8")
    nrec = sum(len(r["recs"]) for r in reports)
    nopen = sum(1 for r in reports for x in r["recs"] if x["status"] == "open")
    rep = {"reports": len(reports), "recs": nrec, "open": nopen, "problems": problems, "open_counts": open_counts}
    (ROOT / "build-report.json").write_text(json.dumps(rep, indent=1))
    print(json.dumps({k: v for k, v in rep.items() if k != "open_counts"}, indent=1))


if __name__ == "__main__":
    main()
