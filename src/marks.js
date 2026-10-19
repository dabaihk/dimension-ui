// Dimension UI — the visualization vocabulary.
// Five marks, each tied to a shape of question, plus the few composites built from them:
//   trend + average   rates and prices over time, judged against the window's own mean
//   deviation bar     signed, zero-centred diff of one window to its average
//   quantile bullet   P50 solid, P90 dim, target tick; only the breach turns red
//   distribution      a histogram whose losing tail is drawn red, not averaged away
//   split of a whole  two or more parts that sum to 100%

import { tone, toneKey, verdict, SURFACE } from './tokens.js';
import { esc, attrs, pct, at } from './html.js';

let uid = 0;
const nextId = (p) => `${p}${++uid}`;
const tc = (name) => `dx-tone-${toneKey(name)}`;

/* ---------- trend + average ---------- */

/**
 * Sparkline with the window's own mean as a dashed reference and a tick on the last value.
 * @param {number[]} values
 * @param {{tone?: string, height?: number}} [o]
 */
export function trend(values, o = {}) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return '';
  const color = tone(o.tone || 'favorable').base;
  const W = 100, H = 30, pad = 3, h = o.height || 42;
  const min = Math.min(...vals), max = Math.max(...vals), r = max - min || 1;
  const x = (i) => (i * W) / (vals.length - 1);
  const y = (v) => H - pad - ((v - min) / r) * (H - pad * 2);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const last = vals[vals.length - 1];
  const id = nextId('dxg');
  const ns = 'vector-effect="non-scaling-stroke"';
  return (
    `<svg class="dx-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${h}px" role="img" aria-label="trend, last ${esc(last)}, average ${esc(+avg.toFixed(4))}">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>` +
    `<path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#${id})"/>` +
    `<line x1="0" x2="${W}" y1="${y(avg).toFixed(2)}" y2="${y(avg).toFixed(2)}" stroke="${SURFACE.avg}" stroke-width="1" stroke-dasharray="2 3" ${ns}/>` +
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" ${ns}/>` +
    `<line x1="${W}" x2="${W}" y1="${(y(last) - 3.5).toFixed(2)}" y2="${(y(last) + 3.5).toFixed(2)}" stroke="${color}" stroke-width="2" ${ns}/>` +
    `</svg>`
  );
}

/* ---------- deviation bar ---------- */

/**
 * Signed, zero-centred bar. w is the magnitude in [0, 1] of the half track.
 * dir is the sign of the change; better decides whether that sign is good.
 * @param {{w?: number, dir?: number, better?: 'up'|'down', tone?: string, size?: 'thin'|'normal'|'thick'}} o
 */
export function deviation(o = {}) {
  const dir = Math.sign(o.dir || 0);
  const size = o.size === 'thin' ? ' dx-dev--thin' : o.size === 'thick' ? ' dx-dev--thick' : '';
  const t = o.tone || verdict(dir, o.better);
  const width = pct(Math.min(1, Math.abs(o.w || 0)) * 50);
  const bar = dir
    ? `<span class="dx-dev__bar ${tc(t)}" style="${dir > 0 ? 'left' : 'right'}:50%;width:${width}"></span>`
    : '';
  return `<div class="dx-track dx-dev${size}"><span class="dx-dev__zero"></span>${bar}</div>`;
}

/* ---------- meter: the degenerate bullet (bar + target tick) ---------- */

/** @param {{value: number, max?: number, min?: number, target?: number, tone?: string, tip?: string}} o */
export function meter(o) {
  const min = o.min || 0, max = o.max ?? 100;
  const fill = `<span class="dx-meter__fill ${tc(o.tone || 'favorable')}" style="width:${pct(at(o.value, min, max))}"></span>`;
  const tick = o.target == null ? '' : `<span class="dx-tick"${attrs({ 'data-tip': o.tip })} style="left:${pct(at(o.target, min, max))}"></span>`;
  return `<div class="dx-track dx-meter">${fill}${tick}</div>`;
}

/* ---------- quantile bullet ---------- */

/**
 * One track carries the whole shape: solid to P50, dim to P90, a white tick for the target,
 * and only the length past the target turns red.
 * better='down' (default) for costs and latencies; 'up' when exceeding the target is good.
 * @param {{p50: number, p90: number, target: number, max: number, min?: number, better?: 'up'|'down'}} o
 */
export function bullet(o) {
  const min = o.min || 0;
  const p = (v) => at(v, min, o.max);
  const a = p(o.p50), b = p(o.p90), t = p(o.target);
  const segs = [];
  const fav = tone('favorable'), adv = tone('adverse');
  if (o.better === 'up') {
    segs.push({ from: 0, to: Math.min(a, t), color: adv.base });
    if (a > t) segs.push({ from: t, to: a, color: fav.base });
    segs.push({ from: a, to: b, color: fav.dim });
  } else {
    segs.push({ from: 0, to: a, color: fav.base });
    segs.push({ from: a, to: Math.min(b, t), color: fav.dim });
    if (b > t) segs.push({ from: Math.max(a, t), to: b, color: adv.base });
  }
  return range({ segments: segs, ticks: [{ at: t }] });
}

