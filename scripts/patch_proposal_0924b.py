"""One-off: proposal page after Umair tagged every promotion on the 24 Sep screen."""
import pathlib, sys
p = pathlib.Path(sys.argv[1]); s = p.read_text(encoding='utf-8'); n = 0
def rep(old, new):
    global s, n
    assert old in s, old[:80]
    s = s.replace(old, new, 1); n += 1

rep('<span>Data: Sellerboard to 20 Sep, Seller Central Manage Promotions screen of 24 Sep, Amazon deal recommendations of 23 Sep</span>',
    '<span>Data: Sellerboard to 20 Sep, Seller Central Manage Promotions screen of 24 Sep (every promotion tagged to its parent), Amazon deal recommendations of 23 Sep</span>')
rep('Bamboo 4pc reaches 27 days in it and Bamboo 6pc 27, before any Lightning Deal.</dd>',
    'Bamboo 4pc reaches 28 days in it and Bamboo 6pc 28, exactly the cap, once their booked Lightning Deals on 15 and 16 October are counted.</dd>')
rep('"Confirm" marks rows tagged by thumbnail and ASIN count that still need a check against the promotion.</p>',
    'Every promotion on the screen is tagged to its parent; ASIN counts in brackets.</p>')
rep('<td><b>BD 20–28 Oct</b> (63 ASINs, booked 24 Sep)</td><td>BD 19–30 Nov (60)</td>',
    '<td><b>LD 16 Oct</b> (42) · <b>BD 20–28 Oct</b> (63), both booked 24 Sep</td><td>BD 19–30 Nov (60)</td>')
rep('<td>LD 18 Sep, LD 20 Sep, BD 26–30 Sep (54, 18 issues)</td><td><span class="pill dim">Nothing offered</span></td><td><b>BD 22–28 Oct</b> (52 ASINs, booked 24 Sep)</td>',
    '<td>LD 18 Sep, LD 20 Sep, BD 26–30 Sep (53)</td><td><span class="pill dim">Nothing offered</span></td><td><b>LD 15 Oct</b> (49) · <b>BD 22–28 Oct</b> (52), both booked 24 Sep</td>')
rep('<td>LD 19 Sep, LD 22 Sep</td><td>LD 7 Oct (75) <span class="pill warn">Confirm</span></td><td>BD 16–28 Oct (76) · LD 2 Nov (65) <span class="pill warn">Confirm</span></td><td>BD 19–30 Nov (70)</td>',
    '<td>LD 19 Sep, LD 22 Sep</td><td>LD 6 Oct (66, 24 issues)</td><td>BD 16–28 Oct (76) · LD 2 Nov (65)</td><td>BD 19–30 Nov (70)</td>')
rep('<tr><td>Satin 6pc (S6)</td><td>—</td><td>LD 6 Oct (66, 24 issues) <span class="pill warn">Confirm</span></td><td>—</td><td>LD 23 Nov (74)</td>',
    '<tr><td>Satin 6pc (S6)</td><td>—</td><td>LD 7 Oct (75)</td><td>—</td><td>LD 23 Nov (74)</td>')
rep('<tr><td>Satin Fitted (SF)</td><td>—</td><td>—</td><td>LD 2 Oct (57) <span class="pill warn">Confirm</span> · BD 16–28 Oct (62)</td>',
    '<tr><td>Satin Fitted (SF)</td><td>—</td><td>LD 6 Oct (61, 14 issues)</td><td>LD 2 Oct (57) · BD 16–28 Oct (62)</td>')
rep('<td>BD 17–30 Sep cancelled before start</td><td>LD 6 Oct (57, 43 issues) <span class="pill warn">Confirm</span></td><td>—</td><td>—</td>',
    '<td>BD 17–30 Sep cancelled before start</td><td>LD 6 Oct (57, 43 issues)</td><td>—</td><td>BD 19–30 Nov (58) at $100 a day</td>')
