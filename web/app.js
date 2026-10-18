// Page logic: sliders, the Pyodide worker, and two hand-drawn SVG charts.
// No build step and no chart library; everything here runs as-is from GitHub Pages.

const PYODIDE_VERSION = '314.0.7';
const query = new URLSearchParams(location.search);
// ?pyodide=/local/path/ lets you test against a local copy of the Pyodide distribution.
const PYODIDE_BASE = query.get('pyodide') || `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PRESETS = { 'daniel-08-16-26': 'Daniel', 'eli-08-16-26': 'Eli', 'brendan-08-16-26': 'Brendan' };
const ANCHORS = { 'uplift-solved': 'coding uplift', 'time-horizon': 'time horizon', revenue: 'revenue' };
const MILESTONES = [
  ['AIR-25x', 'AIR-25×'], ['AC', 'AC'], ['AI2027-SC', 'AI2027-SC'],
  ['SAR-level-experiment-selection-skill', 'SAR'], ['SIAR-level-experiment-selection-skill', 'SIAR'],
  ['TED-AI', 'TED-AI'], ['ASI', 'ASI'],
];
const SVGNS = 'http://www.w3.org/2000/svg';

// ---------- formatting ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtMonth(t) {
  if (t == null) return 'never';
  const y = Math.floor(t);
  return `${MONTHS[Math.min(11, Math.floor((t - y) * 12))]} ${y}`;
}
function fmtDay(t) {
  if (t == null) return 'never';
  const ms = Date.UTC(Math.floor(t), 0, 1) + (t - Math.floor(t)) * 365.25 * 86400e3;
  return new Date(ms).toISOString().slice(0, 10);
}
function deltaDays(a, b) {
  if (a == null || b == null) return null;
  return (a - b) * 365.25;
}
function fmtDelta(d) {
  if (d == null) return '—';
  if (Math.abs(d) < 0.05) return '0 d';
  const s = d > 0 ? '+' : '−';
  const v = Math.abs(d);
  return `${s}${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US')} d`;
}
function fmtSig(x) {
  if (x >= 1000) return x.toExponential(1).replace('e+', 'e');
  if (x >= 100) return String(Math.round(x));
  if (x >= 10) return x.toFixed(1).replace(/\.0$/, '');
  return x.toPrecision(3).replace(/\.?0+$/, '');
}

// ---------- sliders ----------
// Each slider moves in its own `ui` scale (often log10) and maps to a model parameter.
const lin = { to: (v) => v, from: (u) => u };
const log = { to: (v) => Math.log10(v), from: (u) => 10 ** u };
const SLIDERS = {
  parallel_penalty: { label: 'Coding labor exponent λ', ...lin, min: 0.01, max: 1, step: 0.01, fmt: (v) => v.toFixed(2),
    hint: 'Doubling parallel coding labor multiplies serial labor by 2^λ. Bug 2 bites below about 0.27' },
  coding_labor_normalization: { label: 'Coding labor normalization', ...log, min: -1, max: 1, step: 0.01, fmt: fmtSig,
    hint: 'Should change nothing (every calibration target is a ratio). Bug 4' },
  automation_logistic_asymptote: { label: 'Automation logistic asymptote',
    to: (v) => Math.log10(v - 1), from: (u) => 1 + 10 ** u, min: -4, max: Math.log10(4), step: 0.01,
    fmt: (v) => (v < 1.01 ? v.toFixed(4) : v.toFixed(2)), hint: 'Near 1 the frontier grid was too coarse. Bug 2' },
  coding_automation_efficiency_slope: { label: 'Coding automation efficiency slope η', ...log, min: -2, max: 1, step: 0.01, fmt: fmtSig,
    hint: 'OOMs; the original converts it for λ ≠ 0.5 wrongly. Bug 5' },
  top_percentile: { label: 'Top researcher percentile',
    to: (v) => -Math.log10(1 - v), from: (u) => 1 - 10 ** -u, min: 1, max: 5, step: 0.05,
    fmt: (v) => `${(v * 100).toFixed(Math.max(1, Math.ceil(-Math.log10(1 - v)) - 1))}%`,
    hint: 'The original pins the skill milestones to 99.9% whatever this says. Bug 1' },
  ai_research_taste_at_coding_automation_anchor_sd: { label: 'AI research taste at AC (SD)', ...lin, min: -10, max: 10, step: 0.1,
    fmt: (v) => v.toFixed(1), hint: 'Relative to the median human researcher' },
  ai_research_taste_slope: { label: 'AI research taste slope', ...lin, min: 0.1, max: 10, step: 0.1, fmt: (v) => v.toFixed(1),
    hint: 'SD per progress-year' },
  median_to_top_taste_multiplier: { label: 'Median-to-top taste multiplier', ...log, min: Math.log10(1.01), max: 2, step: 0.01, fmt: fmtSig,
    hint: 'How much better the best researcher is than the median' },
  present_day: { label: 'Present day', ...lin, min: 2025.5, max: 2027, step: 0.01, fmt: (v) => v.toFixed(2),
    hint: 'Moving it off the preset date exposes bug 6 in the time-horizon and revenue anchors' },
};

