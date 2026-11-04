'use strict';

const SYNTAX = 'Syntax ERROR';
const MATH = 'Math ERROR';
const VARS = ['M'];
const STORE_KEY = 'kalk-state-v2';

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const sup = s => [...String(s)].map(c => SUP[c] ?? c).join('');

const state = {
  tokens: [],
  cursor: 0,
  mode: 'edit', // edit | result | error
  hyp: false,
  angle: 'DEG',
  ans: 0,
  value: 0,
  fmt: 'dec', // dec | frac | dms | eng
  engExp: 0,
  error: '',
  errPos: 0,
  vars: Object.fromEntries(VARS.map(v => [v, 0])),
  history: [],
  histIdx: 0,
};

/* ---------------- Math ---------------- */

const toRad = x => state.angle === 'DEG' ? x * Math.PI / 180 : state.angle === 'GRA' ? x * Math.PI / 200 : x;
const fromRad = x => state.angle === 'DEG' ? x * 180 / Math.PI : state.angle === 'GRA' ? x * 200 / Math.PI : x;
const clean = v => Math.abs(v) < 1e-15 ? 0 : v;

function fact(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw MATH;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

function combin(n, r, choose) {
  if (![n, r].every(Number.isInteger) || n < 0 || r < 0 || r > n) throw MATH;
  let res = 1;
  for (let k = 1; k <= r; k++) res = choose ? res * (n - r + k) / k : res * (n - r + k);
  return Math.round(res);
}

function powr(b, e) {
  if (b < 0 && !Number.isInteger(e)) {
    const inv = Math.round(1 / e);
    if (Math.abs(1 / e - inv) < 1e-9 && inv % 2 !== 0) return -Math.pow(-b, e);
  }
  return Math.pow(b, e);
}

function root(n, x) {
  if (n === 0) throw MATH;
  if (x < 0 && Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
  return Math.pow(x, 1 / n);
}

const logBase = (a, x) => x === undefined ? Math.log10(a) : Math.log(x) / Math.log(a);

const FUNCS = {
  'sin(': x => clean(Math.sin(toRad(x))),
  'cos(': x => clean(Math.cos(toRad(x))),
  'tan(': x => {
    const r = toRad(x);
    if (Math.abs(Math.cos(r)) < 1e-15) throw MATH;
    return clean(Math.tan(r));
  },
  'sin⁻¹(': x => fromRad(Math.asin(x)),
  'cos⁻¹(': x => fromRad(Math.acos(x)),
  'tan⁻¹(': x => fromRad(Math.atan(x)),
  'sinh(': Math.sinh,
  'cosh(': Math.cosh,
  'tanh(': Math.tanh,
  'sinh⁻¹(': Math.asinh,
  'cosh⁻¹(': Math.acosh,
  'tanh⁻¹(': Math.atanh,
  'log(': logBase,
  'logₐ(': logBase,
  'ln(': Math.log,
  '10^(': x => Math.pow(10, x),
  'e^(': Math.exp,
  '√(': Math.sqrt,
  '∛(': Math.cbrt,
  'Abs(': Math.abs,
  'Rnd(': x => Number(x.toPrecision(10)),
};
const MULTI_ARG = new Set(['log(', 'logₐ(']);

const POSTFIX = {
  '²': x => x * x,
  '³': x => x * x * x,
  '⁻¹': x => { if (x === 0) throw MATH; return 1 / x; },
  '!': fact,
  '%': x => x / 100,
};

const CONSTS = {
  'π': () => Math.PI,
  'e': () => Math.E,
  'Ans': () => state.ans,
  'Ran#': () => Math.round(Math.random() * 1000) / 1000,
};

const DISPLAY = { 'nPr': 'P', 'nCr': 'C' };
const disp = t => DISPLAY[t] ?? t;

// Tokens that, typed right after a result, continue from Ans.
const CONTINUES = new Set(['+', '−', '×', '÷', '²', '³', '⁻¹', '!', '%', '^(', 'ˣ√(', '⌟', 'nPr', 'nCr']);

/* ---------------- Parser ---------------- */

function evaluate(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const chk = v => { if (!Number.isFinite(v)) throw MATH; return v; };
  const isDigit = t => t !== undefined && /^[0-9.]$/.test(t);
  const startsPrimary = t => t !== undefined &&
    (isDigit(t) || t === '(' || t in FUNCS || t in CONSTS || VARS.includes(t));

  function close() {
    if (peek() === ')') i++;
    else if (peek() !== undefined) throw SYNTAX;
  }

  function number() {
    let s = '';
    while (isDigit(peek())) s += tokens[i++];
    if (s === '.' || (s.match(/\./g) || []).length > 1) throw SYNTAX;
    return parseFloat(s);
  }

  function exponent() {
    let sign = 1;
    if (peek() === '-' || peek() === '−') { i++; sign = -1; }
    else if (peek() === '+') i++;
    if (!isDigit(peek())) throw SYNTAX;
    return sign * number();
  }

  function primary() {
    const t = peek();
    if (t === undefined) throw SYNTAX;
    if (isDigit(t)) return number();
    if (t === 'ᴇ') { i++; return chk(Math.pow(10, exponent())); }
    if (t === '(') { i++; const v = expr(); close(); return v; }
    if (t in FUNCS) {
      i++;
      const args = [expr()];
      while (peek() === ',') { i++; args.push(expr()); }
      if (args.length > (MULTI_ARG.has(t) ? 2 : 1)) throw SYNTAX;
      close();
      return chk(FUNCS[t](...args));
    }
    if (t in CONSTS) { i++; return CONSTS[t](); }
    if (VARS.includes(t)) { i++; return state.vars[t]; }
    throw SYNTAX;
  }

  function power() {
    let v = primary();
    for (;;) {
      const t = peek();
      if (t in POSTFIX) { i++; v = chk(POSTFIX[t](v)); }
      else if (t === '^(') { i++; const e = expr(); close(); v = chk(powr(v, e)); }
      else if (t === 'ˣ√(') { i++; const x = expr(); close(); v = chk(root(v, x)); }
      else if (t === 'ᴇ') { i++; v = chk(v * Math.pow(10, exponent())); }
      else if (t === '°') {
        // degrees°minutes°seconds°
        i++;
        let div = 60;
        while (div <= 3600 && isDigit(peek())) {
          const save = i;
          const n = number();
          if (peek() !== '°') { i = save; break; }
          i++;
          v += n / div;
          div *= 60;
        }
      }
      else return v;
    }
  }

  function unary() {
    const t = peek();
    if (t === '-' || t === '−') { i++; return -unary(); }
    if (t === '+') { i++; return unary(); }
    return power();
  }

  function frac() {
    let v = unary();
    while (peek() === '⌟') {
      i++;
      const d = unary();
      if (d === 0) throw MATH;
      v /= d;
    }
    return v;
  }

  function perm() {
    let v = frac();
    while (peek() === 'nPr' || peek() === 'nCr') {
      const choose = tokens[i++] === 'nCr';
      v = combin(v, frac(), choose);
    }
    return v;
  }

  // Implicit multiplication (2π, 3sin(30)) binds tighter than × and ÷.
  function implicit() {
    let v = perm();
    while (startsPrimary(peek())) v = chk(v * perm());
    return v;
  }

  function term() {
    let v = implicit();
    for (;;) {
      const t = peek();
      if (t === '×') { i++; v = chk(v * implicit()); }
      else if (t === '÷') {
        i++;
        const d = implicit();
        if (d === 0) throw MATH;
        v = chk(v / d);
      }
      else return v;
    }
  }

  function expr() {
    let v = term();
    for (;;) {
      const t = peek();
      if (t === '+') { i++; v = chk(v + term()); }
      else if (t === '−' || t === '-') { i++; v = chk(v - term()); }
      else return v;
    }
  }

  try {
    if (!tokens.length) throw SYNTAX;
    let v = expr();
    if (peek() === '→') {
      i++;
      const target = tokens[i++];
      if (!VARS.includes(target) || i < tokens.length) throw SYNTAX;
      state.vars[target] = v;
    }
    if (i < tokens.length) throw SYNTAX;
    v = chk(v);
    return v === 0 ? 0 : v;
  } catch (e) {
    state.errPos = Math.min(i, tokens.length);
    throw typeof e === 'string' ? e : MATH;
  }
}

/* ---------------- Formatting ---------------- */

const stripZeros = s => s.includes('.') ? s.replace(/\.?0+$/, '') : s;

function sci(x) {
  const [m, e] = x.toExponential(9).split('e');
  return `${stripZeros(m)}×10${sup(Number(e))}`;
}

function fmtNum(x) {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e10 || a < 1e-6) return sci(x);
  const s = x.toPrecision(10);
  return s.includes('e') ? sci(x) : stripZeros(s);
}

function toFraction(x) {
  if (Number.isInteger(x) || Math.abs(x) >= 1e10) return null;
  const tol = 1e-12 * Math.max(1, Math.abs(x));
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let n = 0; n < 40; n++) {
    const a = Math.floor(b);
    [h1, h0] = [a * h1 + h0, h1];
    [k1, k0] = [a * k1 + k0, k1];
    if (Math.abs(x - h1 / k1) <= tol || k1 > 1e10) break;
    b = 1 / (b - a);
    if (!Number.isFinite(b)) break;
  }
  if (Math.abs(x - h1 / k1) > tol) return null;
  if (String(Math.abs(h1)).length + String(k1).length > 10) return null;
  return [h1, k1];
}

