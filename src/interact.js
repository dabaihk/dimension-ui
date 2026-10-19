// Dimension UI — the global interaction layer.
// One engine for the whole page, not one per card:
//   [data-tip]     hover shows the definition
//   [data-series]  click opens the enlarged time series: window tabs, crosshair readout,
//                  full precision rows and a copyable query
// Any number on the page opts in with an attribute; nothing is wired per component.

import { SURFACE, MONO } from './tokens.js';
import { esc } from './html.js';

const registry = Object.create(null);
let tipEl = null, modal = null, current = null, installed = false;

/**
 * @typedef {{k: string, color: string, windows: Record<string, number[]>}} Line
 * @typedef {{label: string, unit?: string, tip?: string, lines: Line[], rows?: [string, string][],
 *   query?: string, windows?: string[], defaultWindow?: string, spans?: Record<string, number>}} SeriesConfig
 */

/** Register series configs by key; any [data-series="key"] element then opens it. */
export function register(map) {
  for (const k of Object.keys(map)) registry[k] = map[k];
  if (typeof document !== 'undefined') markClickable(document);
}

/** Format a value for a unit: '$' prefixes, '%' never signs, everything else signs positives. */
export function fmt(v, unit) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const d = a >= 1000 ? 0 : a >= 100 ? 1 : 2;
  const num = a.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (unit === '$') return (v < 0 ? '−$' : '$') + num;
  const sign = v < 0 ? '−' : v > 0 && unit !== '%' ? '+' : '';
  return sign + num + (unit ? (unit === '%' ? '%' : ' ' + unit) : '');
}

/** Deterministic demo series (LCG random walk) so example pages carry no data files. */
export function gen(seed, n, start, drift = 0, vol = 1) {
  let s = seed, v = start;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    v += drift + (s / 2147483648 - 0.5) * vol;
    out.push(Math.round(v * 10000) / 10000);
  }
  return out;
}

/* ---------- tooltips ---------- */

function ensureTip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'dx-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(target, text) {
  const t = ensureTip();
  t.textContent = text;
  t.style.opacity = '1';
  const r = target.getBoundingClientRect();
  const w = Math.min(290, t.offsetWidth), h = t.offsetHeight;
  const left = Math.max(10, Math.min(window.innerWidth - w - 10, r.left));
  let top = r.bottom + 9;
  if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 9);
  t.style.left = left + 'px';
  t.style.top = top + 'px';
}

function hideTip() { if (tipEl) tipEl.style.opacity = '0'; }

/* ---------- chart ---------- */

