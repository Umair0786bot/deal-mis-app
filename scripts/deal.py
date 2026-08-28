"""Edit the deal calendar (data/deals.js) - the replacement for typing into the Deal Calendar tab.

  python scripts/deal.py list [--live|--upcoming]
  python scripts/deal.py add  <TAG> <"Best Deal"|"Lightning Deal"> <start> [<end>] [--promo ID] [--asins N] [--id Dxxx]
  python scripts/deal.py close <ID> <end-date> [--cancelled] [--note "..."]
  python scripts/deal.py reopen <ID>                       # undo a close (restores the planned window)
  python scripts/deal.py sc <ID> [--promo ID] [--status "Running"] [--asins N] [--issues N] [--sales 1234.5] [--units N] [--glance N] [--conv 0.054]
  python scripts/deal.py enrol <ID> <file>                 # confirmed enrolled ASIN list, one ASIN per line (or CSV with an ASIN column)
  python scripts/deal.py objective <ID> --units N --rev N --net N [--aged N] [--label "..."]
  python scripts/deal.py window <ID> <start> <end>         # move a deal's window (e.g. after a Seller Central change)

Every command rewrites data/deals.js; run scripts/bundle.py afterwards (or /deal-publish).
"""
import sys, json, re, datetime, pathlib, csv, argparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
F = ROOT / 'data/deals.js'
src = F.read_text(encoding='utf-8')
DE = json.loads(src[src.index('=', 20) + 1:].rstrip().rstrip(';'))
rows = DE['rows']; by_id = {d['id']: d for d in rows}
TYPES = {'bd': 'Best Deal', 'best deal': 'Best Deal', 'ld': 'Lightning Deal', 'lightning deal': 'Lightning Deal', 'bxgy': 'BXGY'}