/**
 * Low-level bullet track in percent units: coloured segments plus 2px ticks.
 * @param {{segments?: {from:number,to:number,color?:string,tone?:string,strength?:string}[], ticks?: {at:number,color?:string,tone?:string,tip?:string}[]}} o
 */
export function range(o) {
  const segs = (o.segments || []).filter((s) => s.to > s.from);
  const first = segs[0], last = segs[segs.length - 1];
  const segHtml = segs.map((s) => {
    const c = s.color || tone(s.tone).base;
    const rad = `${s === first && s.from === 0 ? '2px' : '0'} ${s === last ? '2px 2px' : '0 0'} ${s === first && s.from === 0 ? '2px' : '0'}`;
    return `<span class="dx-bullet__seg" style="left:${pct(s.from)};width:${pct(s.to - s.from)};background:${c};border-radius:${rad}"></span>`;
  }).join('');
  const tickHtml = (o.ticks || []).map((k) => {
    const c = k.color || (k.tone ? tone(k.tone).base : 'var(--dx-ref)');
    return `<span class="dx-tick"${attrs({ 'data-tip': k.tip })} style="left:${pct(k.at)};background:${c}"></span>`;
  }).join('');
  return `<div class="dx-bullet"><span class="dx-bullet__track"></span>${segHtml}${tickHtml}</div>`;
}

/* ---------- distribution + tail ---------- */

/**
 * Histogram. split is the first bin on the far side of the boundary:
 * mode 'gain' (markout) draws bins left of split red; mode 'cost' (slippage) draws bins from split on red.
 * @param {number[]} bins
 * @param {{split?: number, mode?: 'gain'|'cost', height?: number, gap?: number}} [o]
 */
export function histogram(bins, o = {}) {
  const n = bins.length;
  if (!n) return '';
  const g = o.gap ?? 1.6, split = o.split ?? 0, cost = o.mode === 'cost';
  const max = Math.max(...bins) || 1, bw = (100 - (n - 1) * g) / n;
  const fav = tone('favorable').base, adv = tone('adverse').base;
  const rects = bins.map((v, i) => {
    const adverse = cost ? i >= split : i < split;
    const h = Math.max((v / max) * 29, v ? 1.2 : 0);
    const fill = adverse ? adv : cost ? SURFACE.struct : fav;
    const op = adverse ? 0.9 : cost ? 1 : 0.35 + 0.65 * (v / max);
    return `<rect x="${(i * (bw + g)).toFixed(3)}" width="${bw.toFixed(3)}" y="${(30 - h).toFixed(3)}" height="${h.toFixed(3)}" rx=".6" fill="${fill}" opacity="${+op.toFixed(3)}"/>`;
  }).join('');
  return `<svg class="dx-svg" viewBox="0 0 100 30" preserveAspectRatio="none" style="height:${o.height || 42}px" role="img" aria-label="distribution of ${n} bins">${rects}</svg>`;
}

/* ---------- split of a whole ---------- */

/**
 * Parts must sum to 100 (they are normalised if not). Never for independent quantities.
 * @param {{parts: {value: number, tone?: string, structure?: boolean}[], target?: number, tall?: boolean, tip?: string}} o
 */
export function split(o) {
  const total = o.parts.reduce((a, p) => a + p.value, 0) || 1;
  const segs = o.parts.map((p) => {
    const c = p.structure || !p.tone ? 'var(--dx-struct)' : tone(p.tone).base;
    return `<div style="width:${pct((p.value / total) * 100)};background:${c}"></div>`;
  }).join('');
  const tick = o.target == null ? '' : `<span class="dx-tick"${attrs({ 'data-tip': o.tip })} style="left:${pct(o.target)}"></span>`;
  return `<div class="dx-split${o.tall ? ' dx-split--tall' : ''}">${segs}${tick}</div>`;
}

/* ---------- composites ---------- */

/**
 * Paired values on one shared signed axis (maker / taker / net). Both sides can carry
 * the same sign, so they are never mirrored from a centre.
 * @param {{rows: {k: string, value: number, tone?: string, strength?: 'base'|'dim', tick?: boolean}[], min: number, max: number, scale?: {at: number, label: string, ref?: boolean}[]}} o
 */
export function pairedAxis(o) {
  const z = at(0, o.min, o.max);
  const rows = o.rows.map((r) => {
    const p = at(r.value, o.min, o.max);
    const left = Math.min(z, p), w = Math.abs(p - z);
    const t = tone(r.tone || (r.value >= 0 ? 'favorable' : 'adverse'));
    const c = r.strength === 'dim' ? t.dim : t.base;
    const tick = r.tick ? `<span class="dx-tick" style="left:${pct(p)}"></span>` : '';
    return (
      `<span class="dx-axis__k">${esc(r.k)}</span>` +
      `<div class="dx-track dx-axis__track"><span class="dx-axis__zero" style="left:${pct(z)}"></span>` +
      `<span class="dx-axis__bar" style="left:${pct(left)};width:${pct(w)};background:${c}"></span>${tick}</div>`
    );
  }).join('');
  const scale = o.scale ? `<span></span>${scaleRow(o.scale, o.min, o.max)}` : '';
  return `<div class="dx-axis">${rows}${scale}</div>`;
}

