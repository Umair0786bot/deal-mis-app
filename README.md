# Deal MIS — Deal Management Information System

The Amazon deal tracker, the per-deal analysis files and the scorecards as one app, laid out like the
Command Center's Deals & Events module. Every number is computed by the same rules the sheets use,
from the same feeds — nothing is pasted.

**No build step, no backend.** Plain HTML + CSS + JS; the data snapshot ships as JS files so it runs
from GitHub Pages, any static host, or `index.html` on disk. `dist/deal-mis.html` is the same app in
one file.

## Live
- GitHub Pages: https://umair0786bot.github.io/deal-mis-app/  (redeploys on every push to `main`)
- Shareable artifact (same app, single file): https://claude.ai/code/artifact/3f5dc1d2-3126-4395-b218-e1514c9529c6

## Daily routine (replaces the Google-Sheet pastes)
Drop the day's Sellerboard per-ASIN export (and any new planner / tracker files) in `~/Downloads`, then in Claude Code:
`/deal-update` (ingest + rebuild + morning update + verify) → `/deal-publish` (push + republish). `/deal-status` prints the update without changing anything; `/deal-edit` adds, closes or cancels deals and records Seller Central facts (`scripts/deal.py`).
Scripts: `scripts/update_data.py`, `scripts/deal.py`, `scripts/status.cjs`, `scripts/bundle.py`, `scripts/verify.cjs` (`npm install` once for the headless check).

## Run it
- Double-click `index.html`, or `python -m http.server 8080` here and open http://localhost:8080
- Single file: open `dist/deal-mis.html` (rebuild with `python scripts/bundle.py`)

## Host it on GitHub Pages
```
git init && git add . && git commit -m "Deal MIS"
git branch -M main && git remote add origin https://github.com/<you>/deal-mis.git && git push -u origin main
```
Settings → Pages → Deploy from a branch → `main` / root. `.nojekyll` is included.

## Tabs
| Tab | What it holds | Sheet tabs it replaces |
|---|---|---|
| Deal Registry | KPI strip, alerts, coverage Gantt by parent, deal cards (pace, net, multiplier with provenance), full register | Deal Calendar, Calendar View, Overview |
| Deal Performance | Per deal: overview (units, expected-by-now, pace, uplift, fee, net after fee, incremental, halo), plan-vs-actual chart, 8 gates, objectives; P&L waterfall + deal-vs-nothing; SKUs; stop monitor; outlook & storage; plan & readiness | Deal Performance xlsx, Deal Economics, Deal Metrics, Deal Scorecard, Deal Graphs |
| Deal Planner | Deal setup → products → economics (discount / uplift sliders, presets) → RUN / RUN WITH CONDITIONS / DO NOT RUN | Deals Financials, APP, Deal Allocation, Deal Dashboard |
| Stop Monitor | Today's actions across live deals: STOP line, near limit, losing SKUs, TACOS, weak lift | PROMO STATUS, daily update |
| Historical Performance | Every measured deal: lift and economics by type and parent, benchmark day-curves, LD uplift | Historical DEAL Performance, All Deals, LD Uplift |
| PPC & TACOS | TACOS by day, by deal day, by parent, top SKUs with Sellerboard net | Ad Spend, ProductStats |
| Storage & LTSF | Aged units, monthly charge, 30/60/90 inflow, Gate 5 candidates | LTSF, Summary USA, AIS Inflow |
| Process & Automation | 7 stages, 8 gates, cadence, owners, sheet → feed map | TRACKER-HANDBOOK |

## Rules the engine applies
- Baseline = 14 clean days before the deal, skipping other deals for the same parent and days without an export.
- Multiplier per deal, resolved once with provenance: measured prior deals of the same parent (same type first) → LD uplift tab → house default (BD 1.4×, LD 1.5×). Confidence: firm ≥ 30 deal-days, indicative ≥ 10, thin below.
- Expected-by-now = baseline × multiplier × days with data; pace = actual ÷ expected.
- Fee = min($70 × days billed + 1% × deal revenue, $2,000). Days billed = elapsed (default) or planned.
- Net = Sellerboard net (ads already inside it) − fee. Incremental = net − baseline net/day × days.
- Halo = the parent's SKUs not on deal, same days vs their own baseline (needs the enrolled list).
- STOP at 90% of safe allocation, warn at 80%. Allocation 0 = not in the deal.
- Deals whose parent has no SKUs in the Sellerboard feed are shown as NO SKU DATA, never graded.

Verified headless (Playwright) against the workbooks: D105 at 25 Aug = 430 u / $32,059.10 / net after
fee $3,474.95 / uplift 1.6557×; D109 = 66 u / −$484.46 / 1.737× / halo −$52.37.

## Data
`data/*.js` is the tracker snapshot of 26 Aug 2026 (Sellerboard 23 Jun – 25 Aug, 815 ASINs, 137 deals
reconciled with Seller Central on 21 Aug). `scripts/build_data.py` in `../deal-command-center` regenerates it.
