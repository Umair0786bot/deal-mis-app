"""One-off (24 Sep 2026): the app's own calendar (Seller Central screen + deal.py) becomes the only deal calendar.
The tracker's Deal Calendar tab is no longer synced in - not by scripts/sync_calendar.py, not by a Data Hub upload.
Run from deal-mis/:  python scripts/retire_tracker_calendar.py   (idempotent)
"""
import pathlib, re

def patch(path, pairs):
    p = pathlib.Path(path); s = p.read_text(encoding='utf-8'); n = 0
    for old, new in pairs:
        if new in s and old not in s:
            continue  # already applied
        assert old in s, (path, old[:70])
        s = s.replace(old, new, 1); n += 1
    p.write_text(s, encoding='utf-8'); print('patched', path, n)

# 1. Data Hub: a tracker upload still loads allocations / cost master / dashboard / AIS, but never touches the calendar
p = pathlib.Path('assets/hub.js'); s = p.read_text(encoding='utf-8')
if 'mergeCalendar(cal)' in s:
    s = s.replace("        const cm = mergeCalendar(cal); key.calendar = cal;\n",
                  "        // 24 Sep 2026: the tracker's Deal Calendar is no longer a source - the app calendar (Seller Central screen + Data Hub card 5) is.\n", 1)
    s, k = re.subn(r"out\.push\(`calendar: \$\{cal\.length\} deals in the tracker`[^\n]*\);",
                   "out.push(`calendar: ${cal.length} rows in the tracker ignored - the app calendar is the source`);", s, count=1)
    assert k == 1, 'calendar push line'
    s, k = re.subn(r" if \(it\.calendar && it\.calendar\.length\) mergeCalendar\(it\.calendar\);", "", s, count=1)
    assert k == 1, 'calendar re-merge'
    assert 'mergeCalendar(cal)' not in s and 'mergeCalendar(it.calendar)' not in s
    p.write_text(s, encoding='utf-8'); print('patched assets/hub.js')
else:
    print('assets/hub.js already patched')

# 2. sync_calendar.py refuses unless forced
p = pathlib.Path('scripts/sync_calendar.py'); s = p.read_text(encoding='utf-8')
if 'force_from_tracker' not in s:
    s = s.replace("ap.add_argument('--keep-extra', action='store_true')",
                  "ap.add_argument('--keep-extra', action='store_true')\nap.add_argument('--force-from-tracker', action='store_true', help='RETIRED 24 Sep 2026: the app calendar is the source; only use to rebuild history from an old tracker')", 1)
    s = s.replace("A = ap.parse_args()",
                  "A = ap.parse_args()\nif not A.force_from_tracker:\n    raise SystemExit('sync_calendar.py is retired (24 Sep 2026): the Deal MIS calendar is maintained from the Seller Central screen with scripts/deal.py and the Data Hub. Pass --force-from-tracker only to rebuild history from an old tracker.')", 1)
    assert 'force_from_tracker' in s
    p.write_text(s, encoding='utf-8'); print('patched scripts/sync_calendar.py')
else:
    print('scripts/sync_calendar.py already patched')

# 3. docs
NL = '\n'
patch('CLAUDE.md', [
    ("## Seller Central screen bookings (24 Sep)",
     "## The calendar (rule since 24 Sep 2026)" + NL +
     "**The app calendar is the only deal calendar.** `data/deals.js` is maintained from the Seller Central Manage Promotions screen" + NL +
     "(Running + Upcoming) with `scripts/deal.py add|close|sc|promo|window` or the Data Hub (card 5). The tracker's Deal Calendar tab is" + NL +
     "NOT read any more: `sync_calendar.py` refuses without `--force-from-tracker`, and a tracker upload in the Data Hub loads allocations," + NL +
     "cost master, dashboard and AIS only. Tracker allocation rows are still matched to app deals by (tag, type, start)." + NL +
     "When Umair sends a new screen, reconcile it row by row (promotion id is the key), take parent tags from him in screen order, never" + NL +
     "from thumbnails (they change between captures), and close cancelled deals at the last day their price was live." + NL + NL +
     "## Seller Central screen bookings (24 Sep)"),
    ("`sync_calendar.py` keeps `source: 'SC screen…'` deals even when the tracker lacks them, and skips tracker rows that say" + NL +
     "\"never ran\". D128 SS4 BD 17-30 Sep and D133 BF LD 25 Sep never ran (user-confirmed 24 Sep) and were deleted - mark them" + NL +
     "\"cancel - never ran\" in the tracker. Paste rows for the tracker: `1-Deliverables/Tracker Deal Calendar rows 2026-09-24.csv`.",
     "D128 SS4 BD 17-30 Sep and D133 BF LD 25 Sep never ran (user-confirmed 24 Sep) and were deleted. Umair's tag vocabulary:" + NL +
     "DPC = SPC, SSS4 = SS4 (`TAG_ALIAS`)."),
])
patch('README.md', [
    ("`/deal-update` (ingest + rebuild + morning update + verify) → `/deal-publish` (push + republish). `/deal-status` prints the update without changing anything; `/deal-edit` adds, closes or cancels deals and records Seller Central facts (`scripts/deal.py`).",
     "`/deal-update` (ingest + rebuild + morning update + verify) → `/deal-publish` (push + republish). `/deal-status` prints the update without changing anything; `/deal-edit` adds, closes or cancels deals and records Seller Central facts (`scripts/deal.py`)." + NL + NL +
     "**The calendar lives in the app.** Since 24 Sep 2026 the deal calendar is maintained here from the Seller Central Manage Promotions screen (promotion id, dates, ASINs, issues, parent) and is no longer synced from the tracker's Deal Calendar tab. A tracker upload still refreshes allocations, cost master, dashboard pulls and AIS."),
])
patch('../.claude/skills/deal-update/SKILL.md', [
    ("2. If a deal started, ended or was cancelled since the last update, fix the calendar first with the `deal-edit` skill (`scripts/deal.py close|add|sc`). The update never changes the calendar by itself.",
     "2. If a deal started, ended or was cancelled since the last update, fix the calendar first with the `deal-edit` skill (`scripts/deal.py close|add|sc`). The update never changes the calendar by itself. **The app calendar is the only calendar** (since 24 Sep 2026): it is maintained from the Seller Central Manage Promotions screen, never synced from the tracker's Deal Calendar tab (`sync_calendar.py` is retired). When the user sends a new screen, reconcile by promotion id and take parent tags from the user in screen order."),
])
patch('../.claude/skills/deal-edit/SKILL.md', [
    ("description: Edit the deal calendar in the Deal MIS -",
     "description: Edit the deal calendar in the Deal MIS (the app calendar is the only calendar since 24 Sep 2026 - it mirrors the Seller Central Manage Promotions screen, never the tracker) -"),
])
f = pathlib.Path('../1-Deliverables/Tracker Deal Calendar rows 2026-09-24.csv')
if f.exists(): f.unlink(); print('removed tracker paste csv')
print('done')