function fmtDMS(x) {
  const sign = x < 0 ? '-' : '';
  const a = Math.abs(x);
  let d = Math.floor(a);
  const mf = (a - d) * 60;
  let m = Math.floor(mf);
  let s = Math.round((mf - m) * 6000) / 100;
  if (s >= 60) { s -= 60; m++; }
  if (m >= 60) { m -= 60; d++; }
  return `${sign}${d}°${m}′${stripZeros(s.toFixed(2))}″`;
}

function fmtEng(x) {
  const m = x / Math.pow(10, state.engExp);
  const s = m.toPrecision(10);
  return `${s.includes('e') ? fmtNum(m) : stripZeros(s)}×10${sup(state.engExp)}`;
}

function fmtResult() {
  const v = state.value;
  if (state.fmt === 'frac') {
    const f = toFraction(v);
    if (f) return `${f[0]}⌟${f[1]}`;
  }
  if (state.fmt === 'dms') return fmtDMS(v);
  if (state.fmt === 'eng') return fmtEng(v);
  return fmtNum(v);
}

/* ---------------- Actions ---------------- */

function insert(tok) {
  if (state.mode !== 'edit') {
    const cont = state.mode === 'result' && CONTINUES.has(tok);
    state.tokens = cont ? ['Ans', tok] : [tok];
    state.cursor = state.tokens.length;
    state.mode = 'edit';
    return;
  }
  state.tokens.splice(state.cursor, 0, tok);
  state.cursor++;
}

