'use strict';

const STORE_KEY = 'kalk-stars-v1';
const D2R = Math.PI / 180;
const SIDEREAL_DAY_DEG = 360.98564736629;
const $ = id => document.getElementById(id);

const MONTHS = {
  en: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
  cz: ['LEDEN', 'ÚNOR', 'BŘEZEN', 'DUBEN', 'KVĚTEN', 'ČERVEN', 'ČERVENEC', 'SRPEN', 'ZÁŘÍ', 'ŘÍJEN', 'LISTOPAD', 'PROSINEC'],
};
const CARDINALS = {
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  cz: ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'],
};
const CARDINAL_WORDS = {
  en: ['NORTH', 'EAST', 'SOUTH', 'WEST'],
  cz: ['SEVER', 'VÝCHOD', 'JIH', 'ZÁPAD'],
};
const MESSIER_TYPES = {
  gg: 'galaxy', g: 'galaxy', s: 'spiral galaxy', s0: 'lenticular galaxy', sd: 'dwarf spheroidal galaxy',
  i: 'irregular galaxy', e: 'elliptical galaxy', oc: 'open cluster', gc: 'globular cluster',
  en: 'emission nebula', bn: 'bright nebula', sfr: 'star-forming region', rn: 'reflection nebula',
  pn: 'planetary nebula', snr: 'supernova remnant', dn: 'dark nebula', pos: 'star cloud', ds: 'double star', as: 'asterism',
};

const OPTS = ['lines', 'cnames', 'snames', 'mw', 'messier', 'grid', 'sun', 'clear'];

const state = {
  time: Date.now(),
  lat: 50.0755,
  lon: 14.4378,
  mag: 5,
  lang: typeof LANG !== 'undefined' && LANG === 'cs' ? 'cz' : 'en',
  opts: { lines: true, cnames: true, snames: true, mw: true, messier: false, grid: true, sun: true, clear: false },
  playing: false,
  skyWindow: null, // last chosen view; null = pick by screen size
};

const CONS = Object.fromEntries(SKY.cons.map(c => [c[0], c]));

/* ---------------- Astronomy ---------------- */

const norm = d => ((d % 360) + 360) % 360;
const jdays = ms => ms / 86400000 + 2440587.5 - 2451545; // days since J2000.0
const lstDeg = ms => norm(280.46061837 + SIDEREAL_DAY_DEG * jdays(ms) + state.lon);
const meanSunRA = ms => norm(280.46061837 + 0.98564736629 * jdays(ms));

function sunRaDec(ms) {
  const n = jdays(ms);
  const L = 280.460 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  return [
    norm(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D2R),
    Math.asin(Math.sin(eps) * Math.sin(lam)) / D2R,
  ];
}

function altAz(ra, dec, lst) {
  const H = (lst - ra) * D2R, d = dec * D2R, f = state.lat * D2R;
  const alt = Math.asin(Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(H));
  return [alt / D2R, norm(az / D2R)];
}

// Altitude/azimuth (azimuth from north, eastwards) -> hour angle and declination.
function haDec(alt, az) {
  const a = alt * D2R, z = az * D2R, f = state.lat * D2R;
  const e = Math.cos(a) * Math.sin(z), n = Math.cos(a) * Math.cos(z), u = Math.sin(a);
  const dec = Math.asin(n * Math.cos(f) + u * Math.sin(f));
  const H = Math.atan2(-e, u * Math.cos(f) - n * Math.sin(f));
  return [H / D2R, dec / D2R];
}

/* ---------------- Layout & projection ---------------- */

const canvas = $('sky');
const ctx = canvas.getContext('2d');
const G = {};
// Zoom and the map point (as a fraction of the map size) shown at the canvas centre.
const view = { z: 1, fx: 0.5, fy: 0.5 };
const MAX_ZOOM = 6;

function layout() {
  const S = $('wrap').clientWidth;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(S * dpr);
  canvas.height = Math.round(S * dpr);
  Object.assign(G, {
    S, dpr, k: S / 800,
    cx: S / 2, cy: S / 2,
    Rd: S / 2 - 2,
  });
  G.z = view.z;
  G.ringW = S * 0.062;
  G.Rc = G.Rd - G.ringW;
  G.hourW = S * 0.048;
  G.Rs = G.Rc - G.hourW - S * 0.016;
}