function extent(lines, win) {
  let min = Infinity, max = -Infinity;
  for (const l of lines) for (const v of l.windows[win] || []) { if (v < min) min = v; if (v > max) max = v; }
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

const G = { W: 1000, H: 330, L: 62, R: 18, T: 18, B: 34 };

/** Render the enlarged chart for one window as an SVG string. */
export function chartSvg(cfg, win) {
  const { W, H, L, R, T, B } = G;
  const lines = cfg.lines;
  const [min, max] = extent(lines, win);
  const n = (lines[0].windows[win] || []).length;
  const x = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ns = 'vector-effect="non-scaling-stroke"';
  const gid = 'dxm' + Math.random().toString(36).slice(2, 8);
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px;display:block;overflow:visible">`;
  s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lines[0].color}" stop-opacity=".13"/><stop offset="100%" stop-color="${lines[0].color}" stop-opacity="0"/></linearGradient></defs>`;
  for (let g = 0; g <= 3; g++) {
    const gv = min + (max - min) * (g / 3), gy = y(gv);
    s += `<line x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}" stroke="${SURFACE.line}" stroke-width="1" ${ns}/>`;
    s += `<text x="${L - 10}" y="${gy + 4}" text-anchor="end" fill="${SURFACE.muted}" style="font:500 12px ${MONO}">${esc(fmt(gv, cfg.unit))}</text>`;
  }
  lines.forEach((l, li) => {
    const d = l.windows[win] || [];
    const p = d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    if (li === 0) s += `<path d="${p} L${x(n - 1)} ${H - B} L${L} ${H - B} Z" fill="url(#${gid})"/>`;
    s += `<path d="${p}" fill="none" stroke="${l.color}" stroke-width="${li ? 1.4 : 2}" stroke-linejoin="round" stroke-linecap="round"${li ? ' stroke-dasharray="4 3"' : ''} ${ns}/>`;
    if (li === 0 && d.length) {
      const avg = d.reduce((a, b) => a + b, 0) / d.length;
      s += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="${SURFACE.avg}" stroke-width="1" stroke-dasharray="3 4" ${ns}/>`;
      s += `<text x="${W - R}" y="${y(avg) - 7}" text-anchor="end" fill="${SURFACE.muted}" style="font:500 11px ${MONO}">avg ${esc(fmt(avg, cfg.unit))}</text>`;
    }
  });
  s += `<line class="dx-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="${SURFACE.text}" stroke-width="1" opacity="0" ${ns}/>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="${SURFACE.struct}" stroke-width="1" ${ns}/>`;
  return s + '</svg>';
}

function ago(i, n, win, spans) {
  const span = (spans && spans[win]) || { '10M': 10, '1H': 60, '24H': 1440 }[win] || 60;
  const mins = Math.round((n - 1 - i) * (span / Math.max(1, n - 1)));
  if (mins === 0) return 'now';
  return mins >= 60 ? `−${(mins / 60).toFixed(1)} h` : `−${mins} min`;
}

/* ---------- modal ---------- */

function onKey(e) { if (e.key === 'Escape') close(); }

/** Close the open time-series panel, if any. */
export function close() {
  if (!modal) return;
  modal.remove();
  modal = null;
  current = null;
  document.removeEventListener('keydown', onKey);
}

/** Open the time-series panel for a registered key or an inline config. */
export function open(cfgOrKey) {
  const cfg = typeof cfgOrKey === 'string' ? registry[cfgOrKey] : cfgOrKey;
  if (!cfg || !cfg.lines || !cfg.lines.length) return;
  close();
  const wins = cfg.windows || Object.keys(cfg.lines[0].windows);
  current = { cfg, wins, win: cfg.defaultWindow || wins[wins.length - 1] };

  modal = document.createElement('div');
  modal.className = 'dx-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', cfg.label);
  modal.innerHTML =
    `<div class="dx-modal__panel">` +
    `<div class="dx-modal__head"><div><div class="dx-modal__eyebrow">Time series</div><div class="dx-modal__title">${esc(cfg.label)}</div>` +
    (cfg.tip ? `<div class="dx-modal__desc">${esc(cfg.tip)}</div>` : '') +
    `</div><button class="dx-btn" data-dx-close>CLOSE&nbsp;&nbsp;ESC</button></div>` +
    `<div class="dx-modal__body"><div class="dx-modal__bar"><div class="dx-seg" data-dx-tabs></div>` +
    `<div class="dx-modal__note">complete buckets only · dashed line is this window’s own average</div></div>` +
    `<div class="dx-modal__chart" data-dx-chart></div>` +
    `<div class="dx-modal__legend">${cfg.lines.map((l) => `<span><i style="background:${esc(l.color)}"></i>${esc(l.k)}</span>`).join('')}</div>` +
    (cfg.rows && cfg.rows.length
      ? `<div class="dx-modal__rows">${cfg.rows.map((r) => `<div><div class="k">${esc(r[0])}</div><div class="v">${esc(r[1])}</div></div>`).join('')}</div>`
      : '') +
    (cfg.query
      ? `<div style="margin-top:14px"><div class="dx-modal__eyebrow" style="margin-bottom:8px">Query</div><div class="dx-modal__query">${esc(cfg.query)}</div>` +
        `<button class="dx-btn dx-btn--go" style="margin-top:10px" data-dx-copy>COPY QUERY</button></div>`
      : '') +
    `</div></div>`;

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
  modal.querySelector('[data-dx-close]').addEventListener('click', close);
  const copy = modal.querySelector('[data-dx-copy]');
  if (copy) {
    copy.addEventListener('click', () => {
      if (navigator.clipboard) navigator.clipboard.writeText(cfg.query).catch(() => {});
      copy.textContent = 'COPIED';
      setTimeout(() => { copy.textContent = 'COPY QUERY'; }, 1400);
    });
  }
  document.body.appendChild(modal);
  document.addEventListener('keydown', onKey);
  paint();
  modal.querySelector('[data-dx-close]').focus();
}

function paint() {
  const { cfg, wins, win } = current;
  const tabs = modal.querySelector('[data-dx-tabs]');
  tabs.innerHTML = wins.map((w) => `<button type="button" aria-pressed="${w === win}" data-win="${esc(w)}">${esc(w)}</button>`).join('');
  tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { current.win = b.dataset.win; paint(); }));
  const box = modal.querySelector('[data-dx-chart]');
  box.innerHTML = chartSvg(cfg, win) + '<div class="dx-modal__readout"></div>';
  bindCrosshair(box);
}

