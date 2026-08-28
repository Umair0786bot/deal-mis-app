# Deal MIS — working notes for Claude

Static app (no build, no backend): `index.html` + `assets/{mis.css, mis.js, charts.js, engine.js}` + `data/*.js` (JSON assigned onto `window.DCC`). `scripts/bundle.py` inlines everything into `dist/deal-mis.html`. Same engine and rules as the Google-Sheet tracker, verified to the cent against the per-deal workbooks.

## Daily routine (skills in the workspace `.claude/skills/`)
- `/deal-update` — ingest new Sellerboard exports / tracker allocations / planner CSVs from `~/Downloads`, rebuild, print the morning update, verify.
- `/deal-status` — print today's update without changing anything.
- `/deal-edit` — add / close / cancel deals, Seller Central facts, enrolled ASIN list, objectives (`scripts/deal.py`).
- `/deal-publish` — bundle, verify, commit, push (GitHub Pages at https://umair0786bot.github.io/deal-mis-app/), republish the artifact at the same URL.

## Deal Analysis (Deals Financials) model
`E.analysis(deal, {priceMode, ppcPct, uplift, demand})` reproduces the Deal Analysis file's per-SKU sheet: base price/COGS/FBA from `skus.js`, velocity + expected demand + safe allocation + FBA now from the planner pull (`E.plannerFor`), deal price from the Deal Dashboard pull (`data/dashboard.js`, latest for the deal else for the parent; manual > final > max deal), historical deal price from `price_history.js`, AIS units/charge from `sellerboard.age`. Referral = 15% of the deal price. Fee = $70 × days + 1% of max-sales revenue, capped $2,000. Three views: TRUE PICTURE (max sales, stock-limited), REFERENCE (all expected demand), OPPORTUNITY COST (lost units/revenue, blocked SKUs). `scripts/import_sources.py` loads these sources from the newest tracker + Deal Analysis workbooks in Downloads; the Data Hub can load the same workbooks in the browser.

## Data Hub (in-app uploads)
`assets/hub.js`: parses Sellerboard xlsx (zip + DecompressionStream, no library) or csv, planner CSVs and allocation CSVs in the browser, validates (one day per file, ≥200 rows, identity check), merges into `window.DCC`, persists in IndexedDB (`deal-mis` / `uploads`), and re-merges on load before the first render. Per-browser only — `/deal-update` is the shared path. Test: scratchpad `test_hub.cjs` pattern (setInputFiles on `.drop input[type=file]`).

## Rules the numbers rest on — never change silently
- Fee = min($70 × days billed + 1% × deal revenue, $2,000). Days billed = elapsed (default) or planned.
- Net after fee = Sellerboard net (ads already inside it) − fee. Never subtract PPC again.
- Baseline = 14 clean days before the deal, skipping other deals for the same parent and days without an export.
- One multiplier per deal with provenance: measured prior deals of the same parent (same type first) → LD uplift tab → house default (BD 1.4×, LD 1.5×). Firm ≥ 30 deal-days, indicative ≥ 10, thin below.
- Only the confirmed enrolled list counts (`data/deals.js` → `known[id]`); the rest of the family is halo.
- Cancelled deals are closed at the last day their deal price was live (`deal.py close`), never measured to the planned end.
- STOP at 90% of safe allocation, warn at 80%. Cover floor after a deal: 21 days.
- Lightning Deal enrolment = velocity × LD multiplier × days × 1.3, capped by safe allocation and stock above the hard floor — distinct from safe allocation.
- Parents with no SKUs in the Sellerboard feed show NO SKU DATA and are never graded.

## Data shape
`sellerboard.js`: `dates[]`, `asins[[asin, sku, tag]]`, `rows[[dateIdx, asinIdx, units, sales, ppc, ads, net, bsr, fees, cogs, refunds]]` in cents, identity `sales − ads − fees − cogs − refunds = net`; `age{asinIdx: [charge/mo, aged units, in30, in60, in90, rate]}` (FBA age snapshot). `deals.js`: `rows[]` (id, tag, type, start, end, days, promo, asins, issues, sc_*, enrolled, objective, cancelled, planned_end, closed_note), `known{}`, `not_in_export[]`, `shape_by_tag{}`. `allocations.js`, `planner.js` (with `asof`), `skus.js` (price, cogs, fba, p30, fba_on_hand, rank_var), `ads.js` (Scale Insight, dated by hand), `uplift.js`.

## Verification
`node scripts/verify.cjs` (playwright; `npm install` once). Reference figures: D105 at 25 Aug = 430 u / $32,059.10 / net after fee $3,474.95 / 1.6557×; D109 at 25 Aug = 66 u / −$484.46 / 1.737× / halo −$52.37.