function hemisphere() {
  G.p = state.lat >= 0 ? 1 : -1;
  G.decMin = Math.abs(state.lat) - 94; // a few degrees past the southern horizon
}

// Disc point (RA/Dec) -> screen. The disc is turned by the local sidereal time.
function proj(ra, dec, lst) {
  const r = G.Rs * (90 - G.p * dec) / (90 - G.decMin);
  const t = G.p * (lst - ra) * D2R;
  return [G.cx + r * Math.sin(t), G.cy + r * Math.cos(t), r];
}

const polar = (r, t) => [G.cx + r * Math.sin(t), G.cy + r * Math.cos(t)];

function horizonPoint(alt, az) {
  const [H, dec] = haDec(alt, az);
  const r = G.Rs * (90 - G.p * dec) / (90 - G.decMin);
  return polar(r, G.p * H * D2R);
}

/* ---------------- Drawing helpers ---------------- */

// Sizes are in map units; the view is scaled by G.z on screen.
// Text and stars grow only a little when zooming, lines keep their on-screen width.
const uiScale = () => Math.max(0.66, G.k);
const px = n => n * uiScale() / Math.pow(G.z, 0.62);
const lw = n => n * uiScale() / G.z;
const font = (size, weight = 500) =>
  `${weight} ${Math.max(9 / G.z, px(size)).toFixed(2)}px Inter, system-ui, sans-serif`;
// How large the map appears on screen, relative to an 800 px map.
const detail = () => G.S * G.z / 800;

