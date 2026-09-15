"""Make data/deals.js match the Deal Calendar tab of the newest Deal Tracker Updated*.xlsx.

  python scripts/sync_calendar.py [--downloads DIR] [--file XLSX] [--dry-run] [--keep-extra]

The tracker is the source of truth for WHICH deals exist and their windows. This script:
  * re-keys app deals to the tracker's ids, matching on (tag, type, start) so every bit of
    enrichment (promotion id, Seller Central readings, enrolled ASIN list, objective, notes)
    follows the deal to its new id - allocations/planner are re-keyed with it;
  * adds tracker deals the app does not have;
  * deletes app deals the tracker does not list (deals that were never taken) unless --keep-extra;
  * marks a deal cancelled when any cell on its tracker row says so, and closes it at its
    last day with data rather than its planned end.
Run scripts/update_data.py afterwards so allocations/planner come back keyed by tracker ids.
"""
import argparse, datetime, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
ap = argparse.ArgumentParser()
ap.add_argument('--downloads', default=os.path.expanduser('~/Downloads'))
ap.add_argument('--file')
ap.add_argument('--dry-run', action='store_true')
ap.add_argument('--keep-extra', action='store_true')
A = ap.parse_args()


def load(name):
    s = open(os.path.join(DATA, name + '.js'), encoding='utf-8').read()
    return json.loads(s[s.index('=', 20) + 1:].rstrip().rstrip(';'))


def emit(name, obj):
    s = json.dumps(obj, separators=(',', ':'), ensure_ascii=False)
    open(os.path.join(DATA, name + '.js'), 'w', encoding='utf-8').write('window.DCC=window.DCC||{};window.DCC.%s=%s;\n' % (name, s))
    print('%-16s %7.0f KB' % (name + '.js', len(s) / 1024))


def ndays(a, b): return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days + 1


import openpyxl
tr = A.file or max(glob.glob(os.path.join(A.downloads, 'Deal Tracker Updated*.xlsx')), key=os.path.getmtime)
print('tracker', os.path.basename(tr))
wb = openpyxl.load_workbook(tr, read_only=True, data_only=True)
cal = []
for r in wb['Deal Calendar'].iter_rows(values_only=True):
    if not (r and isinstance(r[0], str) and re.match(r'^D\d{3}$', r[0]) and hasattr(r[3], 'date')):
        continue
    end = r[4].date().isoformat() if hasattr(r[4], 'date') else r[3].date().isoformat()
    cal.append(dict(id=r[0], tag=(r[1] or '').strip(), type=(r[2] or '').strip(), start=r[3].date().isoformat(),
                    end=end, cancelled=any(isinstance(v, str) and 'cancel' in v.lower() for v in r[7:]),
                    status=(r[7] or '').strip() if len(r) > 7 and isinstance(r[7], str) else ''))
print('tracker calendar:', len(cal), 'deals,', sum(1 for c in cal if c['cancelled']), 'cancelled')

DE = load('deals')
by_key = {(d['tag'], d['type'], d['start']): d for d in DE['rows']}
KEEP = ('src', 'sc_status', 'promo', 'asins', 'issues', 'sc_sales', 'sc_units', 'sc_glance', 'sc_conv',
        'target', 'enrolled', 'objective', 'sc_history', 'sc_asof', 'cancelled', 'planned_end', 'closed_note', 'note')
rows, remap, added, matched = [], {}, [], set()
for c in cal:
    old = by_key.get((c['tag'], c['type'], c['start']))
    d = dict(id=c['id'], tag=c['tag'], type=c['type'], start=c['start'], end=c['end'], days=ndays(c['start'], c['end']))
    if old:
        matched.add(old['id'])
        for k in KEEP:
            if k in old and old[k] is not None: d[k] = old[k]
        if old.get('planned_end'):           # a close() shortened it - keep the measured window
            d['planned_end'] = c['end']; d['end'] = old['end']; d['days'] = ndays(d['start'], d['end'])
        if old['id'] != c['id']: remap[old['id']] = c['id']
    else:
        d['src'] = 'tracker ' + datetime.date.today().isoformat()
        added.append(c['id'])
    if c['cancelled'] and not d.get('cancelled'):
        d['cancelled'] = True; d['sc_status'] = 'Cancelled'
        d.setdefault('closed_note', 'Cancelled in the tracker.')
    rows.append(d)
dropped = [d for d in DE['rows'] if d['id'] not in matched]
if A.keep_extra:
    rows += dropped; dropped = []

print('  re-keyed (app -> tracker):', remap or 'none')
print('  added from the tracker   :', added or 'none')
print('  removed (not in tracker) :', len(dropped))
for d in sorted(dropped, key=lambda x: x['start']):
    print('     - %s %-6s %-14s %s -> %s' % (d['id'], d['tag'], d['type'], d['start'], d['end']))

rows.sort(key=lambda d: (d['start'], d['id']))
DE['rows'] = rows
DE['known'] = {remap.get(k, k): v for k, v in DE.get('known', {}).items() if remap.get(k, k) in {d['id'] for d in rows}}
DE['not_in_export'] = [n for n in DE.get('not_in_export', []) if remap.get(n.get('id'), n.get('id')) in {d['id'] for d in rows}]
for n in DE['not_in_export']: n['id'] = remap.get(n['id'], n['id'])
for s in DE.get('sc_raw', []):
    if s.get('deal'): s['deal'] = remap.get(s['deal'], s['deal'])
today = load('settings')['today']
DE['live'] = [d['id'] for d in rows if not d.get('cancelled') and d['start'] <= today <= d['end']]
print('  live now:', DE['live'])

if A.dry_run:
    print('dry run - nothing written'); raise SystemExit
emit('deals', DE)
for name in ('allocations', 'planner'):
    obj = load(name); n = 0
    for r in obj:
        if r.get('deal') in remap: r['deal'] = remap[r['deal']]; n += 1
    obj = [r for r in obj if r.get('deal') in {d['id'] for d in rows}]
    print('  %s: %d rows re-keyed' % (name, n)); emit(name, obj)