const EXAMPLES = [
  { label: 'Preset', set: {} },
  { label: 'λ 0.1', set: { parallel_penalty: 0.1 } },
  { label: 'Top 0.001%', set: { top_percentile: 0.99999 } },
  { label: 'Normalization 2', set: { coding_labor_normalization: 2 } },
  { label: 'λ 0.3', set: { parallel_penalty: 0.3 } },
  { label: 'Speed cap', preset: 'daniel-08-16-26', anchor: 'uplift-solved',
    set: { parallel_penalty: 0.06, coding_automation_efficiency_slope: 2, automation_logistic_asymptote: 1.2 } },
  { label: 'Taste 10 SD (nonsense)', preset: 'eli-08-16-26', anchor: 'uplift-solved',
    set: { ai_research_taste_at_coding_automation_anchor_sd: 10, ai_research_taste_slope: 0.5, median_to_top_taste_multiplier: 20 } },
];

const state = {
  preset: 'daniel-08-16-26',
  anchor: 'uplift-solved',
  set: {},        // slider overrides, in model units
  extra: '',      // free-form "name = value" lines
  presets: {},    // preset id -> API parameter payload
  results: {},    // 'fixed' | 'upstream' -> last result for the current settings
};

// ---------- share link: settings live in the URL hash ----------
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (PRESETS[h.get('preset')]) state.preset = h.get('preset');
  if (ANCHORS[h.get('anchor')]) state.anchor = h.get('anchor');
  for (const key of Object.keys(SLIDERS)) {
    const v = Number(h.get(key));
    if (h.has(key) && Number.isFinite(v)) state.set[key] = v;
  }
  if (h.has('extra')) state.extra = h.get('extra');
}
function writeHash() {
  const h = new URLSearchParams({ preset: state.preset, anchor: state.anchor });
  for (const [k, v] of Object.entries(state.set)) h.set(k, String(+v.toPrecision(8)));
  if (state.extra.trim()) h.set('extra', state.extra.trim());
  history.replaceState(null, '', '#' + h.toString());
}