function ringText(text, r, t) {
  const [x, y] = polar(r, t);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.cos(t) > 0 ? -t : Math.PI - t); // keep text upright
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function radial(r1, r2, t) {
  const [x1, y1] = polar(r1, t);
  const [x2, y2] = polar(r2, t);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

function starColor(bv) {
  if (bv < 0) return '#b5ceff';
  if (bv < 0.3) return '#e2eaff';
  if (bv < 0.6) return '#ffffff';
  if (bv < 1.0) return '#fff0d2';
  return '#ffd09c';
}

/* ---------------- Disc ---------------- */

let hits = [];

function drawDateRing(lst) {
  const { Rc, Rd, ringW } = G;
  const grad = ctx.createRadialGradient(G.cx, G.cy, Rc, G.cx, G.cy, Rd);
  grad.addColorStop(0, '#d9a12a');
  grad.addColorStop(1, '#f0c04a');
  ctx.beginPath();
  ctx.arc(G.cx, G.cy, Rd, 0, 2 * Math.PI);
  ctx.arc(G.cx, G.cy, Rc, 0, 2 * Math.PI, true);
  ctx.fillStyle = grad;
  ctx.fill();

  const year = new Date(state.time).getFullYear();
  const months = MONTHS[state.lang] || MONTHS.en;
  const angleOf = (m, d) => G.p * (lst - meanSunRA(new Date(year, m, d).getTime())) * D2R;

  ctx.strokeStyle = '#2a1c05';
  ctx.fillStyle = '#2a1c05';
  ctx.lineWidth = lw(0.9);
  ctx.beginPath();
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const t = angleOf(m, d);
      const len = d === 1 ? ringW : d % 5 === 0 ? ringW * 0.34 : ringW * 0.2;
      radial(Rc, Rc + len, t);
    }
  }
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(9, 600);
  for (let m = 0; m < 12; m++) {
    for (const d of [10, 20]) ringText(String(d), Rc + ringW * 0.47, angleOf(m, d));
  }
  ctx.font = font(13.5, 700);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px(1.5)}px`;
  for (let m = 0; m < 12; m++) ringText(months[m], Rc + ringW * 0.76, angleOf(m, 15.5));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawMilkyWay(lst) {
  for (const [level, polys] of SKY.mw) {
    if (level > 3) continue;
    ctx.fillStyle = `rgba(150, 185, 255, ${0.05 + level * 0.025})`;
    for (const rings of polys) {
      ctx.beginPath();
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const [x, y] = proj(ring[i], ring[i + 1], lst);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
}

function drawGrid(lst) {
  ctx.lineWidth = lw(0.8);
  ctx.strokeStyle = 'rgba(160, 190, 240, 0.22)';
  ctx.beginPath();
  for (const dec of [60, 30, -30, -60]) {
    const [, , r] = proj(0, dec, lst);
    if (r < G.Rs * 1.05) { ctx.moveTo(G.cx + r, G.cy); ctx.arc(G.cx, G.cy, r, 0, 2 * Math.PI); }
  }
  for (let h = 0; h < 24; h++) {
    const t = G.p * (lst - h * 15) * D2R;
    radial(G.Rs * 0.04, G.Rs, t);
  }
  ctx.stroke();

  // Celestial equator
  const [, , re] = proj(0, 0, lst);
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(G.cx, G.cy, re, 0, 2 * Math.PI);
  ctx.stroke();

  // Ecliptic
  const eps = 23.439 * D2R;
  ctx.strokeStyle = 'rgba(255, 205, 110, 0.6)';
  ctx.setLineDash([lw(6), lw(5)]);
  ctx.beginPath();
  for (let l = 0; l <= 360; l += 2) {
    const lam = l * D2R;
    const ra = norm(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D2R);
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / D2R;
    const [x, y] = proj(ra, dec, lst);
    if (l === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // RA hour labels just inside the equator
  ctx.fillStyle = 'rgba(170, 200, 250, 0.6)';
  ctx.font = font(9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let h = 0; h < 24; h += 2) {
    const t = G.p * (lst - h * 15) * D2R;
    const [x, y] = polar(re - px(10), t + px(9) / re);
    ctx.fillText(`${h}h`, x, y);
  }
}

function drawLines(lst) {
  ctx.strokeStyle = 'rgba(140, 180, 255, 0.5)';
  ctx.lineWidth = lw(1);
  ctx.beginPath();
  for (const l of SKY.lines) {
    for (let i = 0; i < l.length; i += 2) {
      const [x, y] = proj(l[i], l[i + 1], lst);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawMessier(lst) {
  ctx.strokeStyle = '#7fe0a8';
  ctx.fillStyle = 'rgba(127, 224, 168, 0.85)';
  ctx.lineWidth = lw(1.1);
  ctx.font = font(9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const m of SKY.messier) {
    if (G.p * m[2] < G.decMin) continue;
    const [x, y] = proj(m[1], m[2], lst);
    ctx.beginPath();
    ctx.arc(x, y, px(3.2), 0, 2 * Math.PI);
    ctx.stroke();
    if (m[4] < 7.5 && detail() > 0.9) ctx.fillText(m[0], x + px(5), y);
    hits.push({ x, y, r: lw(10), kind: 'messier', d: m });
  }
}

function drawStars(lst) {
  const named = [];
  const nameLimit = starNameLimit();
  for (const s of SKY.stars) {
    if (s[2] > state.mag) break; // sorted by magnitude
    if (G.p * s[1] < G.decMin - 1) continue;
    const [x, y] = proj(s[0], s[1], lst);
    const r = Math.min(px(5.5), Math.max(px(0.75), (6.3 - s[2]) * px(0.62)));
    ctx.fillStyle = starColor(s[3]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    hits.push({ x, y, r: Math.max(r + lw(3), lw(10)), kind: 'star', d: s });
    if (s[4] && s[2] <= nameLimit) named.push([s[4], x, y, r]);
  }
  if (!state.opts.snames) return;
  ctx.font = font(11, 500);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const [name, x, y, r] of named) haloText(name, x + r + px(3), y, 'rgba(255, 255, 255, 0.95)');
}

// Fewer labels when the map is small on screen, more when zoomed in.
function starNameLimit() {
  const d = detail();
  return d < 0.6 ? 0.5 : d < 0.9 ? 1.2 : d < 1.6 ? 1.8 : d < 2.6 ? 2.5 : 3.2;
}

function haloText(text, x, y, color) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw(3);
  ctx.strokeStyle = 'rgba(8, 20, 45, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawConstellationNames(lst) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px(1)}px`;
  const idx = state.lang === 'cz' ? 6 : state.lang === 'la' ? 5 : 4;
  const d = detail();
  const maxRank = d < 0.6 ? 1 : d < 0.95 ? 2 : 3;
  for (const c of SKY.cons) {
    if (G.p * c[2] < G.decMin || c[3] > maxRank) continue;
    const [x, y] = proj(c[1], c[2], lst);
    ctx.font = font(c[3] === 1 ? 12 : c[3] === 2 ? 11 : 10, c[3] === 1 ? 600 : 500);
    haloText(c[idx].toUpperCase(), x, y, 'rgba(185, 212, 255, 0.92)');
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawSun(lst) {
  const [ra, dec] = sunRaDec(state.time);
  if (G.p * dec < G.decMin) return;
  const [x, y] = proj(ra, dec, lst);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, px(16));
  glow.addColorStop(0, 'rgba(255, 220, 90, 0.8)');
  glow.addColorStop(1, 'rgba(255, 220, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, px(16), 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath();
  ctx.arc(x, y, px(6), 0, 2 * Math.PI);
  ctx.fill();
  hits.push({ x, y, r: Math.max(px(9), lw(12)), kind: 'sun', d: [ra, dec] });
}

function drawDisc(lst) {
  drawDateRing(lst);

  ctx.save();
  ctx.beginPath();
  ctx.arc(G.cx, G.cy, G.Rc, 0, 2 * Math.PI);
  const bg = ctx.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, G.Rc);
  bg.addColorStop(0, '#1d4589');
  bg.addColorStop(0.75, '#14336a');
  bg.addColorStop(1, '#0e2550');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();

  if (state.opts.mw) drawMilkyWay(lst);
  if (state.opts.grid) drawGrid(lst);
  if (state.opts.lines) drawLines(lst);
  if (state.opts.messier) drawMessier(lst);
  drawStars(lst);
  if (state.opts.cnames) drawConstellationNames(lst);
  if (state.opts.sun) drawSun(lst);
  ctx.restore();
}