/** A row of axis labels positioned by value. The first and last pin to the edges. */
export function scaleRow(items, min, max) {
  const spans = items.map((s, i) => {
    const pos = at(s.at, min, max);
    const edge = i === 0 && pos <= 0 ? 'left:0' : i === items.length - 1 && pos >= 100 ? 'right:0' : `left:${pct(pos)};transform:translateX(-50%)`;
    const color = s.tone ? `;color:${tone(s.tone).base}` : s.dim ? `;color:${tone('favorable').dim}` : s.ref ? ';color:var(--dx-text-2)' : '';
    return `<span style="${edge}${color}">${esc(s.label)}</span>`;
  }).join('');
  return `<div class="dx-scale">${spans}</div>`;
}

/**
 * Small column chart for state cards: structure bars, the most recent ones in a tone.
 * @param {number[]} values heights in [0, 1]
 * @param {{from?: number, tone?: string, height?: number}} [o] from = first highlighted index
 */
export function columns(values, o = {}) {
  const c = tone(o.tone || 'watch').base;
  const from = o.from ?? values.length;
  const bars = values.map((v, i) => `<span style="height:${pct(v * 100)};background:${i >= from ? c : 'var(--dx-struct)'}"></span>`).join('');
  return `<div class="dx-cols" style="height:${o.height || 28}px">${bars}</div>`;
}

/**
 * Two legs drawn outward from a shared centre, each with its own target tick.
 * @param {{left: {value: number, target?: number, tone?: string, tip?: string}, right: {value: number, target?: number, tone?: string, tip?: string}, max: number}} o
 */
export function diverging(o) {
  const half = (v) => (Math.abs(v) / o.max) * 50;
  const l = o.left, r = o.right;
  const lt = tone(l.tone || 'adverse').base, rt = tone(r.tone || 'favorable').base;
  const ticks = [
    l.target == null ? '' : `<span class="dx-tick"${attrs({ 'data-tip': l.tip })} style="left:${pct(50 - half(l.target))}"></span>`,
    r.target == null ? '' : `<span class="dx-tick"${attrs({ 'data-tip': r.tip })} style="left:${pct(50 + half(r.target))}"></span>`
  ].join('');
  return (
    `<div class="dx-bullet" style="height:11px"><span class="dx-bullet__track" style="top:2px;height:7px"></span>` +
    `<span class="dx-bullet__seg" style="right:50%;width:${pct(half(l.value))};top:2px;height:7px;background:${lt};border-radius:2px 0 0 2px"></span>` +
    `<span class="dx-bullet__seg" style="left:50%;width:${pct(half(r.value))};top:2px;height:7px;background:${rt};border-radius:0 2px 2px 0"></span>` +
    `${ticks}<span class="dx-tick" style="left:50%;width:1px;top:-4px;bottom:-4px;background:var(--dx-muted);transform:translateX(-50%)"></span></div>`
  );
}

/**
 * A residual against flat with a tolerance band; inside the band reads favorable, outside watch.
 * @param {{value: number, tol: number, max: number}} o axis is [-max, +max]
 */
export function band(o) {
  const p = (v) => at(v, -o.max, o.max);
  const inside = Math.abs(o.value) <= o.tol;
  const t = tone(inside ? 'favorable' : 'watch');
  const left = Math.min(50, p(o.value)), w = Math.abs(p(o.value) - 50);
  const fav = tone('favorable');
  return (
    `<div class="dx-bullet" style="height:11px"><span class="dx-bullet__track" style="top:2px;height:7px"></span>` +
    `<span class="dx-bullet__seg" style="left:${pct(p(-o.tol))};width:${pct(p(o.tol) - p(-o.tol))};top:2px;height:7px;box-sizing:border-box;background:${fav.tint};border-top:1px solid ${fav.edge};border-bottom:1px solid ${fav.edge}"></span>` +
    `<span class="dx-bullet__seg" style="left:${pct(left)};width:${pct(w)};top:2px;height:7px;background:${t.base}"></span>` +
    `<span class="dx-tick" style="left:50%;width:1px;top:-2px;bottom:-2px;background:var(--dx-muted)"></span>` +
    `<span class="dx-tick" style="left:${pct(p(o.value))};top:-4px;bottom:-4px"></span></div>`
  );
}

/** A thin rail with a dot at position 0..1, for ranked bins. */
export function rail(position, o = {}) {
  const p = pct(Math.max(0, Math.min(1, position)) * 100);
  const end = position >= 1 ? 'transform:translateX(-100%)' : '';
  return `<div class="dx-rail"><span class="dx-rail__fill" style="width:${p}"></span><span class="dx-rail__dot ${tc(o.tone || 'favorable')}" style="left:${p};${end}"></span></div>`;
}
