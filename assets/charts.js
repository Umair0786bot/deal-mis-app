/* Deal Command Center — hand-rolled SVG charts (no dependencies).
   Every chart: thin marks, one y-axis, recessive grid, hover layer with tooltip, deal-window bands. */
(function () {
  const C = {};
  const NS = 'http://www.w3.org/2000/svg';
  const registry = new Set();
  const fmt = {
    money: (v) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }),
    money2: (v) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    int: (v) => Math.round(v).toLocaleString('en-US'),
    pct: (v) => (v * 100).toFixed(1) + '%',
    x: (v) => v.toFixed(2) + 'x',
    short: (v) => { const a = Math.abs(v); const s = v < 0 ? '-' : ''; if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k'; return s + (Math.round(a * 10) / 10).toString(); },
    shortMoney: (v) => (v < 0 ? '-$' : '$') + fmt.short(Math.abs(v)),
  };
  C.fmt = fmt;
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const dshort = (iso) => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  C.dshort = dshort;
  const nice = (max, n = 4) => { if (max <= 0) return { step: 1, max: 1 }; const raw = max / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; return { step, max: Math.ceil(max / step) * step }; };

  function tooltip(container) {
    let t = container.querySelector('.ctip');
    if (!t) { t = document.createElement('div'); t.className = 'ctip'; container.appendChild(t); }
    return t;
  }
  function placeTip(t, container, px, py) {
    const w = container.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
    let x = px + 14, y = py - th / 2; if (x + tw > w) x = px - tw - 14; if (y < 0) y = 4;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }

  /** Line / area chart. opts: {dates:[iso], series:[{name,color,values:[num|null],area?,dash?}], bands:[{from,to,label}], today, yfmt, height, ylabel, baseline:{value,label}} */
  C.line = function (container, opts) {
    container.classList.add('chart');
    const draw = () => {
      container.querySelectorAll('svg').forEach(s => s.remove());
      const W = Math.max(320, container.clientWidth || 600), H = opts.height || 260;
      const m = { t: 18, r: 14, b: 30, l: 52 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': opts.aria || 'chart' }, container);
      const n = opts.dates.length; if (!n) return;
      const xs = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      let max = 0, min = 0;
      opts.series.forEach(s => s.values.forEach(v => { if (v != null) { if (v > max) max = v; if (v < min) min = v; } }));
      if (opts.baseline && opts.baseline.value > max) max = opts.baseline.value;
      const { step, max: ymax } = nice(max);
      let ymin = 0; if (min < 0) { ymin = -nice(-min).max; }
      const ys = (v) => m.t + ih - ((v - ymin) / (ymax - ymin || 1)) * ih;
      // bands
      (opts.bands || []).forEach(b => {
        const i0 = opts.dates.findIndex(d => d >= b.from), i1r = opts.dates.map((d, i) => d <= b.to ? i : -1).filter(i => i >= 0);
        if (i0 < 0 || !i1r.length) return; const i1 = i1r[i1r.length - 1];
        const x0 = xs(i0) - (n > 1 ? iw / (n - 1) / 2 : 0), x1 = xs(i1) + (n > 1 ? iw / (n - 1) / 2 : 0);
        el('rect', { x: Math.max(m.l, x0), y: m.t, width: Math.min(W - m.r, x1) - Math.max(m.l, x0), height: ih, class: 'band' }, svg);
        el('line', { x1: Math.max(m.l, x0), x2: Math.max(m.l, x0), y1: m.t, y2: m.t + ih, class: 'band-edge' }, svg);
        if (b.label) el('text', { x: Math.max(m.l, x0) + 5, y: m.t + 11, class: 'band-lbl' }, svg).textContent = b.label;
      });
      // grid + y ticks
      for (let v = ymin; v <= ymax + 1e-9; v += step) {
        el('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), class: v === 0 ? 'axis' : 'grid-line' }, svg);
        el('text', { x: m.l - 8, y: ys(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = (opts.yfmt || fmt.short)(v);
      }
      // x ticks
      const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 70))));
      opts.dates.forEach((d, i) => { if (i % every === 0 ? (n - 1 - i) >= every * .5 || i === n - 1 : i === n - 1) el('text', { x: xs(i), y: H - 9, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = (opts.xfmt || dshort)(d); });
      if (opts.baseline) {
        el('line', { x1: m.l, x2: W - m.r, y1: ys(opts.baseline.value), y2: ys(opts.baseline.value), stroke: 'var(--ink-3)', 'stroke-dasharray': '4 3', 'stroke-width': 1 }, svg);
        el('text', { x: W - m.r, y: ys(opts.baseline.value) - 4, class: 'lbl', 'text-anchor': 'end' }, svg).textContent = opts.baseline.label || 'baseline';
      }
      if (opts.today) { const ti = opts.dates.indexOf(opts.today); if (ti >= 0) { el('line', { x1: xs(ti), x2: xs(ti), y1: m.t, y2: m.t + ih, class: 'today' }, svg); el('text', { x: xs(ti) + 4, y: m.t + ih - 4, class: 'lbl' }, svg).textContent = 'as of'; } }
      // series
      opts.series.forEach((s) => {
        const pts = s.values.map((v, i) => v == null ? null : [xs(i), ys(v)]);
        let d = '', started = false;
        pts.forEach(p => { if (!p) { started = false; return; } d += (started ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); started = true; });
        if (s.area) {
          let a = '', seg = [];
          const flush = () => { if (seg.length) { a += 'M' + seg[0][0] + ' ' + ys(Math.max(0, ymin)) + seg.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'L' + seg[seg.length - 1][0] + ' ' + ys(Math.max(0, ymin)) + 'Z'; seg = []; } };
          pts.forEach(p => { if (!p) flush(); else seg.push(p); }); flush();
          el('path', { d: a, fill: s.color, opacity: .12 }, svg);
        }
        el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dash ? '5 4' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        if (n <= 40) pts.forEach(p => p && el('circle', { cx: p[0], cy: p[1], r: 2.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg));
      });
      // hover
      const xh = el('line', { y1: m.t, y2: m.t + ih, class: 'xhair' }, svg);
      const dots = opts.series.map(s => el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }, svg));
      const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, class: 'hit' }, svg);
      const tip = tooltip(container);
      hit.addEventListener('mousemove', (ev) => {
        const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (W / r.width);
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
        xh.setAttribute('x1', xs(i)); xh.setAttribute('x2', xs(i)); xh.style.opacity = 1;
        let html = `<b>${(opts.xfmt || dshort)(opts.dates[i])}${opts.dayLabel ? ' · ' + opts.dayLabel(i) : ''}</b>`;
        opts.series.forEach((s, k) => { const v = s.values[i]; if (v == null) { dots[k].style.opacity = 0; return; } dots[k].setAttribute('cx', xs(i)); dots[k].setAttribute('cy', ys(v)); dots[k].style.opacity = 1; html += `<div class="row"><span><i style="background:${s.color}"></i>${s.name}</span><span>${(s.fmt || opts.yfmt || fmt.short)(v)}</span></div>`; });
        if (opts.extra) html += opts.extra(i);
        tip.innerHTML = html; tip.style.opacity = 1;
        placeTip(tip, container, (ev.clientX - r.left), (ev.clientY - r.top));
      });
      hit.addEventListener('mouseleave', () => { xh.style.opacity = 0; dots.forEach(d => d.style.opacity = 0); tip.style.opacity = 0; });
    };
    draw(); registry.add(draw); container._redraw = draw;
    if (opts.legend !== false && opts.series.length > 1) {
      let lg = container.nextElementSibling; if (!lg || !lg.classList.contains('legend')) { lg = document.createElement('div'); lg.className = 'legend'; container.after(lg); }
      lg.innerHTML = opts.series.map(s => `<span><i class="line" style="background:${s.color}"></i>${s.name}</span>`).join('');
    }
    return container;
  };

  /** Bar chart. opts: {cats:[str], series:[{name,color,values}], stacked, horizontal, yfmt, height, fmtCat, colorBy:(v,i)=>color, labels:bool} */
  C.bar = function (container, opts) {
    container.classList.add('chart');
    const draw = () => {
      container.querySelectorAll('svg').forEach(s => s.remove());
      const horiz = !!opts.horizontal; const n = opts.cats.length;
      const W = Math.max(320, container.clientWidth || 600);
      const H = opts.height || (horiz ? Math.max(120, n * 26 + 40) : 240);
      const m = horiz ? { t: 8, r: 50, b: 8, l: opts.labelWidth || 150 } : { t: 16, r: 10, b: 30, l: 50 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' }, container);
      const totals = opts.cats.map((_, i) => opts.stacked ? opts.series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0) : Math.max(...opts.series.map(s => s.values[i] || 0)));
      const negs = opts.cats.map((_, i) => opts.stacked ? opts.series.reduce((a, s) => a + Math.min(0, s.values[i] || 0), 0) : Math.min(0, ...opts.series.map(s => s.values[i] || 0)));
      const { step, max } = nice(Math.max(0, ...totals)); const min = Math.min(0, ...negs); const nmin = min < 0 ? -nice(-min).max : 0;
      const vs = (v) => horiz ? m.l + ((v - nmin) / (max - nmin || 1)) * iw : m.t + ih - ((v - nmin) / (max - nmin || 1)) * ih;
      const band = (horiz ? ih : iw) / n; const gap = Math.min(10, band * .25);
      const k = opts.stacked ? 1 : opts.series.length; const bw = (band - gap) / k;
      for (let v = nmin; v <= max + 1e-9; v += step) {
        if (horiz) { el('line', { x1: vs(v), x2: vs(v), y1: m.t, y2: m.t + ih, class: v === 0 ? 'axis' : 'grid-line' }, svg); }
        else { el('line', { x1: m.l, x2: W - m.r, y1: vs(v), y2: vs(v), class: v === 0 ? 'axis' : 'grid-line' }, svg); el('text', { x: m.l - 8, y: vs(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = (opts.yfmt || fmt.short)(v); }
      }
      const tip = tooltip(container);
      opts.cats.forEach((c, i) => {
        const p0 = (horiz ? m.t : m.l) + i * band + gap / 2;
        if (horiz) el('text', { x: m.l - 8, y: p0 + band / 2 + 4 - gap / 2, class: 'lbl', 'text-anchor': 'end' }, svg).textContent = (opts.fmtCat || (x => x))(c);
        else { const every = Math.max(1, Math.ceil(n / Math.floor(iw / 56))); if (i % every === 0) el('text', { x: p0 + (band - gap) / 2, y: H - 9, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = (opts.fmtCat || (x => x))(c); }
        let posAcc = 0, negAcc = 0;
        opts.series.forEach((s, j) => {
          const v = s.values[i] || 0; if (!v && !opts.showZero) return;
          const color = opts.colorBy ? opts.colorBy(v, i, j) : s.color;
          let a, b; if (opts.stacked) { if (v >= 0) { a = posAcc; posAcc += v; b = posAcc; } else { b = negAcc; negAcc += v; a = negAcc; } } else { a = Math.min(0, v); b = Math.max(0, v); }
          const off = opts.stacked ? 0 : j * bw;
          let r;
          if (horiz) r = el('rect', { x: vs(a), y: p0 + off, width: Math.max(1, vs(b) - vs(a)), height: bw, fill: color, rx: 3, class: 'bar-hit', stroke: 'var(--surface)', 'stroke-width': opts.stacked ? 1 : 0 }, svg);
          else r = el('rect', { x: p0 + off, y: vs(b), width: bw, height: Math.max(1, vs(a) - vs(b)), fill: color, rx: 3, class: 'bar-hit', stroke: 'var(--surface)', 'stroke-width': opts.stacked ? 1 : 0 }, svg);
          if (opts.labels && !opts.stacked) { const txt = (opts.yfmt || fmt.short)(v); if (horiz) el('text', { x: vs(Math.max(0, v)) + 5, y: p0 + off + bw / 2 + 4, class: 'tick' }, svg).textContent = txt; }
          r.addEventListener('mousemove', (ev) => { const rr = container.getBoundingClientRect(); tip.innerHTML = `<b>${(opts.fmtCat || (x => x))(c)}</b><div class="row"><span><i style="background:${color}"></i>${s.name}</span><span>${(s.fmt || opts.yfmt || fmt.short)(v)}</span></div>${opts.extra ? opts.extra(i, j) : ''}`; tip.style.opacity = 1; placeTip(tip, container, ev.clientX - rr.left, ev.clientY - rr.top); });
          r.addEventListener('mouseleave', () => tip.style.opacity = 0);
          if (opts.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => opts.onClick(i, c)); }
        });
      });
    };
    draw(); registry.add(draw); container._redraw = draw;
    if (opts.legend !== false && opts.series.length > 1) { let lg = container.nextElementSibling; if (!lg || !lg.classList.contains('legend')) { lg = document.createElement('div'); lg.className = 'legend'; container.after(lg); } lg.innerHTML = opts.series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join(''); }
    return container;
  };

  /** Waterfall: steps [{label,value,total?}] */
  C.waterfall = function (container, steps, opts = {}) {
    container.classList.add('chart');
    const draw = () => {
      container.querySelectorAll('svg').forEach(s => s.remove());
      const W = Math.max(320, container.clientWidth || 600), H = opts.height || 250; const m = { t: 16, r: 10, b: 44, l: 56 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b; const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, container);
      let run = 0, lo = 0, hi = 0; const bars = steps.map(s => { if (s.total) { run = s.value; return { ...s, a: 0, b: s.value }; } const a = run; run += s.value; lo = Math.min(lo, a, run); hi = Math.max(hi, a, run); return { ...s, a, b: run }; });
      hi = Math.max(hi, ...bars.map(b => Math.max(b.a, b.b))); lo = Math.min(lo, ...bars.map(b => Math.min(b.a, b.b)));
      const top = nice(hi).max, bot = lo < 0 ? -nice(-lo).max : 0; const ys = (v) => m.t + ih - ((v - bot) / (top - bot || 1)) * ih;
      const { step } = nice(hi); for (let v = bot; v <= top + 1e-9; v += step) { el('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), class: v === 0 ? 'axis' : 'grid-line' }, svg); el('text', { x: m.l - 8, y: ys(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = fmt.shortMoney(v); }
      const band = iw / bars.length, bw = band * .62; const tip = tooltip(container);
      bars.forEach((b, i) => {
        const x = m.l + i * band + (band - bw) / 2; const color = b.total ? (b.value >= 0 ? 'var(--s1)' : 'var(--bad)') : (b.value >= 0 ? 'var(--good)' : 'var(--bad)');
        const r = el('rect', { x, y: ys(Math.max(b.a, b.b)), width: bw, height: Math.max(1.5, Math.abs(ys(b.a) - ys(b.b))), fill: color, rx: 3, opacity: b.total ? 1 : .85 }, svg);
        if (i < bars.length - 1) el('line', { x1: x + bw, x2: x + band, y1: ys(b.b), y2: ys(b.b), stroke: 'var(--ink-4)', 'stroke-dasharray': '2 2' }, svg);
        el('text', { x: x + bw / 2, y: H - 26, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = b.label;
        el('text', { x: x + bw / 2, y: H - 12, class: 'lbl', 'text-anchor': 'middle' }, svg).textContent = fmt.shortMoney(b.value);
        r.addEventListener('mousemove', (ev) => { const rr = container.getBoundingClientRect(); tip.innerHTML = `<b>${b.label}</b><div class="row"><span>Amount</span><span>${fmt.money2(b.value)}</span></div>${b.note ? `<div class="dim small">${b.note}</div>` : ''}`; tip.style.opacity = 1; placeTip(tip, container, ev.clientX - rr.left, ev.clientY - rr.top); });
        r.addEventListener('mouseleave', () => tip.style.opacity = 0);
      });
    };
    draw(); registry.add(draw); container._redraw = draw; return container;
  };

  /** Gantt: rows [{label, bars:[{id,from,to,color,text,tip,dim,onClick}]}], from,to (iso), today. Label column stays put while the days scroll. */
  C.gantt = function (container, opts) {
    container.classList.add('gantt');
    const draw = () => {
      container.innerHTML = '';
      const days = []; for (let d = new Date(opts.from + 'T12:00:00'); d <= new Date(opts.to + 'T12:00:00'); d.setDate(d.getDate() + 1)) days.push(d.toISOString().slice(0, 10));
      const LW = opts.labelWidth || 120, avail = (container.clientWidth || 900) - LW - 2, DW = Math.max(22, Math.floor(avail / days.length)), RH = 30, HH = 40;
      const W = DW * days.length, H = HH + opts.rows.length * RH + 8;
      container.style.display = 'flex'; container.style.overflow = 'hidden'; container.style.position = 'relative';
      const lab = el('svg', { viewBox: `0 0 ${LW} ${H}`, width: LW, height: H, class: 'gsvg', style: 'flex:none;border-right:1px solid var(--line)' }, container);
      const scroller = document.createElement('div'); scroller.style.cssText = 'overflow-x:auto;flex:1;min-width:0'; container.appendChild(scroller);
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'gsvg' }, scroller);
      days.forEach((d, i) => { const dt = new Date(d + 'T12:00:00'); const x = i * DW; if (dt.getDay() === 0 || dt.getDay() === 6) el('rect', { x, y: HH, width: DW, height: H - HH, class: 'gweekend' }, svg); if (dt.getDate() === 1 || i === 0) el('text', { x: x + 3, y: 14, class: 'grow', 'font-weight': 600 }, svg).textContent = dt.toLocaleDateString('en-GB', { month: 'short' }); el('text', { x: x + DW / 2, y: 31, class: 'gday', 'text-anchor': 'middle' }, svg).textContent = dt.getDate(); el('line', { x1: x, x2: x, y1: HH, y2: H, class: 'gline' }, svg); });
      const tip = tooltip(container);
      opts.rows.forEach((r, ri) => {
        const y = HH + ri * RH; el('line', { x1: 0, x2: W, y1: y, y2: y, class: 'gline' }, svg); el('line', { x1: 0, x2: LW, y1: y, y2: y, class: 'gline' }, lab);
        el('text', { x: 12, y: y + RH / 2 + 4, class: 'grow', 'font-weight': 600 }, lab).textContent = r.label;
        r.bars.forEach(b => {
          const i0 = days.indexOf(b.from), i1 = days.indexOf(b.to); if (i0 < 0 && i1 < 0 && !(b.from < opts.from && b.to > opts.to)) return;
          const x0 = Math.max(0, i0) * DW, x1 = (i1 < 0 ? days.length : i1 + 1) * DW;
          const rect = el('rect', { x: x0 + 1, y: y + 6, width: Math.max(4, x1 - x0 - 2), height: RH - 12, fill: b.color, class: 'gbar', opacity: b.dim ? .45 : .95 }, svg);
          if (x1 - x0 > 30) { const t = el('text', { x: x0 + 6, y: y + RH / 2 + 4, class: 'gbar-lbl' }, svg); t.textContent = b.text; }
          rect.addEventListener('mousemove', (ev) => { const rr = container.getBoundingClientRect(); tip.innerHTML = b.tip; tip.style.opacity = 1; placeTip(tip, container, ev.clientX - rr.left, ev.clientY - rr.top); });
          rect.addEventListener('mouseleave', () => tip.style.opacity = 0);
          if (b.onClick) rect.addEventListener('click', b.onClick);
        });
      });
      const ti = days.indexOf(opts.today); if (ti >= 0) { const x = ti * DW + DW / 2; el('line', { x1: x, x2: x, y1: HH - 6, y2: H, class: 'gtoday' }, svg); el('text', { x: x + 4, y: HH - 8, class: 'gday' }, svg).textContent = 'today'; }
      if (ti >= 0 && W > scroller.clientWidth) scroller.scrollLeft = Math.max(0, ti * DW - scroller.clientWidth * .4);
    };
    draw(); registry.add(draw); container._redraw = draw; return container;
  };

  /** Inline sparkline svg string */
  C.spark = function (values, color = 'var(--s1)', w = 120, h = 26, band) {
    const v = values.filter(x => x != null); if (!v.length) return '';
    const max = Math.max(...v), min = Math.min(0, ...v); const n = values.length;
    const xs = i => (i / Math.max(1, n - 1)) * w, ys = x => h - 2 - ((x - min) / (max - min || 1)) * (h - 4);
    let d = ''; values.forEach((x, i) => { if (x == null) return; d += (d ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(x).toFixed(1); });
    let bandRect = ''; if (band) { bandRect = `<rect x="${xs(band[0])}" y="0" width="${Math.max(2, xs(band[1]) - xs(band[0]))}" height="${h}" fill="var(--band)"/>`; }
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" style="display:block;width:100%">${bandRect}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  };

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => registry.forEach(d => { try { d(); } catch (e) { } }), 120); });
  C.clearRegistry = () => registry.clear();
  window.Charts = C;
})();
