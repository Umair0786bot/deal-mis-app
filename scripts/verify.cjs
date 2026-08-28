// Headless check of the built app: every route renders, no console errors, no horizontal overflow, engine figures printed.
// One-time setup in deal-mis/:  npm install   (installs playwright + chromium)
// Usage: node scripts/verify.cjs [path-to-html]   (default dist/deal-mis.html)
const path = require('path'), fs = require('fs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('playwright is not installed - run `npm install` in deal-mis/ once.'); process.exit(2); }
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'deal-mis.html'));
const routes = ['', 'performance', 'performance/D105/pnl', 'performance/D105/skus', 'performance/D105/expected', 'performance/D105/stops', 'performance/D105/outlook', 'performance/D105/plan', 'planner', 'stops', 'history', 'ppc', 'storage', 'process'];
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  const url = 'file:///' + target.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(600);
  console.log(await page.evaluate(() => { const E = window.Engine, D = window.DCC; const live = D.deals.rows.filter(d => E.status(d, D.settings.today) === 'live'); return `feed ${E.firstDate} - ${E.lastDate} (${E.dates.length} days) - today ${D.settings.today} - live: ${live.map(d => { const m = E.metrics(d); return `${d.id} ${d.tag} day ${m.elapsed}/${d.days} ${m.tot.units}u net $${m.netAfterFee.toFixed(0)} ${m.verdict}`; }).join(' | ') || 'none'}`; }));
  let bad = 0;
  for (const r of routes) {
    await page.goto(url + '#/' + r, { waitUntil: 'load' }); await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange'))); await page.waitForTimeout(300);
    const err = await page.evaluate(() => { const b = document.querySelector('#page .banner.bad'); return b && /hit an error/.test(b.innerText) ? b.innerText : ''; });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (err || wide) bad++;
    console.log(`${err || wide ? 'FAIL' : 'ok  '} #/${r}${err ? ' - ' + err : ''}${wide ? ' - horizontal overflow' : ''}`);
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close(); process.exit(bad || errors.length ? 1 : 0);
})();
