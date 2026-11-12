'use strict';

const STORE_KEY = 'kalk-coords-v2';
const OLD_KEY = 'kalk-coords-v1';
const EARTH_R = 6371008.8; // mean Earth radius, m
const ZMIN = 0.6;
const ZMAX = 60000;

const $ = id => document.getElementById(id);
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap180 = l => ((l + 180) % 360 + 360) % 360 - 180;

const EXAMPLES = {
  cities: [
    ['Praha', 50.0755, 14.4378],
    ['New York', 40.7128, -74.006],
    ['São Paulo', -23.5505, -46.6333],
    ['Cape Town', -33.9249, 18.4241],
  ],
  prague: [
    ['Old Town Square', 50.08757, 14.42118],
    ['Charles Bridge', 50.08646, 14.41140],
    ['Wenceslas Square', 50.08128, 14.42785],
    ['Powder Tower', 50.08710, 14.42760],
  ],
};

let nextId = 1;
const state = {
  points: [], // { id, name, u: latitude text, v: longitude text }
  from: null,
  to: null,
  angles: true,
  addMode: false,
};

/* ================= Parsing ================= */

function parseNum(s) {
  const t = String(s).trim().replace(/\s+/g, '').replace(/−/g, '-').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

function parseDMS(s) {
  const str = String(s).trim().toUpperCase().replace(/,/g, '.');
  if (!str || /[^\d.\s°º'′’"″”NSEW+\-−]/.test(str)) return NaN;
  const nums = str.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length > 3) return NaN;
  const [d, m = 0, sec = 0] = nums.map(Number);
  if (m >= 60 || sec >= 60) return NaN;
  const v = d + m / 60 + sec / 3600;
  return /[SW]/.test(str) || /^[-−]/.test(str) ? -v : v;
}

// Field 'u' is latitude, 'v' is longitude.
function parseField(s, field) {
  const hemi = String(s).toUpperCase();
  if (field === 'u' && /[EW]/.test(hemi)) return NaN;
  if (field === 'v' && /[NS]/.test(hemi)) return NaN;
  let v = parseNum(s);
  if (!Number.isFinite(v)) v = parseDMS(s);
  return Math.abs(v) <= (field === 'u' ? 90 : 180) ? v : NaN;
}

// One coordinate: decimal or DMS, optional N/S/E/W before or after.
const COORD_RE = /(?:\b[NSEW]\s*)?[-+−]?\d+(?:[.,]\d+)?(?:\s*[°º](?:\s*\d+(?:[.,]\d+)?\s*['′’])?(?:\s*\d+(?:[.,]\d+)?\s*["″”])?)?(?:\s*[NSEW](?![A-Z]))?/gi;

// "Name 50.4743964N, 14.3278153E" -> { name, u: lat, v: lon }
function splitGps(text) {
  const ms = [...text.matchAll(COORD_RE)];
  if (ms.length < 2) return null;
  const toks = ms.map(m => ({ s: m[0].trim(), index: m.index }));
  // In "N 50.47 E 14.32" the regex grabs "E" as a suffix of the first value.
  for (let i = 0; i < toks.length - 1; i++) {
    const both = toks[i].s.match(/^([NSEW])(.*?)\s*([NSEW])$/i);
    if (both && !/^[NSEW]/i.test(toks[i + 1].s)) {
      toks[i].s = (both[1] + both[2]).trim();
      toks[i + 1].s = `${both[3]} ${toks[i + 1].s}`;
    }
  }
  const [a, b] = toks.slice(-2);
  let lat = a.s, lon = b.s;
  if (/[EW]/i.test(lat) || /[NS]/i.test(lon)) [lat, lon] = [lon, lat];
  if (!Number.isFinite(parseField(lat, 'u')) || !Number.isFinite(parseField(lon, 'v'))) return null;
  const name = text.slice(0, a.index).replace(/[\s,;:|]+$/, '').trim();
  return { name, u: lat, v: lon };
}

function parseLines(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(splitGps).filter(Boolean);
}

/* ================= Formatting ================= */

function fmt(v, digits = 4) {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(digits));
  return (r === 0 ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: digits }).replace(/,/g, ' ');
}

const plain = (v, digits = 8) => String(Number(v.toFixed(digits)) || 0);

function toDMS(v) {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.floor((a - d) * 60);
  let s = Math.round(((a - d) * 60 - m) * 60 * 1000) / 1000;
  if (s >= 60) { s -= 60; m++; }
  if (m >= 60) { m -= 60; d++; }
  return `${sign}${d}°${m}′${s}″`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = b => t(COMPASS[Math.round(b / 45) % 8]);

const latText = (v, d = 6) => `${fmt(Math.abs(v), d)}° ${v < 0 ? 'S' : 'N'}`;
const lonText = (v, d = 6) => `${fmt(Math.abs(v), d)}° ${v < 0 ? 'W' : 'E'}`;
const llText = ([la, lo], d = 6) => `${latText(la, d)}, ${lonText(lo, d)}`;

function distText(m) {
  return m < 1000
    ? { main: `${fmt(m, 2)} m`, sub: `${fmt(m / 1000, 5)} km` }
    : { main: `${fmt(m / 1000, 3)} km`, sub: `${fmt(m / 1852, 2)} NM · ${fmt(m / 1609.344, 2)} mi` };
}

function areaParts(a) {
  if (a >= 1e8) return { main: `${fmt(a / 1e6, 1)} km²`, sub: `${fmt(a / 1e4, 0)} ha` };
  return { main: `${fmt(a, 2)} m²`, sub: `${fmt(a / 1e4, 4)} ha · ${fmt(a / 1e6, 6)} km²` };
}

/* ================= Spherical geometry ================= */

const vec = (lat, lon) => {
  const p = rad(lat), l = rad(lon), c = Math.cos(p);
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
};
const toLL = v => [deg(Math.atan2(v[2], Math.hypot(v[0], v[1]))), deg(Math.atan2(v[1], v[0]))];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = a => mul(a, 1 / (len(a) || 1));
const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b)); // accurate for any distance

function slerp(a, b, t) {
  const w = angle(a, b);
  if (w < 1e-15) return a;
  const s = Math.sin(w);
  return add(mul(a, Math.sin((1 - t) * w) / s), mul(b, Math.sin(t * w) / s));
}

// Great circle from a to b as a function of t in [0, 1] (antipodes go over the North Pole side).
function gcFn(a, b) {
  if (angle(a, b) < Math.PI - 1e-9) return t => slerp(a, b, t);
  let m = cross(a, [0, 0, 1]);
  m = len(m) < 1e-9 ? [1, 0, 0] : unit(cross(m, a));
  return t => (t < 0.5 ? slerp(a, m, t * 2) : slerp(m, b, t * 2 - 1));
}

function bearing([la1, lo1], [la2, lo2]) {
  const p1 = rad(la1), p2 = rad(la2), dl = rad(lo2 - lo1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
const finalBearing = (a, b) => (bearing(b, a) + 180) % 360;

function rhumb([la1, lo1], [la2, lo2]) {
  const p1 = rad(la1), p2 = rad(la2);
  const dp = p2 - p1;
  const dl = rad(wrap180(lo2 - lo1));
  const dpsi = Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const q = Math.abs(dpsi) > 1e-12 ? dp / dpsi : Math.cos(p1);
  return {
    dist: Math.hypot(dp, q * dl) * EARTH_R,
    brg: (deg(Math.atan2(dl, dpsi)) + 360) % 360,
  };
}

// Exact area of a spherical polygon with great-circle edges (same method as d3-geo).
function sphericalArea(LL) {
  let sum = 0;
  const last = LL[LL.length - 1];
  let l0 = rad(last[1]);
  let h0 = rad(last[0]) / 2 + Math.PI / 4;
  let c0 = Math.cos(h0), s0 = Math.sin(h0);
  for (const [la, lo] of LL) {
    const l = rad(lo), h = rad(la) / 2 + Math.PI / 4;
    const dl = l - l0, sd = dl >= 0 ? 1 : -1, ad = sd * dl;
    const c = Math.cos(h), s = Math.sin(h), k = s0 * s;
    sum += Math.atan2(k * sd * Math.sin(ad), c0 * c + k * Math.cos(ad));
    l0 = l; c0 = c; s0 = s;
  }
  let a = Math.abs(2 * sum);
  a = Math.min(a, 4 * Math.PI - a); // the smaller side of the ring
  return a * EARTH_R * EARTH_R;
}

// Do great-circle arcs a–b and c–d cross?
function arcsCross(a, b, c, d) {
  const n1 = cross(a, b), n2 = cross(c, d);
  let L = cross(n1, n2);
  if (len(L) < 1e-15) return false;
  L = unit(L);
  const eps = 1e-12;
  const onArc = (x, p, q, n) => dot(cross(p, x), n) > eps && dot(cross(x, q), n) > eps;
  return [L, mul(L, -1)].some(x => onArc(x, a, b, n1) && onArc(x, c, d, n2));
}

function selfIntersects(vs) {
  const n = vs.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (arcsCross(vs[i], vs[(i + 1) % n], vs[j], vs[(j + 1) % n])) return true;
    }
  }
  return false;
}

// Area centroid and orientation using a gnomonic projection around the mean point.
function centroidInfo(vs) {
  let c = vs.reduce(add, [0, 0, 0]);
  c = len(c) < 1e-9 ? vs[0] : unit(c);
  let e = [-c[1], c[0], 0];
  e = len(e) < 1e-9 ? [0, 1, 0] : unit(e);
  const n = cross(c, e);
  const P = [];
  for (const v of vs) {
    const d = dot(v, c);
    if (d <= 1e-6) return null; // larger than a hemisphere
    P.push([dot(v, e) / d, dot(v, n) / d]);
  }
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
    const k = x1 * y2 - x2 * y1;
    a2 += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  if (Math.abs(a2) < 1e-18) return { centroid: toLL(c), signed: 0 };
  const x = cx / (3 * a2), y = cy / (3 * a2);
  return { centroid: toLL(unit(add(c, add(mul(e, x), mul(n, y))))), signed: a2 };
}

/* ================= Points ================= */

function validPoints() {
  const out = [];
  state.points.forEach((p, idx) => {
    const lat = parseField(p.u, 'u');
    const lon = parseField(p.v, 'v');
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ p, idx, lat, lon, v: vec(lat, lon) });
  });
  return out;
}

