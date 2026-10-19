// Dimension UI — badges. One geometry (20px tall, 4px radius, 1px edge):
// hue says which way, shape says what kind.

import { toneKey } from './tokens.js';
import { esc, attrs } from './html.js';

const SIDES = { long: 'favorable', short: 'adverse', flat: 'neutral' };
const DIRS = { buy: ['B', 'favorable'], sell: ['S', 'adverse'] };

/** Side, what is held. Locked min-width so categories are not weighted by spelling. */
export function side(name, o = {}) {
  const key = String(name).toLowerCase();
  const t = SIDES[key];
  if (!t) throw new Error(`dimension-ui: side must be long, short or flat (got "${name}")`);
  return `<span class="dx-badge dx-badge--side dx-tone-${t}"${attrs({ 'data-tip': o.tip })}>${esc(o.label || key)}</span>`;
}

/** Direction, a single momentary action. Square glyph so it never reads as a position. */
export function direction(name, o = {}) {
  const d = DIRS[String(name).toLowerCase()];
  if (!d) throw new Error(`dimension-ui: direction must be buy or sell (got "${name}")`);
  return `<span class="dx-glyph dx-tone-${d[1]}"${attrs({ 'data-tip': o.tip, 'aria-label': name })}>${d[0]}</span>`;
}

/**
 * State, where something is in its life. Only a live state earns colour;
 * finished is deliberately neutral, failure is adverse and has no dot.
 * @param {string} label
 * @param {{tone?: string, dot?: boolean, tip?: string}} [o]
 */
export function state(label, o = {}) {
  const t = toneKey(o.tone || 'neutral');
  const dot = o.dot ?? t !== 'adverse';
  return `<span class="dx-badge dx-badge--state dx-tone-${t}"${attrs({ 'data-tip': o.tip })}>${dot ? '<span class="dx-badge__dot"></span>' : ''}${esc(label)}</span>`;
}

/** Plain toned badge, e.g. a LIVE marker. */
export function badge(label, o = {}) {
  const t = toneKey(o.tone || 'neutral');
  return `<span class="dx-badge dx-tone-${t}"${attrs({ 'data-tip': o.tip })}>${o.dot ? '<span class="dx-badge__dot"></span>' : ''}${esc(label)}</span>`;
}

/**
 * Instrument mark plus ticker: the one sanctioned exception to the six hues.
 * Brand colour lives inside the disc only and never reaches a value, a bar or a rule.
 * @param {string} ticker
 * @param {{kind?: string, color?: string, glyph?: string, svg?: string}} [o]
 */
export function instrument(ticker, o = {}) {
  const disc = o.svg
    ? o.svg
    : `<span class="dx-instrument__disc" style="background:${esc(o.color || '#4f5754')}">${esc(o.glyph ?? String(ticker).slice(0, 1))}</span>`;
  const kind = o.kind ? `<span class="dx-instrument__k">${esc(o.kind)}</span>` : '';
  return `<span class="dx-instrument">${disc}<span class="dx-instrument__t">${esc(ticker)}</span>${kind}</span>`;
}

/** Small bordered chip for card heads: a denominator, a tier, a state word. */
export function chip(label, o = {}) {
  if (!o.tone) return `<span class="dx-chip"${attrs({ 'data-tip': o.tip })}>${esc(label)}</span>`;
  const dot = o.dot ? '<span class="dx-chip__dot"></span>' : '';
  return `<span class="dx-chip dx-chip--toned dx-tone-${toneKey(o.tone)}"${attrs({ 'data-tip': o.tip })}>${dot}${esc(label)}</span>`;
}
