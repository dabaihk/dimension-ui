// <dx-card> — declarative wrapper around card(). Configure it with a JSON child:
//   <dx-card><script type="application/json">{"label": "Fill rate", ...}</script></dx-card>
// or a config attribute. Marks are given as {"mark": "trend", "args": [[1, 2, 3], {"tone": "favorable"}]}.

import { card } from './card.js';
import { raw } from './html.js';
import * as marks from './marks.js';

function resolveMarks(spec) {
  if (spec == null) return spec;
  const list = Array.isArray(spec) ? spec : [spec];
  return list.map((m) => {
    if (typeof m === 'string') return raw(m);
    const fn = marks[m.mark];
    if (typeof fn !== 'function') throw new Error(`dimension-ui: unknown mark "${m.mark}"`);
    return raw(fn(...(m.args || [])));
  });
}

export function defineElements(registry = typeof customElements !== 'undefined' ? customElements : null) {
  if (!registry || registry.get('dx-card')) return;
  registry.define('dx-card', class extends HTMLElement {
    static get observedAttributes() { return ['config']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    render() {
      const src = this.getAttribute('config') || this.querySelector('script[type="application/json"]')?.textContent;
      if (!src) return;
      const cfg = JSON.parse(src);
      cfg.marks = resolveMarks(cfg.marks);
      this.style.display = 'contents';
      this.innerHTML = card(cfg);
    }
  });
}

defineElements();
