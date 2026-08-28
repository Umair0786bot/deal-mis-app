/* Deal MIS — Data Hub: in-browser uploads (Sellerboard xlsx/csv, planner CSV, allocation CSV, Seller Central readings).
   Parsed here, validated, merged into window.DCC and kept in IndexedDB so they survive reloads.
   Uploads live in THIS browser only; /deal-update makes the same file permanent for everyone. */
(function () {
  const D = window.DCC; const H = {};
  const DB = 'deal-mis', STORE = 'uploads';
  function idb() { return new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
  async function tx(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const s = t.objectStore(STORE); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
  const put = (k, v) => tx('readwrite', s => s.put(v, k));
  const del = (k) => tx('readwrite', s => s.delete(k));
  const all = () => tx('readonly', s => { const req = s.openCursor(); const out = []; req.onsuccess = () => { const c = req.result; if (c) { out.push({ key: c.key, val: c.value }); c.continue(); } }; return { get result() { return out; } }; });
  const clear = () => tx('readwrite', s => s.clear());

  // ---------- parsers ----------
  function parseCsv(text) {
    const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    const parse = (l) => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
    return { hdr: parse(lines[0]), rows: lines.slice(1).map(parse) };
  }
  const u8 = (buf) => new Uint8Array(buf);
  async function inflateRaw(bytes) { const ds = new DecompressionStream('deflate-raw'); const stream = new Blob([bytes]).stream().pipeThrough(ds); return new Uint8Array(await new Response(stream).arrayBuffer()); }
  async function unzip(buf) {
    const b = u8(buf); const dv = new DataView(buf); let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('not a zip / xlsx file');
    const n = dv.getUint16(eocd + 10, true), cd = dv.getUint32(eocd + 16, true); const files = {}; let p = cd;
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen)); files[name] = { method, csize, off }; p += 46 + nlen + elen + clen;
    }
    return { async read(name) { const f = files[name]; if (!f) return null; const lh = f.off; const nlen = dv.getUint16(lh + 26, true), elen = dv.getUint16(lh + 28, true); const start = lh + 30 + nlen + elen; const data = b.subarray(start, start + f.csize); const out = f.method === 8 ? await inflateRaw(data) : data; return new TextDecoder().decode(out); }, names: Object.keys(files) };
  }
  const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  async function sheetList(z) {
    const wb = await z.read('xl/workbook.xml'); const rels = await z.read('xl/_rels/workbook.xml.rels'); if (!wb) return [];
    const relMap = {}; if (rels) for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = (m[0].match(/Id="([^"]+)"/) || [])[1], tg = (m[0].match(/Target="([^"]+)"/) || [])[1]; if (id && tg) relMap[id] = tg.replace(/^\/?(xl\/)?/, 'xl/'); }
    return [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: unxml((m[0].match(/name="([^"]+)"/) || [])[1] || ''), path: relMap[(m[0].match(/r:id="([^"]+)"/) || [])[1]] }));
  }
  async function parseXlsx(buf, sheetName) {
    const z = await unzip(buf);
    const ss = []; const sst = await z.read('xl/sharedStrings.xml');
    if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
    let path = null;
    if (sheetName) { const sh = (await sheetList(z)).find(x => x.name === sheetName); if (!sh) throw new Error(`Sheet "${sheetName}" not found in this workbook`); path = sh.path; }
    else path = z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))[0];
    const xml = await z.read(path); if (!xml) throw new Error('no worksheet in file');
    const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const rows = [];
    const serial = (v) => { if (typeof v !== 'number') return v; const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return d.toISOString().slice(0, 10); };
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[2] || '', inner = cm[3] || ''; const t = (attrs.match(/t="(\w+)"/) || [])[1]; let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = unxml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || ''); else if (t === 'str' || t === 'b') v = v == null ? '' : unxml(v); else if (v != null && v !== '') v = +v;
        if (/s="\d+"/.test(attrs) && typeof v === 'number' && v > 40000 && v < 60000 && Number.isInteger(v)) v = serial(v);
        row[colIdx(cm[1])] = v == null ? '' : v;
      }
      if (row.some(x => x !== '' && x != null)) rows.push(row);
    }
    return { hdr: (rows[0] || []).map(x => String(x)), rows: rows.slice(1), all: rows };
  }
  H.parseXlsx = parseXlsx; H.sheetList = async (buf) => (await sheetList(await unzip(buf))).map(x => x.name);
  async function readTable(file) {
    if (/\.xlsx$/i.test(file.name)) return parseXlsx(await file.arrayBuffer());
    return parseCsv(await file.text());
  }
  const num = (v) => { if (v == null || v === '' || v === '-') return 0; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%\s]/g, '')); return isNaN(n) ? 0 : n; };
  const cents = (v) => Math.round(num(v) * 100);
  const findCol = (hdr, ...names) => { const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); const H2 = hdr.map(norm); for (const n of names) { const i = H2.indexOf(norm(n)); if (i >= 0) return i; } for (const n of names) { const i = H2.findIndex(h => h.startsWith(norm(n))); if (i >= 0) return i; } return -1; };
  const fileDate = (name) => { const m = name.match(/(\d\d)_(\d\d)_(\d{4})-(\d\d)_(\d\d)_(\d{4})/); if (!m) return { date: null, multi: false }; const a = `${m[3]}-${m[2]}-${m[1]}`, b = `${m[6]}-${m[5]}-${m[4]}`; return { date: a, multi: a !== b, to: b }; };

  // ---------- merge into DCC ----------
  const SB = D.sellerboard;
  function mergeSbDay(day, recs) {
    // recs: [[asin, sku, units, sales, ppc, ads, net, bsr, fees, cogs, refunds]] (money in cents)
    if (!SB.dates.includes(day)) { const old = SB.dates.slice(); SB.dates.push(day); SB.dates.sort(); const map = old.map(d => SB.dates.indexOf(d)); SB.rows.forEach(r => { r[0] = map[r[0]]; }); }
    const di = SB.dates.indexOf(day); SB.rows = SB.rows.filter(r => r[0] !== di);
    const asinIdx = new Map(SB.asins.map((a, i) => [a[0], i])); const skuTag = new Map(D.skus.map(s => [s.sku, s.tag])); let newA = 0;
    recs.forEach(r => { let i = asinIdx.get(r[0]); if (i == null) { SB.asins.push([r[0], r[1] || r[0], skuTag.get(r[1]) || '?']); i = SB.asins.length - 1; asinIdx.set(r[0], i); newA++; } SB.rows.push([di, i, r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]); });
    SB.rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]); return newA;
  }
  function mergePlanner(deal, rows) { D.planner = D.planner.filter(p => p.deal !== deal).concat(rows); }
  function mergeAlloc(deal, rows) { D.allocations = D.allocations.filter(a => a.deal !== deal).concat(rows); }
  function mergeSc(deal, rec) { const d = D.deals.rows.find(x => x.id === deal); if (!d) return; d.sc_history = (d.sc_history || []).filter(h => h.date !== rec.date).concat([rec]).sort((a, b) => a.date.localeCompare(b.date)); const last = d.sc_history[d.sc_history.length - 1]; d.sc_sales = last.sales; d.sc_units = last.units; d.sc_glance = last.glance; d.sc_conv = last.conv; d.sc_asof = last.date; }

  // ---------- ingest (validate -> merge -> persist) ----------
  H.ingestSellerboard = async (file, dateOverride) => {
    const t = await readTable(file); const hdr = t.hdr;
    const c = { asin: findCol(hdr, 'ASIN'), sku: findCol(hdr, 'SKU'), units: findCol(hdr, 'Units'), sales: findCol(hdr, 'Sales'), ppc: findCol(hdr, 'Sponsored products (PPC)', 'Sponsored products'), ads: findCol(hdr, 'Ads'), net: findCol(hdr, 'Net profit'), bsr: findCol(hdr, 'BSR'), fees: findCol(hdr, 'Amazon fees'), cogs: findCol(hdr, 'Cost of Goods'), refunds: findCol(hdr, 'Refund cost', 'Refund сost', 'Refund') };
    for (const k of ['asin', 'units', 'sales', 'ads', 'net', 'fees', 'cogs']) if (c[k] < 0) throw new Error(`Column "${k}" not found — is this the Sellerboard Products export grouped by ASIN? Columns seen: ${hdr.slice(0, 8).join(', ')}…`);
    const fd = fileDate(file.name); if (fd.multi) throw new Error(`This export covers ${fd.date} to ${fd.to}. The app needs one day per file — export each day separately.`);
    const day = fd.date || dateOverride; if (!day) throw new Error('The filename has no date — pick the day this export covers.');
    const recs = t.rows.filter(r => r[c.asin]).map(r => [String(r[c.asin]).trim(), c.sku >= 0 ? String(r[c.sku] || '').trim() : '', Math.round(num(r[c.units])), cents(r[c.sales]), c.ppc >= 0 ? -cents(r[c.ppc]) : -cents(r[c.ads]), -cents(r[c.ads]), cents(r[c.net]), c.bsr >= 0 ? Math.round(num(r[c.bsr])) : 0, -cents(r[c.fees]), -cents(r[c.cogs]), c.refunds >= 0 ? -cents(r[c.refunds]) : 0]);
    if (recs.length < 200) throw new Error(`Only ${recs.length} ASIN rows — a normal day has 400+. This looks like a broken or filtered export; not loaded.`);
    const bad = recs.filter(r => Math.abs((r[3] - r[5] - r[8] - r[9] - r[10]) - r[6]) > 1).length;
    if (bad > recs.length * 0.05) throw new Error(`${bad} rows fail sales − ads − fees − COGS − refunds = net. Wrong column layout; not loaded.`);
    const newA = mergeSbDay(day, recs);
    await put('sb:' + day, { kind: 'sellerboard', date: day, file: file.name, at: new Date().toISOString(), recs });
    return { day, rows: recs.length, newAsins: newA, mismatches: bad, units: recs.reduce((a, r) => a + r[2], 0), sales: recs.reduce((a, r) => a + r[3], 0) / 100 };
  };
  H.ingestPlanner = async (file, dealId) => {
    const text = await file.text(); if (!/SKU DETAIL/.test(text)) throw new Error('Not a planner export — expected a "SKU DETAIL" section (deal-allocation-<TAG>-<date>.csv).');
    const t = parseCsv(text.split('SKU DETAIL')[1].trim()); const h = t.hdr; const g = (r, ...n) => { const i = findCol(h, ...n); return i >= 0 ? r[i] : ''; }; const nv = (v) => v === '' || v == null || v === '-' ? null : num(v);
    const tag = (file.name.match(/deal-allocation-([A-Z0-9]+)-/) || [])[1]; const pulled = (file.name.match(/(\d{4}-\d\d-\d\d)/) || [])[1] || new Date().toISOString().slice(0, 10);
    let deal = dealId; if (!deal) { const cands = D.deals.rows.filter(d => d.tag === tag && d.end >= pulled).sort((a, b) => a.start.localeCompare(b.start)); if (!cands.length) throw new Error(`No upcoming or live ${tag || '?'} deal in the calendar to attach this pull to — pick the deal.`); deal = cands[0].id; }
    const rows = t.rows.filter(r => r[0]).map(r => ({ sku: g(r, 'SKU'), product: g(r, 'Product'), mkt: g(r, 'Marketplace') || 'US', fba_now: nv(g(r, 'FBA Now')), vel: nv(g(r, 'Velocity/day')), min_doh: nv(g(r, 'Min DOH')), hard_floor: nv(g(r, 'Hard Floor')), soft_target: nv(g(r, 'Soft Target')), service: g(r, 'Service Level') || 'p80', baseline_demand: nv(g(r, 'Expected Units (deal window)')), pipeline: nv(g(r, 'Pipeline In')), safe_alloc: nv(g(r, 'Safe Allocation')), upside: nv(g(r, 'Upside')), rec_date: g(r, 'Recovery Date') || null, rec_po: g(r, 'Recovery PO') || null, rec_doh: nv(g(r, 'Recovered DOH')), post_doh_max: nv(g(r, 'Post-Deal DOH (max safe)')), post_doh_bal: nv(g(r, 'Post-Deal DOH (balanced)')), status: g(r, 'Status') || 'SAFE', deal, asof: pulled }));
    mergePlanner(deal, rows); await put('planner:' + deal, { kind: 'planner', deal, file: file.name, at: new Date().toISOString(), rows });
    return { deal, rows: rows.length, safe: rows.reduce((a, r) => a + (r.safe_alloc || 0), 0) };
  };
  H.ingestAlloc = async (file, dealId) => {
    const t = parseCsv(await file.text()); const h = t.hdr; const ci = findCol(h, 'Deal ID', 'Deal'), cs = findCol(h, 'SKU'), ca = findCol(h, 'Safe Allocation', 'Allocation', 'Safe');
    if (cs < 0 || ca < 0) throw new Error('Need columns SKU and Safe Allocation (and Deal ID unless you pick the deal).');
    const byDeal = {}; t.rows.forEach(r => { const deal = ci >= 0 && r[ci] ? r[ci].trim() : dealId; if (!deal || !r[cs]) return; (byDeal[deal] = byDeal[deal] || []).push({ deal, sku: r[cs].trim(), alloc: num(r[ca]), notes: null }); });
    const deals = Object.keys(byDeal); if (!deals.length) throw new Error('No rows with a deal id — pick the deal or add a Deal ID column.');
    for (const deal of deals) { mergeAlloc(deal, byDeal[deal]); await put('alloc:' + deal, { kind: 'alloc', deal, file: file.name, at: new Date().toISOString(), rows: byDeal[deal] }); }
    return { deals, rows: t.rows.length };
  };
  const dash = () => { D.dashboard = D.dashboard || { rows: [] }; return D.dashboard; };
  function mergeCosts(rows) { const bySku = new Map(D.skus.map(x => [x.sku, x])); let added = 0, upd = 0; rows.forEach(r => { let x = bySku.get(r.sku); if (!x) { x = { sku: r.sku, asin: r.asin, tag: r.tag, price: r.price, fba: r.fba, cogs: r.cogs, cogs_basis: 'upload' }; D.skus.push(x); bySku.set(r.sku, x); added++; } else { let ch = false; for (const k of ['price', 'fba', 'cogs']) { if (r[k] != null && !(r.fillOnly && x[k] != null) && x[k] !== r[k]) { x[k] = r[k]; ch = true; } } for (const k of ['l30', 'fba_on_hand', 'stock_asof', 'brand', 'product', 'size', 'color']) if (r[k] != null) x[k] = r[k]; if (!x.tag && r.tag) x.tag = r.tag; if (!x.asin && r.asin) x.asin = r.asin; if (ch) upd++; } }); SB.asins.forEach(a => { if (!a[2] || a[2] === '?') { const x = bySku.get(a[1]); if (x && x.tag) a[2] = x.tag; } }); return { added, upd }; }
  function mergeDashboard(rows) { const d = dash(); const key = (r) => r.date + '|' + r.deal + '|' + (r.sku || r.asin); const seen = new Set(rows.map(key)); d.rows = d.rows.filter(r => !seen.has(key(r))).concat(rows); }
  function mergeHist(rows) { D.price_history = D.price_history || []; const by = new Map(D.price_history.filter(x => x.sku).map(x => [x.sku, x])); let n = 0; rows.forEach(r => { const x = by.get(r.sku); if (!x) { D.price_history.push({ sku: r.sku, deal_price: r.price }); n++; } else if (x.deal_price == null) { x.deal_price = r.price; n++; } }); return n; }
  function mergeAis(rows) { const idx = new Map(SB.asins.map((a, i) => [a[0], i])); const skuTag = new Map(D.skus.map(x => [x.sku, x.tag])); let n = 0; rows.forEach(r => { let i = idx.get(r.asin); if (i == null) { SB.asins.push([r.asin, r.sku || r.asin, skuTag.get(r.sku) || r.tag || '?']); i = SB.asins.length - 1; idx.set(r.asin, i); } const cur = SB.age[String(i)]; if (!cur || cur[1] === 0) { SB.age[String(i)] = [r.charge, r.units, cur ? cur[2] : 0, cur ? cur[3] : 0, cur ? cur[4] : 0, r.units ? r.charge / r.units : 0]; n++; } }); return n; }
  const dateOf = (v) => { if (!v) return null; if (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v)) return v.slice(0, 10); if (typeof v === 'number') { return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10); } const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
  const nv = (v) => v === '' || v == null || v === '-' ? null : num(v);
  H.ingestWorkbook = async (file, since) => {
    since = since || '2026-06-01'; const buf = await file.arrayBuffer(); const names = await H.sheetList(buf); const out = []; const isTracker = names.includes('Deal Dashboard') && names.includes('Deal Allocation'); const isDA = names.includes('Deals Financials') || names.includes('Updated COGS');
    if (!isTracker && !isDA) throw new Error(`Not a tracker or Deal Analysis workbook. Sheets seen: ${names.slice(0, 8).join(', ')}…`);
    const costs = []; const key = { kind: 'workbook', file: file.name, at: new Date().toISOString(), tracker: isTracker, da: isDA, dashboard: [], costs: [], alloc: [], hist: [], ais: [] };
    if (names.includes('Cost Master')) { const t = await parseXlsx(buf, 'Cost Master'); t.all.forEach(r => { if (r[1] && r[2] && nv(r[3]) != null && String(r[0]).length <= 8 && r[0] !== 'Tag') { let asin = String(r[1]).trim(), sku = String(r[2]).trim(); if (/^B0[A-Z0-9]{8}$/.test(sku) && !/^B0[A-Z0-9]{8}$/.test(asin)) [asin, sku] = [sku, asin]; if (!/^B0[A-Z0-9]{8}$/.test(sku)) costs.push({ tag: String(r[0]), asin, sku, price: nv(r[3]), fba: nv(r[4]), cogs: nv(r[5]) }); } }); }
    if (isDA && names.includes('Updated COGS')) { const t = await parseXlsx(buf, 'Updated COGS'); const hi = {}; t.hdr.forEach((x, i) => hi[x] = i); t.rows.forEach(r => { const sku = r[hi['sku']]; if (!sku) return; costs.push({ sku: String(sku).trim(), fba: nv(r[hi['expected-fulfillment-fee-per-unit']]), cogs: nv(r[hi['cogs_per_unit']]), l30: nv(r[hi['l30_units_sold']]), fba_on_hand: nv(r[hi['fba_on_hand_units_LIVE']]), stock_asof: dateOf(r[hi['as_of_date']]), brand: r[hi['brand']] || null, product: r[hi['product']] || null, size: r[hi['size']] || null, color: r[hi['color']] || null, fillOnly: true }); }); }
    if (costs.length) { const r = mergeCosts(costs); key.costs = costs; out.push(`cost master: ${costs.length} rows (${r.added} new SKUs, ${r.upd} updated)`); }
    if (isTracker) {
      const t = await parseXlsx(buf, 'Deal Dashboard'); const rows = [];
      t.all.forEach(r => { const date = dateOf(r[0]); if (!date || date < since || r.length < 27) return; const asin = r[16] ? String(r[16]) : null, sku = r[17] ? String(r[17]) : null; if (!asin && !sku) return; rows.push({ date, tag: r[1] ? String(r[1]) : null, deal: r[2] ? String(r[2]) : null, asin, sku, ref: nv(r[18]), max_deal: nv(r[19]), final: nv(r[20]), your_price: nv(r[21]), min_price: nv(r[22]), disc: nv(r[23]), stock: nv(r[24]), min_commit: nv(r[25]), status: r[26] ? String(r[26]) : null, action: r[27] ? String(r[27]) : null, manual: nv(r[15]) }); });
      mergeDashboard(rows); key.dashboard = rows; out.push(`deal dashboard: ${rows.length} rows since ${since} (${[...new Set(rows.map(r => r.deal).filter(Boolean))].slice(-6).join(', ')})`);
      const a = await parseXlsx(buf, 'Deal Allocation'); const byDeal = {}; a.all.forEach(r => { if (r[0] && /^D\d{3}$/.test(String(r[0])) && r[1]) (byDeal[String(r[0])] = byDeal[String(r[0])] || []).push({ deal: String(r[0]), sku: String(r[1]).trim(), alloc: nv(r[2]) || 0, notes: r[3] || null }); });
      // tracker ids that collide with the reconciled calendar: match by tag + type + start
      if (names.includes('Deal Calendar')) { const c = await parseXlsx(buf, 'Deal Calendar'); const mine = {}; D.deals.rows.forEach(d => { mine[d.tag + '|' + d.type + '|' + d.start] = mine[d.tag + '|' + d.type + '|' + d.start] || d.id; }); const remap = {}; c.all.forEach(r => { if (r[0] && /^D\d{3}$/.test(String(r[0])) && r[3]) { const k = String(r[1]) + '|' + String(r[2]) + '|' + dateOf(r[3]); if (mine[k] && mine[k] !== String(r[0])) remap[String(r[0])] = mine[k]; } }); Object.keys(remap).forEach(t => { if (byDeal[t]) { byDeal[remap[t]] = byDeal[t].map(x => ({ ...x, deal: remap[t] })); delete byDeal[t]; } }); if (Object.keys(remap).length) out.push('id remap ' + JSON.stringify(remap)); }
      Object.keys(byDeal).forEach(deal => mergeAlloc(deal, byDeal[deal])); key.alloc = Object.values(byDeal).flat(); out.push(`allocations: ${key.alloc.length} rows for ${Object.keys(byDeal).length} deals`);
    }
    if (isDA) {
      if (names.includes('Historical Deal price')) { const t = await parseXlsx(buf, 'Historical Deal price'); const rows = []; t.all.forEach(r => { if (r[0] && nv(r[1]) != null && r[0] !== 'SKU') rows.push({ sku: String(r[0]).trim(), price: nv(r[1]) }); }); key.hist = rows; out.push(`historical deal prices: ${mergeHist(rows)} filled`); }
      if (names.includes('Estimated Upcoming Month charge')) { const t = await parseXlsx(buf, 'Estimated Upcoming Month charge'); const rows = []; t.all.forEach(r => { if (r.length >= 6 && r[2] && r[2] !== 'Asin' && nv(r[4]) != null && nv(r[5]) != null) rows.push({ tag: r[0] ? String(r[0]) : null, asin: String(r[2]), sku: r[3] ? String(r[3]) : null, charge: nv(r[4]), units: nv(r[5]) }); }); key.ais = rows; out.push(`AIS: ${mergeAis(rows)} ASINs filled`); }
    }
    await put('wb:' + file.name, key); return { notes: out };
  };
  H.addSc = async (deal, rec) => { mergeSc(deal, rec); await put(`sc:${deal}:${rec.date}`, { kind: 'sc', deal, at: new Date().toISOString(), rec }); return rec; };

  // ---------- load persisted uploads on start ----------
  H.items = [];
  H.init = async () => {
    try { const items = await all(); H.items = items.map(i => ({ key: i.key, ...i.val })).sort((a, b) => (a.kind + (a.date || a.deal || '')).localeCompare(b.kind + (b.date || b.deal || '')));
      for (const it of H.items) { if (it.kind === 'sellerboard') mergeSbDay(it.date, it.recs); else if (it.kind === 'planner') mergePlanner(it.deal, it.rows); else if (it.kind === 'alloc') mergeAlloc(it.deal, it.rows); else if (it.kind === 'sc') mergeSc(it.deal, it.rec); else if (it.kind === 'workbook') { if (it.costs && it.costs.length) mergeCosts(it.costs); if (it.dashboard && it.dashboard.length) mergeDashboard(it.dashboard); (it.alloc || []).reduce((m, a) => { (m[a.deal] = m[a.deal] || []).push(a); return m; }, {}) && Object.entries((it.alloc || []).reduce((m, a) => { (m[a.deal] = m[a.deal] || []).push(a); return m; }, {})).forEach(([deal, rows]) => mergeAlloc(deal, rows)); if (it.hist && it.hist.length) mergeHist(it.hist); if (it.ais && it.ais.length) mergeAis(it.ais); } }
    } catch (e) { H.error = e.message; H.items = []; }
    return H.items;
  };
  H.refresh = async () => { const items = await all(); H.items = items.map(i => ({ key: i.key, ...i.val })); return H.items; };
  H.remove = async (key) => { await del(key); };
  H.reset = async () => { await clear(); };
  H.supported = () => typeof indexedDB !== 'undefined' && typeof DecompressionStream !== 'undefined';
  window.Hub = H;
})();