function parseExtra(text) {
  const out = {};
  for (const raw of text.split(/\n|;/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.+)$/);
    if (!m) throw new Error(`Can't read "${line}"; use name = value`);
    const v = m[2].trim();
    const n = Number(v);
    out[m[1]] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(n) ? n : v.replace(/^["']|["']$/g, '');
  }
  return out;
}

function overrides() {
  return { ac_anchor_mode: state.anchor, ...state.set, ...parseExtra(state.extra) };
}

// ---------- controls ----------
const $ = (id) => document.getElementById(id);

function presetValue(key) {
  const p = state.presets[state.preset];
  return p ? p[key] : undefined;
}

function buildSliders() {
  for (const el of document.querySelectorAll('.slider')) {
    const key = el.dataset.key;
    const s = SLIDERS[key];
    el.innerHTML = `<div class="row"><label for="s-${key}">${s.label}</label><output id="o-${key}"></output></div>
      <input type="range" id="s-${key}" min="${s.min}" max="${s.max}" step="${s.step}">
      <div class="hint" id="h-${key}"></div>`;
    el.querySelector('input').addEventListener('input', (e) => {
      const v = s.from(Number(e.target.value));
      const p = presetValue(key);
      if (p != null && Math.abs(s.to(v) - s.to(p)) < s.step / 2) delete state.set[key];
      else state.set[key] = +v.toPrecision(6);
      syncControls();
      schedule();
    });
  }
}

function syncControls() {
  $('preset').value = state.preset;
  $('anchor').value = state.anchor;
  if (document.activeElement !== $('extra')) $('extra').value = state.extra;
  for (const [key, s] of Object.entries(SLIDERS)) {
    const p = presetValue(key);
    const v = key in state.set ? state.set[key] : p;
    if (v == null) continue;
    const input = $(`s-${key}`);
    if (document.activeElement !== input) input.value = String(s.to(v));
    $(`o-${key}`).textContent = s.fmt(v);
    const changed = key in state.set;
    $(`h-${key}`).textContent = `${s.hint}. Preset ${p == null ? '?' : s.fmt(p)}${changed ? '' : ' (unchanged)'}`;
  }
  for (const btn of $('examples').children) {
    const ex = EXAMPLES[Number(btn.dataset.i)];
    const same = JSON.stringify(sortKeys(ex.set)) === JSON.stringify(sortKeys(state.set)) && !state.extra.trim()
      && (!ex.preset || ex.preset === state.preset) && (!ex.anchor || ex.anchor === state.anchor);
    btn.setAttribute('aria-pressed', String(same));
  }
  writeHash();
}
function sortKeys(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

function buildExamples() {
  EXAMPLES.forEach((ex, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ex.label;
    b.dataset.i = String(i);
    b.addEventListener('click', () => {
      if (ex.preset) state.preset = ex.preset;
      if (ex.anchor) state.anchor = ex.anchor;
      state.set = { ...ex.set };
      state.extra = '';
      loadPreset();
    });
    $('examples').appendChild(b);
  });
}

// ---------- worker ----------
const worker = new Worker('worker.js', { type: 'module' });
let ready = false;
let runId = 0;
let busy = false;
let dirty = false;
let timer = null;
const cache = new Map(); // JSON(which, preset, overrides) -> result

function setStatus(text, kind) {
  const el = $('status');
  el.className = 'status' + (kind === 'error' ? ' error' : '');
  el.innerHTML = (kind === 'busy' ? '<span class="spin"></span>' : '') + text;
  document.querySelector('.results').classList.toggle('busy', kind === 'busy');
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(start, 250);
}

function loadPreset() {
  syncControls();
  if (state.presets[state.preset]) return schedule();
  if (ready) worker.postMessage({ type: 'preset', preset: state.preset });
}

function start() {
  if (!ready || !state.presets[state.preset]) return;
  if (busy) { dirty = true; return; }
  let ov;
  try {
    ov = overrides();
  } catch (e) {
    setStatus(e.message, 'error');
    return;
  }
  const id = ++runId;
  state.results = {};
  state.pending = { id, ov, preset: state.preset, ms: {} };
  for (const which of ['fixed', 'upstream']) {
    const key = JSON.stringify([which, state.preset, sortKeys(ov)]);
    if (cache.has(key)) {
      state.results[which] = cache.get(key);
    } else {
      busy = true;
      worker.postMessage({ type: 'run', id, which, preset: state.preset, overrides: ov });
    }
  }
  if (busy) setStatus(`Solving ${PRESETS[state.preset]}, ${ANCHORS[state.anchor]} anchor…`, 'busy');
  render();
  if (!busy) finish();
}

function finish() {
  const r = state.results;
  const errs = ['fixed', 'upstream'].filter((w) => r[w] && r[w].error).map((w) => `${w === 'fixed' ? 'Fixed' : 'Original'}: ${r[w].error}`);
  if (errs.length) setStatus(errs.join(' · '), 'error');
  else setStatus(`${PRESETS[state.preset]} preset, ${ANCHORS[state.anchor]} anchor.`);
}

worker.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'progress') {
    setStatus(msg.text + '…', 'busy');
  } else if (msg.type === 'ready') {
    ready = true;
    worker.postMessage({ type: 'preset', preset: state.preset });
  } else if (msg.type === 'preset') {
    state.presets[msg.preset] = msg.params;
    syncControls();
    if (msg.preset === state.preset) start();
  } else if (msg.type === 'result' || msg.type === 'error') {
    if (msg.type === 'error' && msg.stage !== 'run') {
      setStatus(`Could not start the model: ${msg.message}`, 'error');
      return;
    }
    const p = state.pending;
    if (!p || msg.id !== p.id) return;
    const data = msg.type === 'result' ? msg.data : { error: msg.message };
    const which = msg.which || (state.results.fixed ? 'upstream' : 'fixed');
    state.results[which] = data;
    cache.set(JSON.stringify([which, p.preset, sortKeys(p.ov)]), data);
    render();
    if (state.results.fixed && state.results.upstream) {
      busy = false;
      if (dirty) { dirty = false; start(); } else finish();
    }
  }
};
worker.onerror = (e) => setStatus(`The model failed to load: ${e.message}`, 'error');