function currentPair(V) {
  const a = V.find(q => q.p.id === state.from);
  const b = V.find(q => q.p.id === state.to);
  return a && b && a !== b ? [a, b] : [null, null];
}

/* ================= Results ================= */

function fillStats(dl, rows, emptyText) {
  dl.replaceChildren();
  if (!rows.length) {
    const p = document.createElement('div');
    p.className = 'none';
    p.textContent = emptyText;
    dl.append(p);
    return;
  }
  for (const [label, value, opts = {}] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (opts.big) { dd.className = 'big'; dt.className = 'big-label'; }
    dd.append(value);
    if (opts.sub) {
      const s = document.createElement('span');
      s.className = 'sub';
      s.textContent = opts.sub;
      dd.append(s);
    }
    dl.append(dt, dd);
  }
}

function renderPolygon(V) {
  const msgs = [];
  const bad = state.points.length - V.length;
  if (bad > 0) msgs.push(t(bad === 1 ? '1 row is empty or invalid and is skipped.' : '{n} rows are empty or invalid and are skipped.', { n: bad }));

  if (V.length < 3) {
    fillStats($('poly'), [], 'Add at least 3 points to calculate an area.');
  } else {
    const ll = V.map(q => [q.lat, q.lon]);
    const vs = V.map(q => q.v);
    const area = areaParts(sphericalArea(ll));
    let per = 0;
    for (let i = 0; i < vs.length; i++) per += angle(vs[i], vs[(i + 1) % vs.length]) * EARTH_R;
    const perT = distText(per);
    const info = centroidInfo(vs);
    const rows = [
      ['Area', area.main, { big: true, sub: area.sub }],
      ['Perimeter', perT.main, { sub: perT.sub }],
    ];
    if (info) rows.push(['Centroid', `${fmt(info.centroid[0], 6)}, ${fmt(info.centroid[1], 6)}`]);
    rows.push(['Points', String(V.length)]);
    if (info) rows.push(['Order', info.signed > 0 ? 'counter-clockwise' : info.signed < 0 ? 'clockwise' : '—']);
    fillStats($('poly'), rows);
    if (selfIntersects(vs)) {
      msgs.push('The edges cross each other, so this area is not meaningful. Reorder the points so they go around the shape.');
    }
  }
  $('poly-warn').hidden = !msgs.length;
  $('poly-warn').textContent = msgs.join(' ');
}

function fillSelect(sel, V, id) {
  sel.replaceChildren(...V.map(q => {
    const o = document.createElement('option');
    o.value = q.p.id;
    o.textContent = `${q.idx + 1}. ${q.p.name || t('Point')}`;
    o.selected = q.p.id === id;
    return o;
  }));
  sel.disabled = V.length < 2;
}