function equals() {
  if (state.mode === 'error' || !state.tokens.length) return;
  try {
    const v = evaluate(state.tokens);
    state.value = v;
    state.ans = v;
    state.mode = 'result';
    state.fmt = state.tokens.includes('⌟') && toFraction(v) ? 'frac' : 'dec';
    const last = state.history[state.history.length - 1];
    if (!last || last.tokens.join('\u0000') !== state.tokens.join('\u0000') || last.value !== v) {
      state.history.push({ tokens: [...state.tokens], value: v });
      if (state.history.length > 30) state.history.shift();
    }
    state.histIdx = state.history.length;
    save();
  } catch (e) {
    state.mode = 'error';
    state.error = e;
  }
}

function del() {
  if (state.mode === 'error') return ac();
  if (state.mode === 'result') {
    state.mode = 'edit';
    state.cursor = state.tokens.length;
    return;
  }
  if (state.cursor > 0) {
    state.tokens.splice(state.cursor - 1, 1);
    state.cursor--;
  }
}

function ac() {
  state.tokens = [];
  state.cursor = 0;
  state.mode = 'edit';
  state.hyp = false;
  state.histIdx = state.history.length;
}

function move(dir) {
  const len = state.tokens.length;
  if (state.mode === 'error') {
    state.mode = 'edit';
    state.cursor = Math.min(state.errPos, len);
  } else if (state.mode === 'result') {
    state.mode = 'edit';
    state.cursor = dir < 0 ? len : 0;
  } else {
    state.cursor = Math.max(0, Math.min(len, state.cursor + dir));
  }
}