rep('<td><b>BD 14–27 Oct</b> (41, booked 24 Sep) <span class="pill warn">Confirm</span></td><td>BD 19–30 Nov (42) <span class="pill warn">Confirm</span></td>',
    '<td><b>BD 14–27 Oct</b> (41, booked 24 Sep)</td><td>BD 19–30 Nov (42)</td>')
rep('<td>LD 6 Oct (17, 12 issues) <span class="pill warn">Confirm</span></td><td>LD 2 Oct (13) <span class="pill warn">Confirm</span> · BD 16–28 Oct (19)</td><td>BD 19–30 Nov (19) <span class="pill warn">Confirm</span></td>',
    '<td>LD 6 Oct (17, 12 issues)</td><td>LD 2 Oct (13) · BD 16–28 Oct (19)</td><td>BD 19–30 Nov (19)</td>')
rep('<tr><td>Bamboo Fitted (BF)</td><td>LD 25 Sep cancelled</td><td>LD 6 Oct (61, 14 issues)</td><td>—</td><td>—</td><td>LD week 28 Sep only</td><td class="n">0</td></tr>',
    '<tr><td>Bamboo Fitted (BF)</td><td>LD 25 Sep cancelled</td><td>—</td><td>—</td><td>—</td><td>LD week 28 Sep only</td><td class="n">0</td></tr>')
rep('<p class="small">Also booked but not yet tagged to a parent: two bamboo Lightning Deals on 15 Oct (49 ASINs) and 16 Oct (42 ASINs), and a 58-ASIN Black Friday Best Deal at $100 a day. Two satin Lightning Deals on 30 Sep and 1 Oct are being cancelled. Nineteen Canada promotions (5 Lightning Deals, 5 Prime Big Deal Days deals, 2 in October, 6 Black Friday Best Deals) are booked on the Canadian marketplace and sit outside this board, which is US only.</p>',
    '<p class="small">Two satin Lightning Deals on 30 Sep (Satin 6pc, 90 ASINs) and 1 Oct (Satin 4pc, 87) are being cancelled and are not counted. Nineteen Canada promotions are booked on the Canadian marketplace and sit outside this board, which is US only: Lightning Deals for Bamboo 6pc (25 and 29 Sep, 24 Oct), Satin 6pc (29 Sep), Bamboo 4pc (30 Sep, 6 Oct) and Satin 4pc (3 Oct); Prime Big Deal Days Best Deals for Bamboo 6pc, Satin Fitted, Satin 6pc, Satin 4pc and Sleephoria Satin; a Bamboo 4pc Best Deal 16–24 Oct; and Black Friday Best Deals for Satin Fitted, Bamboo 6pc, Satin 4pc, Bamboo 4pc, Satin 6pc and Sleephoria Satin.</p>')
rep('they are the right windows, and they take both parents to 27 deal-days in the Black Friday window, one Lightning Deal short of the cap. That is the trade-off in decision 3.</p>',
    'they are the right windows, and with the Lightning Deals booked for 15 and 16 October they take both parents to exactly 28 deal-days in the Black Friday window, the cap. That is the trade-off in decision 3.</p>')
rep('They take both parents to 27 deal-days in the Black Friday window, so the ask is to hold both clear of any further Lightning Deal until 19 November, and to run them at 10% off rather than deeper so the Black Friday reference price is protected.</li>',
    'With the Lightning Deals booked for 15 and 16 October they take both parents to exactly 28 deal-days in the Black Friday window, the cap. The ask is to book nothing further on either parent before 19 November, and to run the October deals at 10% off rather than deeper so the Black Friday reference price is protected.</li>')
rep('Bamboo 6pc 26–30 Sep starts with 18 open ASIN issues to clear by Friday.</li>',
    'Bamboo 6pc 26–30 Sep starts Saturday with its issues cleared (53 ASINs).</li>')
p.write_text(s, encoding='utf-8'); print('proposal patched,', n, 'edits')
