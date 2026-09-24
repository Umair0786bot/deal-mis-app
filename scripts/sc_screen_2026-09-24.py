"""One-off: reconcile data/deals.js to the Seller Central Manage Promotions screen of 24 Sep 2026 (US rows only).
Removes D128 SS4 BD 17-30 Sep and D133 BF LD 25 Sep (never ran - user-confirmed cancelled) and adds the booked
promotions with their ids. Rows tagged from thumbnail + ASIN count carry confirm_tag=True until Umair confirms.
Run from deal-mis/:  python scripts/sc_screen_2026-09-24.py
"""
import json, subprocess, sys, pathlib
F = pathlib.Path('data/deals.js')

def load():
    s = F.read_text(encoding='utf-8'); return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))

def save(DE):
    F.write_text('window.DCC=window.DCC||{};window.DCC.deals=' + json.dumps(DE, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')

DE = load()
gone = [d for d in DE['rows'] if d['id'] in ('D128', 'D133')]
DE['rows'] = [d for d in DE['rows'] if d['id'] not in ('D128', 'D133')]
for k in ('known', 'promo_price', 'promo_commit'):
    if k in DE:
        for i in ('D128', 'D133'): DE[k].pop(i, None)
save(DE); print('removed', [(d['id'], d['tag'], d['start']) for d in gone])

PBDD = 'Prime Big Deal Days - $100/day + 1.5%'
BF = 'Black Friday - $50/day + 1.5%'
NEW = [
 ('SPC', 'ld', '2026-09-30', None, 'Lightning Deal-2026/09/24 9-4-5-164', 16, 0, ''),
 ('SLQS', 'ld', '2026-10-02', None, 'Lightning Deal-2026/09/24 9-0-54-968', 13, 0, 'CONFIRM parent (13 ASINs, quilt thumbnail)'),
 ('SF', 'ld', '2026-10-02', None, 'Lightning Deal-2026/09/24 9-2-55-658', 57, 0, 'CONFIRM parent (57 ASINs, fitted-sheet thumbnail)'),
 ('HC', 'bd', '2026-10-06', '2026-10-07', 'Deals-2026/09/03 7-0-31-618', 2, 0, PBDD),
 ('SLCPC', 'ld', '2026-10-06', None, 'Lightning Deal-2026/09/01 7-21-52-794', 6, 3, PBDD),
 ('BF', 'ld', '2026-10-06', None, 'Lightning Deal-2026/08/31 10-27-42-928', 61, 14, PBDD),
 ('S6', 'ld', '2026-10-06', None, 'Lightning Deal-2026/09/01 12-45-40-444', 66, 24, PBDD + ' - CONFIRM parent (66 ASINs, satin thumbnail)'),
 ('LC', 'ld', '2026-10-06', None, 'Lightning Deal-2026/09/03 18-49-15-995', 35, 1, PBDD),
 ('SLQS', 'ld', '2026-10-06', None, 'Lightning Deal-2026/09/01 12-56-38-695', 17, 12, PBDD + ' - CONFIRM parent (17 ASINs)'),
 ('SS4', 'ld', '2026-10-06', None, 'Lightning Deal-2026/09/01 13-27-56-316', 57, 43, PBDD + ' - CONFIRM parent (57 ASINs, satin thumbnail)'),
 ('S4', 'ld', '2026-10-07', None, 'Lightning Deal-2026/09/01 12-58-28-922', 75, 0, PBDD + ' - CONFIRM parent (75 ASINs, satin thumbnail)'),
 ('SLCF', 'ld', '2026-10-07', None, 'Lightning Deal-2026/09/01 13-23-52-197', 25, 5, PBDD),
 ('SPC', 'ld', '2026-10-07', None, 'Lightning Deal-2026/09/01 7-15-35-801', 16, 5, PBDD),
 ('WCC', 'ld', '2026-10-07', None, 'Lightning Deal-2026/09/01 13-38-44-257', 4, 0, PBDD),
 ('SSB6', 'bd', '2026-10-14', '2026-10-27', 'Deals-2026/09/24 8-58-31-608', 41, 0, 'CONFIRM parent (41 ASINs, bamboo-sheets packaging)'),
 ('SF', 'bd', '2026-10-16', '2026-10-28', 'Deals-2026/08/31 14-31-57-962', 62, 0, ''),
 ('S4', 'bd', '2026-10-16', '2026-10-28', 'Deals-2026/08/31 10-19-48-132', 76, 0, ''),
 ('SLQS', 'bd', '2026-10-16', '2026-10-28', 'Deals-2026/08/31 14-33-59-548', 19, 0, ''),
 ('B4', 'bd', '2026-10-20', '2026-10-28', 'Deals-2026/09/24 8-49-11-35', 63, 0, 'booked 24 Sep'),
 ('B6', 'bd', '2026-10-22', '2026-10-28', 'Deals-2026/09/24 8-51-55-73', 52, 0, 'booked 24 Sep'),
 ('LC', 'ld', '2026-10-22', None, 'Lightning Deal-2026/09/01 7-12-1-512', 38, 0, ''),
 ('S4', 'ld', '2026-11-02', None, 'Lightning Deal-2026/09/10 6-53-34-335', 65, 0, 'CONFIRM parent (65 ASINs, satin thumbnail)'),
 ('SLQS', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-33-57-148', 19, 0, BF + ' - CONFIRM parent (19 ASINs)'),
 ('WCC', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/09/01 6-58-49-542', 6, 0, BF),
 ('S4', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 9-57-17-223', 70, 0, BF),
 ('LC', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-33-11-550', 38, 0, BF),
 ('HC', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-40-40-755', 2, 0, BF),
 ('SLCPC', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-36-57-896', 7, 0, BF),
 ('SLC4', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/09/01 6-46-43-735', 45, 0, BF),
 ('B4', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-24-41-71', 60, 0, BF),
 ('B6', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-25-39-710', 54, 0, BF),
 ('SSB6', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/09/03 6-50-35-276', 42, 0, BF + ' - CONFIRM parent (42 ASINs, bamboo-sheets packaging)'),
 ('SLCLG', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/09/01 6-47-30-562', 18, 0, BF),
 ('SF', 'bd', '2026-11-19', '2026-11-30', 'Deals-2026/08/31 10-27-16-680', 62, 0, BF),
 ('SPC', 'ld', '2026-11-23', None, 'Lightning Deal-2026/09/01 7-16-13-292', 16, 0, BF),
 ('S6', 'ld', '2026-11-23', None, 'Lightning Deal-2026/09/01 7-14-9-620', 74, 0, BF),
 ('SLCF', 'ld', '2026-11-25', None, 'Lightning Deal-2026/09/01 13-23-11-474', 25, 0, BF),
]
added = []
for tag, typ, start, end, promo, asins, issues, note in NEW:
    cmd = [sys.executable, 'scripts/deal.py', 'add', tag, typ, start] + ([end] if end else []) + ['--promo', promo, '--asins', str(asins)]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if out.returncode:
        print('FAIL', tag, start, out.stdout, out.stderr); continue
    added.append((tag, typ, start, end, promo, issues, note))
DE = load(); byp = {d.get('promo'): d for d in DE['rows']}
for tag, typ, start, end, promo, issues, note in added:
    d = byp[promo]; d['issues'] = issues; d['sc_status'] = 'Has issues' if issues else 'Upcoming'; d['source'] = 'SC screen 2026-09-24'
    if note: d['note'] = note
    if 'CONFIRM' in note: d['confirm_tag'] = True
save(DE)
print('added', len(added))
for d in sorted(DE['rows'], key=lambda d: d['start']):
    if d['start'] >= '2026-09-25':
        print(' ', d['id'], d['tag'], d['type'][:4], d['start'], d['end'], d.get('asins'), 'CONFIRM' if d.get('confirm_tag') else '')