function browse(dir) {
  const n = state.history.length;
  if (!n) return;
  const idx = state.histIdx + dir;
  if (idx < 0 || idx >= n) return;
  state.histIdx = idx;
  const h = state.history[idx];
  state.tokens = [...h.tokens];
  state.cursor = state.tokens.length;
  state.value = h.value;
  state.mode = 'result';
  state.fmt = 'dec';
}

function ensureResult() {
  if (state.mode === 'edit' && state.tokens.length) equals();
  return state.mode === 'result';
}

function trigKey(name, inverse) {
  return () => insert(name + (state.hyp ? 'h' : '') + (inverse ? '⁻¹' : '') + '(');
}

function memAdd(sign) {
  if (!ensureResult()) return;
  state.vars.M += sign * state.value;
  save();
}

function eng(dir) {
  if (!ensureResult() || state.value === 0) return;
  if (state.fmt !== 'eng') {
    state.fmt = 'eng';
    state.engExp = Math.floor(Math.log10(Math.abs(state.value)) / 3) * 3;
  } else {
    state.engExp += dir * 3;
  }
}

function toggleSD() {
  if (!ensureResult()) return;
  state.fmt = state.fmt !== 'frac' && toFraction(state.value) ? 'frac' : 'dec';
}

function dmsKey() {
  if (state.mode === 'result') state.fmt = state.fmt === 'dms' ? 'dec' : 'dms';
  else insert('°');
}

function setAngle(a) {
  state.angle = a;
  save();
}

const KEYS = {
  left: () => move(-1),
  right: () => move(1),
  up: () => browse(-1),
  down: () => browse(1),
  deg: () => setAngle('DEG'),
  rad: () => setAngle('RAD'),
  gra: () => setAngle('GRA'),
  cycleAngle: () => setAngle({ DEG: 'RAD', RAD: 'GRA', GRA: 'DEG' }[state.angle]),

  sin: trigKey('sin'), cos: trigKey('cos'), tan: trigKey('tan'),
  asin: trigKey('sin', true), acos: trigKey('cos', true), atan: trigKey('tan', true),
  hyp: () => { state.hyp = !state.hyp; },
  dms: dmsKey,

  sq: '²', cube: '³', pow: '^(', inv: '⁻¹',
  sqrt: '√(', cbrt: '∛(', root: 'ˣ√(', tenx: '10^(',
  log: 'log(', ln: 'ln(', ex: 'e^(', logab: 'logₐ(',

  pi: 'π', e: 'e', fact: '!', pct: '%',
  npr: 'nPr', ncr: 'nCr', abs: 'Abs(', comma: ',',
  frac: '⌟', sd: toggleSD, eng: () => eng(-1), ran: 'Ran#',

  mplus: () => memAdd(1),
  mminus: () => memAdd(-1),
  mr: 'M',
  mc: () => { state.vars.M = 0; save(); },

  ac, del, eq: equals,
  lp: '(', rp: ')',
  d0: '0', d1: '1', d2: '2', d3: '3', d4: '4', d5: '5', d6: '6', d7: '7', d8: '8', d9: '9',
  dot: '.', exp: 'ᴇ', neg: '-', ans: 'Ans',
  add: '+', sub: '−', mul: '×', div: '÷',
};

const KEEPS_HYP = new Set(['hyp', 'left', 'right', 'deg', 'rad', 'gra', 'cycleAngle']);

function press(name) {
  const action = KEYS[name];
  if (action === undefined) return;
  if (typeof action === 'string') insert(action);
  else action();
  if (!KEEPS_HYP.has(name)) state.hyp = false;
  render();
}

/* ---------------- Rendering ---------------- */