/* ---------------- Cover ---------------- */

function drawCover(lst) {
  const { cx, cy, Rc, hourW } = G;
  const horizon = [];
  for (let az = 0; az < 360; az += 1.5) horizon.push(horizonPoint(0, az));

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, Rc, 0, 2 * Math.PI);
  horizon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  const cover = ctx.createRadialGradient(cx, cy - Rc * 0.3, 0, cx, cy, Rc);
  cover.addColorStop(0, '#16213a');
  cover.addColorStop(1, '#0a1020');
  ctx.globalAlpha = state.opts.clear ? 0.55 : 1;
  ctx.fillStyle = cover;
  ctx.fill('evenodd');
  ctx.globalAlpha = 1;

  // Horizon edge
  ctx.strokeStyle = 'rgba(220, 230, 255, 0.85)';
  ctx.lineWidth = lw(1.6);
  ctx.beginPath();
  horizon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.stroke();

  // Altitude circles, zenith and meridian inside the window
  const zenith = horizonPoint(90, 0);
  if (state.opts.grid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = lw(0.8);
    ctx.setLineDash([lw(3), lw(4)]);
    for (const alt of [30, 60]) {
      ctx.beginPath();
      for (let az = 0; az <= 360; az += 3) {
        const [x, y] = horizonPoint(alt, az);
        if (az === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    const [nx, ny] = horizonPoint(0, 0);
    const [sx, sy] = horizonPoint(0, 180);
    ctx.moveTo(nx, ny);
    ctx.lineTo(zenith[0], zenith[1]);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = lw(1.4);
  ctx.beginPath();
  ctx.moveTo(zenith[0] - px(6), zenith[1]);
  ctx.lineTo(zenith[0] + px(6), zenith[1]);
  ctx.moveTo(zenith[0], zenith[1] - px(6));
  ctx.lineTo(zenith[0], zenith[1] + px(6));
  ctx.stroke();

  // Direction labels just outside the window
  const lang = CARDINALS[state.lang] ? state.lang : 'en';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const [x, y] = horizonPoint(0, i * 45);
    const dx = x - zenith[0], dy = y - zenith[1];
    const len = Math.hypot(dx, dy) || 1;
    const main = i % 2 === 0;
    const off = px(main ? 15 : 12);
    ctx.font = font(main ? 12 : 9.5, main ? 700 : 500);
    ctx.fillStyle = main ? '#ffffff' : 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(main ? CARDINAL_WORDS[lang][i / 2] : CARDINALS[lang][i], x + dx / len * off, y + dy / len * off);
  }

  // Hour ring: local clock time, matched against the date ring on the disc
  const tz = -new Date(state.time).getTimezoneOffset() / 60;
  const hourAngle = h => G.p * (15 * (h - tz) + state.lon - 180) * D2R;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = lw(0.9);
  ctx.beginPath();
  for (let m = 0; m < 24 * 60; m += 10) {
    const len = m % 60 === 0 ? hourW * 0.32 : m % 30 === 0 ? hourW * 0.2 : hourW * 0.12;
    radial(Rc - len, Rc, hourAngle(m / 60));
  }
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = font(13, 600);
  for (let h = 0; h < 24; h++) ringText(String(h), Rc - hourW * 0.62, hourAngle(h));

  // Current moment marker across both rings
  const tNow = G.p * (lst - meanSunRA(state.time)) * D2R;
  ctx.strokeStyle = '#ff7a45';
  ctx.lineWidth = lw(2.2);
  ctx.beginPath();
  radial(Rc - hourW, G.Rd, tNow);
  ctx.stroke();

  // Info printed on the cover, above the window
  const topY = Math.min(...horizon.map(p => p[1]));
  if (topY - (cy - G.Rs) > px(60)) {
    const y0 = (cy - G.Rs + topY) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = font(15, 700);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px(2)}px`;
    ctx.fillText(state.lang === 'cz' ? 'OTOČNÁ MAPA HVĚZDNÉ OBLOHY' : 'ROTATING STAR MAP', cx, y0 - px(10));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = font(10.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const lat = `${Math.abs(state.lat).toFixed(1)}° ${state.lat >= 0 ? 'N' : 'S'}`;
    const lon = `${Math.abs(state.lon).toFixed(1)}° ${state.lon >= 0 ? 'E' : 'W'}`;
    const sign = tz >= 0 ? '+' : '−';
    ctx.fillText(`${lat} · ${lon} · UTC${sign}${Math.abs(tz)}`, cx, y0 + px(10));
  }

  // Centre pin
  ctx.fillStyle = '#c9ced8';
  ctx.beginPath();
  ctx.arc(cx, cy, px(5), 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#6b7180';
  ctx.beginPath();
  ctx.arc(cx, cy, px(2), 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

/* ---------------- Frame ---------------- */

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}

function draw() {
  if (!G.S) return;
  const lst = lstDeg(state.time);
  hits = [];
  G.z = view.z;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.clearRect(0, 0, G.S, G.S);
  const s = G.dpr * G.z;
  ctx.setTransform(s, 0, 0, s, G.dpr * G.S * (0.5 - view.fx * G.z), G.dpr * G.S * (0.5 - view.fy * G.z));
  drawDisc(lst);
  drawCover(lst);
  renderFacts(lst);
}

const pad2 = n => String(n).padStart(2, '0');
const hhmm = hours => {
  const m = Math.floor(norm(hours * 15) / 15 * 60 + 1e-6) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

function renderFacts(lst) {
  const d = new Date(state.time);
  const tz = -d.getTimezoneOffset() / 60;
  const [sra, sdec] = sunRaDec(state.time);
  const [salt] = altAz(sra, sdec, lst);
  const phase = salt > 0 ? 'day' : salt > -6 ? 'civil twilight' : salt > -12 ? 'nautical twilight' : salt > -18 ? 'astronomical twilight' : 'night';
  const rows = [
    ['Local time', `${pad2(d.getHours())}:${pad2(d.getMinutes())} (UTC${tz >= 0 ? '+' : '−'}${Math.abs(tz)})`],
    ['Sidereal time', hhmm(lst / 15)],
    ['Sun altitude', `${salt.toFixed(1)}°`],
    ['Sky', phase],
  ];
  const dl = $('facts');
  dl.replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    return [dt, dd];
  }));

  if (document.activeElement !== $('date')) {
    $('date').value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  if (document.activeElement !== $('time')) $('time').value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ---------------- Tooltip ---------------- */

const compass = az => CARDINALS[LANG === 'cs' ? 'cz' : 'en'][Math.round(az / 45) % 8];

function showTip(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left, y = evt.clientY - rect.top;
  const [mx, my] = toMap(x, y);
  const lst = lstDeg(state.time);
  let best = null, bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - mx, h.y - my);
    if (d > h.r || d >= bestD) continue;
    const [ra, dec] = h.kind === 'star' ? h.d : h.kind === 'messier' ? [h.d[1], h.d[2]] : h.d;
    const [alt] = altAz(ra, dec, lst);
    if (alt < 0 && !state.opts.clear) continue;
    best = h;
    bestD = d;
  }
  const tip = $('tip');
  if (!best) { tip.hidden = true; return; }

  const consName = id => {
    const c = CONS[id];
    return c ? c[state.lang === 'cz' ? 6 : state.lang === 'la' ? 5 : 4] : '';
  };
  let ra, dec, title, sub;
  if (best.kind === 'star') {
    const s = best.d;
    [ra, dec] = s;
    const bayer = s[5] && s[6] ? `${s[5]} ${CONS[s[6]] ? CONS[s[6]][7] : s[6]}` : '';
    title = s[4] || bayer || 'Star';
    sub = [s[4] && bayer ? bayer : '', consName(s[6]), t('magnitude {m}', { m: s[2].toFixed(2) })].filter(Boolean).join(' · ');
  } else if (best.kind === 'messier') {
    const m = best.d;
    [ra, dec] = [m[1], m[2]];
    title = m[5] ? `${m[0]} · ${m[5]}` : m[0];
    sub = `${t(MESSIER_TYPES[m[3]] || m[3])} · ${t('magnitude {m}', { m: m[4] })}`;
  } else {
    [ra, dec] = best.d;
    title = 'Sun';
    sub = '';
  }
  const [alt, az] = altAz(ra, dec, lst);
  const pos = alt >= 0 ? t('altitude {alt}° · {dir} ({az}°)', { alt: alt.toFixed(0), dir: compass(az), az: az.toFixed(0) }) : t('below the horizon');

  tip.replaceChildren();
  const b = document.createElement('b');
  b.textContent = title;
  tip.append(b);
  for (const line of [sub, pos]) {
    if (!line) continue;
    const div = document.createElement('div');
    div.className = line === pos ? '' : 'dim';
    div.textContent = line;
    tip.append(div);
  }
  tip.hidden = false;
  const flip = x > rect.width - 220;
  tip.style.left = `${Math.max(0, flip ? x - 244 : x)}px`;
  tip.style.top = `${y > rect.height - 90 ? y - 90 : y}px`;
}

/* ---------------- View (zoom & pan) ---------------- */

const toMap = (sx, sy) => [
  (sx - G.S / 2) / view.z + view.fx * G.S,
  (sy - G.S / 2) / view.z + view.fy * G.S,
];

function clampView() {
  view.z = Math.max(1, Math.min(MAX_ZOOM, view.z));
  const half = 0.5 / view.z;
  view.fx = Math.max(half, Math.min(1 - half, view.fx));
  view.fy = Math.max(half, Math.min(1 - half, view.fy));
}

function zoomAt(sx, sy, z) {
  const [mx, my] = toMap(sx, sy);
  view.z = Math.max(1, Math.min(MAX_ZOOM, z));
  view.fx = (mx - (sx - G.S / 2) / view.z) / G.S;
  view.fy = (my - (sy - G.S / 2) / view.z) / G.S;
  clampView();
  renderViewButton();
  requestDraw();
}

function fitWindow() {
  const pts = [];
  for (let az = 0; az < 360; az += 5) pts.push(horizonPoint(0, az));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  view.z = Math.min(MAX_ZOOM, G.S / (Math.max(w, h) * 1.1));
  view.fx = (Math.max(...xs) + Math.min(...xs)) / 2 / G.S;
  view.fy = (Math.max(...ys) + Math.min(...ys)) / 2 / G.S;
  clampView();
}

function setWholeMap() {
  view.z = 1;
  view.fx = view.fy = 0.5;
}

const isWhole = () => view.z < 1.01;

function renderViewButton() {
  $('view-toggle').textContent = isWhole() ? 'Sky window' : 'Whole map';
}

$('zoom-in').addEventListener('click', () => zoomAt(G.S / 2, G.S / 2, view.z * 1.4));
$('zoom-out').addEventListener('click', () => zoomAt(G.S / 2, G.S / 2, view.z / 1.4));
$('view-toggle').addEventListener('click', () => {
  if (isWhole()) fitWindow(); else setWholeMap();
  state.skyWindow = !isWhole();
  save();
  renderViewButton();
  requestDraw();
});

/* ---------------- Interaction ---------------- */

// One finger / mouse: turn the disc. Two fingers: pinch and move.
// Shift, right or middle mouse button: move the view.
const pointers = new Map();
let gesture = null;

const localPoint = e => {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
};
const discAngle = (sx, sy) => {
  const [mx, my] = toMap(sx, sy);
  return Math.atan2(mx - G.cx, my - G.cy) / D2R;
};

function turnBy(deg) {
  // Turning the disc by Δθ changes local sidereal time by p·Δθ.
  state.time += G.p * deg / SIDEREAL_DAY_DEG * 86400000;
  requestDraw();
}

function startPinch() {
  const [a, b] = [...pointers.values()];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  gesture = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: view.z, anchor: toMap(...mid) };
}

canvas.addEventListener('pointerdown', e => {
  const p = localPoint(e);
  pointers.set(e.pointerId, p);
  canvas.setPointerCapture(e.pointerId);
  $('tip').hidden = true;
  stopPlaying();
  if (pointers.size === 2) return startPinch();
  if (pointers.size > 2) return;
  const pan = e.shiftKey || e.button === 1 || e.button === 2;
  gesture = pan
    ? { type: 'pan', start: p, fx: view.fx, fy: view.fy }
    : { type: 'turn', angle: discAngle(...p), start: p, t0: performance.now(), moved: false };
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse') showTip(e);
    return;
  }
  const p = localPoint(e);
  pointers.set(e.pointerId, p);
  if (!gesture) return;

  if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    view.z = Math.max(1, Math.min(MAX_ZOOM, gesture.z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / gesture.d0));
    view.fx = (gesture.anchor[0] - (mid[0] - G.S / 2) / view.z) / G.S;
    view.fy = (gesture.anchor[1] - (mid[1] - G.S / 2) / view.z) / G.S;
    clampView();
    renderViewButton();
    requestDraw();
  } else if (gesture.type === 'pan') {
    view.fx = gesture.fx - (p[0] - gesture.start[0]) / view.z / G.S;
    view.fy = gesture.fy - (p[1] - gesture.start[1]) / view.z / G.S;
    clampView();
    requestDraw();
  } else if (gesture.type === 'turn') {
    if (Math.hypot(p[0] - gesture.start[0], p[1] - gesture.start[1]) > 4) gesture.moved = true;
    const a = discAngle(...p);
    const delta = ((a - gesture.angle + 540) % 360) - 180;
    gesture.angle = a;
    turnBy(delta);
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  // A short tap without moving shows what is under the finger.
  if (gesture?.type === 'turn' && !gesture.moved && e.type === 'pointerup' && performance.now() - gesture.t0 < 500) {
    showTip(e);
  }
  if (pointers.size === 0 || gesture?.type === 'pinch') gesture = null;
  if (pointers.size === 0) canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pointers.size) $('tip').hidden = true; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const [sx, sy] = localPoint(e);
  zoomAt(sx, sy, view.z * Math.pow(1.0015, -e.deltaY));
}, { passive: false });

canvas.addEventListener('dblclick', e => {
  const [sx, sy] = localPoint(e);
  zoomAt(sx, sy, view.z * 1.8);
});

let lastFrame = 0;
function tick(ts) {
  if (!state.playing) return;
  if (lastFrame) state.time += (ts - lastFrame) * 1200; // 20 minutes per second
  lastFrame = ts;
  draw();
  requestAnimationFrame(tick);
}
function stopPlaying() {
  state.playing = false;
  $('play').setAttribute('aria-pressed', 'false');
  $('play').textContent = '▶ Play';
}

$('play').addEventListener('click', () => {
  if (state.playing) return stopPlaying();
  state.playing = true;
  lastFrame = 0;
  $('play').setAttribute('aria-pressed', 'true');
  $('play').textContent = '❚❚ Pause';
  requestAnimationFrame(tick);
});

$('now').addEventListener('click', () => { state.time = Date.now(); requestDraw(); });
$('minus-h').addEventListener('click', () => { state.time -= 3600000; requestDraw(); });
$('plus-h').addEventListener('click', () => { state.time += 3600000; requestDraw(); });

function readDateTime() {
  const d = $('date').value, t = $('time').value || '00:00';
  if (!d) return;
  const ms = new Date(`${d}T${t}`).getTime();
  if (Number.isFinite(ms)) {
    state.time = ms;
    requestDraw();
  }
}
$('date').addEventListener('change', readDateTime);
$('time').addEventListener('change', readDateTime);

/* ---------------- Location & options ---------------- */

function parseCoord(s, limit) {
  const t = String(s).trim().replace(',', '.').replace(/−/g, '-');
  let v = parseFloat(t.replace(/^[NSEW]\s*/i, ''));
  if (!Number.isFinite(v)) return NaN;
  if (/[SW]/i.test(t)) v = -Math.abs(v);
  return Math.abs(v) <= limit ? v : NaN;
}

function syncLocationInputs() {
  if (document.activeElement !== $('lat')) $('lat').value = String(+state.lat.toFixed(4));
  if (document.activeElement !== $('lon')) $('lon').value = String(+state.lon.toFixed(4));
  const match = [...$('place').options].find(o => {
    if (!o.value) return false;
    const [a, b] = o.value.split(',').map(Number);
    return Math.abs(a - state.lat) < 1e-3 && Math.abs(b - state.lon) < 1e-3;
  });
  $('place').value = match ? match.value : '';
}

function setLocation(lat, lon) {
  state.lat = Math.max(-89.5, Math.min(89.5, lat));
  state.lon = lon;
  hemisphere();
  if (!isWhole()) fitWindow();
  syncLocationInputs();
  save();
  requestDraw();
}

$('place').addEventListener('change', e => {
  if (!e.target.value) return;
  const [a, b] = e.target.value.split(',').map(Number);
  setLocation(a, b);
});

for (const [id, limit] of [['lat', 90], ['lon', 180]]) {
  $(id).addEventListener('input', () => {
    const v = parseCoord($(id).value, limit);
    $(id).classList.toggle('bad', !Number.isFinite(v));
    if (!Number.isFinite(v)) return;
    if (id === 'lat') setLocation(v, state.lon); else setLocation(state.lat, v);
  });
  $(id).addEventListener('blur', syncLocationInputs);
}

$('locate').addEventListener('click', () => {
  const note = $('loc-note');
  if (!navigator.geolocation) {
    note.hidden = false;
    note.textContent = 'Your browser does not support location.';
    return;
  }
  note.hidden = false;
  note.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      setLocation(pos.coords.latitude, pos.coords.longitude);
      note.textContent = 'Location set.';
    },
    () => { note.textContent = 'Could not get your location. Type it in or pick a place.'; },
    { timeout: 10000 },
  );
});

for (const o of OPTS) {
  $(`o-${o}`).addEventListener('change', e => {
    state.opts[o] = e.target.checked;
    save();
    requestDraw();
  });
}

$('mag').addEventListener('input', e => {
  state.mag = Number(e.target.value);
  $('mag-val').textContent = t('magnitude {m}', { m: state.mag });
  save();
  requestDraw();
});

$('lang').addEventListener('change', e => {
  state.lang = e.target.value;
  save();
  requestDraw();
});

/* ---------------- Persistence ---------------- */

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      lat: state.lat, lon: state.lon, mag: state.mag, lang: state.lang, opts: state.opts, skyWindow: state.skyWindow,
    }));
  } catch { /* storage unavailable */ }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!d) return;
    if (Number.isFinite(d.lat) && Math.abs(d.lat) <= 90) state.lat = d.lat;
    if (Number.isFinite(d.lon) && Math.abs(d.lon) <= 180) state.lon = d.lon;
    if (Number.isFinite(d.mag)) state.mag = Math.max(2, Math.min(6, d.mag));
    if (['en', 'cz', 'la'].includes(d.lang)) state.lang = d.lang;
    if (typeof d.skyWindow === 'boolean') state.skyWindow = d.skyWindow;
    for (const o of OPTS) if (typeof d.opts?.[o] === 'boolean') state.opts[o] = d.opts[o];
  } catch { /* ignore corrupt storage */ }
}

load();
for (const o of OPTS) $(`o-${o}`).checked = state.opts[o];
$('mag').value = state.mag;
$('mag-val').textContent = t('magnitude {m}', { m: state.mag });
$('lang').value = state.lang;
hemisphere();
syncLocationInputs();
layout();
if (state.skyWindow ?? G.S < 560) fitWindow(); // phones start zoomed to the visible sky
renderViewButton();
draw();

new ResizeObserver(() => { layout(); draw(); }).observe($('wrap'));
if (document.fonts) document.fonts.ready.then(draw);