function renderPair(V) {
  const ids = V.map(q => q.p.id);
  if (!ids.includes(state.from)) state.from = ids[0] ?? null;
  if (!ids.includes(state.to) || (state.to === state.from && ids.length > 1)) {
    state.to = ids.find(id => id !== state.from) ?? null;
  }
  fillSelect($('from'), V, state.from);
  fillSelect($('to'), V, state.to);
  for (const tr of $('rows').children) {
    const id = Number(tr.dataset.id);
    tr.classList.toggle('p1', V.length > 1 && id === state.from);
    tr.classList.toggle('p2', V.length > 1 && id === state.to);
  }

  const [a, b] = currentPair(V);
  if (!a) return fillStats($('pair'), [], V.length < 2 ? 'Add at least 2 points.' : 'Choose two different points.');

  const p1 = [a.lat, a.lon], p2 = [b.lat, b.lon];
  const g = angle(a.v, b.v);
  const d = distText(g * EARTH_R);
  const b1 = bearing(p1, p2), b2 = finalBearing(p1, p2);
  const mid = toLL(unit(add(a.v, b.v)));
  const rh = rhumb(p1, p2);
  const rhT = distText(rh.dist);
  const rows = [
    ['Great-circle distance', d.main, { big: true, sub: d.sub }],
    ['Central angle g', `${fmt(deg(g), 6)}°`],
    ['Initial bearing', `${fmt(b1, 2)}° ${compass(b1)}`],
    ['Final bearing', `${fmt(b2, 2)}° ${compass(b2)}`],
  ];
  if (g < Math.PI - 1e-9) rows.push(['Midpoint', `${fmt(mid[0], 6)}, ${fmt(mid[1], 6)}`]);
  rows.push(['Rhumb line', rhT.main, { sub: t('constant bearing {b}', { b: `${fmt(rh.brg, 2)}° ${compass(rh.brg)}` }) }]);
  rows.push(['Δ lat, Δ lon', `${fmt(b.lat - a.lat, 6)}°, ${fmt(wrap180(b.lon - a.lon), 6)}°`]);
  fillStats($('pair'), rows);
}

function stepItem(list, title, lines, plainItem = false) {
  const li = document.createElement('li');
  if (plainItem) li.className = 'plain';
  if (title) {
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = title;
    li.append(t);
  }
  for (const line of lines) {
    const f = document.createElement('div');
    f.className = 'f';
    for (const part of [].concat(line)) {
      if (typeof part === 'string') f.append(part);
      else {
        const s = document.createElement('span');
        s.className = 'v';
        s.textContent = part.v;
        f.append(s);
      }
    }
    li.append(f);
  }
  list.append(li);
}

function renderSteps(V) {
  const ol = $('steps');
  ol.replaceChildren();
  const [a, b] = currentPair(V);
  if (!a) {
    const li = document.createElement('li');
    li.className = 'plain none';
    li.textContent = 'Add at least two points and pick P₁ and P₂ under "Distance" to see how the distance is calculated.';
    ol.append(li);
    $('steps-pair').textContent = '';
    return;
  }
  const s = Math.sin, c = Math.cos;
  const f1 = rad(a.lat), f2 = rad(b.lat);
  const dl = wrap180(b.lon - a.lon);
  const cosg = s(f1) * s(f2) + c(f1) * c(f2) * c(rad(dl));
  const g = angle(a.v, b.v);
  const d = distText(g * EARTH_R);
  const b1 = bearing([a.lat, a.lon], [b.lat, b.lon]);
  const b2 = finalBearing([a.lat, a.lon], [b.lat, b.lon]);

  $('steps-pair').textContent = `P₁ ${a.p.name || a.idx + 1} (${fmt(a.lat, 6)}°, ${fmt(a.lon, 6)}°) → P₂ ${b.p.name || b.idx + 1} (${fmt(b.lat, 6)}°, ${fmt(b.lon, 6)}°)`;
  stepItem(ol, 'Sides from the North Pole (colatitudes)', [
    ['90° − lat₁ = ', { v: `${fmt(90 - a.lat, 6)}°` }],
    ['90° − lat₂ = ', { v: `${fmt(90 - b.lat, 6)}°` }],
  ]);
  stepItem(ol, 'Angle at the North Pole', [
    ['Δlon = lon₂ − lon₁ = ', { v: `${fmt(dl, 6)}°` }],
  ]);
  stepItem(ol, 'Spherical law of cosines (the side opposite the pole)', [
    'cos g = sin lat₁·sin lat₂ + cos lat₁·cos lat₂·cos Δlon',
    ['cos g = ', { v: fmt(cosg, 10) }],
  ]);
  stepItem(ol, 'Central angle between the points', [
    ['g = arccos(cos g) = ', { v: `${fmt(deg(g), 6)}°` }, ` = ${fmt(g, 8)} rad`],
  ]);
  stepItem(ol, 'Great-circle distance', [
    `d = R·g = ${fmt(EARTH_R / 1000, 4)} km × ${fmt(g, 8)}`,
    ['d = ', { v: d.main }],
  ]);
  stepItem(ol, 'Angles of the triangle at the points (bearings)', [
    [t('start at P₁: '), { v: `${fmt(b1, 2)}° ${compass(b1)}` }],
    [t('arrive at P₂: '), { v: `${fmt(b2, 2)}° ${compass(b2)}` }],
  ]);
  const li = document.createElement('li');
  li.className = 'plain note';
  li.textContent = `R is the mean Earth radius. For very short distances arccos loses precision, so g is computed with the equivalent vector (haversine-type) formula. The Earth is treated as a sphere; on the real ellipsoid distances differ by up to about 0.5 %.`;
  ol.append(li);
}

/* ================= Globe ================= */

const canvas = $('globe');
const ctx = canvas.getContext('2d');
const view = { lat: 30, lon: 10, z: 1 };
let CW = 0, CH = 0, R0 = 1, dpr = 1;
let F = null; // current frame: basis, centre, radius
let C = {};   // colours from CSS
let drawQueued = false;
let anim = null;

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  C = {
    oceanHi: v('--ocean-hi'), ocean: v('--ocean'), land: v('--land'), landLine: v('--land-line'),
    grat: v('--grat'), equator: v('--equator'), meridian: v('--meridian'), arc: v('--arc'),
    lat: v('--wedge-lat'), lon: v('--wedge-lon'), pole: v('--pole'),
    text: v('--text'), muted: v('--muted'), bg: v('--display'), accent: v('--accent'), surface: v('--surface'),
  };
}

// Land rings and borders as unit vectors; long edges are filled in so they curve properly.
function toVectors(flat) {
  const out = [];
  let pl = null, pa = null;
  for (let i = 0; i < flat.length; i += 2) {
    let lo = flat[i];
    const la = flat[i + 1];
    if (pl !== null) {
      // edges crossing the 180° meridian: go the short way round
      if (lo - pl > 180) lo -= 360;
      else if (pl - lo > 180) lo += 360;
      const n = Math.ceil(Math.max(Math.abs(lo - pl), Math.abs(la - pa)) / 2);
      for (let k = 1; k < n; k++) out.push(vec(pa + (la - pa) * k / n, pl + (lo - pl) * k / n));
    }
    out.push(vec(la, lo));
    pl = lo; pa = la;
  }
  return out;
}
const LANDV = (typeof LAND !== 'undefined' ? LAND : []).map(toVectors);
const BORDERV = (typeof BORDERS !== 'undefined' ? BORDERS : []).map(toVectors);

