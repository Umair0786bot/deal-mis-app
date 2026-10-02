"""Load Allocation Planner results pulled through the Command Center MCP into data/planner.js.

  python scripts/import_planner_mcp.py <dir>

<dir> holds one planner_allocation_compute (or planner_allocation_plan) reply per deal, saved as <DealId>.txt or
<DealId>.json (e.g. D141.txt), with every SKU row on one page (limit 300). Each file replaces that deal's planner
rows, mapped to the deal-allocation CSV columns the planner import in update_data.py reads:
  expected_units_deal_window -> baseline_demand, safe_allocation -> safe_alloc, pipeline_in -> pipeline,
  post_deal_doh_max_safe / _balanced -> post_doh_max / post_doh_bal, velocity_per_day -> vel, ...
The deal's Seller Central promotion id must appear in the planner deal's name, so a file cannot land on the wrong deal.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')


def load(name):
    s = open(os.path.join(DATA, name + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))


PL = load('planner'); DE = load('deals')
by_id = {d['id']: d for d in DE['rows']}
for f in sorted(glob.glob(os.path.join(sys.argv[1], 'D*.*'))):
    did = os.path.splitext(os.path.basename(f))[0]
    deal = by_id.get(did)
    if not deal: print('SKIP', did, '- not on the calendar'); continue
    s = open(f, encoding='utf-8').read(); j = json.loads(s[s.index('{'):])
    name = (j.get('deal') or {}).get('name') or (j.get('setup') or {}).get('deal_name') or ''
    if not deal.get('promo') or deal['promo'] not in name:
        print('SKIP', did, '- promotion id', deal.get('promo'), 'not in planner deal', name); continue
    rows = j['skus']['rows']
    if len(rows) != j['skus']['total']: print('SKIP', did, '- only', len(rows), 'of', j['skus']['total'], 'SKU rows'); continue
    asof = (j.get('calculated_at') or j.get('created_at') or '')[:10] or None
    new = [{'sku': r['sku'], 'product': r['product'], 'mkt': r.get('marketplace') or 'US', 'fba_now': r['fba_now'], 'vel': r['velocity_per_day'],
            'min_doh': r['min_doh'], 'hard_floor': r['hard_floor'], 'soft_target': r['soft_target'], 'service': r.get('service_level') or 'p80',
            'baseline_demand': r['expected_units_deal_window'], 'exp_uplift': r.get('expected_units_with_uplift'), 'pipeline': r['pipeline_in'],
            'safe_alloc': r['safe_allocation'], 'upside': r['upside'], 'rec_date': r['recovery_date'], 'rec_po': r['recovery_po'],
            'rec_doh': r['recovered_doh'], 'post_doh_max': r['post_deal_doh_max_safe'], 'post_doh_bal': r['post_deal_doh_balanced'],
            'status': (r['status'] or 'SAFE').upper(), 'deal': did, 'asof': asof, 'src': 'planner MCP'} for r in rows]
    PL = [p for p in PL if p['deal'] != did] + new
    p0 = j['products'][0]
    print('%s %-5s %s planner %s: %d SKUs, expected %s (with lift %s), safe %s balanced / %s sum, %s'
          % (did, deal['tag'], deal['start'], asof, len(new), p0['expected_units_deal_window'], p0['expected_units_with_uplift'],
             p0['safe_total_balanced'], p0['safe_total_sum'], p0['status']))
s = json.dumps(PL, separators=(',', ':'), ensure_ascii=False)
open(os.path.join(DATA, 'planner.js'), 'w', encoding='utf-8').write('window.DCC=window.DCC||{};window.DCC.planner=%s;\n' % s)
print('planner.js %.0f KB, %d rows' % (len(s) / 1024, len(PL)))
