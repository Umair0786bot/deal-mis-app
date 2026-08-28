// Morning status for the Deal MIS - the daily update, computed from data/*.js with the app's own engine.
// Usage: node scripts/status.cjs [--asof YYYY-MM-DD] [--md]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
global.window = {};
for (const f of ['settings', 'deals', 'sellerboard', 'skus', 'allocations', 'planner', 'uplift']) eval(fs.readFileSync(path.join(root, 'data', f + '.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'assets', 'engine.js'), 'utf8'));
const D = window.DCC, E = window.Engine, S = D.settings;
const args = process.argv.slice(2); const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const asOf = get('--asof') || E.lastDate; const today = S.today;
const money = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (v) => v == null ? '-' : (v * 100).toFixed(0) + '%';
const x = (v) => v == null ? '-' : v.toFixed(2) + 'x';
const NAMES = { B4: 'Decolure Bamboo 4pc', B6: 'Decolure Bamboo 6pc', S4: 'Decolure Satin 4pc', S6: 'Decolure Satin 6pc', SF: 'Decolure Satin Fitted', C4: 'Decolure Cooling 4pc', BT: 'Decolure Beach Towel', LC: 'Decolure Linen Curtains', SPC: 'Decolure Silk Pillowcase', WCC: 'Decolure Chair Cover', SS4: 'Sleephoria Satin 4pc', SSB6: 'Sleephoria Bamboo 6pc', SLC4: 'Sleephoria Cooling 4pc', SLCF: 'Sleephoria Cooling Fitted', SLQS: 'Sleephoria Quilt Set', SLCPC: 'Sleephoria Cooling Pillowcases' };
const nm = (t) => NAMES[t] || (S.tag_names[t] || t);

const live = D.deals.rows.filter(d => E.status(d, today) === 'live');
const out = [];
out.push(`DEAL UPDATE - ${today} (Sellerboard through ${asOf})`);
out.push('');
if (!live.length) out.push('No deals running today.');
let stopsAll = [], removeAll = [];
for (const d of live) {
  const m = E.metrics(d, asOf); const mu = E.multiplier(d, asOf); const pace = E.pace(m, mu);
  out.push(`${d.id} ${nm(d.tag)} ${d.type} - day ${m.elapsed} of ${d.days} - ${m.verdict}`);
  if (!m.nData) { out.push('  no Sellerboard days inside the window yet'); continue; }
  out.push(`  units ${m.tot.units.toLocaleString()} (${x(m.uplift)} vs baseline, pace ${pace ? pct(pace.pace) : '-'} of plan) - revenue ${money(m.tot.sales)} - TACOS ${pct(m.tacos)}`);
  out.push(`  net after fee ${money(m.netAfterFee)} - incremental vs no deal ${money(m.incremental)} - fee ${money(m.fee)}${m.halo ? ` - halo ${money(m.halo.diff)}` : ''}`);
  const fails = m.gates.filter(g => g.verdict === 'fail'); if (fails.length) out.push(`  gates failing: ${fails.map(g => 'G' + g.n + ' ' + g.name.split(' - ')[0]).join(', ')}`);
  const risk = E.stockRisk(m, mu); const rem = risk.filter(r => r.cls === 'bad'); const watch = risk.filter(r => r.cls === 'warn');
  const over = risk.filter(r => r.perf === 'over').length, under = risk.filter(r => r.perf === 'under').length;
  out.push(`  SKUs: ${over} over plan, ${under} under plan, ${rem.length} to remove, ${watch.length} to watch`);
  rem.forEach(r => out.push(`    REMOVE ${r.sku}${r.rank ? ' [RANK VARIATION]' : ''} - ${r.flag}: ${r.why}`));
  stopsAll.push(...m.stops.map(s => ({ deal: d.id, ...s }))); removeAll.push(...rem.map(r => ({ deal: d.id, ...r })));
  out.push('');
}
const tot = live.map(d => E.metrics(d, asOf)).filter(m => m.nData);
if (tot.length) {
  const sum = (k) => tot.reduce((a, m) => a + (typeof k === 'function' ? k(m) : m[k]), 0);
  out.push(`ALL LIVE DEALS: ${sum(m => m.tot.units).toLocaleString()} units, ${money(sum(m => m.tot.sales))} revenue, net after fee ${money(sum('netAfterFee'))}, ${money(sum('incremental'))} vs doing nothing`);
  out.push('');
}
const upcoming = D.deals.rows.filter(d => d.start > today && d.start <= E.addDays(today, 10)).sort((a, b) => a.start.localeCompare(b.start));
if (upcoming.length) {
  out.push('STARTING WITHIN 10 DAYS');
  for (const d of upcoming) {
    const al = E.allocByDeal[d.id]; const n = al ? Object.values(al).filter(v => v > 0).length : 0; const mu = E.multiplier(d, asOf);
    const flags = []; if (!d.promo) flags.push('NO SC PROMOTION ID'); if (d.issues) flags.push(d.issues + ' ASINs with issues'); if (!n && !E.plannerByDeal[d.id]) flags.push('no safe allocation loaded');
    let ld = ''; if (d.type === 'Lightning Deal') { const r = E.ldAllocation(d, mu); ld = ` - LD enrol ${r.total} units across ${r.rows.filter(q => q.rec > 0).length} SKUs`; }
    out.push(`  ${d.id} ${nm(d.tag)} ${d.type} ${d.start}${d.days > 1 ? ' to ' + d.end : ''} - multiplier ${x(mu.value)} (${mu.basis}${mu.basis === 'measured' ? ', ' + mu.confidence : ''})${n ? ` - ${n} SKUs allocated` : ''}${ld}${flags.length ? ' - ' + flags.join('; ') : ''}`);
  }
  out.push('');
}
const lag = E.diffDays(E.lastDate, today); if (lag > 1) out.push(`NOTE: Sellerboard feed is ${lag} days behind today - drop the latest exports in Downloads and run the update.`);
console.log(out.join('\n'));