function makeFrame() {
  const o = vec(view.lat, view.lon);
  const e = unit([-o[1], o[0], 0]);
  const n = cross(o, e);
  const Rz = R0 * view.z;
  return { o, e, n, cx: CW / 2, cy: (CH + TOP_PAD) / 2 - 6, Rz, back: view.z < 1.8 };
}

// Screen position [x, y, depth]; depth < 0 means the far side of the globe.
const proj = v => [F.cx + dot(v, F.e) * F.Rz, F.cy - dot(v, F.n) * F.Rz, dot(v, F.o)];

function unproject(X, Y) {
  const x = (X - F.cx) / F.Rz, y = (F.cy - Y) / F.Rz, r2 = x * x + y * y;
  if (r2 > 1) return null;
  return add(add(mul(F.e, x), mul(F.n, y)), mul(F.o, Math.sqrt(1 - r2)));
}

// Sample a curve fn(t), t∈[0,1], finely enough to look smooth; parts far off screen stay coarse.
function sampleCurve(fn, pieces = 8) {
  let ta = 0, pa = proj(fn(0));
  const out = [pa];
  for (let i = 1; i <= pieces; i++) {
    const tb = i / pieces, pb = proj(fn(tb));
    refine(fn, ta, tb, pa, pb, out, 0);
    out.push(pb);
    ta = tb; pa = pb;
  }
  return out;
}
function refine(fn, ta, tb, pa, pb, out, depth) {
  if (depth > 18) return;
  const tm = (ta + tb) / 2, pm = proj(fn(tm));
  const dev = Math.hypot(pm[0] - (pa[0] + pb[0]) / 2, pm[1] - (pa[1] + pb[1]) / 2);
  const m = dev + 40;
  if ((pa[0] < -m && pb[0] < -m) || (pa[0] > CW + m && pb[0] > CW + m) ||
      (pa[1] < -m && pb[1] < -m) || (pa[1] > CH + m && pb[1] > CH + m)) return;
  if (!F.back && pa[2] < 0 && pb[2] < 0 && pm[2] < 0) return;
  if (dev < 0.35 && depth > 1) return;
  refine(fn, ta, tm, pa, pm, out, depth + 1);
  out.push(pm);
  refine(fn, tm, tb, pm, pb, out, depth + 1);
}

// Split a projected path into runs on the near and far side of the globe.
function splitRuns(P, closed) {
  const front = [], back = [];
  if (!P.length) return { front, back };
  const pts = closed ? [...P, P[0]] : P;
  let cur = [pts[0]], vis = pts[0][2] >= 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], bv = b[2] >= 0;
    if (bv !== vis) {
      const t = a[2] / (a[2] - b[2]);
      const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
      cur.push(m);
      (vis ? front : back).push(cur);
      cur = [m];
      vis = bv;
    }
    cur.push(b);
  }
  (vis ? front : back).push(cur);
  return { front, back };
}

