"""One-off: reconcile data/deals.js to Amazon's US deal records as of 2 Oct 2026 (Command Center amazon_promotions
feed, snapshot of 1 Oct) and the Command Center deal calendar.

- Removes the deals Amazon lists as CANCELED with no sales (never ran), user-confirmed 2 Oct:
  D121 C4 BD 1-14 Sep, D127 SLQS LD 18 Sep, D129 S4 LD 19 Sep, D131 SLC4 LD 21 Sep, D132 SSB6 LD 21 Sep,
  D135 SPC LD 30 Sep, D136 SLQS LD 2 Oct, D137 SF LD 2 Oct.
- Adds the three S6 Lightning Deals booked in Seller Central on 24 Sep after the 24 Sep screen (12, 24 and 30 Oct).
- Records Amazon's final deal attribution (units, revenue, glance views) for the deals that ran since mid-August.
Run from deal-mis/:  python scripts/sc_feed_2026-10-02.py
"""
import json, subprocess, sys, pathlib
F = pathlib.Path('data/deals.js')


def load():
    s = F.read_text(encoding='utf-8'); return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))


def save(DE):
    F.write_text('window.DCC=window.DCC||{};window.DCC.deals=' + json.dumps(DE, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')


def deal(*args):
    out = subprocess.run([sys.executable, 'scripts/deal.py', *args], capture_output=True, text=True, encoding='utf-8')
    if out.returncode: raise SystemExit('deal.py %s failed: %s %s' % (' '.join(args), out.stdout, out.stderr))
    print(' ', out.stdout.strip())


GONE = ('D121', 'D127', 'D129', 'D131', 'D132', 'D135', 'D136', 'D137')
DE = load()
gone = [d for d in DE['rows'] if d['id'] in GONE]
DE['rows'] = [d for d in DE['rows'] if d['id'] not in GONE]
for k in ('known', 'promo_price', 'promo_commit'):
    for i in GONE: DE.get(k, {}).pop(i, None)
DE['live'] = [i for i in DE.get('live', []) if i not in GONE]
save(DE); print('removed', [(d['id'], d['tag'], d['type'], d['start']) for d in gone])

NEW = [('2026-10-12', 'Lightning Deal-2026/09/24 13-28-10-252'),
       ('2026-10-24', 'Lightning Deal-2026/09/24 13-28-52-266'),
       ('2026-10-30', 'Lightning Deal-2026/09/24 13-29-59-851')]
for start, promo in NEW:
    deal('add', 'S6', 'ld', start, '--promo', promo)
DE = load(); byp = {d.get('promo'): d for d in DE['rows']}
for start, promo in NEW:
    d = byp[promo]; d['source'] = 'Command Center calendar 2026-10-02'; d['note'] = 'booked 24 Sep in Seller Central - ASIN count not read yet'
save(DE)

# Amazon's deal attribution (amazon_promotions, US): id, promotion, units, revenue, glance views
RAN = [('D097', 'ac248be6', 841, 60211.22, 22289), ('D105', 'bff0d415', 1349, 101004.10, 24646),
       ('D106', '606167af', 2183, 59468.92, 37509), ('D107', '22578750', 4, 114.71, 527),
       ('D108', '04eb8ebb', 3, 77.32, 110), ('D119', 'e17d9c4d', 129, 6184.94, 3157),
       ('D120', '482e1420', 504, 15656.88, 26189), ('D126', 'fb6c02f9', 893, 63322.40, 25110),
       ('D130', 'e621f86d', 74, 5182.06, 2059), ('D134', '1951ce62', 388, 27383.56, 7789)]
for did, amz, units, sales, glance in RAN:
    deal('sc', did, '--status', 'Ended', '--sales', str(sales), '--units', str(units), '--glance', str(glance),
         '--conv', '%.3f' % (units / glance), '--date', '2026-10-01')
# Ran, but Amazon's report has no results for them yet
for did in ('D175', 'D176'):
    deal('sc', did, '--status', 'Ended')
DE = load(); by_id = {d['id']: d for d in DE['rows']}
for did, amz, *_ in RAN: by_id[did]['amazon_promotion'] = amz
by_id['D130']['asins'] = 56
by_id['D175']['amazon_promotion'] = '17408079'; by_id['D176']['amazon_promotion'] = '9af6be05'
for did in ('D175', 'D176'): by_id[did]['note'] = 'ran - Amazon deal results not in the 1 Oct report yet'
save(DE)
print('rows', len(DE['rows']))