// ---------- charts ----------
function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}
function text(parent, x, y, str, attrs = {}) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}
function niceTicks(lo, hi, n) {
  const span = hi - lo;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

const tooltip = $('tooltip');
function showTip(evt, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 14;
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  const r = tooltip.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}
function hideTip() { tooltip.hidden = true; }

function milestoneChart() {
  const host = $('milestones');
  host.innerHTML = '';
  const { fixed, upstream } = state.results;
  const rows = MILESTONES.map(([key, label]) => ({
    key, label,
    f: fixed && fixed.milestones ? fixed.milestones[key] : undefined,
    u: upstream && upstream.milestones ? upstream.milestones[key] : undefined,
  }));
  const ts = rows.flatMap((r) => [r.f, r.u]).filter((t) => t != null);
  const W = 720, rowH = 30, top = 8, left = 90, right = 16;
  const H = top + rows.length * rowH + 26;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Milestone dates, fixed and original' }, host);
  if (!ts.length) return;
  let lo = Math.min(...ts), hi = Math.max(...ts);
  if (hi - lo < 2) { const m = (lo + hi) / 2; lo = m - 1; hi = m + 1; }
  lo = Math.floor(lo - 0.3); hi = Math.ceil(hi + 0.3);
  const x = (t) => left + ((t - lo) / (hi - lo)) * (W - left - right);
  const yBottom = top + rows.length * rowH;
  for (const t of niceTicks(lo, hi, 8)) {
    el('line', { x1: x(t), x2: x(t), y1: top, y2: yBottom, class: 'grid' }, svg);
    text(svg, x(t), yBottom + 16, String(t), { 'text-anchor': 'middle' });
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    text(svg, left - 10, y + 4, r.label, { 'text-anchor': 'end', class: 'row-label' });
    const g = el('g', {}, svg);
    if (r.f != null && r.u != null && Math.abs(r.f - r.u) * 365.25 >= 1) {
      el('line', { x1: x(r.u), x2: x(r.f), y1: y, y2: y, stroke: 'var(--text-3)', 'stroke-width': 2 }, g);
    }
    if (r.u != null) el('circle', { cx: x(r.u), cy: y, r: 6, fill: 'var(--surface)', stroke: 'var(--orig)', 'stroke-width': 2.5 }, g);
    if (r.f != null) el('circle', { cx: x(r.f), cy: y, r: 4.5, fill: 'var(--fix)', stroke: 'var(--surface)', 'stroke-width': 1.5 }, g);
    const hit = el('rect', { x: left, y: y - rowH / 2, width: W - left - right, height: rowH, fill: 'transparent' }, g);
    hit.addEventListener('mousemove', (e) => showTip(e, `<strong>${r.label}</strong>
      <div class="t-row"><span>Fixed</span><span>${fmtDay(r.f)}</span></div>
      <div class="t-row"><span>Original</span><span>${fmtDay(r.u)}</span></div>
      <div class="t-row"><span>Change</span><span>${fmtDelta(deltaDays(r.f, r.u))}</span></div>`));
    hit.addEventListener('mouseleave', hideTip);
  });
}