function strokeRuns(runs, color, width, dash) {
  ctx.beginPath();
  for (const r of runs) {
    if (r.length < 2) continue;
    ctx.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Stroke a curve: solid on the near side, faint dashed on the far side (whole-globe view only).
function strokeCurve(P, color, width, closed = false) {
  const { front, back } = splitRuns(P, closed);
  if (F.back && back.length) {
    ctx.globalAlpha = 0.45;
    strokeRuns(back, color, Math.max(1, width * 0.6), [4, 4]);
    ctx.globalAlpha = 1;
  }
  strokeRuns(front, color, width);
  return front;
}

// Points on the far side are pushed onto the rim, so filled shapes are clipped at the horizon.
function addLimbPath(P) {
  let started = false, any = false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const xy = [];
  for (const p of P) {
    let x = p[0], y = p[1];
    if (p[2] < 0) {
      const dx = x - F.cx, dy = y - F.cy, d = Math.hypot(dx, dy);
      if (d < 1e-9) continue;
      x = F.cx + dx / d * F.Rz;
      y = F.cy + dy / d * F.Rz;
    } else any = true;
    xy.push(x, y);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!any || maxX < 0 || minX > CW || maxY < 0 || minY > CH) return false;
  for (let i = 0; i < xy.length; i += 2) {
    if (!started) { ctx.moveTo(xy[i], xy[i + 1]); started = true; } else ctx.lineTo(xy[i], xy[i + 1]);
  }
  ctx.closePath();
  return true;
}

const STEPS = [30, 15, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001, 0.00005, 0.00002, 0.00001];

function visibleRadius() {
  const r = Math.hypot(CW, CH) / 2 / F.Rz;
  return r >= 1 ? 90 : deg(Math.asin(r));
}

function drawGraticule() {
  const rho = visibleRadius();
  const step = STEPS.find(s => s <= rho / 4) ?? STEPS[STEPS.length - 1];
  let latA = -90, latB = 90, lonA = -180, lonB = 180;
  if (rho < 60) {
    latA = Math.max(-90, view.lat - rho * 1.3);
    latB = Math.min(90, view.lat + rho * 1.3);
    if (latA > -89.9 && latB < 89.9) {
      const cmin = Math.cos(rad(Math.max(Math.abs(latA), Math.abs(latB))));
      const hw = rho * 1.3 / Math.max(cmin, 1e-9);
      if (hw < 180) { lonA = view.lon - hw; lonB = view.lon + hw; }
    }
  }
  const lines = [];
  for (let k = Math.ceil(latA / step); k <= Math.floor(latB / step); k++) {
    const la = k * step;
    if (Math.abs(la) > 89.9999 || la === 0) continue;
    lines.push(sampleCurve(t => vec(la, lonA + t * (lonB - lonA)), lonB - lonA > 90 ? 16 : 4));
  }
  let lonStep = step;
  for (let i = STEPS.indexOf(step); (lonB - lonA) / lonStep > 72 && i > 0; i--) lonStep = STEPS[i - 1];
  for (let k = Math.ceil(lonA / lonStep); k <= Math.floor(lonB / lonStep); k++) {
    const lo = k * lonStep;
    if (Math.abs(wrap180(lo)) < 1e-9) continue;
    lines.push(sampleCurve(t => vec(latA + t * (latB - latA), lo), latB - latA > 90 ? 8 : 4));
  }
  const front = [];
  for (const P of lines) front.push(...splitRuns(P, false).front);
  strokeRuns(front, C.grat, 1);
  return step;
}

function drawLand() {
  ctx.beginPath();
  let any = false;
  for (const ring of LANDV) {
    if (addLimbPath(ring.map(proj))) any = true;
  }
  if (any) {
    ctx.fillStyle = C.land;
    ctx.fill('evenodd');
  }
  const front = [];
  for (const line of BORDERV) {
    const P = line.map(proj);
    if (!P.some(p => p[2] >= 0)) continue;
    front.push(...splitRuns(P, false).front);
  }
  ctx.globalAlpha = 0.7;
  strokeRuns(front, C.landLine, view.z > 6 ? 1.2 : 0.8);
  ctx.globalAlpha = 1;
}

// Boxes already taken by labels (and by the HTML overlays) in the current frame.
let placed = [];
let overlayBoxes = [];

function measureOverlays() {
  const wr = $('wrap').getBoundingClientRect();
  const bar = document.querySelector('.globe-bar');
  if (bar) TOP_PAD = bar.offsetTop + bar.offsetHeight + 6;
  overlayBoxes = [...document.querySelectorAll('#wrap .overlay')]
    .flatMap(el => (el.classList.contains('globe-bar') ? [...el.children] : [el]))
    .filter(el => el.offsetParent && !el.classList.contains('spacer'))
    .map(el => {
      const r = el.getBoundingClientRect();
      return [r.left - wr.left - 4, r.top - wr.top - 4, r.right - wr.left + 4, r.bottom - wr.top + 4];
    });
}

function labelBox(text, x, y, opts) {
  const size = opts.size || 13;
  const w = ctx.measureText(text).width + 6, h = size + 6;
  const align = opts.align || 'center', base = opts.base || 'middle';
  const x0 = align === 'left' ? -3 : align === 'right' ? -w + 3 : -w / 2;
  const y0 = base === 'bottom' ? -h + 3 : base === 'top' ? -3 : -h / 2;
  const a = opts.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
  const xs = [], ys = [];
  for (const [px, py] of [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]]) {
    xs.push(x + px * ca - py * sa);
    ys.push(y + px * sa + py * ca);
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const overlaps = (b, c) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1];

// Text with a halo; rotated along a path when `angle` is given.
// Returns false (and draws nothing) if it would overlap an earlier label or a control.
function label(text, x, y, opts = {}) {
  ctx.font = `${opts.weight || 600} ${opts.size || 13}px Inter, system-ui, sans-serif`;
  const box = labelBox(text, x, y, opts);
  if (!opts.force) {
    if (box[0] < 2 || box[1] < 2 || box[2] > CW - 2 || box[3] > CH - 2) return false;
    if (placed.some(b => overlaps(b, box)) || overlayBoxes.some(b => overlaps(b, box))) return false;
  }
  placed.push(box);
  ctx.save();
  ctx.translate(x, y);
  if (opts.angle) ctx.rotate(opts.angle);
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.base || 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.bg;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = opts.color || C.text;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return true;
}

// Try several positions in turn until one fits.
function labelAt(text, x, y, candidates, opts = {}) {
  for (const [dx, dy, align, base] of candidates) {
    if (label(text, x + dx, y + dy, { ...opts, align, base })) return true;
  }
  return false;
}

// Place a label along the visible middle of a path, offset to one side.
// Falls back to the short text (or nothing) when the visible part is too short.
function labelAlong(runs, text, shortText, color, offset = 12, side = 1) {
  const pts = [];
  for (const r of runs) for (const p of r) {
    if (p[0] > 20 && p[0] < CW - 20 && p[1] > 16 && p[1] < CH - 16) pts.push(p);
  }
  if (pts.length < 2) return;
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  let t = text;
  if (ctx.measureText(t).width + 50 > length) t = shortText;
  if (!t || ctx.measureText(t).width + 30 > length) return;
  // try the middle of the visible part first, then other spots and the other side
  for (const frac of [0.5, 0.35, 0.65, 0.22, 0.78]) {
    let acc = 0, i = 1;
    for (; i < pts.length - 1; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= length * frac) break;
    }
    const a = pts[i - 1], b = pts[Math.min(pts.length - 1, i + 1)];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    for (const sd of [side, -side]) {
      const nx = Math.sin(ang) * offset * sd, ny = -Math.cos(ang) * offset * sd;
      if (label(t, pts[i][0] + nx, pts[i][1] + ny, { angle: ang, color, size: 12 })) return;
    }
  }
}

function fillShape(vs, color, alpha) {
  const P = vs.map(proj);
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (const p of P.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

const range = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const SUB = ['₁', '₂'];

// Planes through the Earth's centre: latitude, longitude and the central angle g.
function drawWedges(A, B, labels) {
  const O = [0, 0, 0];
  const k = 0.62;
  for (const [P, i] of [[A, 0], [B, 1]]) {
    const r = i === 0 ? k : k * 0.8;
    const alpha = i === 0 ? 0.42 : 0.28;
    if (Math.abs(P.lon) > 0.05) {
      fillShape([O, ...range(48, t => mul(vec(0, t * P.lon), r))], C.lon, alpha);
      const m = proj(mul(vec(0, P.lon / 2), r * 0.72));
      labels.push(() => label(`lon${SUB[i]}`, m[0], m[1], { color: C.text, size: 11 }));
    }
    if (Math.abs(P.lat) > 0.05) {
      fillShape([O, ...range(48, t => mul(vec(t * P.lat, P.lon), r))], C.lat, alpha);
      const m = proj(mul(vec(P.lat / 2, P.lon), r * 0.72));
      labels.push(() => label(`lat${SUB[i]}`, m[0], m[1], { color: C.text, size: 11 }));
    }
  }
  const gf = gcFn(A.v, B.v);
  fillShape([O, ...range(64, t => mul(gf(t), 0.45))], C.arc, 0.25);
  const o = proj(O);
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = C.arc;
  ctx.beginPath();
  for (const P of [A, B]) {
    const p = proj(P.v);
    ctx.moveTo(o[0], o[1]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const gm = proj(mul(gf(0.5), 0.32));
  labels.push(() => label('g', gm[0], gm[1], { color: C.arc, size: 13, weight: 700 }));
  labels.push(() => {
    ctx.beginPath();
    ctx.arc(o[0], o[1], 2.5, 0, Math.PI * 2);
    ctx.fillStyle = C.text;
    ctx.fill();
  });
}

function drawPair(A, B, labels, minor) {
  const pole = [0, 0, 1];
  if (state.angles && view.z < 1.4) drawWedges(A, B, minor);
  let dlonLabel = null;

  const mA = strokeCurve(sampleCurve(t => slerp(pole, A.v, t), 8), C.arc, 2);
  const mB = strokeCurve(sampleCurve(t => slerp(pole, B.v, t), 8), C.arc, 2);
  const dl = wrap180(B.lon - A.lon);
  const r = clamp(deg(46 / F.Rz), 1e-6, 14);
  if (Math.abs(dl) > 0.001 && proj(pole)[2] > 0) {
    const arc = strokeCurve(sampleCurve(t => vec(90 - r, A.lon + t * dl), 8), C.arc, 1.6);
    if (arc.length) {
      const p = proj(vec(90 - r * 1.75, A.lon + dl / 2));
      if (p[2] > 0) {
        dlonLabel = () => label(`Δlon = ${fmt(Math.abs(dl), 2)}°`, p[0], p[1], { color: C.arc, size: 12 }) ||
          label('Δlon', p[0], p[1], { color: C.arc, size: 12 });
      }
    }
  }
  const gc = strokeCurve(sampleCurve(gcFn(A.v, B.v), 16), C.arc, 3.5);

  const dist = distText(angle(A.v, B.v) * EARTH_R).main;
  labels.push(() => {
    labelAlong(gc, t('great-circle distance g = {d}', { d: dist }), `g = ${dist}`, C.arc, 13, -1);
    labelAlong(mA, `90° − lat₁ = ${fmt(90 - A.lat, 2)}°`, '90° − lat₁', C.arc, 11);
    labelAlong(mB, `90° − lat₂ = ${fmt(90 - B.lat, 2)}°`, '90° − lat₂', C.arc, 11);
  });
  if (dlonLabel) labels.push(dlonLabel);
}

function drawPolygon(V) {
  if (V.length < 3) return;
  const P = [];
  for (let i = 0; i < V.length; i++) {
    const seg = sampleCurve(gcFn(V[i].v, V[(i + 1) % V.length].v), 2);
    P.push(...seg.slice(0, -1));
  }
  ctx.beginPath();
  if (addLimbPath(P)) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = C.accent;
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }
  strokeCurve(P, C.accent, 2, true);
}

function drawPoint(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function niceLen(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

function drawScale() {
  if (view.z < 2) return;
  const mPerPx = EARTH_R / F.Rz;
  const m = niceLen(110 * mPerPx);
  const w = m / mPerPx;
  const x = (CW - w) / 2, y = CH - 14;
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 5);
  ctx.stroke();
  label(m >= 1000 ? `${fmt(m / 1000, 3)} km` : `${fmt(m, 3)} m`, x + w / 2, y - 10, { size: 11, weight: 500, force: true });
}

function draw() {
  drawQueued = false;
  if (!CW) return;
  F = makeFrame();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  const { cx, cy, Rz } = F;
  const huge = Rz > Math.hypot(CW, CH) * 3;

  ctx.save();
  ctx.beginPath();
  if (huge) {
    ctx.rect(0, 0, CW, CH);
    ctx.fillStyle = C.ocean;
  } else {
    ctx.arc(cx, cy, Rz, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - Rz * 0.35, cy - Rz * 0.4, Rz * 0.05, cx, cy, Rz);
    g.addColorStop(0, C.oceanHi);
    g.addColorStop(1, C.ocean);
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.clip();

  drawLand();
  drawGraticule();
  strokeCurve(sampleCurve(t => vec(0, -180 + 360 * t), 16), C.equator, 1.8);
  strokeCurve(sampleCurve(t => vec(-90 + 180 * t, 0), 8), C.meridian, 1.6);

  const V = validPoints();
  const [A, B] = currentPair(V);
  const labels = [], minor = [];
  placed = [];
  drawPolygon(V);
  if (A) drawPair(A, B, labels, minor);
  ctx.restore();

  if (!huge) {
    ctx.beginPath();
    ctx.arc(cx, cy, Rz, 0, Math.PI * 2);
    ctx.strokeStyle = C.muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Dots first, so that every label can avoid them
  const pointLabels = [];
  for (const q of V) {
    const p = proj(q.v);
    const isA = A && q === A, isB = A && q === B;
    if (p[2] < 0) {
      if (F.back) {
        ctx.globalAlpha = 0.45;
        drawPoint(p[0], p[1], 4, 'transparent', isA || isB ? C.pole : C.accent);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    if (p[0] < -50 || p[0] > CW + 50 || p[1] < -50 || p[1] > CH + 50) continue;
    if (isA || isB) drawPoint(p[0], p[1], 5.5, C.pole, C.bg);
    else drawPoint(p[0], p[1], 4.5, C.surface, C.accent);
    placed.push([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5]);
    const name = q.p.name || String(q.idx + 1);
    pointLabels.push({ p, pair: isA || isB, text: isA ? `P₁ ${name}` : isB ? `P₂ ${name}` : name });
  }
  const np = proj([0, 0, 1]);
  const poleOn = np[2] >= 0 && np[0] > -20 && np[0] < CW + 20 && np[1] > -20 && np[1] < CH + 20;
  if (poleOn) {
    drawPoint(np[0], np[1], 4, C.pole, C.bg);
    placed.push([np[0] - 4, np[1] - 4, np[0] + 4, np[1] + 4]);
  }

  // Labels in order of importance; anything that would overlap is left out.
  const below = [[10, 13, 'left', 'middle'], [-10, 13, 'right', 'middle'], [10, -13, 'left', 'middle'], [-10, -13, 'right', 'middle'], [12, 0, 'left', 'middle'], [-12, 0, 'right', 'middle']];
  const above = [below[2], below[3], below[0], below[1], below[4], below[5]];
  const pSize = R0 < 200 ? 12 : 13;
  for (const l of pointLabels.filter(l => l.pair)) labelAt(l.text, l.p[0], l.p[1], below, { size: pSize });
  for (const l of pointLabels.filter(l => !l.pair)) labelAt(l.text, l.p[0], l.p[1], above, { size: pSize });
  if (poleOn) {
    const sides = [[0, -9, 'center', 'bottom'], [9, -6, 'left', 'bottom'], [-9, -6, 'right', 'bottom'], [9, 0, 'left', 'middle'], [-9, 0, 'right', 'middle']];
    labelAt(t('North Pole (lat = 90°)'), np[0], np[1], sides, { size: 12 }) || labelAt(t('North Pole'), np[0], np[1], sides, { size: 12 });
  }
  for (const f of labels) f();
  for (const f of minor) f();

  drawScale();
}

function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(draw);
}

let TOP_PAD = 50; // room for the floating toolbar (measured)

function resize() {
  const w = $('wrap').clientWidth, h = $('wrap').clientHeight;
  if (!w || !h) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  CW = w; CH = h;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  measureOverlays();
  R0 = Math.max(60, Math.min(w - 40, h - TOP_PAD - 40) / 2);
  draw();
}

/* ---------- View control ---------- */

function setCenter(v) {
  const [la, lo] = toLL(v);
  view.lat = clamp(la, -89.9, 89.9);
  view.lon = lo;
}

function zoomAt(X, Y, k) {
  F = makeFrame();
  const z1 = clamp(view.z * k, ZMIN, ZMAX);
  k = z1 / view.z;
  const target = unproject(X, Y);
  if (target && k !== 1) setCenter(slerp(vec(view.lat, view.lon), target, 1 - 1 / k));
  view.z = z1;
  requestDraw();
}

function stopAnim() {
  if (anim) cancelAnimationFrame(anim);
  anim = null;
}

function animateTo(t) {
  stopAnim();
  const c0 = vec(view.lat, view.lon), c1 = vec(t.lat, t.lon);
  const z0 = Math.log(view.z), z1 = Math.log(t.z);
  const start = performance.now();
  const step = now => {
    const u = Math.min(1, (now - start) / 650);
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    setCenter(slerp(c0, c1, e));
    view.z = Math.exp(z0 + (z1 - z0) * e);
    draw();
    anim = u < 1 ? requestAnimationFrame(step) : null;
  };
  anim = requestAnimationFrame(step);
}

function fitTarget() {
  const V = validPoints();
  if (!V.length) return { lat: 30, lon: 10, z: 1 };
  const vs = V.map(q => q.v);
  const [A, B] = currentPair(V);
  if (A && angle(A.v, B.v) > rad(2.5)) vs.push([0, 0, 1]);
  let c = vs.reduce(add, [0, 0, 0]);
  c = len(c) < 1e-9 ? vs[0] : unit(c);
  const maxAng = Math.max(...vs.map(v => angle(c, v)));
  const [lat, lon] = toLL(c);
  let z = 1;
  if (vs.length === 1) z = 300;
  else if (maxAng < rad(60)) z = clamp((Math.min(CW, CH - TOP_PAD) / 2 - 70) / (R0 * Math.sin(maxAng)), 1, ZMAX);
  return { lat: clamp(lat, -89.9, 89.9), lon, z };
}

function fitView(animate = true) {
  const t = fitTarget();
  if (animate && CW) animateTo(t);
  else { Object.assign(view, t); requestDraw(); }
}

/* ---------- Pointer input ---------- */

const pointers = new Map();
let gesture = null;

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function rotateBy(dx, dy) {
  const k = deg(1 / (R0 * view.z));
  const f = view.z < 3 ? 1 : 1 / Math.max(Math.cos(rad(view.lat)), 0.15);
  view.lon = wrap180(view.lon - dx * k * f);
  view.lat = clamp(view.lat + dy * k, -89.9, 89.9);
  requestDraw();
}

function showReadout(X, Y) {
  if (!F) return;
  const v = unproject(X, Y);
  const el = $('readout');
  if (!v) return readoutHint();
  const d = clamp(Math.ceil(-Math.log10(deg(1 / F.Rz))), 1, 7);
  el.textContent = llText(toLL(v), d);
  el.classList.add('coords');
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = canvasPos(e);
  pointers.set(e.pointerId, { x, y });
  stopAnim();
  if (pointers.size === 1) {
    gesture = { type: 'drag', x, y, moved: 0 };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: 99 };
  }
});

canvas.addEventListener('pointermove', e => {
  const [x, y] = canvasPos(e);
  if (e.pointerType === 'mouse') showReadout(x, y);
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x, y });
  if (gesture.type === 'drag') {
    const dx = x - gesture.x, dy = y - gesture.y;
    gesture.moved += Math.abs(dx) + Math.abs(dy);
    gesture.x = x; gesture.y = y;
    if (gesture.moved > 3) {
      canvas.classList.add('dragging');
      rotateBy(dx, dy);
    }
  } else if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    rotateBy(mx - gesture.mx, my - gesture.my);
    zoomAt(mx, my, d / gesture.d);
    Object.assign(gesture, { d, mx, my });
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const g = gesture;
  pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  if (g && g.type === 'drag' && g.moved <= 3 && e.type === 'pointerup' && state.addMode) {
    F = makeFrame();
    const v = unproject(...canvasPos(e));
    if (v) {
      const d = clamp(Math.ceil(-Math.log10(deg(1 / F.Rz))) + 1, 2, 8);
      const [la, lo] = toLL(v);
      addPoint(plain(la, d), plain(lo, d));
      save();
      renderRows();
      compute();
    }
  }
  if (pointers.size === 1) {
    const [p] = pointers.values();
    gesture = { type: 'drag', x: p.x, y: p.y, moved: 99 };
  } else if (!pointers.size) gesture = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
function readoutHint() {
  const el = $('readout');
  el.classList.remove('coords');
  el.textContent = state.addMode ? 'Click the globe to add a point' : 'Drag to turn · scroll or pinch to zoom';
}
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') readoutHint(); });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  stopAnim();
  const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  const [x, y] = canvasPos(e);
  zoomAt(x, y, Math.exp(-clamp(dy, -300, 300) * 0.0018));
}, { passive: false });

canvas.addEventListener('dblclick', e => {
  stopAnim();
  zoomAt(...canvasPos(e), e.shiftKey ? 0.5 : 2);
});

$('zoom-in').addEventListener('click', () => { stopAnim(); zoomAt(CW / 2, CH / 2, 1.7); });
$('zoom-out').addEventListener('click', () => { stopAnim(); zoomAt(CW / 2, CH / 2, 1 / 1.7); });
$('fit').addEventListener('click', () => fitView());
$('world').addEventListener('click', () => {
  const t = fitTarget();
  animateTo({ lat: clamp(t.lat, -60, 60), lon: t.lon, z: 1 });
});
$('angles').addEventListener('change', e => {
  state.angles = e.target.checked;
  $('legend').classList.toggle('no-angles', !state.angles);
  save();
  measureOverlays();
  requestDraw();
});
$('add-mode').addEventListener('click', () => {
  state.addMode = !state.addMode;
  $('add-mode').setAttribute('aria-pressed', String(state.addMode));
  canvas.classList.toggle('adding', state.addMode);
  readoutHint();
});

/* ================= Table ================= */

function makeInput(p, field, cls, placeholder) {
  const input = document.createElement('input');
  input.className = cls;
  input.dataset.field = field;
  input.value = p[field];
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', { name: 'Name', u: 'Latitude', v: 'Longitude' }[field]);
  return input;
}

function renderRows() {
  const tbody = $('rows');
  tbody.replaceChildren();
  state.points.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    const n = document.createElement('td');
    n.className = 'n';
    const num = document.createElement('span');
    num.textContent = i + 1;
    n.append(num);
    const cells = [
      makeInput(p, 'name', 'name', `P${i + 1}`),
      makeInput(p, 'u', 'num', '50.4743964N'),
      makeInput(p, 'v', 'num', '14.3278153E'),
    ].map(inp => { const td = document.createElement('td'); td.append(inp); return td; });
    const delTd = document.createElement('td');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Remove point';
    del.setAttribute('aria-label', 'Remove point');
    delTd.append(del);
    tr.append(n, ...cells, delTd);
    tbody.append(tr);
  });
}

function markInvalid() {
  for (const tr of $('rows').children) {
    const p = state.points.find(q => q.id === Number(tr.dataset.id));
    if (!p) continue;
    for (const inp of tr.querySelectorAll('input.num')) {
      const raw = p[inp.dataset.field];
      inp.classList.toggle('bad', raw.trim() !== '' && !Number.isFinite(parseField(raw, inp.dataset.field)));
    }
  }
}

function compute() {
  const V = validPoints();
  markInvalid();
  renderPolygon(V);
  renderPair(V);
  renderSteps(V);
  requestDraw();
}

/* ================= State ================= */

function newPoint(name = '', u = '', v = '') {
  return { id: nextId++, name, u: String(u), v: String(v) };
}

function addPoint(u = '', v = '', name) {
  const p = newPoint(name ?? `P${state.points.length + 1}`, u, v);
  state.points.push(p);
  return p;
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      points: state.points.map(({ name, u, v }) => ({ name, u, v })),
      angles: state.angles,
    }));
  } catch { /* storage unavailable */ }
}

