/* Deal Command Center — calculation engine.
   Same rules the tracker workbooks use, applied to the Sellerboard daily feed:
   - baseline = N clean days before the deal (skips days inside another deal for the same parent, and days with no export)
   - fee      = min(fee_day x billed days + fee_pct x deal revenue, fee_cap)      billed days = elapsed (default) or planned
   - net      = Sellerboard net profit (ads already inside it) - deal fee
   - incremental = net with the deal - (baseline net/day x elapsed days)
   - halo     = the parent's SKUs NOT on deal, during the same days vs their baseline */
(function () {
  const D = window.DCC;
  const E = {};
  const SB = D.sellerboard;
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  E.addDays = addDays; E.diffDays = diffDays;

  // ---------- indexes (rebuilt after a CSV load via E.reindex) ----------
  let dateIdx, byDate, asinIdx, skuIdx, tagSets, skuMeta, allocByDeal, plannerByDeal, deals, dealById;
  function index() {
    dateIdx = new Map(SB.dates.map((d, i) => [d, i]));
    byDate = SB.dates.map(() => []);
    SB.rows.forEach(r => byDate[r[0]].push(r));
    asinIdx = new Map(SB.asins.map((a, i) => [a[0], i]));
    skuIdx = new Map(SB.asins.map((a, i) => [a[1], i]));
    tagSets = {};
    SB.asins.forEach((a, i) => { (tagSets[a[2]] = tagSets[a[2]] || new Set()).add(i); });
    skuMeta = new Map(D.skus.map(s => [s.sku, s]));
    allocByDeal = {};
    D.allocations.forEach(a => { (allocByDeal[a.deal] = allocByDeal[a.deal] || {})[a.sku] = a.alloc; });
    plannerByDeal = {};
    D.planner.forEach(p => { (plannerByDeal[p.deal] = plannerByDeal[p.deal] || {})[p.sku] = p; });
    deals = D.deals.rows;
    dealById = new Map(deals.map(d => [d.id, d]));
    E.tagSets = tagSets; E.dates = SB.dates; E.asinIdx = asinIdx; E.skuIdx = skuIdx; E.skuMeta = skuMeta;
    E.allocByDeal = allocByDeal; E.plannerByDeal = plannerByDeal; E.deals = deals;
    E.lastDate = SB.dates[SB.dates.length - 1]; E.firstDate = SB.dates[0];
  }
  index();
  E.reindex = index;
  E.dealById = (id) => dealById.get(id);

  E.status = (d, today) => today < d.start ? 'upcoming' : today > d.end ? 'past' : 'live';
  E.dealsOn = (date, tag) => deals.filter(d => d.start <= date && d.end >= date && (!tag || d.tag === tag));

  /** Which ASIN indexes belong to a deal: the confirmed enrolled list if known, else the parent family. */
  E.scope = (deal) => {
    const known = D.deals.known[deal.id];
    if (known && known.length) { const s = new Set(); known.forEach(a => { const i = asinIdx.get(a); if (i != null) s.add(i); }); return { set: s, known: true }; }
    return { set: new Set(tagSets[deal.tag] || []), known: false };
  };

  /** Sum one day for a set of asin indexes. Returns money in dollars. */
  const sumDay = (di, set) => {
    const o = { units: 0, sales: 0, ppc: 0, ads: 0, net: 0, fees: 0, cogs: 0, refunds: 0, bsr: null, n: 0 };
    if (di == null) return o;
    let bsr = 0, bn = 0;
    for (const r of byDate[di]) {
      if (!set.has(r[1])) continue;
      o.units += r[2]; o.sales += r[3] / 100; o.ppc += r[4] / 100; o.ads += r[5] / 100; o.net += r[6] / 100; o.fees += r[8] / 100; o.cogs += r[9] / 100; o.refunds += r[10] / 100; o.n++;
      if (r[7] > 0) { bsr += r[7]; bn++; }
    }
    if (bn) o.bsr = bsr / bn;
    return o;
  };
  E.sumDay = sumDay;

  /** Daily series for a set between two dates (inclusive), only dates that have an export. */
  E.series = (set, from, to) => SB.dates.filter(d => d >= from && d <= to).map(d => ({ date: d, ...sumDay(dateIdx.get(d), set) }));

  /** Clean baseline days: walk back from the day before `start`, skipping days with no export and days inside another deal for `tag`. */
  E.baselineDays = (start, tag, n = D.settings.baseline_days) => {
    const out = []; let d = addDays(start, -1); let guard = 0;
    while (out.length < n && guard++ < 120 && d >= E.firstDate) {
      if (dateIdx.has(d) && !E.dealsOn(d, tag).length) out.unshift(d);
      d = addDays(d, -1);
    }
    return out;
  };

  E.fee = (days, revenue, s = D.settings) => Math.min(s.fee_day * days + s.fee_pct * revenue, s.fee_cap);

  /** Full metrics for a deal as of a date. */
  E.metrics = (deal, asOf, opts = {}) => {
    asOf = asOf || E.lastDate;
    const s = D.settings;
    const { set, known } = E.scope(deal);
    const winEnd = deal.end < asOf ? deal.end : asOf;
    const dealDays = SB.dates.filter(d => d >= deal.start && d <= winEnd);
    const elapsed = deal.start <= asOf ? Math.max(0, diffDays(deal.start, winEnd) + 1) : 0;
    const planned = deal.days;
    const daily = dealDays.map(d => ({ date: d, day: diffDays(deal.start, d) + 1, ...sumDay(dateIdx.get(d), set) }));
    const tot = daily.reduce((a, r) => { for (const k of ['units', 'sales', 'ppc', 'ads', 'net', 'fees', 'cogs', 'refunds']) a[k] += r[k]; return a; }, { units: 0, sales: 0, ppc: 0, ads: 0, net: 0, fees: 0, cogs: 0, refunds: 0 });
    const bdays = E.baselineDays(deal.start, deal.tag);
    const bl = bdays.map(d => sumDay(dateIdx.get(d), set));
    const nb = bl.length || 1;
    const base = { units: 0, sales: 0, ads: 0, net: 0, fees: 0, cogs: 0, refunds: 0 };
    bl.forEach(r => { for (const k in base) base[k] += r[k] / nb; });
    const nData = daily.length;
    const billed = opts.basis === 'planned' ? planned : elapsed;
    const fee = elapsed ? E.fee(billed, tot.sales) : 0;
    const netAfterFee = tot.net - fee;
    const nodeal = { units: base.units * nData, sales: base.sales * nData, ads: base.ads * nData, net: base.net * nData };
    const incremental = netAfterFee - nodeal.net;
    const uplift = base.units > 0 && nData ? (tot.units / nData) / base.units : null;
    const tacos = tot.sales > 0 ? tot.ads / tot.sales : null;
    const baseTacos = base.sales > 0 ? base.ads / base.sales : null;
    const asp = tot.units ? tot.sales / tot.units : null;
    const feeShare = tot.sales > 0 ? fee / tot.sales : null;
    // halo: rest of the family
    let halo = null;
    if (known) {
      const fam = tagSets[deal.tag] || new Set(); const rest = new Set([...fam].filter(i => !set.has(i)));
      if (rest.size) {
        const hd = dealDays.map(d => sumDay(dateIdx.get(d), rest)); const hb = bdays.map(d => sumDay(dateIdx.get(d), rest));
        const ht = hd.reduce((a, r) => ({ units: a.units + r.units, sales: a.sales + r.sales, ads: a.ads + r.ads, net: a.net + r.net }), { units: 0, sales: 0, ads: 0, net: 0 });
        const hbase = hb.reduce((a, r) => ({ units: a.units + r.units / nb, sales: a.sales + r.sales / nb, ads: a.ads + r.ads / nb, net: a.net + r.net / nb }), { units: 0, sales: 0, ads: 0, net: 0 });
        halo = { n: rest.size, ...ht, base: hbase, diff: ht.net - hbase.net * nData, unitsDiff: ht.units - hbase.units * nData };
      }
    }
    // per SKU
    const alloc = allocByDeal[deal.id] || {};
    const perSku = [...set].map(i => {
      const a = SB.asins[i]; const one = new Set([i]);
      const dd = dealDays.reduce((acc, d) => { const r = sumDay(dateIdx.get(d), one); acc.units += r.units; acc.sales += r.sales; acc.ads += r.ads; acc.net += r.net; return acc; }, { units: 0, sales: 0, ads: 0, net: 0 });
      const bb = bdays.reduce((acc, d) => acc + sumDay(dateIdx.get(d), one).units, 0) / nb;
      const meta = skuMeta.get(a[1]) || {};
      const al = alloc[a[1]]; const stop = al != null ? al * s.stop_line : null;
      const age = SB.age[String(i)];
      const proj = nData && planned > nData ? dd.units / nData * planned : dd.units;
      let action = '';
      if (stop != null && al > 0 && dd.units >= stop) action = 'STOP - at limit';
      else if (stop != null && al > 0 && dd.units >= al * s.stop_warn) action = 'near limit';
      else if (stop != null && al > 0 && proj >= stop) action = 'will breach';
      else if (dd.net < 0 && dd.ads > Math.abs(dd.net)) action = 'cut ads';
      else if (dd.units === 0 && age && age[1] > 0) action = 'clear stock';
      else if (dd.net < 0) action = 'review';
      return { i, asin: a[0], sku: a[1], tag: a[2], ...dd, base: bb, uplift: bb > 0 && nData ? (dd.units / nData) / bb : null, tacos: dd.sales > 0 ? dd.ads / dd.sales : null,
        netUnit: dd.units ? dd.net / dd.units : null, alloc: al, stop, pctStop: stop ? dd.units / stop : null, proj, aged: age ? age[1] : 0, agedCharge: age ? age[0] : 0, agesSoon: age ? (age[2] + age[3] + age[4]) : 0,
        price: meta.price, cogs: meta.cogs, fba: meta.fba, rankVar: meta.rank_var, action };
    }).sort((x, y) => x.net - y.net);
    const losers = perSku.filter(p => p.net < 0);
    const stops = perSku.filter(p => p.alloc > 0 && p.stop != null && p.units >= p.stop);
    const aged = perSku.reduce((a, p) => a + p.aged, 0);
    const agedCharge = perSku.reduce((a, p) => a + p.agedCharge, 0);
    const agesSoon = perSku.reduce((a, p) => a + p.agesSoon, 0);
    const gates = [
      { n: 1, key: 'profit', name: 'Profit - net after ads and fee', reading: netAfterFee, fmt: 'money', threshold: '> $0', verdict: !elapsed ? 'na' : netAfterFee > 0 ? 'pass' : 'fail', label: !elapsed ? 'not started' : netAfterFee > 0 ? 'PASS' : 'LOSING MONEY' },
      { n: 2, key: 'incremental', name: 'Incremental - better than not running it', reading: incremental, fmt: 'money', threshold: '> $0', verdict: !elapsed ? 'na' : incremental > 0 ? 'pass' : 'fail', label: !elapsed ? 'not started' : incremental > 0 ? 'PASS' : 'WORSE THAN NOTHING' },
      { n: 3, key: 'uplift', name: 'Uplift - units vs baseline', reading: uplift, fmt: 'x', threshold: '>= 1.20x', verdict: uplift == null ? 'na' : uplift >= 1.2 ? 'pass' : nData >= 3 ? 'fail' : 'watch', label: uplift == null ? 'no baseline' : uplift >= 1.2 ? 'PASS' : nData >= 3 ? 'WEAK LIFT' : 'EARLY' },
      { n: 4, key: 'tacos', name: 'TACOS on the deal SKUs', reading: tacos, fmt: 'pct', threshold: '<= 25%', verdict: tacos == null ? 'na' : tacos <= .25 ? 'pass' : 'fail', label: tacos == null ? '-' : tacos <= .25 ? 'PASS' : 'ADS TOO HIGH' },
      { n: 5, key: 'fee', name: 'Fee as a share of deal revenue', reading: feeShare, fmt: 'pct', threshold: '<= 20%', verdict: feeShare == null ? 'na' : feeShare <= .2 ? 'pass' : 'fail', label: feeShare == null ? '-' : feeShare <= .2 ? 'PASS' : 'FEE TOO HIGH' },
      { n: 6, key: 'losers', name: 'SKUs losing money after ads', reading: losers.length, fmt: 'int', threshold: '0', verdict: !elapsed ? 'na' : losers.length ? 'watch' : 'pass', label: !elapsed ? '-' : losers.length ? losers.length + ' SKUS' : 'PASS' },
      { n: 7, key: 'stop', name: 'SKUs at or past their STOP line', reading: stops.length, fmt: 'int', threshold: '0', verdict: !elapsed ? 'na' : stops.length ? 'fail' : 'pass', label: !elapsed ? '-' : stops.length ? stops.length + ' TO STOP' : 'PASS' },
      { n: 8, key: 'aged', name: 'Aged stock still on the shelf', reading: aged, fmt: 'int', threshold: 'falling', verdict: aged > 0 ? 'watch' : 'pass', label: aged > 0 ? 'WATCH' : 'CLEAR' },
    ];
    let verdict, vclass;
    if (!elapsed) { verdict = 'NOT STARTED'; vclass = 'dim'; }
    else if (!nData) { verdict = 'NO DATA YET'; vclass = 'dim'; }
    else if (netAfterFee <= 0) { verdict = 'LOSING MONEY'; vclass = 'bad'; }
    else if (incremental <= 0) { verdict = 'NOT INCREMENTAL'; vclass = 'warn'; }
    else if (uplift != null && uplift < 1.2 && nData >= 3) { verdict = 'WEAK LIFT'; vclass = 'warn'; }
    else { verdict = 'HEALTHY'; vclass = 'good'; }
    return { deal, set, known, asOf, elapsed, planned, billed, nData, daily, tot, bdays, base, fee, netAfterFee, nodeal, incremental, uplift, tacos, baseTacos, asp, feeShare, halo, perSku, losers, stops, aged, agedCharge, agesSoon, gates, verdict, vclass,
      objective: deal.objective, target: deal.target };
  };

  /** Projection to end of window: three scenarios holding ASP / TACOS / margin constant. */
  E.projection = (m, months = 12) => {
    const s = D.settings; const deal = m.deal; const remaining = Math.max(0, deal.days - m.elapsed);
    if (!m.nData) return null;
    const perDay = m.tot.units / m.nData; const asp = m.asp || 0; const marginRate = m.tot.sales ? m.tot.net / m.tot.sales : 0; const tacos = m.tacos || 0;
    const shape = (D.deals.shape_by_tag && D.deals.shape_by_tag[deal.tag] && D.deals.shape_by_tag[deal.tag].shape) || D.deals.shape_pool;
    const perUnitCharge = m.aged ? m.agedCharge / m.aged : 0;
    const mk = (name, note, units) => {
      const rev = m.tot.sales + (units - m.tot.units) * asp; const ads = rev * tacos; const net = rev * marginRate; const fee = E.fee(deal.days, rev); const naf = net - fee;
      const cleared = Math.min(units, m.aged); const storage = cleared * perUnitCharge * months;
      return { name, note, units, rev, ads, fee, net: naf, storage, netIncl: naf + storage };
    };
    const out = [];
    if (shape && shape.length) { // rescale remaining days by the parent's last long deal curve
      const n = shape.length; const idx = (k) => Math.min(n - 1, Math.floor(k / deal.days * n));
      const doneW = Array.from({ length: m.elapsed }, (_, k) => shape[idx(k)]).reduce((a, b) => a + b, 0) || 1;
      const restW = Array.from({ length: remaining }, (_, k) => shape[idx(m.elapsed + k)]).reduce((a, b) => a + b, 0);
      out.push(mk('Deal curve - same parent\'s last deal', 'remaining days follow how the last long ' + deal.tag + ' deal actually sold', m.tot.units + m.tot.units / doneW * restW));
    }
    out.push(mk('Flat - today\'s rate held', perDay.toFixed(1) + ' units/day to the end', m.tot.units + perDay * remaining));
    const allocTot = m.perSku.reduce((a, p) => a + (p.alloc || 0), 0);
    if (allocTot > 0) out.push(mk('Sells the full safe allocation', allocTot.toLocaleString() + ' units approved by the planner', allocTot));
    return { scenarios: out, remaining, months };
  };

  /** Tag-level (or all) daily series across the whole feed */
  E.tagSeries = (tag) => { const set = tag === 'ALL' ? new Set(SB.asins.map((_, i) => i)) : (tagSets[tag] || new Set()); return SB.dates.map((d, i) => ({ date: d, ...sumDay(i, set) })); };

  /** Ad spend (Scale Insight) per tag per day */
  E.adsByTag = () => { const out = {}; D.ads.forEach(a => { const meta = skuMeta.get(a.sku); const tag = (meta && meta.tag) || (asinIdx.has(a.asin) ? SB.asins[asinIdx.get(a.asin)][2] : '?'); const k = a.date + '|' + tag; const o = out[k] = out[k] || { date: a.date, tag, imp: 0, clicks: 0, orders: 0, units: 0, sales: 0, spent: 0, n: 0 }; o.imp += a.imp; o.clicks += a.clicks; o.orders += a.orders; o.units += a.units; o.sales += a.sales; o.spent += a.spent; o.n++; }); return Object.values(out); };

  /** Planning engine for an upcoming deal (Deals Financials idiom) */
  E.plan = (deal, params) => {
    const p = Object.assign({ referral: D.settings.referral, uplift: null, fee_day: D.settings.fee_day, fee_pct: D.settings.fee_pct, fee_cap: D.settings.fee_cap, discount: 0.15 }, params || {});
    const planner = plannerByDeal[deal.id] || {}; const alloc = allocByDeal[deal.id] || {};
    const skus = new Set([...Object.keys(planner), ...Object.keys(alloc)]);
    if (!skus.size) { D.skus.filter(s => s.tag === deal.tag).forEach(s => skus.add(s.sku)); }
    const up = (D.uplift.find(u => u.tag === deal.tag) || {}).uplift || (D.uplift.find(u => u.tag === 'DEFAULT') || {}).uplift || 1.42;
    const uplift = p.uplift || (deal.type === 'Lightning Deal' ? up : (D.deals.shape_by_tag && D.deals.shape_by_tag[deal.tag] ? 1.7 : 1.5));
    const rows = [...skus].map(sku => {
      const meta = skuMeta.get(sku) || {}; const pl = planner[sku]; const al = alloc[sku] != null ? alloc[sku] : (pl ? pl.safe_alloc : null);
      const price = meta.price || null; const dealPrice = price ? Math.round(price * (1 - p.discount) * 100) / 100 : null;
      const vel = pl ? pl.vel : (meta.p30 || meta.p7 || 0);
      const expected = pl && pl.baseline_demand != null ? pl.baseline_demand * uplift : vel * deal.days * uplift;
      const sellable = al != null ? Math.min(expected, al) : expected;
      const cogs = meta.cogs || 0, fba = meta.fba || 0;
      const margin = dealPrice ? dealPrice - cogs - fba - dealPrice * p.referral : null;
      const status = pl ? pl.status : (al === 0 ? 'AT_RISK' : al > 0 ? 'SAFE' : 'NO PLANNER ROW');
      const age = asinIdx.has(meta.asin) ? SB.age[String(asinIdx.get(meta.asin))] : null;
      let decision = 'ENROL';
      if (!price) decision = 'EXCLUDE - no price on file';
      else if (margin != null && margin <= 0) decision = 'EXCLUDE - negative margin';
      else if (al === 0 && age && age[1] > 0) decision = 'LTSF REVIEW - alloc 0 but aged stock';
      else if (al === 0) decision = 'EXCLUDE - safe allocation 0';
      else if (al == null) decision = 'PENDING - planner run needed';
      return { sku, asin: meta.asin, price, dealPrice, cogs, fba, vel, expected, alloc: al, sellable, lost: Math.max(0, expected - sellable), margin, gp: margin != null ? margin * sellable : null, rev: dealPrice ? dealPrice * sellable : 0, status, aged: age ? age[1] : 0, fba_now: pl ? pl.fba_now : meta.fba_on_hand, post_doh: pl ? pl.post_doh_bal : null, decision };
    }).sort((a, b) => (b.gp || 0) - (a.gp || 0));
    const enrolled = rows.filter(r => r.decision === 'ENROL');
    const rev = enrolled.reduce((a, r) => a + r.rev, 0), gp = enrolled.reduce((a, r) => a + (r.gp || 0), 0), units = enrolled.reduce((a, r) => a + r.sellable, 0);
    const fee = Math.min(p.fee_day * deal.days + p.fee_pct * rev, p.fee_cap);
    return { rows, enrolled, units, rev, gp, fee, net: gp - fee, uplift, lost: rows.reduce((a, r) => a + r.lost, 0), params: p };
  };


  // ---------- Deal MIS additions ----------
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  E.median = median;
  const _m = E.metrics; const cache = new Map();
  E.metrics = (deal, asOf, opts = {}) => { const k = deal.id + '|' + (asOf || E.lastDate) + '|' + (opts.basis || 'elapsed'); if (!cache.has(k)) { const r = _m(deal, asOf, opts); if (!r.set.size) { r.verdict = 'NO SKU DATA'; r.vclass = 'dim'; r.gates.forEach(g => { g.verdict = 'na'; g.label = 'no SKUs in feed'; }); } cache.set(k, r); } return cache.get(k); };
  E.clearCache = () => cache.clear();
  const _reindex = E.reindex; E.reindex = () => { _reindex(); cache.clear(); };

  /** Resolve ONE multiplier for a deal, with provenance: measured prior deals of the same parent (same type first), then the LD uplift tab, then the house default. */
  E.multiplier = (deal, asOf) => {
    asOf = asOf || E.lastDate;
    const prior = deals.filter(p => p.tag === deal.tag && p.id !== deal.id && p.end < deal.start && p.end >= E.firstDate && p.start <= asOf);
    const ups = prior.map(p => { const m = E.metrics(p, asOf); return m.nData && m.uplift != null && m.base.units >= 1 ? { id: p.id, uplift: m.uplift, type: p.type, n: m.nData, start: p.start } : null; }).filter(Boolean);
    const same = ups.filter(u => u.type === deal.type);
    const pool = same.length ? same : ups;
    if (pool.length) { const obs = pool.reduce((a, u) => a + u.n, 0); return { value: median(pool.map(u => u.uplift)), basis: 'measured', deals: pool.map(u => u.id), obs, sameType: !!same.length, confidence: obs >= 30 ? 'firm' : obs >= 10 ? 'indicative' : 'thin' }; }
    const ld = D.uplift.find(u => u.tag === deal.tag);
    if (deal.type === 'Lightning Deal' && ld) return { value: ld.uplift, basis: 'LD uplift tab', deals: [], obs: +ld.n || 0, confidence: (+ld.n || 0) >= 3 ? 'indicative' : 'thin' };
    return { value: deal.type === 'Lightning Deal' ? 1.5 : 1.4, basis: 'house default', deals: [], obs: 0, confidence: 'none' };
  };

  /** Pace against the frozen expectation: clean baseline x multiplier, over the days that have data. */
  E.pace = (m, mult) => {
    if (!m.nData || !m.base.units) return null;
    const expectedDay = m.base.units * mult.value;
    const expected = expectedDay * m.nData;
    const actual = m.tot.units;
    const perDay = actual / m.nData;
    const projected = perDay * m.deal.days;
    return { expectedDay, expected, actual, pace: actual / expected, projected, planTotal: expectedDay * m.deal.days, perDay };
  };

  /** Every deal that overlaps the feed and has at least one day of data, measured with the same rules. */
  E.historical = (asOf, basis) => {
    asOf = asOf || E.lastDate;
    return deals.filter(d => d.start <= asOf && d.end >= E.firstDate).map(d => {
      const m = E.metrics(d, asOf, { basis }); if (!m.nData || !m.set.size) return null;
      const closed = d.end <= asOf;
      return { id: d.id, tag: d.tag, type: d.type, start: d.start, end: d.end, days: d.days, closed, nData: m.nData, known: m.known, skus: m.set.size, units: m.tot.units, sales: m.tot.sales, ads: m.tot.ads, tacos: m.tacos, fee: m.fee, net: m.netAfterFee, incremental: m.incremental, uplift: m.uplift, baseUnits: m.base.units, netPerDay: m.netAfterFee / m.nData, baseNetPerDay: m.base.net, halo: m.halo ? m.halo.diff : null, verdict: m.verdict, vclass: m.vclass, m };
    }).filter(Boolean);
  };

  /** Stop board across the live deals. */
  E.stopBoard = (asOf, basis) => {
    asOf = asOf || E.lastDate; const today = D.settings.today;
    const live = deals.filter(d => E.status(d, today) === 'live' || (d.end >= asOf && d.start <= asOf));
    const out = [];
    live.forEach(d => { const m = E.metrics(d, asOf, { basis }); m.perSku.forEach(p => { const st = p.alloc == null ? 'no allocation' : p.alloc === 0 ? 'not enrolled' : p.units >= p.stop ? 'STOP now' : p.units >= p.alloc * D.settings.stop_warn ? 'near limit' : p.proj >= p.stop ? 'will breach' : 'ok'; out.push({ deal: d.id, tag: d.tag, type: d.type, ...p, status: st }); }); });
    return out;
  };


  /** Expected vs actual per SKU with a stock-sufficiency read. Stock now = latest snapshot (planner pull or cost master)
      minus units sold since that snapshot; cover after the deal = (stock now - projected remaining deal units) / pre-deal velocity. */
  E.stockRisk = (m, mult) => {
    const s = D.settings; const deal = m.deal; const remaining = Math.max(0, deal.days - m.elapsed);
    const pl = plannerByDeal[deal.id] || {};
    return m.perSku.map(p => {
      const meta = skuMeta.get(p.sku) || {}; const row = pl[p.sku];
      let stock0 = null, asof = null, src = null;
      if (row && row.fba_now != null) { stock0 = row.fba_now; asof = row.asof || deal.start; src = 'planner ' + (row.asof || ''); }
      else if (meta.fba_on_hand != null) { stock0 = meta.fba_on_hand; asof = meta.stock_asof || null; src = 'cost master ' + (meta.stock_asof || ''); }
      let soldSince = 0;
      if (stock0 != null && asof) { const one = new Set([p.i]); SB.dates.filter(d => d > asof && d <= m.asOf).forEach(d => { soldSince += sumDay(dateIdx.get(d), one).units; }); }
      const stockNow = stock0 == null ? null : Math.max(0, stock0 - soldSince);
      const perDay = m.nData ? p.units / m.nData : 0;
      const expected = p.base * mult.value * m.nData;
      const pace = expected > 0 ? p.units / expected : null;
      const projRemaining = perDay * remaining;
      const stockAfter = stockNow == null ? null : stockNow - projRemaining;
      const vel = Math.max(p.base || 0, meta.p30 || 0, 0.05);
      const coverAfter = stockAfter == null ? null : stockAfter / vel;
      const rank = (p.rankVar || 0) >= 0.1;
      let flag = 'OK', cls = 'good', why = '';
      if (p.alloc === 0) { flag = 'NOT IN DEAL'; cls = 'dim'; why = 'safe allocation 0'; }
      else if (stockNow != null && projRemaining > stockNow) { flag = 'WILL RUN OUT'; cls = 'bad'; why = `${Math.round(projRemaining)} more units expected before ${deal.end}, ${Math.round(stockNow)} in stock`; }
      else if (p.pctStop != null && p.pctStop >= s.stop_line) { flag = 'REMOVE FROM DEAL'; cls = 'bad'; why = `sold ${Math.round(p.pctStop * 100)}% of the stop line`; }
      else if (coverAfter != null && coverAfter < s.min_cover_days) { flag = 'REMOVE FROM DEAL'; cls = 'bad'; why = `${Math.round(coverAfter)} days of cover left after the deal (floor ${s.min_cover_days})`; }
      else if ((p.pctStop != null && p.pctStop >= s.stop_warn) || (coverAfter != null && coverAfter < s.min_cover_days * 1.6) || (pace != null && pace >= 1.5)) { flag = 'WATCH'; cls = 'warn'; why = pace >= 1.5 ? `selling ${Math.round(pace * 100)}% of plan` : coverAfter != null && coverAfter < s.min_cover_days * 1.6 ? `${Math.round(coverAfter)} days of cover after the deal` : `${Math.round(p.pctStop * 100)}% of the stop line`; }
      if (rank && cls === 'warn') { flag = 'PROTECT RANK VARIATION'; cls = 'bad'; why = 'rank driver - ' + why; }
      else if (rank && cls === 'bad') { why = 'rank driver - ' + why; }
      const perf = pace == null ? 'no baseline' : pace >= 1.25 ? 'over' : pace <= 0.75 ? 'under' : 'on plan';
      return { ...p, expected, pace, perf, stock0, stockNow, soldSince, asof, src, projRemaining, stockAfter, coverAfter, rank, flag, cls, why, remaining };
    });
  };

  /** Lightning Deal allocation: the units to ENROL for a one-day deal, not the safe allocation.
      expected day = velocity x LD multiplier; recommend expected x buffer (P80-ish), never above safe allocation or stock above the hard floor. */
  E.ldAllocation = (deal, mult, buffer = 1.3) => {
    const pl = plannerByDeal[deal.id] || {}; const al = allocByDeal[deal.id] || {};
    const skus = new Set([...Object.keys(pl), ...Object.keys(al)]);
    if (!skus.size) D.skus.filter(s => s.tag === deal.tag).forEach(s => skus.add(s.sku));
    const rows = [...skus].map(sku => {
      const meta = skuMeta.get(sku) || {}; const row = pl[sku]; const safe = al[sku] != null ? al[sku] : (row ? row.safe_alloc : null);
      const vel = row && row.vel != null ? row.vel : (meta.p30 || meta.p7 || 0);
      const stock = row && row.fba_now != null ? row.fba_now : meta.fba_on_hand;
      const floor = row && row.hard_floor != null ? row.hard_floor : (vel * D.settings.min_cover_days);
      const expected = vel * mult.value * deal.days;
      let rec = Math.ceil(expected * buffer);
      const capStock = stock != null ? Math.max(0, Math.floor(stock - floor)) : null;
      const caps = [];
      if (safe != null && rec > safe) { rec = safe; caps.push('safe allocation'); }
      if (capStock != null && rec > capStock) { rec = capStock; caps.push('stock above floor'); }
      if (expected < 1 && rec > 0) { rec = Math.min(rec, 1); }
      return { sku, vel, expected, rec: Math.max(0, rec), safe, stock, floor, cap: caps.join(' + '), reason: safe === 0 ? 'safe allocation 0 - do not enrol' : rec === 0 ? 'no demand' : caps.length ? 'capped by ' + caps.join(' + ') : `expected ${expected.toFixed(1)} x ${buffer} buffer`, rank: (meta.rank_var || 0) >= 0.1 };
    }).sort((a, b) => b.rec - a.rec);
    return { rows, total: rows.reduce((a, r) => a + r.rec, 0), totalSafe: rows.reduce((a, r) => a + (r.safe || 0), 0), buffer, mult };
  };

  window.Engine = E;
})();
