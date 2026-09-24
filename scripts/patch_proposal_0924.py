"""One-off: bring the Deal Planning Standards proposal page in line with the 24 Sep Seller Central screen."""
import pathlib, sys
p = pathlib.Path(sys.argv[1]); s = p.read_text(encoding='utf-8')
n = 0
def rep(old, new):
    global s, n
    assert old in s, old[:80]
    s = s.replace(old, new, 1); n += 1

# summary
rep('and judged on units. Measured against the same days without a deal, most of them did not pay for their fee, and the near-continuous run of deals on our five biggest parents is the most likely reason Amazon offered us no Best Deal for Prime Big Deal Days.',
    'and judged on units. Measured against the same days without a deal, most of them did not pay for their fee, and the near-continuous run of deals on our five biggest parents is the most likely reason Amazon offered us no Best Deal for Prime Big Deal Days. The bookings made on 24 September for late October are already inside the Black Friday window, which is where the budget in section C starts to bite.')
rep('<span>Data: Sellerboard to 20 Sep, Seller Central screen of 15 Sep, Amazon deal recommendations of 23 Sep</span>',
    '<span>Data: Sellerboard to 20 Sep, Seller Central Manage Promotions screen of 24 Sep, Amazon deal recommendations of 23 Sep</span>')
# running-now table: D128 never ran
rep('''      <tr><td>D128</td><td>Sleephoria Satin 4pc</td><td>4 of 14</td><td class="n">165</td><td class="n">0.97×</td><td class="n">59%</td><td class="n">24%</td><td class="n neg">−$449</td><td class="n pos">+$663</td><td><span class="pill bad">Losing money</span> no lift yet; watch through day 7</td></tr>
''', '')
rep('<p class="small">Sellerboard data to 20 September. Both deals are reviewed daily in the Deal MIS stop monitor.</p>',
    '<p class="small">Sellerboard data to 20 September; Seller Central shows $35,930 and 506 units for the same deal to 21 September. The Sleephoria Satin Best Deal booked for 17–30 September was cancelled before it started and is not measured. Live deals are reviewed daily in the Deal MIS stop monitor.</p>')
# booking standards stats
rep('<div class="stat"><div class="l">Parents with a Best Deal</div><div class="v">7</div><div class="d">September, down from 13 in June</div></div>',
    '<div class="stat"><div class="l">Parents with a Best Deal</div><div class="v">6</div><div class="d">September, down from 13 in June</div></div>')
rep('<div class="stat"><div class="l">October Best Deals booked</div><div class="v">3</div><div class="d">Satin Fitted, Satin 4pc, Quilt Set, all 16–28 Oct</div></div>',
    '<div class="stat"><div class="l">October Best Deals booked</div><div class="v">6</div><div class="d">three from 31 Aug (16–28 Oct), three added 24 Sep (14–28 Oct)</div></div>')
# budget chart: SS4 back to 15 (the 17-30 Sep deal never ran)
rep('''      <div class="lab">SS4</div><div class="track"><div class="fill over" style="width:72.5%"></div><div class="cap" style="left:70%"></div></div><div class="val">29</div>
      <div class="lab">SSB6</div><div class="track"><div class="fill" style="width:50%"></div><div class="cap" style="left:70%"></div></div><div class="val">20</div>
      <div class="lab">SLQS</div><div class="track"><div class="fill" style="width:50%"></div><div class="cap" style="left:70%"></div></div><div class="val">20</div>
''', '''      <div class="lab">SSB6</div><div class="track"><div class="fill" style="width:50%"></div><div class="cap" style="left:70%"></div></div><div class="val">20</div>
      <div class="lab">SLQS</div><div class="track"><div class="fill" style="width:50%"></div><div class="cap" style="left:70%"></div></div><div class="val">20</div>
      <div class="lab">SS4</div><div class="track"><div class="fill" style="width:37.5%"></div><div class="cap" style="left:70%"></div></div><div class="val">15</div>
''')
rep('Satin 6pc 29, Sleephoria Satin 29, Sleephoria Bamboo 6pc 20, Quilt Set 20,', 'Satin 6pc 29, Sleephoria Bamboo 6pc 20, Quilt Set 20, Sleephoria Satin 15,')
rep('<p>The six parents over the line are the five key lines plus Cooling 4pc, and none of them was offered an event Best Deal for 7–8 October. The only event Best Deal Amazon offered went to Hanging Closet, which has spent no days on deal. The cooldown alone cannot explain this: all six were clear of the 21-day rule on every October date.',
    '<p>The five parents over the line are the four key lines plus Cooling 4pc, and none of them was offered an event Best Deal for 7–8 October. The only event Best Deal Amazon offered went to Hanging Closet, which has spent no days on deal. The cooldown alone cannot explain this: all five were clear of the 21-day rule on every October date.')