const $ = id => document.getElementById(id);
const exprEl = $('expr');
const resultEl = $('result');
const TRIG_KEYS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'];

function render() {
  $('i-hyp').classList.toggle('on', state.hyp);
  $('i-m').classList.toggle('on', state.vars.M !== 0);
  document.querySelector('[data-k="hyp"]').classList.toggle('active', state.hyp);
  for (const a of ['deg', 'rad', 'gra']) {
    document.querySelector(`[data-k="${a}"]`).classList.toggle('active', state.angle === a.toUpperCase());
  }
  for (const k of TRIG_KEYS) {
    const base = k.replace(/^a/, '');
    document.querySelector(`[data-k="${k}"]`).textContent =
      base + (state.hyp ? 'h' : '') + (k.startsWith('a') ? '⁻¹' : '');
  }

  exprEl.replaceChildren();
  exprEl.classList.toggle('editing', state.mode === 'edit');
  resultEl.classList.remove('hint');

  if (state.mode === 'error') {
    const err = document.createElement('span');
    err.className = 'err';
    err.textContent = state.error;
    exprEl.append(err);
    resultEl.classList.add('hint');
    resultEl.textContent = 'AC to clear · ◀ ▶ to fix the expression';
    return;
  }

  const text = ts => ts.map(disp).join('');
  if (state.mode === 'edit') {
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    exprEl.append(
      text(state.tokens.slice(0, state.cursor)),
      cursor,
      text(state.tokens.slice(state.cursor)),
    );
    resultEl.textContent = state.tokens.length ? '' : '0';
    const left = cursor.offsetLeft - exprEl.offsetLeft;
    if (left > exprEl.scrollLeft + exprEl.clientWidth - 12) exprEl.scrollLeft = left - exprEl.clientWidth + 12;
    else if (left < exprEl.scrollLeft + 12) exprEl.scrollLeft = Math.max(0, left - 12);
  } else {
    exprEl.append(text(state.tokens));
    exprEl.scrollLeft = 0;
    resultEl.textContent = fmtResult();
    resultEl.scrollLeft = resultEl.scrollWidth;
  }
}

/* ---------------- Persistence ---------------- */

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      vars: state.vars,
      ans: state.ans,
      angle: state.angle,
      history: state.history,
    }));
  } catch { /* storage unavailable */ }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!d) return;
    for (const v of VARS) if (Number.isFinite(d.vars?.[v])) state.vars[v] = d.vars[v];
    if (Number.isFinite(d.ans)) state.ans = d.ans;
    if (['DEG', 'RAD', 'GRA'].includes(d.angle)) state.angle = d.angle;
    if (Array.isArray(d.history)) {
      state.history = d.history
        .filter(h => Array.isArray(h.tokens) && h.tokens.every(t => typeof t === 'string') && Number.isFinite(h.value))
        .slice(-30);
    }
  } catch { /* ignore corrupt storage */ }
  state.histIdx = state.history.length;
}

/* ---------------- Input wiring ---------------- */

function flash(name) {
  const btn = document.querySelector(`[data-k="${name}"]`);
  if (!btn) return;
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 110);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('button[data-k]');
  if (!btn) return;
  press(btn.dataset.k);
});

const KB = {
  '0': 'd0', '1': 'd1', '2': 'd2', '3': 'd3', '4': 'd4',
  '5': 'd5', '6': 'd6', '7': 'd7', '8': 'd8', '9': 'd9',
  '.': 'dot', '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow',
  '(': 'lp', ')': 'rp', ',': 'comma', '%': 'pct', '!': 'fact',
  'Enter': 'eq', '=': 'eq', 'Backspace': 'del', 'Delete': 'del', 'Escape': 'ac',
  'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down',
  's': 'sin', 'c': 'cos', 't': 'tan', 'l': 'ln', 'g': 'log', 'r': 'sqrt', 'h': 'hyp',
  'p': 'pi', 'e': 'e', 'E': 'exp', 'a': 'ans', 'm': 'cycleAngle',
};

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const name = KB[e.key];
  if (!name) return;
  e.preventDefault();
  flash(name);
  press(name);
});

load();
render();

