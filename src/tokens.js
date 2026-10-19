// Dimension UI — the colour law in code. Mirrors tokens.css for marks drawn as SVG.

export const TONES = Object.freeze({
  favorable: Object.freeze({ tint: '#17210c', edge: '#35471a', dim: '#5e7a2a', base: '#bff24d' }),
  adverse: Object.freeze({ tint: '#24100e', edge: '#4a2724', dim: '#8c3c34', base: '#ff6b5e' }),
  watch: Object.freeze({ tint: '#221806', edge: '#4a3a18', dim: '#8a6520', base: '#f2a93b' }),
  flow: Object.freeze({ tint: '#08222a', edge: '#1d3a40', dim: '#2a7d8c', base: '#3fd3e8' }),
  neutral: Object.freeze({ tint: '#12161a', edge: '#23282b', dim: '#2c3336', base: '#e9ece7' })
});

// Short names used by the original design, accepted everywhere a tone is.
export const ALIASES = Object.freeze({
  lime: 'favorable', good: 'favorable', buy: 'favorable', long: 'favorable',
  red: 'adverse', bad: 'adverse', sell: 'adverse', short: 'adverse',
  amber: 'watch', warn: 'watch',
  cyan: 'flow', size: 'flow',
  white: 'neutral', reference: 'neutral', ref: 'neutral'
});

// What each hue is allowed to mean. A colour never appears for a reason not listed here.
export const MEANING = Object.freeze({
  favorable: 'Result up, markout positive, rebate earned, target met. Also the buy / long side.',
  adverse: 'Result down, negative markout, fee paid, budget breached. Also the sell / short side.',
  watch: 'Inside tolerance but trending at a threshold, or the feed is degraded. Never for a number that is merely negative.',
  flow: 'Volume, notional, inventory, share. Magnitude carries no verdict.',
  structure: 'Counts, denominators, the remainder of a whole, empty track.',
  reference: 'Targets, budgets, medians, zero rules. Always a mark you are measured against.'
});

export const SURFACE = Object.freeze({
  page: '#07080a', panel: '#0c0e10', card: '#101315', raised: '#12161a', pop: '#181c1f',
  track: '#191d1f', line: '#1d2124', edge: '#23282b', zero: '#2f3639', dotted: '#3a4043',
  struct: '#2c3336', avg: '#454c4e',
  text: '#e9ece7', text2: '#c8cdc7', muted: '#8b918c', sub: '#7c837e', faint: '#626963'
});

export const FONT = "Geist, 'Helvetica Neue', Helvetica, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Resolve a tone name or alias. Throws on anything outside the law. */
export function tone(name = 'neutral') {
  const key = ALIASES[name] || name;
  const t = TONES[key];
  if (!t) {
    throw new Error(`dimension-ui: "${name}" is not a tone. Use one of ${Object.keys(TONES).join(', ')}.`);
  }
  return t;
}

/** Canonical tone key for a name or alias. */
export function toneKey(name = 'neutral') {
  tone(name);
  return ALIASES[name] || name;
}

const LAWFUL = new Set(
  [
    ...Object.values(TONES).flatMap((t) => Object.values(t)),
    ...Object.values(SURFACE)
  ].map((c) => c.toLowerCase())
);

/** True when a hex colour belongs to the system (any hue strength or surface). */
export function isLawful(hex) {
  return LAWFUL.has(String(hex).toLowerCase());
}

/**
 * Pick favorable / adverse for a signed change.
 * better = 'up' when a rise is good (P&L), 'down' when a rise is bad (cost, latency).
 */
export function verdict(dir, better = 'up') {
  if (!dir) return 'neutral';
  const good = better === 'down' ? dir < 0 : dir > 0;
  return good ? 'favorable' : 'adverse';
}