rep('<dt>Event protection</dt><dd>No deal-days in the 21 days before Prime Big Deal Days or Black Friday, and no more than 21 deal-days in the 90 days before an event on the parents we want an event Best Deal for. For Black Friday (19 Nov) that window opened on 21 August; Bamboo 6pc already has 20 days in it, Bamboo 4pc 18.</dd>',
    '<dt>Event protection</dt><dd>No deal-days in the 21 days before Prime Big Deal Days or Black Friday, and no more than 21 deal-days in the 90 days before an event on the parents we want an event Best Deal for. For Black Friday (19 Nov) that window opened on 21 August. With the 24 September bookings, Bamboo 4pc reaches 27 days in it and Bamboo 6pc 27, before any Lightning Deal.</dd>')
# event board
rep('<p class="sub">Every parent, what it is doing around the two events, and what Amazon is offering it right now. Bookings from the Seller Central screen of 15 September and the tracker of 24 September; offers from Amazon\'s deal recommendations file of 23 September. "Confirm" marks rows tagged by ASIN count that still need a check against the promotion.</p>',
    '<p class="sub">Every parent, what it is doing around the two events, and what Amazon is offering it right now. Bookings from the Seller Central Manage Promotions screen of 24 September (US, Running and Upcoming); offers from Amazon\'s deal recommendations file of 23 September. "Confirm" marks rows tagged by thumbnail and ASIN count that still need a check against the promotion.</p>')
rep('<tr><td>Bamboo 4pc (B4)</td><td>BD 15–28 Sep, live</td><td><span class="pill dim">Nothing offered</span></td><td>—</td><td>BD 19–30 Nov</td><td>BD 20–28 Oct · LD week 12–18 Oct</td><td class="n neg">32</td></tr>',
    '<tr><td>Bamboo 4pc (B4)</td><td>BD 15–28 Sep, live</td><td><span class="pill dim">Nothing offered</span></td><td><b>BD 20–28 Oct</b> (63 ASINs, booked 24 Sep)</td><td>BD 19–30 Nov (60)</td><td>BD 20–28 Oct · LD week 12–18 Oct</td><td class="n neg">32</td></tr>')
rep('<tr><td>Bamboo 6pc (B6)</td><td>LD 18 Sep, LD 20 Sep, BD 26–30 Sep</td><td><span class="pill dim">Nothing offered</span></td><td>—</td><td>BD 19–30 Nov</td><td>BD 22–28 Oct (also 23 Sep–5 Oct) · LD weeks 28 Sep and 12 Oct</td><td class="n neg">36</td></tr>',
    '<tr><td>Bamboo 6pc (B6)</td><td>LD 18 Sep, LD 20 Sep, BD 26–30 Sep (54, 18 issues)</td><td><span class="pill dim">Nothing offered</span></td><td><b>BD 22–28 Oct</b> (52 ASINs, booked 24 Sep)</td><td>BD 19–30 Nov (54)</td><td>BD 22–28 Oct (also 23 Sep–5 Oct) · LD weeks 28 Sep and 12 Oct</td><td class="n neg">36</td></tr>')