function load() {
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const str = x => typeof x === 'string' ? x : '';
  const toPoints = list => (Array.isArray(list) ? list : []).slice(0, 500).map(p => newPoint(str(p?.name), str(p?.u), str(p?.v)));
  const d = read(STORE_KEY);
  if (d) {
    state.points = toPoints(d.points);
    if (typeof d.angles === 'boolean') state.angles = d.angles;
  } else {
    const old = read(OLD_KEY);
    const oldPts = toPoints(old?.points?.gps);
    const isOldExample = oldPts.length === EXAMPLES.prague.length &&
      oldPts.every((p, i) => p.name === EXAMPLES.prague[i][0]);
    state.points = oldPts.length && !isOldExample ? oldPts : loadExample('cities');
  }
  $('angles').checked = state.angles;
  $('legend').classList.toggle('no-angles', !state.angles);
}

function loadExample(key) {
  return EXAMPLES[key].map(([n, u, v]) => newPoint(n, u, v));
}

function focusCell(id, field) {
  const inp = document.querySelector(`#rows tr[data-id="${id}"] input[data-field="${field}"]`);
  if (inp) { inp.focus(); inp.select(); }
}

/* ================= Events ================= */

$('rows').addEventListener('input', e => {
  const inp = e.target.closest('input');
  const tr = e.target.closest('tr');
  if (!inp || !tr) return;
  const p = state.points.find(q => q.id === Number(tr.dataset.id));
  if (!p) return;
  p[inp.dataset.field] = inp.value;
  save();
  compute();
  if (inp.dataset.field !== 'name') scheduleRefit();
});

