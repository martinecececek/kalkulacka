'use strict';

const STORE_KEY = 'kalk-sun-v1';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const $ = id => document.getElementById(id);
const D2R = Math.PI / 180;

const state = { m: 0, d: 1, lat: 50.08 };

function parseDecl(s) {
  const m = /^([+-]?)(\d+)°(\d+)'$/.exec(s);
  const v = Number(m[2]) + Number(m[3]) / 60;
  return m[1] === '-' ? -v : v;
}

const signClass = s => (s.startsWith('+') ? 'pos' : s.startsWith('-') ? 'neg' : 'zero');
const pretty = s => s.replace('-', '−');

function fmtDeg(v) {
  const sign = v < 0 ? '−' : '';
  let total = Math.round(Math.abs(v) * 60);
  return `${sign}${Math.floor(total / 60)}°${String(total % 60).padStart(2, '0')}′`;
}

function fmtHours(h) {
  const mins = Math.round(h * 60);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/* ---------------- Table ---------------- */

function buildTable() {
  const head = $('head');
  const th = document.createElement('th');
  th.className = 'day';
  th.textContent = 'Day';
  head.append(th, ...MONTHS.map((name, i) => {
    const h = document.createElement('th');
    h.textContent = name;
    h.dataset.m = i;
    return h;
  }));

  const body = $('body');
  SUN_DECL.forEach((row, di) => {
    const tr = document.createElement('tr');
    const day = document.createElement('td');
    day.className = 'day';
    day.textContent = di + 1;
    tr.append(day);
    row.forEach((v, mi) => {
      const td = document.createElement('td');
      if (v) {
        td.className = `v ${signClass(v)}`;
        td.textContent = pretty(v);
        td.dataset.m = mi;
        td.dataset.d = di + 1;
        td.title = `${di + 1}. ${MONTHS[mi]}`;
      }
      tr.append(td);
    });
    body.append(tr);
  });

  const now = new Date();
  const cell = cellFor(now.getMonth(), now.getDate());
  if (cell) cell.classList.add('today');
}

const cellFor = (m, d) => $('body').querySelector(`td[data-m="${m}"][data-d="${d}"]`);

/* ---------------- Lookup ---------------- */

function render() {
  for (const el of $('table').querySelectorAll('.sel, .cur')) el.classList.remove('sel', 'cur');
  const cell = cellFor(state.m, state.d);
  if (cell) cell.classList.add('sel');
  const th = $('head').querySelector(`th[data-m="${state.m}"]`);
  if (th) th.classList.add('cur');

  const raw = SUN_DECL[state.d - 1][state.m];
  const declEl = $('decl');
  if (!raw) {
    declEl.textContent = '—';
    declEl.className = 'big';
    $('decl-note').textContent = 'No value for this date.';
    $('facts').replaceChildren();
    return;
  }
  const dec = parseDecl(raw);
  declEl.textContent = pretty(raw);
  declEl.className = `big ${signClass(raw)}`;
  $('decl-note').textContent = dec > 0
    ? 'above the celestial equator'
    : dec < 0 ? 'below the celestial equator' : 'on the celestial equator (equinox)';

  const rows = [['Date', `${state.d}. ${t(MONTHS[state.m])}`]];
  const lat = state.lat;
  if (Number.isFinite(lat)) {
    const noon = 90 - Math.abs(lat - dec);
    const side = lat > dec ? 'south' : lat < dec ? 'north' : 'overhead';
    rows.push(['Sun at noon', noon > 0
      ? t(side === 'overhead' ? '{h} (overhead)' : side === 'south' ? '{h} in the south' : '{h} in the north', { h: fmtDeg(noon) })
      : t('below the horizon')]);

    const x = -Math.tan(lat * D2R) * Math.tan(dec * D2R);
    const dayLen = x <= -1 ? 24 : x >= 1 ? 0 : 2 * Math.acos(x) / D2R / 15;
    rows.push(['Day length', x <= -1 ? '24 h (midnight sun)' : x >= 1 ? '0 h (polar night)' : fmtHours(dayLen)]);
    rows.push(['Night length', fmtHours(24 - dayLen)]);
  }
  $('facts').replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    return [dt, dd];
  }));

  if (document.activeElement !== $('date')) {
    let year = new Date().getFullYear();
    if (state.m === 1 && state.d === 29) while (!isLeap(year)) year++;
    $('date').value = `${year}-${String(state.m + 1).padStart(2, '0')}-${String(state.d).padStart(2, '0')}`;
  }
}