rep('<tr><td>Satin 4pc (S4)</td><td>LD 19 Sep, LD 22 Sep</td><td>LD 7 Oct (75 ASINs)</td><td>BD 16–28 Oct</td><td>BD 19–30 Nov</td><td>LD week 28 Sep only, no Best Deal</td><td class="n neg">31</td></tr>',
    '<tr><td>Satin 4pc (S4)</td><td>LD 19 Sep, LD 22 Sep</td><td>LD 7 Oct (75) <span class="pill warn">Confirm</span></td><td>BD 16–28 Oct (76) · LD 2 Nov (65) <span class="pill warn">Confirm</span></td><td>BD 19–30 Nov (70)</td><td>LD week 28 Sep only, no Best Deal</td><td class="n neg">31</td></tr>')
rep('<tr><td>Satin 6pc (S6)</td><td>—</td><td>—</td><td>—</td><td>LD 23 Nov</td><td>LD week 28 Sep only, no Best Deal</td><td class="n neg">29</td></tr>',
    '<tr><td>Satin 6pc (S6)</td><td>—</td><td>LD 6 Oct (66, 24 issues) <span class="pill warn">Confirm</span></td><td>—</td><td>LD 23 Nov (74)</td><td>LD week 28 Sep only, no Best Deal</td><td class="n neg">29</td></tr>')
rep('<tr><td>Satin Fitted (SF)</td><td>BD 17–30 Sep <span class="pill warn">Confirm</span></td><td>—</td><td>BD 16–28 Oct</td><td>BD 19–30 Nov</td><td>BD 23–24 Sep · LD week 28 Sep</td><td class="n">14</td></tr>',
    '<tr><td>Satin Fitted (SF)</td><td>—</td><td>—</td><td>LD 2 Oct (57) <span class="pill warn">Confirm</span> · BD 16–28 Oct (62)</td><td>BD 19–30 Nov (62)</td><td>BD 23–24 Sep · LD week 28 Sep</td><td class="n">14</td></tr>')
rep('<tr><td>Silk Pillowcase (SPC)</td><td>—</td><td>LD 7 Oct</td><td>—</td><td>LD 23 Nov</td><td>LD week 28 Sep</td><td class="n">14</td></tr>',
    '<tr><td>Silk Pillowcase (SPC)</td><td>LD 30 Sep (16)</td><td>LD 7 Oct (16, 5 issues)</td><td>—</td><td>LD 23 Nov (16)</td><td>LD week 28 Sep</td><td class="n">14</td></tr>')
rep('<tr><td>Linen Curtains (LC)</td><td>BD 15–28 Sep <span class="pill warn">Confirm</span></td><td>LD 6 Oct? (35 ASINs, LC or SLCF)</td><td>LD 22 Oct</td><td>BD 19–30 Nov</td><td>Nothing</td><td class="n">5</td></tr>',
    '<tr><td>Linen Curtains (LC)</td><td>—</td><td>LD 6 Oct (35, 1 issue)</td><td>LD 22 Oct (38)</td><td>BD 19–30 Nov (38)</td><td>Nothing</td><td class="n">5</td></tr>')
rep('<tr><td>Chair Covers (WCC)</td><td>—</td><td>LD 7 Oct? (4 ASINs)</td><td>—</td><td>BD 19–30 Nov</td><td>BD 23 Sep–5 Oct · LD week 28 Sep (6-piece)</td><td class="n">0</td></tr>',
    '<tr><td>Chair Covers (WCC)</td><td>—</td><td>LD 7 Oct (4)</td><td>—</td><td>BD 19–30 Nov (6)</td><td>BD 23 Sep–5 Oct · LD week 28 Sep (6-piece)</td><td class="n">0</td></tr>')
rep('<tr><td>Hanging Closet (HC)</td><td>—</td><td>BD 6–7 Oct (2 ASINs)</td><td>—</td><td>BD 19–30 Nov</td><td>Nothing</td><td class="n">0</td></tr>',
    '<tr><td>Hanging Closet (HC)</td><td>—</td><td>BD 6–7 Oct (2)</td><td>—</td><td>BD 19–30 Nov (2)</td><td>Nothing</td><td class="n">0</td></tr>')
