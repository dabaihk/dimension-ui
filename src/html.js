// Tiny string helpers. Every component returns an HTML string, so it renders the same
// in a browser, in a server template, or in an agent's generated file.

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML content and attribute values. */
export function esc(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ENT[c]);
}

/** Mark a string as trusted HTML so components insert it as-is. */
export function raw(html) {
  return { __html: html == null ? '' : String(html) };
}

/** Render a slot: trusted HTML passes through, anything else is escaped. */
export function slot(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(slot).join('');
  if (typeof v === 'object' && '__html' in v) return v.__html;
  return esc(v);
}

/** Build an attribute string, skipping null / false values. */
export function attrs(map) {
  let s = '';
  for (const [k, v] of Object.entries(map)) {
    if (v == null || v === false) continue;
    s += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return s;
}

/** Clamp a number into [0, 100] and format it as a CSS percentage. */
export function pct(v) {
  const n = Math.max(0, Math.min(100, Number(v) || 0));
  return `${+n.toFixed(2)}%`;
}

/** Position of value v on a [min, max] axis, in percent. */
export function at(v, min, max) {
  return max === min ? 0 : ((v - min) / (max - min)) * 100;
}