// After typing coordinates, move the globe if a point is hidden, off screen or right at the edge.
let refitTimer = 0;
function scheduleRefit() {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => {
    if (!CW || anim || gesture) return;
    F = makeFrame();
    const bad = validPoints().some(q => {
      const p = proj(q.v);
      return p[2] < 0.25 || p[0] < 30 || p[0] > CW - 30 || p[1] < TOP_PAD || p[1] > CH - 30;
    });
    if (bad) fitView();
  }, 700);
}

// Pasting "50.47N, 14.32E" (or several lines) into a cell fills the row(s).
$('rows').addEventListener('paste', e => {
  const inp = e.target.closest('input.num');
  const tr = e.target.closest('tr');
  if (!inp || !tr) return;
  const parsed = parseLines(e.clipboardData.getData('text'));
  if (!parsed.length) return; // a single value: let the browser paste it normally
  e.preventDefault();
  const list = state.points;
  const at = list.findIndex(q => q.id === Number(tr.dataset.id));
  const [first, ...rest] = parsed;
  const p = list[at];
  p.u = first.u;
  p.v = first.v;
  if (first.name) p.name = first.name;
  list.splice(at + 1, 0, ...rest.map((q, i) => newPoint(q.name || `P${list.length + i + 1}`, q.u, q.v)));
  save();
  renderRows();
  compute();
  focusCell(p.id, 'v');
  if (rest.length) fitView();
});