rep('<tr><td>Sleephoria Satin 4pc (SS4)</td><td>BD 17–30 Sep, live</td><td>LD 6 Oct? (57 ASINs, B6 or SS4)</td><td>—</td><td>—</td><td>BD 22–28 Oct · LD week 12–18 Oct</td><td class="n neg">29</td></tr>',
    '<tr><td>Sleephoria Satin 4pc (SS4)</td><td>BD 17–30 Sep cancelled before start</td><td>LD 6 Oct (57, 43 issues) <span class="pill warn">Confirm</span></td><td>—</td><td>—</td><td>BD 22–28 Oct · LD week 12–18 Oct</td><td class="n">15</td></tr>')
rep('<tr><td>Sleephoria Bamboo 6pc (SSB6)</td><td>LD 2 Sep, LD 21 Sep</td><td>—</td><td>—</td><td>—</td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">20</td></tr>',
    '<tr><td>Sleephoria Bamboo 6pc (SSB6)</td><td>LD 2 Sep, LD 21 Sep</td><td>—</td><td><b>BD 14–27 Oct</b> (41, booked 24 Sep) <span class="pill warn">Confirm</span></td><td>BD 19–30 Nov (42) <span class="pill warn">Confirm</span></td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">20</td></tr>')
rep('<tr><td>Sleephoria Cooling 4pc (SLC4)</td><td>LD 21 Sep</td><td>—</td><td>—</td><td>BD 19–30 Nov</td><td>BD 28 Sep–5 Oct · LD week 28 Sep</td><td class="n">2</td></tr>',
    '<tr><td>Sleephoria Cooling 4pc (SLC4)</td><td>LD 21 Sep</td><td>—</td><td>—</td><td>BD 19–30 Nov (45)</td><td>BD 28 Sep–5 Oct · LD week 28 Sep</td><td class="n">2</td></tr>')
rep('<tr><td>Cooling Sheets LG (SLCLG)</td><td>—</td><td>—</td><td>—</td><td>BD 19–30 Nov</td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">0</td></tr>',
    '<tr><td>Cooling Sheets LG (SLCLG)</td><td>—</td><td>—</td><td>—</td><td>BD 19–30 Nov (18)</td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">0</td></tr>')
rep('<tr><td>Cooling Pillowcases (SLCPC)</td><td>—</td><td>LD 6 Oct</td><td>—</td><td>BD 19–30 Nov</td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">0</td></tr>',
    '<tr><td>Cooling Pillowcases (SLCPC)</td><td>—</td><td>LD 6 Oct (6, 3 issues)</td><td>—</td><td>BD 19–30 Nov (7)</td><td>BD 23 Sep–5 Oct · LD week 28 Sep</td><td class="n">0</td></tr>')
rep('<tr><td>Quilt Set (SLQS)</td><td>BD 31 Aug–13 Sep, LD 18 Sep</td><td>LD 6 Oct</td><td>BD 16–28 Oct</td><td>BD 19–30 Nov</td><td>LD week 28 Sep only</td><td class="n">20</td></tr>',
    '<tr><td>Quilt Set (SLQS)</td><td>BD 31 Aug–13 Sep, LD 18 Sep</td><td>LD 6 Oct (17, 12 issues) <span class="pill warn">Confirm</span></td><td>LD 2 Oct (13) <span class="pill warn">Confirm</span> · BD 16–28 Oct (19)</td><td>BD 19–30 Nov (19) <span class="pill warn">Confirm</span></td><td>LD week 28 Sep only</td><td class="n">20</td></tr>')
rep('<tr><td>Cooling Fitted (SLCF)</td><td>—</td><td>LD 7 Oct</td><td>—</td><td>LD 25 Nov? <span class="pill warn">Confirm</span></td><td>LD week 28 Sep only</td><td class="n">0</td></tr>',
    '<tr><td>Cooling Fitted (SLCF)</td><td>—</td><td>LD 7 Oct (25, 5 issues)</td><td>—</td><td>LD 25 Nov (25)</td><td>LD week 28 Sep only</td><td class="n">0</td></tr>')
rep('<tr><td>Bamboo Fitted (BF)</td><td>LD 25 Sep</td><td>LD 6 Oct</td><td>—</td><td>—</td><td>LD week 28 Sep only</td><td class="n">1</td></tr>',
    '<tr><td>Bamboo Fitted (BF)</td><td>LD 25 Sep cancelled</td><td>LD 6 Oct (61, 14 issues)</td><td>—</td><td>—</td><td>LD week 28 Sep only</td><td class="n">0</td></tr>')
