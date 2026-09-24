"""One-off: apply Umair's parent tags (given 24 Sep in Seller Central screen order) to the calendar.
DPC = Decolure Pillowcase = app tag SPC; SSS4 = app tag SS4.  Canada rows are recorded in the CSV only.
Run from deal-mis/:  python scripts/sc_tags_2026-09-24.py
"""
import json, subprocess, sys, pathlib, csv, datetime
F = pathlib.Path('data/deals.js')
ALIAS = {'DPC': 'SPC', 'SSS4': 'SS4'}

def load():
    s = F.read_text(encoding='utf-8'); return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))

def save(DE):
    F.write_text('window.DCC=window.DCC||{};window.DCC.deals=' + json.dumps(DE, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')

# (promotion id, type, market, start, end, asins, issues, event, tag) in the 24 Sep screen order
ROWS = [
 ('Deals-2026/09/04 18-32-34-622', 'Best Deal', 'US', '2026-09-15', '2026-09-28', 39, 0, '', 'B4'),
 ('Lightning Deal-2026/09/19 14-53-21-10', 'Lightning Deal', 'CA', '2026-09-25', '2026-09-25', 63, 0, '', 'B6'),
 ('Deals-2026/09/04 18-34-39-334', 'Best Deal', 'US', '2026-09-26', '2026-09-30', 53, 0, '', 'B6'),
 ('Lightning Deal-2026/09/24 9-21-56-371', 'Lightning Deal', 'CA', '2026-09-29', '2026-09-29', 106, 0, '', 'S6'),
 ('Lightning Deal-2026/09/24 9-0-54-968', 'Lightning Deal', 'US', '2026-10-02', '2026-10-02', 13, 0, '', 'SLQS'),
 ('Lightning Deal-2026/09/24 8-40-42-43', 'Lightning Deal', 'US', '2026-10-01', '2026-10-01', 87, 0, '', 'S4'),
 ('Lightning Deal-2026/09/24 9-12-1-400', 'Lightning Deal', 'CA', '2026-09-29', '2026-09-29', 66, 0, '', 'B6'),
 ('Lightning Deal-2026/09/24 8-39-48-432', 'Lightning Deal', 'US', '2026-09-30', '2026-09-30', 90, 0, '', 'S6'),
 ('Lightning Deal-2026/09/24 9-2-55-658', 'Lightning Deal', 'US', '2026-10-02', '2026-10-02', 57, 0, '', 'SF'),
 ('Lightning Deal-2026/09/24 9-12-59-0', 'Lightning Deal', 'CA', '2026-09-30', '2026-09-30', 59, 0, '', 'B4'),
 ('Lightning Deal-2026/09/24 9-20-43-295', 'Lightning Deal', 'CA', '2026-10-03', '2026-10-03', 89, 0, '', 'S4'),
 ('Lightning Deal-2026/09/24 9-4-5-164', 'Lightning Deal', 'US', '2026-09-30', '2026-09-30', 16, 0, '', 'DPC'),
 ('Deals-2026/09/01 12-20-47-310', 'Best Deal', 'CA', '2026-10-06', '2026-10-07', 66, 43, 'PBDD', 'B6'),
 ('Deals-2026/09/01 13-26-24-806', 'Best Deal', 'CA', '2026-10-06', '2026-10-07', 63, 18, 'PBDD', 'SF'),
 ('Deals-2026/09/01 12-17-52-468', 'Best Deal', 'CA', '2026-10-06', '2026-10-07', 99, 57, 'PBDD', 'S6'),
 ('Deals-2026/09/03 7-0-31-618', 'Best Deal', 'US', '2026-10-06', '2026-10-07', 2, 0, 'PBDD', 'HC'),
 ('Deals-2026/09/01 12-19-19-332', 'Best Deal', 'CA', '2026-10-06', '2026-10-07', 82, 41, 'PBDD', 'S4'),
 ('Deals-2026/08/31 11-3-23-992', 'Best Deal', 'CA', '2026-10-06', '2026-10-07', 58, 32, 'PBDD', 'SSS4'),
 ('Lightning Deal-2026/09/11 7-20-53-919', 'Lightning Deal', 'CA', '2026-10-06', '2026-10-06', 51, 31, 'PBDD', 'B4'),
 ('Lightning Deal-2026/09/01 7-21-52-794', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 6, 3, 'PBDD', 'SLCPC'),
 ('Lightning Deal-2026/08/31 10-27-42-928', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 61, 14, 'PBDD', 'SF'),
 ('Lightning Deal-2026/09/01 12-45-40-444', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 66, 24, 'PBDD', 'S4'),
 ('Lightning Deal-2026/09/03 18-49-15-995', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 35, 1, 'PBDD', 'LC'),
 ('Lightning Deal-2026/09/01 12-56-38-695', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 17, 12, 'PBDD', 'SLQS'),
 ('Lightning Deal-2026/09/01 13-27-56-316', 'Lightning Deal', 'US', '2026-10-06', '2026-10-06', 57, 43, 'PBDD', 'SSS4'),
 ('Lightning Deal-2026/09/01 12-58-28-922', 'Lightning Deal', 'US', '2026-10-07', '2026-10-07', 75, 0, 'PBDD', 'S6'),
 ('Lightning Deal-2026/09/01 13-23-52-197', 'Lightning Deal', 'US', '2026-10-07', '2026-10-07', 25, 5, 'PBDD', 'SLCF'),
 ('Lightning Deal-2026/09/01 7-15-35-801', 'Lightning Deal', 'US', '2026-10-07', '2026-10-07', 16, 5, 'PBDD', 'DPC'),
 ('Lightning Deal-2026/09/01 13-38-44-257', 'Lightning Deal', 'US', '2026-10-07', '2026-10-07', 4, 0, 'PBDD', 'WCC'),
 ('Lightning Deal-2026/09/24 8-53-0-160', 'Lightning Deal', 'US', '2026-10-15', '2026-10-15', 49, 0, '', 'B6'),
 ('Lightning Deal-2026/09/24 8-26-45-1', 'Lightning Deal', 'US', '2026-10-16', '2026-10-16', 42, 0, '', 'B4'),
 ('Deals-2026/09/24 8-58-31-608', 'Best Deal', 'US', '2026-10-14', '2026-10-27', 41, 0, '', 'SSB6'),
 ('Deals-2026/08/31 14-31-57-962', 'Best Deal', 'US', '2026-10-16', '2026-10-28', 62, 0, '', 'SF'),
 ('Deals-2026/08/31 10-19-48-132', 'Best Deal', 'US', '2026-10-16', '2026-10-28', 76, 0, '', 'S4'),
 ('Deals-2026/08/25 9-58-7-793', 'Best Deal', 'CA', '2026-10-16', '2026-10-24', 76, 0, '', 'B4'),
 ('Deals-2026/08/31 14-33-59-548', 'Best Deal', 'US', '2026-10-16', '2026-10-28', 19, 0, '', 'SLQS'),
 ('Lightning Deal-2026/09/01 7-12-1-512', 'Lightning Deal', 'US', '2026-10-22', '2026-10-22', 38, 0, '', 'LC'),
 ('Lightning Deal-2026/08/31 11-13-31-363', 'Lightning Deal', 'CA', '2026-10-24', '2026-10-24', 63, 0, '', 'B6'),
 ('Deals-2026/09/24 8-49-11-35', 'Best Deal', 'US', '2026-10-20', '2026-10-28', 63, 0, '', 'B4'),
 ('Deals-2026/09/24 8-51-55-73', 'Best Deal', 'US', '2026-10-22', '2026-10-28', 52, 0, '', 'B6'),
 ('Lightning Deal-2026/09/10 6-53-34-335', 'Lightning Deal', 'US', '2026-11-02', '2026-11-02', 65, 0, '', 'S4'),
 ('Deals-2026/08/31 10-33-57-148', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 19, 0, 'BFCM', 'SLQS'),
 ('Deals-2026/09/01 6-58-49-542', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 6, 0, 'BFCM', 'WCC'),
 ('Deals-2026/08/31 9-57-17-223', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 70, 0, 'BFCM', 'S4'),
 ('Deals-2026/08/31 10-33-11-550', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 38, 0, 'BFCM', 'LC'),
 ('Deals-2026/08/31 10-40-40-755', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 2, 0, 'BFCM', 'HC'),
 ('Deals-2026/08/31 11-8-23-569', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 62, 0, 'BFCM', 'SF'),
 ('Deals-2026/08/31 10-53-58-836', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 67, 0, 'BFCM', 'B6'),
 ('Deals-2026/08/31 10-36-57-896', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 7, 0, 'BFCM', 'SLCPC'),
 ('Deals-2026/09/01 6-46-43-735', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 45, 0, 'BFCM', 'SLC4'),
 ('Deals-2026/08/31 10-55-56-349', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 82, 0, 'BFCM', 'S4'),
 ('Deals-2026/08/31 10-24-41-71', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 60, 0, 'BFCM', 'B4'),
 ('Deals-2026/08/31 10-25-39-710', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 54, 0, 'BFCM', 'B6'),
 ('Deals-2026/08/31 10-57-23-720', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 70, 0, 'BFCM', 'B4'),
 ('Deals-2026/08/31 11-1-8-303', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 99, 0, 'BFCM', 'S6'),
 ('Deals-2026/08/31 11-2-41-988', 'Best Deal', 'CA', '2026-11-19', '2026-11-30', 58, 0, 'BFCM', 'SSS4'),
 ('Deals-2026/09/10 6-59-14-547', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 58, 0, 'BFCM', 'SSS4'),
 ('Deals-2026/09/03 6-50-35-276', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 42, 0, 'BFCM', 'SSB6'),
 ('Deals-2026/09/01 6-47-30-562', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 18, 0, 'BFCM', 'SLCLG'),
 ('Deals-2026/08/31 10-27-16-680', 'Best Deal', 'US', '2026-11-19', '2026-11-30', 62, 0, 'BFCM', 'SF'),
 ('Lightning Deal-2026/09/01 7-16-13-292', 'Lightning Deal', 'US', '2026-11-23', '2026-11-23', 16, 0, 'BFCM', 'DPC'),
 ('Lightning Deal-2026/09/01 7-14-9-620', 'Lightning Deal', 'US', '2026-11-23', '2026-11-23', 74, 0, 'BFCM', 'S6'),
 ('Lightning Deal-2026/09/01 13-23-11-474', 'Lightning Deal', 'US', '2026-11-25', '2026-11-25', 25, 0, 'BFCM', 'SLCF'),
]
assert len(ROWS) == 63
# the two satin Lightning Deals Umair said he is cancelling (24 Sep) are recorded but not added to the calendar
CANCELLING = {'Lightning Deal-2026/09/24 8-40-42-43', 'Lightning Deal-2026/09/24 8-39-48-432'}
EVENT_NOTE = {'PBDD': 'Prime Big Deal Days - $100/day + 1.5%', 'BFCM': 'Black Friday - $50/day + 1.5%', '': ''}

DE = load(); byp = {d.get('promo'): d for d in DE['rows']}
changed = []
for promo, typ, mkt, start, end, asins, issues, event, tag in ROWS:
    tag = ALIAS.get(tag, tag)
    if mkt != 'US' or promo in CANCELLING:
        continue
    d = byp.get(promo)
    if d:
        if d['tag'] != tag: changed.append((d['id'], d['tag'], tag)); d['tag'] = tag
        d['asins'] = asins; d['issues'] = issues; d['sc_status'] = 'Has issues' if issues else ('Running' if d.get('sc_status') == 'Running' else 'Upcoming')
        d.pop('confirm_tag', None)
        if d.get('note', '').find('CONFIRM') >= 0:
            d['note'] = EVENT_NOTE[event] or ('booked 24 Sep' if promo.split('-')[1].startswith('2026/09/24') else '')
            if not d['note']: d.pop('note')
        d['tag_source'] = 'Umair 2026-09-24'
    else:
        cmd = [sys.executable, 'scripts/deal.py', 'add', tag, 'bd' if typ == 'Best Deal' else 'ld', start] + ([end] if end != start else []) + ['--promo', promo, '--asins', str(asins)]
        out = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if out.returncode: print('FAIL', tag, start, out.stdout, out.stderr); continue
        save_needed = True
        DE2 = load(); d = {x.get('promo'): x for x in DE2['rows']}[promo]
        d['issues'] = issues; d['sc_status'] = 'Upcoming'; d['source'] = 'SC screen 2026-09-24'; d['tag_source'] = 'Umair 2026-09-24'
        note = EVENT_NOTE[event] + (' - fee $100/day + 1.5%' if promo == 'Deals-2026/09/10 6-59-14-547' else '')
        if note: d['note'] = note
        save(DE2); DE = load(); byp = {x.get('promo'): x for x in DE['rows']}
        changed.append((d['id'], 'NEW', tag))
save(DE)
print('changed/added:', changed)

# CSV of the whole screen with the confirmed tags (US + Canada)
out = pathlib.Path('../1-Deliverables/SC Manage Promotions 2026-09-24.csv')
with out.open('w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['promotion', 'type', 'market', 'start', 'end', 'asins', 'issues', 'event', 'tag', 'app_id', 'note'])
    for promo, typ, mkt, start, end, asins, issues, event, tag in ROWS:
        d = byp.get(promo) if mkt == 'US' else None
        w.writerow([promo, typ, mkt, start, end, asins, issues, event, ALIAS.get(tag, tag), d['id'] if d else '', 'cancelling' if promo in CANCELLING else ('Canada - not in the app' if mkt == 'CA' else '')])
# tracker paste rows (US, app rows sourced from the screen)
out = pathlib.Path('../1-Deliverables/Tracker Deal Calendar rows 2026-09-24.csv')
with out.open('w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['Deal ID', 'Parent Tag', 'Deal Type', 'Start Date', 'End Date', 'Duration (days)', 'Week Label', 'Status', 'Promotion ID', 'ASINs', 'Issues', 'Note'])
    for d in sorted(DE['rows'], key=lambda d: d['id']):
        if d.get('source', '').startswith('SC screen'):
            a = datetime.date.fromisoformat(d['start']); b = datetime.date.fromisoformat(d['end'])
            w.writerow([d['id'], d['tag'], d['type'], d['start'], d['end'], (b - a).days + 1, f"{a:%d-%b} to {b:%d-%b}", 'Upcoming', d.get('promo'), d.get('asins'), d.get('issues'), d.get('note', '')])
print('csvs written')
for d in sorted(DE['rows'], key=lambda d: d['start']):
    if d['start'] >= '2026-09-25': print(' ', d['id'], d['tag'], d['type'][:4], d['start'], d['end'], d.get('asins'), d.get('issues'))
