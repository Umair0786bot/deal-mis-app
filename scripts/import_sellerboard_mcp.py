"""Load Sellerboard days pulled through the Sellerboard MCP connector into data/sellerboard.js.

  python scripts/import_sellerboard_mcp.py <dir> [--min-rows 200]

<dir> holds the raw dashboard_table replies (entry_type product, marketplace amazon.com, one UTC day per call, no
grouping) saved as <YYYY-MM-DD>_c<count>_p<NN>.txt, plus optional <YYYY-MM-DD>_tail.jsonl rows (Info fields only).
Product rows are SKU-level, so they are summed per ASIN - the same as the Group-by-Parent path in update_data.py, which
reproduces the per-ASIN export. Column map (export -> Info field):
  Units -> Units, Sales -> Sales, Sponsored products (PPC) -> SponsoredADS, Ads -> Advertising, Net profit -> NetProfit,
  BSR -> BSR, Amazon fees -> AmazonFees, Cost of Goods -> ProductCosts, Refund cost -> ProductRefunds.
A day replaces any stored day with the same date (Sellerboard restates). A day whose unique rows do not match the
reply's total, or with fewer than --min-rows ASIN rows, is rejected.
"""
import argparse, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
ap = argparse.ArgumentParser()
ap.add_argument('dir')
ap.add_argument('--min-rows', type=int, default=200)
A = ap.parse_args()


def load(name):
    s = open(os.path.join(DATA, name + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))


SB = load('sellerboard'); SK = load('skus')
sku_tag = {s['sku']: s['tag'] for s in SK}
asin_idx = {a[0]: i for i, a in enumerate(SB['asins'])}
cents = lambda v: int(round(float(v or 0) * 100))
FIELDS = ('Units', 'Sales', 'SponsoredADS', 'Advertising', 'NetProfit', 'AmazonFees', 'ProductCosts', 'ProductRefunds')

days = sorted({m.group(1) for f in os.listdir(A.dir) for m in [re.match(r'^(\d{4}-\d\d-\d\d)_(c\d+_p\d+\.txt|tail\.jsonl)$', f)] if m})
for day in days:
    rows, total = {}, None
    for f in sorted(glob.glob(os.path.join(A.dir, day + '_c*_p*.txt'))):
        s = open(f, encoding='utf-8').read(); j = json.loads(s[s.index('{'):])
        if {p['from'] for p in j['resolvedPeriods']} != {day}: raise SystemExit('%s covers %s, not %s' % (f, j['resolvedPeriods'], day))
        total = j['total']
        for r in j['result']: rows[r['Info']['Id']] = r['Info']
    tail = os.path.join(A.dir, day + '_tail.jsonl')
    if os.path.exists(tail):
        for line in open(tail, encoding='utf-8'):
            if line.strip(): i = json.loads(line); rows[i['Id']] = i
    if total is None or len(rows) != total:
        print('REJECT', day, 'unique rows', len(rows), 'vs total', total); continue
    by_asin = {}
    for i in rows.values():
        a = i.get('ASIN')
        if not a: continue
        m = by_asin.setdefault(a, {'sku': i.get('SKU') or a, 'bsr': 0, **{k: 0.0 for k in FIELDS}})
        for k in FIELDS: m[k] += float(i.get(k) or 0)
        if not m['bsr'] and isinstance(i.get('BSR'), (int, float)): m['bsr'] = int(i['BSR'])
    if len(by_asin) < A.min_rows:
        print('REJECT', day, 'only', len(by_asin), 'ASIN rows'); continue
    if day not in SB['dates']:
        old = list(SB['dates']); SB['dates'].append(day); SB['dates'].sort()
        remap = {i: SB['dates'].index(d) for i, d in enumerate(old)}
        for r in SB['rows']: r[0] = remap[r[0]]
    di = SB['dates'].index(day)
    SB['rows'] = [r for r in SB['rows'] if r[0] != di]
    new_asins = 0
    for a, m in by_asin.items():
        if a not in asin_idx:
            SB['asins'].append([a, m['sku'], sku_tag.get(m['sku'], '?')]); asin_idx[a] = len(SB['asins']) - 1; new_asins += 1
        SB['rows'].append([di, asin_idx[a], int(round(m['Units'])), cents(m['Sales']), -cents(m['SponsoredADS']), -cents(m['Advertising']),
                           cents(m['NetProfit']), m['bsr'], -cents(m['AmazonFees']), -cents(m['ProductCosts']), -cents(m['ProductRefunds'])])
    day_rows = [r for r in SB['rows'] if r[0] == di]
    promo = sum(1 for r in day_rows if abs((r[3] - r[5] - r[8] - r[9] - r[10]) - r[6]) > 1)
    print('Sellerboard %s <- %d ASIN rows from %d SKU rows (%d new ASINs, %d rows carry promotion value): units %d, sales $%.2f, net $%.2f'
          % (day, len(day_rows), len(rows), new_asins, promo, sum(r[2] for r in day_rows), sum(r[3] for r in day_rows) / 100, sum(r[6] for r in day_rows) / 100))
SB['rows'].sort(key=lambda r: (r[0], r[1]))
s = json.dumps(SB, separators=(',', ':'), ensure_ascii=False)
open(os.path.join(DATA, 'sellerboard.js'), 'w', encoding='utf-8').write('window.DCC=window.DCC||{};window.DCC.sellerboard=%s;\n' % s)
print('sellerboard.js %.0f KB, feed %s - %s (%d days)' % (len(s) / 1024, SB['dates'][0], SB['dates'][-1], len(SB['dates'])))