/* ---------------- Year chart ---------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = [];
for (let m = 0; m < 12; m++) {
  for (let d = 1; d <= 31; d++) {
    const raw = SUN_DECL[d - 1][m];
    if (raw && !(m === 1 && d === 29)) DAYS.push({ m, d, dec: parseDecl(raw), raw }); // leap day skipped: it would kink the curve
  }
}
let view = 'decl';

const noonHeight = (lat, dec) => 90 - Math.abs(lat - dec);
function dayLength(lat, dec) {
  const x = -Math.tan(lat * D2R) * Math.tan(dec * D2R);
  return x <= -1 ? 24 : x >= 1 ? 0 : 2 * Math.acos(x) / D2R / 15;
}
const dateText = p => (LANG === 'cs' ? `${p.d}. ${t(MONTH_NAMES[p.m])}` : `${p.d} ${MONTH_NAMES[p.m]}`);

function svg(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

const VIEWS = {
  decl: {
    title: 'Declination through the year',
    sub: 'Above zero the Sun is north of the celestial equator, below zero south of it.',
    value: p => p.dec,
    domain: () => [-32, 32],
    ticks: [-20, -10, 0, 10, 20],
    tickText: v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`,
    base: 0,
    refs: [[23.44, 'Tropic of Cancer +23°26′'], [-23.44, 'Tropic of Capricorn −23°26′']],
    fmt: p => pretty(p.raw),
  },
  noon: {
    title: 'Height of the Sun at noon',
    sub: lat => t('At latitude {lat}. 0° is the horizon.', { lat: fmtLat(lat) }),
    value: p => noonHeight(state.lat, p.dec),
    domain: vals => [Math.min(0, Math.floor(Math.min(...vals) / 10) * 10), Math.max(30, Math.ceil(Math.max(...vals) / 10) * 10)],
    ticks: null,
    tickText: v => `${v < 0 ? '−' : ''}${Math.abs(v)}°`,
    base: null,
    refs: [[0, 'horizon']],
    fmt: p => fmtDeg(noonHeight(state.lat, p.dec)),
  },
  day: {
    title: 'Length of the day',
    sub: lat => t('Sunrise to sunset at latitude {lat}, without refraction.', { lat: fmtLat(lat) }),
    value: p => dayLength(state.lat, p.dec),
    domain: () => [0, 24],
    ticks: [0, 6, 12, 18, 24],
    tickText: v => `${v} h`,
    base: null,
    refs: [[12, '12 h']],
    fmt: p => fmtHours(dayLength(state.lat, p.dec)),
  },
};

const fmtLat = v => `${String(Math.abs(v)).replace('.', LANG === 'cs' ? ',' : '.')}° ${v < 0 ? (LANG === 'cs' ? 'j. š.' : 'S') : (LANG === 'cs' ? 's. š.' : 'N')}`;

let chartGeom = null;

function renderChart() {
  const el = $('chart');
  const W = el.clientWidth, H = el.clientHeight;
  if (!W) return;
  const V = VIEWS[view];
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.replaceChildren();
  $('chart-title').textContent = V.title;
  $('chart-sub').textContent = typeof V.sub === 'function' ? V.sub(state.lat) : V.sub;

  const vals = DAYS.map(V.value);
  const [y0, y1] = V.domain(vals);
  const ticks = V.ticks || (() => {
    const step = y1 - y0 > 60 ? 15 : 10;
    const t = [];
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) t.push(v);
    return t;
  })();
  const L = 44, R = 12, T = 14, B = 26;
  const n = DAYS.length;
  const sx = i => L + (i / (n - 1)) * (W - L - R);
  const sy = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  chartGeom = { sx, sy, L, R, W, H, T, B, n, vals };

  // grid, month bands
  ticks.forEach(v => {
    el.append(svg('line', { class: 'grid', x1: L, x2: W - R, y1: sy(v), y2: sy(v) }));
    el.append(svg('text', { class: 'tick', x: L - 6, y: sy(v) + 4, 'text-anchor': 'end' }, V.tickText(v)));
  });
  let start = 0;
  const narrow = W < 560;
  for (let m = 0; m < 12; m++) {
    const end = DAYS.findIndex(p => p.m === m + 1);
    const last = end < 0 ? n - 1 : end;
    if (m > 0) el.append(svg('line', { class: 'grid', x1: sx(start), x2: sx(start), y1: T, y2: H - B }));
    el.append(svg('text', { class: 'tick', x: (sx(start) + sx(last)) / 2, y: H - 8, 'text-anchor': 'middle' },
      narrow ? MONTH_NAMES[m][0] : MONTH_NAMES[m]));
    start = last;
  }

  // reference lines
  for (const [v, text] of V.refs) {
    if (v < y0 || v > y1) continue;
    el.append(svg('line', { class: v === 0 && view === 'decl' ? 'zero' : 'ref', x1: L, x2: W - R, y1: sy(v), y2: sy(v) }));
    if (!narrow && (view !== 'decl' || v !== 0)) {
      el.append(svg('text', { class: 'ann-sub halo', x: W - R - 4, y: sy(v) - 5, 'text-anchor': 'end' }, text));
    }
  }

  const pts = vals.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`);
  const linePath = `M${pts.join('L')}`;
  const defs = svg('defs', {});
  el.append(defs);

  if (view === 'decl') {
    // two colours split at the celestial equator
    const zy = sy(0);
    defs.append(svg('clipPath', { id: 'clip-pos' }));
    defs.lastChild.append(svg('rect', { x: 0, y: 0, width: W, height: zy }));
    defs.append(svg('clipPath', { id: 'clip-neg' }));
    defs.lastChild.append(svg('rect', { x: 0, y: zy, width: W, height: H - zy }));
    const area = `${linePath}L${sx(n - 1)},${zy}L${sx(0)},${zy}Z`;
    for (const [id, color] of [['pos', 'var(--dec-pos)'], ['neg', 'var(--dec-neg)']]) {
      el.append(svg('path', { d: area, fill: color, opacity: 0.16, 'clip-path': `url(#clip-${id})` }));
      el.append(svg('path', { class: 'line', d: linePath, stroke: color, 'clip-path': `url(#clip-${id})` }));
    }
    if (!narrow) {
      el.append(svg('text', { class: 'ann-sub halo', x: L + 6, y: T + 12 }, 'north of the equator (+)'));
      el.append(svg('text', { class: 'ann-sub halo', x: L + 6, y: H - B - 6 }, 'south of the equator (−)'));
    }
  } else {
    const by = sy(Math.max(y0, 0));
    el.append(svg('path', { d: `${linePath}L${sx(n - 1)},${by}L${sx(0)},${by}Z`, fill: 'var(--accent)', opacity: 0.12 }));
    el.append(svg('path', { class: 'line', d: linePath, stroke: 'var(--accent)' }));
  }

  // annotations: solstices & equinoxes, or the year's extremes
  const anns = [];
  const iMax = vals.indexOf(Math.max(...vals)), iMin = vals.indexOf(Math.min(...vals));
  if (view === 'decl') {
    anns.push([iMax, 'Summer solstice', -1], [iMin, 'Winter solstice', 1]);
    let spring = -1, autumn = -1;
    for (let i = 1; i < n; i++) {
      if (vals[i - 1] < 0 && vals[i] >= 0 && spring < 0) spring = vals[i] === 0 || Math.abs(vals[i]) < Math.abs(vals[i - 1]) ? i : i - 1;
      if (vals[i - 1] > 0 && vals[i] <= 0 && autumn < 0) autumn = vals[i] === 0 || Math.abs(vals[i]) < Math.abs(vals[i - 1]) ? i : i - 1;
    }
    if (spring >= 0) anns.push([spring, 'Spring equinox', -1]);
    if (autumn >= 0) anns.push([autumn, 'Autumn equinox', -1]);
  } else if (vals[iMax] !== vals[iMin]) {
    anns.push([iMax, view === 'day' ? 'Longest day' : 'Highest', -1], [iMin, view === 'day' ? 'Shortest day' : 'Lowest', 1]);
  }
  for (const [i, text, dir] of anns) {
    const x = sx(i), y = sy(vals[i]);
    const anchor = x < L + 70 ? 'start' : x > W - R - 70 ? 'end' : 'middle';
    el.append(svg('circle', { class: 'dot', cx: x, cy: y, r: 4, fill: 'var(--text)' }));
    if (narrow) continue; // on phones the tooltip carries the details
    const ty = dir < 0 ? y - 24 : y + 18;
    el.append(svg('text', { class: 'ann halo', x, y: ty, 'text-anchor': anchor }, text));
    el.append(svg('text', { class: 'ann-sub halo', x, y: ty + 13, 'text-anchor': anchor }, `${dateText(DAYS[i])} · ${V.fmt(DAYS[i])}`));
  }

  // today and the selected day
  const now = new Date();
  const ti = DAYS.findIndex(p => p.m === now.getMonth() && p.d === now.getDate());
  if (ti >= 0) {
    el.append(svg('line', { class: 'today', x1: sx(ti), x2: sx(ti), y1: T, y2: H - B }));
    el.append(svg('text', { class: 'today-label halo', x: sx(ti) + 4, y: T + 10, 'text-anchor': sx(ti) > W - 80 ? 'end' : 'start', dx: sx(ti) > W - 80 ? -8 : 0 }, 'Today'));
  }
  const si = DAYS.findIndex(p => p.m === state.m && p.d === state.d);
  if (si >= 0) el.append(svg('circle', { class: 'sel', cx: sx(si), cy: sy(vals[si]), r: 7 }));

  // hover layer
  chartGeom.cross = svg('line', { class: 'cross', y1: T, y2: H - B, visibility: 'hidden' });
  chartGeom.dot = svg('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  el.append(chartGeom.cross, chartGeom.dot);
}

function hoverIndex(e) {
  const g = chartGeom;
  const r = $('chart').getBoundingClientRect();
  const x = e.clientX - r.left;
  const i = Math.round((x - g.L) / (g.W - g.L - g.R) * (g.n - 1));
  return Math.max(0, Math.min(g.n - 1, i));
}

function showHover(e) {
  if (!chartGeom) return;
  const i = hoverIndex(e), p = DAYS[i], g = chartGeom;
  const x = g.sx(i), y = g.sy(g.vals[i]);
  g.cross.setAttribute('x1', x); g.cross.setAttribute('x2', x);
  g.cross.setAttribute('visibility', 'visible');
  g.dot.setAttribute('cx', x); g.dot.setAttribute('cy', y);
  g.dot.setAttribute('fill', view === 'decl' ? (p.dec >= 0 ? 'var(--dec-pos)' : 'var(--dec-neg)') : 'var(--accent)');
  g.dot.setAttribute('visibility', 'visible');

  const tip = $('chart-tip');
  const rows = [
    ['decl', 'Declination', pretty(p.raw)],
    ['noon', 'Noon height', fmtDeg(noonHeight(state.lat, p.dec))],
    ['day', 'Day length', fmtHours(dayLength(state.lat, p.dec))],
  ];
  tip.replaceChildren();
  const b = document.createElement('b');
  b.textContent = dateText(p);
  tip.append(b);
  for (const [k, label, value] of rows) {
    const r = document.createElement('div');
    r.className = k === view ? 'r main' : 'r';
    const a = document.createElement('span'), c = document.createElement('span');
    a.textContent = label; c.textContent = value;
    r.append(a, c);
    tip.append(r);
  }
  tip.hidden = false;
  const tw = tip.offsetWidth;
  tip.style.left = `${x + 14 + tw > g.W ? x - 14 - tw : x + 14}px`;
}

function hideHover() {
  if (!chartGeom) return;
  chartGeom.cross.setAttribute('visibility', 'hidden');
  chartGeom.dot.setAttribute('visibility', 'hidden');
  $('chart-tip').hidden = true;
}

$('chart').addEventListener('pointermove', showHover);
$('chart').addEventListener('pointerdown', showHover);
$('chart').addEventListener('pointerleave', hideHover);
$('chart').addEventListener('click', e => {
  if (!chartGeom) return;
  const p = DAYS[hoverIndex(e)];
  select(p.m, p.d, false);
  showHover(e);
});
function setView(v) {
  if (!VIEWS[v]) return;
  view = v;
  for (const x of document.querySelectorAll('[data-view]')) {
    x.classList.toggle('active', x.dataset.view === v);
    x.setAttribute('aria-pressed', String(x.dataset.view === v));
  }
  renderChart();
}
document.querySelector('.chart-head .segmented').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) setView(b.dataset.view);
});
setView(location.hash.slice(1) || 'decl');
new ResizeObserver(() => renderChart()).observe($('chart-wrap'));

function select(m, d, scroll) {
  state.m = m;
  state.d = d;
  render();
  renderChart();
  if (scroll) cellFor(m, d)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function selectToday(scroll) {
  const now = new Date();
  select(now.getMonth(), now.getDate(), scroll);
}

/* ---------------- Events ---------------- */

$('body').addEventListener('click', e => {
  const td = e.target.closest('td.v');
  if (td) select(Number(td.dataset.m), Number(td.dataset.d), false);
});

$('date').addEventListener('change', e => {
  const [, m, d] = e.target.value.split('-').map(Number);
  if (m && d) select(m - 1, d, true);
});

$('today').addEventListener('click', () => selectToday(true));

$('lat').addEventListener('input', e => {
  const t = e.target.value.trim().replace(',', '.').replace(/−/g, '-');
  let v = parseFloat(t.replace(/^[NS]\s*/i, ''));
  if (/S/i.test(t)) v = -Math.abs(v);
  const ok = Number.isFinite(v) && Math.abs(v) <= 90;
  e.target.classList.toggle('bad', !ok && t !== '');
  if (!ok) return;
  state.lat = v;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ lat: v })); } catch { /* storage unavailable */ }
  render();
  renderChart();
});

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY));
  if (Number.isFinite(saved?.lat)) state.lat = saved.lat;
} catch { /* ignore */ }
$('lat').value = String(state.lat);

buildTable();
selectToday(false);
