// Dimension UI — the card atom. One card answers one question.
// Four sanctioned variants:
//   single  one value
//   dual    two sides of one value, any signs (maker / taker, realized / unrealized)
//   split   a pair that sums to 100%
//   state   a value with no window axis; facts replace the window strip

import { toneKey, verdict } from './tokens.js';
import { esc, attrs, slot } from './html.js';
import { deviation } from './marks.js';
import { chip as chipHtml } from './badges.js';

export const VARIANTS = Object.freeze(['single', 'dual', 'split', 'state']);

export const WINDOW_TIPS = Object.freeze({
  '10M': 'Trailing 10 minutes, complete one-minute buckets only. Diff is against this window’s own trailing average.',
  '1H': 'Trailing 60 minutes of complete buckets. Diff is against this window’s own trailing average.',
  '24H': 'Trailing 24 hours — the baseline every other window is compared against.'
});

const tc = (t) => `dx-tone-${toneKey(t)}`;

/**
 * @typedef {{sub?: string, v: string|number, unit?: string, tone?: string, muted?: boolean, series?: string, better?: 'up'|'down', aside?: any}} Value
 * @typedef {{v: string|number, d?: string, w?: number, dir?: number, better?: 'up'|'down', tone?: string}} WindowRow
 * @typedef {{win: string, tip?: string, rows: WindowRow[]}} Window
 * @typedef {{k: string, v: string|number, note?: string, tone?: string, bar?: number}} Fact
 * @typedef {{
 *   label: string, tip?: string, caption?: string,
 *   chip?: string|{label: string, tone?: string, dot?: boolean, tip?: string},
 *   tag?: string, tone?: string, tinted?: boolean,
 *   variant?: 'single'|'dual'|'split'|'state',
 *   value?: Value, values?: Value[],
 *   marks?: any, foot?: any[], better?: 'up'|'down',
 *   windows?: Window[], facts?: Fact[], strip?: boolean,
 *   span?: number, id?: string, attrs?: Record<string, string>
 * }} CardOptions
 */

/** Render a metric card to an HTML string. */
export function card(o) {
  if (!o || !o.label) throw new Error('dimension-ui: a card needs a label — the question it answers');
  const values = o.values || (o.value ? [o.value] : []);
  const variant = o.variant || (o.facts ? 'state' : values.length > 1 ? 'dual' : 'single');
  if (!VARIANTS.includes(variant)) throw new Error(`dimension-ui: unknown variant "${variant}"`);
  if (values.length > 2) throw new Error('dimension-ui: a card carries one value or one pair — never more');
  const accent = o.tone || 'neutral';

  const tag = o.tag ? `<span class="dx-tag ${tc(accent)}">${esc(o.tag)}</span>` : '';
  const label = `<span class="dx-label"${attrs({ 'data-tip': o.tip })}>${esc(o.label)}</span>`;
  const chip = o.chip == null ? '' : typeof o.chip === 'string' ? chipHtml(o.chip) : chipHtml(o.chip.label, o.chip);
  const head = `<div class="dx-card__head${o.tinted ? ` dx-card__head--tinted ${tc(accent)}` : ''}"><span class="dx-card__ident">${tag}${label}</span>${slot(o.chipHtml) || chip}</div>`;

  const primary = values.length === 2 ? pair(values) : values.length === 1 ? single(values[0]) : '';
  const marks = slot(o.marks);
  const foot = o.foot ? `<div class="dx-foot">${o.foot.map((f) => `<span>${slot(f)}</span>`).join('')}</div>` : '';

  let strip = '';
  if (o.strip !== false) {
    if (o.facts) strip = facts(o.facts);
    else if (o.windows) strip = windowStrip(o.windows, values, o.better);
  }

  const caption = o.caption ? `<div class="dx-card__caption">${esc(o.caption)}</div>` : '';
  const cls = `dx-card dx-card--${variant}${o.span === 2 ? ' dx-span-2' : ''}`;
  return (
    `<div class="${cls}"${attrs({ id: o.id, ...(o.attrs || {}) })}>` +
    `<div class="dx-card__rule ${tc(accent)}"></div>${caption}` +
    (o.tinted ? head : '') +
    `<div class="dx-card__body${o.tinted ? ' dx-card__body--after-head' : ''}">` +
    (o.tinted ? '' : head) +
    primary + marks + foot +
    `</div>${strip}</div>`
  );
}

function valueHtml(v, dual) {
  const t = v.muted ? '' : ` ${tc(v.tone || 'neutral')}`;
  const style = v.muted ? ' style="color:var(--dx-muted)"' : '';
  const unit = v.unit ? `<span class="dx-unit">${esc(v.unit)}</span>` : '';
  return `<div class="dx-value${dual ? ' dx-value--dual' : ''}${t}"${style}${attrs({ 'data-series': v.series })}>${esc(v.v)}${unit}</div>`;
}

function single(v) {
  // aside: an optional slot drawn at the value's right edge (a delta, an annotation)
  const value = v.aside
    ? `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px">${valueHtml(v, false)}${slot(v.aside)}</div>`
    : valueHtml(v, false);
  return v.sub ? `<div><div class="dx-sub">${esc(v.sub)}</div>${value}</div>` : value;
}