$('rows').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const inp = e.target.closest('input');
  const tr = e.target.closest('tr');
  if (!inp || !tr) return;
  e.preventDefault();
  const next = tr.nextElementSibling;
  if (next) return focusCell(next.dataset.id, inp.dataset.field);
  const p = addPoint();
  save();
  renderRows();
  compute();
  focusCell(p.id, 'u');
});

$('rows').addEventListener('click', e => {
  const del = e.target.closest('button.del');
  if (!del) return;
  const id = Number(del.closest('tr').dataset.id);
  state.points = state.points.filter(p => p.id !== id);
  save();
  renderRows();
  compute();
});

$('add').addEventListener('click', () => {
  const p = addPoint();
  save();
  renderRows();
  compute();
  focusCell(p.id, 'u');
});

$('clear').addEventListener('click', () => {
  if (state.points.length && !confirm(t('Remove all points?'))) return;
  state.points = [];
  save();
  renderRows();
  compute();
});

$('example').addEventListener('change', e => {
  if (!e.target.value) return;
  state.points = loadExample(e.target.value);
  state.from = state.to = null;
  e.target.value = '';
  save();
  renderRows();
  compute();
  fitView();
});

function importPaste(replace) {
  const parsed = parseLines($('paste').value);
  if (!parsed.length) {
    alert(t('No points found. Use one point per line, e.g. "Home 50.4743964N, 14.3278153E".'));
    return;
  }
  if (replace) state.points = [];
  for (const q of parsed) addPoint(q.u, q.v, q.name || undefined);
  $('paste').value = '';
  save();
  renderRows();
  compute();
  fitView();
}
$('paste-replace').addEventListener('click', () => importPaste(true));
$('paste-append').addEventListener('click', () => importPaste(false));

$('from').addEventListener('change', e => { state.from = Number(e.target.value); compute(); });
$('to').addEventListener('change', e => { state.to = Number(e.target.value); compute(); });
$('swap').addEventListener('click', () => {
  [state.from, state.to] = [state.to, state.from];
  compute();
});

$('g-dec').addEventListener('input', e => {
  const v = parseNum(e.target.value);
  $('g-dms').value = Number.isFinite(v) ? toDMS(v) : '';
});
$('g-dms').addEventListener('input', e => {
  const v = parseDMS(e.target.value);
  $('g-dec').value = Number.isFinite(v) ? plain(v, 8) : '';
});

/* ================= Start ================= */

readColors();
const scheme = window.matchMedia('(prefers-color-scheme: dark)');
const onScheme = () => { readColors(); requestDraw(); };
if (scheme.addEventListener) scheme.addEventListener('change', onScheme);

load();
renderRows();
compute();
new ResizeObserver(resize).observe($('wrap'));
resize();
fitView(false);