def save():
    F.write_text('window.DCC=window.DCC||{};window.DCC.deals=' + json.dumps(DE, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')


def iso(s):
    s = s.strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d %b %Y', '%d %B %Y'):
        try: return datetime.datetime.strptime(s, fmt).date().isoformat()
        except ValueError: pass
    raise SystemExit('bad date: ' + s)


def ndays(a, b): return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days + 1


def next_id():
    n = max(int(d['id'][1:]) for d in rows) + 1
    return 'D%03d' % n


def status(d, today):
    if d.get('cancelled'): return 'cancelled'
    return 'upcoming' if today < d['start'] else 'past' if today > d['end'] else 'live'


def main(argv):
    if not argv or argv[0] in ('-h', '--help'): print(__doc__); return
    cmd, rest = argv[0], argv[1:]
    today = datetime.date.today().isoformat()
    if cmd == 'list':
        f = rest[0] if rest else None
        for d in sorted(rows, key=lambda r: r['start']):
            st = status(d, today)
            if f == '--live' and st != 'live': continue
            if f == '--upcoming' and st != 'upcoming': continue
            print('%s %-6s %-14s %s -> %s %2dd %-9s %s%s' % (d['id'], d['tag'], d['type'], d['start'], d['end'], d['days'], st, d.get('promo') or '-', (' [%d ASINs, %d issues]' % (d.get('asins') or 0, d.get('issues') or 0)) if d.get('asins') else ''))
        return
    if cmd == 'add':
        ap = argparse.ArgumentParser(prog='deal.py add'); ap.add_argument('tag'); ap.add_argument('type'); ap.add_argument('start'); ap.add_argument('end', nargs='?'); ap.add_argument('--promo'); ap.add_argument('--asins', type=int); ap.add_argument('--id')
        a = ap.parse_args(rest); t = TYPES.get(a.type.lower(), a.type); start = iso(a.start); end = iso(a.end) if a.end else (start if t == 'Lightning Deal' else None)
        if not end: raise SystemExit('Best Deals need an end date')
        did = a.id or next_id()
        if did in by_id: raise SystemExit(did + ' already exists')
        d = dict(id=did, tag=a.tag.upper(), type=t, start=start, end=end, days=ndays(start, end), src='added ' + today, sc_status='Upcoming' if a.promo else None, promo=a.promo, asins=a.asins, issues=0, sc_sales=None, sc_units=None, sc_glance=None, sc_conv=None, target=None, enrolled=None, objective=None)
        rows.append(d); save(); print('added', did, d['tag'], t, start, '->', end, '(%d days)' % d['days']); return
    d = by_id.get(rest[0] if rest else None)
    if not d: raise SystemExit('unknown deal id')
    if cmd == 'close':
        ap = argparse.ArgumentParser(prog='deal.py close'); ap.add_argument('id'); ap.add_argument('end'); ap.add_argument('--cancelled', action='store_true'); ap.add_argument('--note', default='')
        a = ap.parse_args(rest); end = iso(a.end)
        if 'planned_end' not in d: d['planned_end'] = d['end']
        d['end'] = end; d['days'] = ndays(d['start'], end); d['cancelled'] = a.cancelled; d['sc_status'] = 'Cancelled' if a.cancelled else 'Ended'; d['issues'] = 0
        d['closed_note'] = a.note or ('Cancelled %s.' % end if a.cancelled else 'Ended %s.' % end)
        save(); print('closed', d['id'], 'on', end, '(cancelled)' if a.cancelled else '(ended)', '- ran', d['days'], 'days; planned end', d['planned_end']); return
    if cmd == 'reopen':
        if 'planned_end' in d: d['end'] = d.pop('planned_end'); d['days'] = ndays(d['start'], d['end'])
        d.pop('cancelled', None); d.pop('closed_note', None); d['sc_status'] = 'Running' if d['start'] <= today <= d['end'] else 'Upcoming'
        save(); print('reopened', d['id'], d['start'], '->', d['end']); return
    if cmd == 'sc':
        ap = argparse.ArgumentParser(prog='deal.py sc'); ap.add_argument('id'); ap.add_argument('--promo'); ap.add_argument('--status'); ap.add_argument('--asins', type=int); ap.add_argument('--issues', type=int); ap.add_argument('--sales', type=float); ap.add_argument('--units', type=int); ap.add_argument('--glance', type=int); ap.add_argument('--conv', type=float); ap.add_argument('--date', default=today, help='date the Seller Central page was read (default today)')
        a = ap.parse_args(rest)
        for k, v in dict(promo=a.promo, sc_status=a.status, asins=a.asins, issues=a.issues, sc_sales=a.sales, sc_units=a.units, sc_glance=a.glance, sc_conv=a.conv).items():
            if v is not None: d[k] = v
        if a.sales is not None or a.units is not None:
            hist = [h for h in d.get('sc_history', []) if h['date'] != iso(a.date)]
            hist.append(dict(date=iso(a.date), sales=a.sales, units=a.units, glance=a.glance, conv=a.conv)); d['sc_history'] = sorted(hist, key=lambda h: h['date']); d['sc_asof'] = iso(a.date)
        save(); print('updated', d['id'], {k: d[k] for k in ('promo', 'sc_status', 'asins', 'issues', 'sc_sales', 'sc_units', 'sc_glance', 'sc_conv')}); return
    if cmd == 'enrol':
        p = pathlib.Path(rest[1]); text = p.read_text(encoding='utf-8-sig')
        asins = []
        if p.suffix.lower() == '.csv':
            for r in csv.DictReader(text.splitlines()):
                k = next((k for k in r if k and k.strip().lower() == 'asin'), None)
                if k and r[k]: asins.append(r[k].strip())
        else:
            asins = [l.strip() for l in text.splitlines() if re.match(r'^B0[A-Z0-9]{8}$', l.strip())]
        if not asins: raise SystemExit('no ASINs found in ' + str(p))
        DE['known'][d['id']] = sorted(set(asins)); d['enrolled'] = len(DE['known'][d['id']])
        save(); print('enrolled list for', d['id'], '=', d['enrolled'], 'ASINs'); return
    if cmd == 'objective':
        ap = argparse.ArgumentParser(prog='deal.py objective'); ap.add_argument('id'); ap.add_argument('--units', type=float, required=True); ap.add_argument('--rev', type=float, required=True); ap.add_argument('--net', type=float, required=True); ap.add_argument('--aged', type=float, default=0); ap.add_argument('--label', default='')
        a = ap.parse_args(rest)
        d['objective'] = dict(units=a.units, rev=a.rev, net=a.net, aged=a.aged, label=a.label or ('%s plan' % d['tag']), notes=[]); d['target'] = a.units
        save(); print('objective set for', d['id'], d['objective']); return
    if cmd == 'window':
        start, end = iso(rest[1]), iso(rest[2]); d['start'], d['end'], d['days'] = start, end, ndays(start, end); d.pop('planned_end', None)
        save(); print('window', d['id'], start, '->', end, '(%d days)' % d['days']); return
    raise SystemExit('unknown command ' + cmd)


if __name__ == '__main__':
    main(sys.argv[1:])