function pair([a, b]) {
  return (
    `<div class="dx-pair"><div><div class="dx-sub">${esc(a.sub || '')}</div>${valueHtml(a, true)}</div>` +
    `<div class="dx-pair__div"></div>` +
    `<div><div class="dx-sub">${esc(b.sub || '')}</div>${valueHtml(b, true)}</div></div>`
  );
}

function delta(r, better) {
  const dir = Math.sign(r.dir || 0);
  const t = r.tone || verdict(dir, r.better || better);
  return { dir, t, bar: deviation({ w: r.w, dir, tone: t, size: 'thin' }) };
}

function winLabel(w) {
  const tip = w.tip ?? WINDOW_TIPS[w.win];
  return `<span class="dx-strip__win"${attrs({ 'data-tip': tip })}>${esc(w.win)}</span>`;
}

/**
 * The window strip. A single value gets one window per column; a pair inherits the
 * card's two-column split, with the windows listed vertically inside each side.
 */
export function windowStrip(windows, values = [], better = 'up') {
  const sides = Math.max(1, ...windows.map((w) => (w.rows || []).length));
  if (sides > 1) {
    const col = (i) => {
      const b = values[i]?.better || better;
      return windows.map((w) => {
        const r = (w.rows || [])[i];
        if (!r) return '';
        const d = delta(r, b);
        const dTone = d.dir ? ` ${tc(d.t)}` : '';
        return (
          `<div class="dx-strip__row"><div class="dx-strip__rowhead">${winLabel(w)}<span class="dx-strip__v">${esc(r.v)}</span></div>` +
          `<div class="dx-strip__rowbar">${d.bar}<span class="dx-strip__d${dTone}"${d.dir ? '' : ' style="color:var(--dx-muted)"'}>${esc(r.d ?? 'base')}</span></div></div>`
        );
      }).join('');
    };
    return `<div class="dx-strip dx-strip--pair"><div class="dx-strip__col">${col(0)}</div><div class="dx-strip__sep"></div><div class="dx-strip__col">${col(1)}</div></div>`;
  }
  const b = values[0]?.better || better;
  const cells = windows.map((w) => {
    const r = (w.rows || [])[0] || {};
    const d = delta(r, b);
    const thick = deviation({ w: r.w, dir: d.dir, tone: d.t });
    return (
      `<div class="dx-strip__cell">${winLabel(w)}<span class="dx-strip__v">${esc(r.v)}</span>${thick}` +
      `<span class="dx-strip__d${d.dir ? ` ${tc(d.t)}` : ''}">${esc(r.d ?? 'baseline')}</span></div>`
    );
  }).join('');
  return `<div class="dx-strip" style="--dx-cols:${windows.length}">${cells}</div>`;
}

/** The state strip: facts with no window axis. */
export function facts(list) {
  const cells = list.map((f) => {
    const t = f.tone ? ` ${tc(f.tone)}` : '';
    const bar = f.bar == null ? '' : `<div class="dx-track dx-dev dx-dev--thin"><span class="dx-dev__bar${t || ' dx-tone-favorable'}" style="left:0;width:${Math.max(0, Math.min(100, f.bar * 100))}%"></span></div>`;
    const note = f.note ? `<span class="dx-strip__note"${f.tone && f.bar != null ? ` style="color:var(--dx-t)"` : ''}>${esc(f.note)}</span>` : '';
    return `<div class="dx-strip__cell${t}"><span class="dx-strip__win"${attrs({ 'data-tip': f.tip })}>${esc(f.k)}</span><span class="dx-strip__v">${esc(f.v)}</span>${bar}${note}</div>`;
  }).join('');
  return `<div class="dx-strip" style="--dx-cols:${list.length}">${cells}</div>`;
}

/**
 * Check a card against the system's rules. Returns a list of problems (empty = ships).
 * Designed for review bots and for agents that generate dashboards.
 * @param {CardOptions} o
 */
export function lint(o) {
  const out = [];
  const values = o.values || (o.value ? [o.value] : []);
  const words = String(o.label || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) out.push('label: missing — a card states the question it answers');
  else if (words.length > 3) out.push(`label: "${o.label}" is ${words.length} words; keep it to two or three and move qualifiers to the footnote`);
  if (!o.tip) out.push('tip: missing — every label carries its definition on hover');
  if (values.length > 2) out.push('values: more than two — split the card');
  if (values.length === 2 && o.variant !== 'split' && o.variant !== 'dual' && !o.facts) {
    out.push('variant: a pair should be declared "dual" (any signs) or "split" (sums to 100%)');
  }
  if (o.variant === 'split') {
    const sum = values.reduce((a, v) => a + parseFloat(String(v.v).replace(/[^\d.+-]/g, '')), 0);
    if (Math.abs(sum - 100) > 0.5) out.push(`variant: split values sum to ${+sum.toFixed(2)}, not 100 — use "dual"`);
  }
  if (o.variant === 'state' && o.windows) out.push('variant: a state card has no window axis — use facts');
  if (o.windows && o.facts) out.push('strip: windows and facts are exclusive');
  if (o.tinted && !o.tag) out.push('tinted: a card earns a tint only when its identity is a side or a state — give it a tag');
  for (const [i, v] of values.entries()) {
    if (v.tone) {
      try { toneKey(v.tone); } catch (e) { out.push(`values[${i}].tone: ${e.message}`); }
    }
  }
  if (!o.windows && !o.facts && o.strip !== false) out.push('strip: no windows — every value is judged against a baseline');
  return out;
}