rep('<p class="small">Also booked but not yet tagged to a parent: a 66-ASIN Lightning Deal on 6 Oct (Satin 4pc or Bamboo 6pc), a 65-ASIN Lightning Deal on 2 Nov, and two Black Friday Best Deals of 58 ASINs at $100 a day and 42 ASINs. These need the promotion opened in Seller Central to confirm.</p>',
    '<p class="small">Also booked but not yet tagged to a parent: two bamboo Lightning Deals on 15 Oct (49 ASINs) and 16 Oct (42 ASINs), and a 58-ASIN Black Friday Best Deal at $100 a day. Two satin Lightning Deals on 30 Sep and 1 Oct are being cancelled. Nineteen Canada promotions (5 Lightning Deals, 5 Prime Big Deal Days deals, 2 in October, 6 Black Friday Best Deals) are booked on the Canadian marketplace and sit outside this board, which is US only.</p>')
rep('<p><b>What the board shows.</b> Black Friday is well covered: 13 Best Deals and 3 Lightning Deals across 15 parents. October is the hole: after Prime Big Deal Days only three parents have a Best Deal, and December has nothing booked. Amazon is offering the two Bamboo parents and Sleephoria Satin a Best Deal from 20–22 October; under the budget those are worth taking only if we accept 29–36 deal-days in the Black Friday window, which is the trade-off in decision 3.</p>',
    '<p><b>What the board shows.</b> Black Friday is well covered: 13 Best Deals and 3 Lightning Deals across 15 parents, with submissions open until 20 October. October now has six Best Deals after the 24 September bookings, and December has nothing booked. The two Bamboo Best Deals booked for 20–28 and 22–28 October are the ones Amazon offered on 23 September; they are the right windows, and they take both parents to 27 deal-days in the Black Friday window, one Lightning Deal short of the cap. That is the trade-off in decision 3.</p>')
# decisions
rep('<li><b>Late-October Bamboo Best Deals.</b> Amazon is offering Bamboo 4pc 20–28 Oct and Bamboo 6pc 22–28 Oct. Taking them puts both parents at 29–36 deal-days in the Black Friday window. My recommendation is to take Bamboo 4pc for 7 days at 10% and hold Bamboo 6pc clear, because 6pc has the bigger Black Friday deal and the higher count.</li>',
    '<li><b>Late-October Bamboo Best Deals.</b> Bamboo 4pc 20–28 Oct and Bamboo 6pc 22–28 Oct were booked on 24 September, in the windows Amazon offered. They take both parents to 27 deal-days in the Black Friday window, so the ask is to hold both clear of any further Lightning Deal until 19 November, and to run them at 10% off rather than deeper so the Black Friday reference price is protected.</li>')
rep('<li><b>Mid-deal calls this week.</b> Bamboo 4pc (D126) continues with ads brought under 15% and the three flagged SKUs reviewed; Sleephoria Satin (D128) is reviewed on day 7 and stopped if the uplift is still under 1.2×.</li>',
    '<li><b>Mid-deal calls this week.</b> Bamboo 4pc (D126) continues with ads brought under 15% and the three flagged SKUs reviewed. Bamboo 6pc 26–30 Sep starts with 18 open ASIN issues to clear by Friday.</li>')
rep('<p>Sources: Deal MIS (Sellerboard per-ASIN exports 23 Jun–20 Sep 2026; tracker Deal Calendar of 24 Sep; Seller Central promotion files for the Bamboo 4pc and Quilt Set deals), Seller Central Manage Promotions screen of 15 Sep 2026,',
    '<p>Sources: Deal MIS (Sellerboard per-ASIN exports 23 Jun–20 Sep 2026; tracker Deal Calendar of 24 Sep; Seller Central promotion files for the Bamboo 4pc and Quilt Set deals), Seller Central Manage Promotions screen of 24 Sep 2026 (63 promotions, performance to 21 Sep),')
p.write_text(s, encoding='utf-8'); print('proposal patched,', n, 'edits')
