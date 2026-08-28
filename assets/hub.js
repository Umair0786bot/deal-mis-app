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
  async function parseXlsx(buf) {
    const z = await unzip(buf);
    const ss = []; const sst = await z.read('xl/sharedStrings.xml');
    if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) ss.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
    const sheetName = z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))[0];
    const xml = await z.read(sheetName); if (!xml) throw new Error('no worksheet in file');
    const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const rows = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[2] || '', inner = cm[3] || ''; const t = (attrs.match(/t="(\w+)"/) || [])[1]; let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = unxml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || ''); else if (t === 'str' || t === 'b') v = v == null ? '' : unxml(v); else if (v != null && v !== '') v = +v;
        row[colIdx(cm[1])] = v == null ? '' : v;
      }
      if (row.some(x => x !== '' && x != null)) rows.push(row);
    }
    return { hdr: rows[0].map(x => String(x)), rows: rows.slice(1) };
  }
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
  H.addSc = async (deal, rec) => { mergeSc(deal, rec); await put(`sc:${deal}:${rec.date}`, { kind: 'sc', deal, at: new Date().toISOString(), rec }); return rec; };

  // ---------- load persisted uploads on start ----------
  H.items = [];
  H.init = async () => {
    try { const items = await all(); H.items = items.map(i => ({ key: i.key, ...i.val })).sort((a, b) => (a.kind + (a.date || a.deal || '')).localeCompare(b.kind + (b.date || b.deal || '')));
      for (const it of H.items) { if (it.kind === 'sellerboard') mergeSbDay(it.date, it.recs); else if (it.kind === 'planner') mergePlanner(it.deal, it.rows); else if (it.kind === 'alloc') mergeAlloc(it.deal, it.rows); else if (it.kind === 'sc') mergeSc(it.deal, it.rec); }
    } catch (e) { H.error = e.message; H.items = []; }
    return H.items;
  };
  H.refresh = async () => { const items = await all(); H.items = items.map(i => ({ key: i.key, ...i.val })); return H.items; };
  H.remove = async (key) => { await del(key); };
  H.reset = async () => { await clear(); };
  H.supported = () => typeof indexedDB !== 'undefined' && typeof DecompressionStream !== 'undefined';
  window.Hub = H;
})();