function trajectoryChart() {
  const host = $('trajectory');
  host.innerHTML = '';
  const series = [['upstream', 'var(--orig)', '6 4'], ['fixed', 'var(--fix)', null]]
    .map(([w, color, dash]) => ({ w, color, dash, r: state.results[w] }))
    .filter((s) => s.r && s.r.times);
  const W = 720, H = 300, left = 46, right = 16, top = 10, bottom = 26;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Progress over time, fixed and original' }, host);
  if (!series.length) return;
  const asi = Math.max(...series.map((s) => s.r.milestones.ASI ?? s.r.milestones.AC ?? 2035));
  const t0 = 2020, t1 = Math.min(2060, Math.max(2032, Math.ceil(asi + 2)));
  const pts = series.flatMap((s) => s.r.times.map((t, i) => [t, s.r.progress[i]]).filter(([t]) => t >= t0 && t <= t1));
  let lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  const pad = (hi - lo) * 0.05 || 1;
  lo -= pad; hi += pad;
  const x = (t) => left + ((t - t0) / (t1 - t0)) * (W - left - right);
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  for (const v of niceTicks(lo, hi, 6)) {
    el('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), class: 'grid' }, svg);
    text(svg, left - 6, y(v) + 4, String(v), { 'text-anchor': 'end' });
  }
  for (const t of niceTicks(t0, t1, 8)) text(svg, x(t), H - 8, String(t), { 'text-anchor': 'middle' });
  el('line', { x1: left, x2: W - right, y1: H - bottom, y2: H - bottom, class: 'axis' }, svg);
  const today = state.results.fixed && state.results.fixed.present_day;
  if (today) el('line', { x1: x(today), x2: x(today), y1: top, y2: H - bottom, class: 'today' }, svg);
  for (const s of series) {
    const d = s.r.times.map((t, i) => [t, s.r.progress[i]]).filter(([t]) => t >= t0 && t <= t1)
      .map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
    el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-dasharray': s.dash || 'none', 'stroke-linejoin': 'round' }, svg);
  }
  const cross = el('line', { y1: top, y2: H - bottom, stroke: 'var(--text-3)', visibility: 'hidden' }, svg);
  const hit = el('rect', { x: left, y: top, width: W - left - right, height: H - top - bottom, fill: 'transparent' }, svg);
  hit.addEventListener('mousemove', (e) => {
    const box = svg.getBoundingClientRect();
    const t = t0 + ((e.clientX - box.left) / box.width * W - left) / (W - left - right) * (t1 - t0);
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('visibility', 'visible');
    const at = (r) => {
      let best = 0;
      r.times.forEach((tt, i) => { if (Math.abs(tt - t) < Math.abs(r.times[best] - t)) best = i; });
      return r.progress[best];
    };
    showTip(e, `<strong>${fmtMonth(t)}</strong>` + series.slice().reverse().map((s) =>
      `<div class="t-row"><span>${s.w === 'fixed' ? 'Fixed' : 'Original'}</span><span>${at(s.r).toFixed(2)} OOMs</span></div>`).join(''));
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
}

function stats() {
  const { fixed, upstream } = state.results;
  const cell = (key, label) => {
    const f = fixed && fixed.milestones ? fixed.milestones[key] : undefined;
    const u = upstream && upstream.milestones ? upstream.milestones[key] : undefined;
    return `<div class="stat"><div class="label">${label}, fixed</div><div class="value">${fixed ? fmtMonth(f) : '…'}</div>
      <div class="pair">Original ${upstream ? fmtMonth(u) : '…'} · change ${fmtDelta(deltaDays(f, u))}</div></div>`;
  };
  const f = fixed && fixed.milestones, u = upstream && upstream.milestones;
  const take = (m) => (m && m.AC != null && m.ASI != null ? (m.ASI - m.AC) * 12 : null);
  const tf = take(f), tu = take(u);
  $('stats').innerHTML = cell('AC', 'AC') + cell('ASI', 'ASI') +
    `<div class="stat"><div class="label">AC to ASI, fixed</div><div class="value">${tf == null ? (fixed ? '—' : '…') : `${tf.toFixed(1)} mo`}</div>
     <div class="pair">Original ${tu == null ? (upstream ? '—' : '…') : `${tu.toFixed(1)} mo`}</div></div>`;
}

function table() {
  const { fixed, upstream } = state.results;
  const rows = MILESTONES.map(([key, label]) => {
    const f = fixed && fixed.milestones ? fixed.milestones[key] : undefined;
    const u = upstream && upstream.milestones ? upstream.milestones[key] : undefined;
    const d = deltaDays(f, u);
    const moved = (f == null) !== (u == null) || (d != null && Math.abs(d) >= 1);
    return `<tr><td>${label}</td><td class="num">${fixed ? fmtDay(f) : '…'}</td><td class="num">${upstream ? fmtDay(u) : '…'}</td>
      <td class="num${moved && fixed && upstream ? ' moved' : ''}">${fixed && upstream ? fmtDelta(d) : ''}</td></tr>`;
  });
  $('table').innerHTML = `<thead><tr><th>Milestone</th><th class="num">Fixed</th><th class="num">Original</th><th class="num">Change</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}

function render() {
  stats();
  milestoneChart();
  trajectoryChart();
  table();
}

// ---------- wiring ----------
readHash();
buildSliders();
buildExamples();
$('preset').addEventListener('change', (e) => { state.preset = e.target.value; loadPreset(); });
$('anchor').addEventListener('change', (e) => { state.anchor = e.target.value; syncControls(); schedule(); });
$('extra').addEventListener('input', (e) => { state.extra = e.target.value; syncControls(); schedule(); });
$('reset').addEventListener('click', () => { state.set = {}; state.extra = ''; syncControls(); schedule(); });
syncControls();
render();
worker.postMessage({ type: 'init', pyodideBase: PYODIDE_BASE });