function bindCrosshair(box) {
  const svg = box.querySelector('svg'), cross = box.querySelector('.dx-cross'), out = box.querySelector('.dx-modal__readout');
  const { W, L, R } = G;
  svg.addEventListener('mousemove', (e) => {
    const { cfg, win } = current;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const n = (cfg.lines[0].windows[win] || []).length;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
    const xv = L + (i / Math.max(1, n - 1)) * (W - L - R);
    cross.setAttribute('x1', xv); cross.setAttribute('x2', xv); cross.setAttribute('opacity', '0.35');
    out.innerHTML =
      cfg.lines.map((l) => `<span style="color:${esc(l.color)}">${esc(l.k)}</span> ${esc(fmt((l.windows[win] || [])[i], cfg.unit))}`).join('<span style="color:#4a5154"> · </span>') +
      `<span style="color:${SURFACE.muted}"> · ${ago(i, n, win, cfg.spans)}</span>`;
    out.style.opacity = '1';
    out.style.left = Math.min(rect.width - out.offsetWidth - 4, Math.max(0, (xv / W) * rect.width - out.offsetWidth / 2)) + 'px';
  });
  svg.addEventListener('mouseleave', () => { cross.setAttribute('opacity', '0'); out.style.opacity = '0'; });
}

/* ---------- wiring ---------- */

/** Give every registered [data-series] element a pointer, a hint and keyboard access. */
export function markClickable(root = document) {
  root.querySelectorAll('[data-series]').forEach((n) => {
    if (n.dataset.dxReady) return;
    n.dataset.dxReady = '1';
    if (!n.hasAttribute('tabindex')) n.setAttribute('tabindex', '0');
    n.setAttribute('role', 'button');
    if (!n.getAttribute('data-tip')) n.setAttribute('data-tip', 'Click to open the full time series');
  });
}

/** Install the page-wide listeners. Idempotent; called automatically in browsers. */
export function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('mouseover', (e) => {
    const n = e.target.closest && e.target.closest('[data-tip]');
    if (n) showTip(n, n.getAttribute('data-tip'));
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest && e.target.closest('[data-tip]')) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const n = e.target.closest && e.target.closest('[data-tip]');
    if (n) showTip(n, n.getAttribute('data-tip'));
  });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, true);
  document.addEventListener('click', (e) => {
    const n = e.target.closest && e.target.closest('[data-series]');
    if (!n || !registry[n.getAttribute('data-series')]) return;
    e.preventDefault();
    hideTip();
    open(n.getAttribute('data-series'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const n = e.target.closest && e.target.closest('[data-series]');
    if (!n || !registry[n.getAttribute('data-series')]) return;
    e.preventDefault();
    open(n.getAttribute('data-series'));
  });
}

/**
 * Highlight the nav link whose section is in view.
 * Links carry data-nav="sectionId"; the active one gets aria-current="true".
 */
export function scrollSpy(root = document, offset = 120) {
  const links = [...root.querySelectorAll('[data-nav]')];
  if (!links.length) return () => {};
  const paintNav = () => {
    let active = links[0];
    for (const l of links) {
      const t = document.getElementById(l.dataset.nav);
      if (t && t.getBoundingClientRect().top <= offset) active = l;
    }
    links.forEach((l) => (l === active ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
  };
  window.addEventListener('scroll', paintNav, { passive: true });
  paintNav();
  return () => window.removeEventListener('scroll', paintNav);
}

if (typeof document !== 'undefined') install();
