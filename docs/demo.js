// Documentation page: every card here is rendered by the library from plain data.
// All figures are illustrative demo data for a fictional two-account desk.

import {
  card, marks as M, badges as B, raw, esc, register, gen, scrollSpy, TONES, MEANING, SURFACE
} from '../src/index.js';

const $ = (id) => document.getElementById(id);
const density = { strip: true, foot: true, notes: true };

/* ---------- small data helpers ---------- */

// one value per window: [v, d, w (0..1 of half track), dir]
const win1 = (...cells) => ['10M', '1H', '24H'].map((win, i) => {
  const [v, d, w, dir] = cells[i];
  return { win, rows: [{ v, d, w, dir }] };
});
// a pair per window: [[vA, dA, wA, dirA], [vB, dB, wB, dirB]]
const win2 = (...cells) => ['10M', '1H', '24H'].map((win, i) => ({
  win, rows: cells[i].map(([v, d, w, dir]) => ({ v, d, w, dir }))
}));
const base = (v) => [v, 'base', 0, 0];

const foot = (l, r) => (density.foot ? [l, r] : null);
const strip = () => density.strip;
const num = (n) => (density.notes ? `<span class="num">${n}</span>` : '');

const series = (seed, start, vol) => ({ '10M': gen(seed, 20, start, 0, vol), '1H': gen(seed + 7, 30, start, 0, vol), '24H': gen(seed + 13, 40, start, 0, vol) });
const drift = (seed, a, b, c) => ({ '10M': gen(seed, 20, ...a), '1H': gen(seed + 7, 30, ...b), '24H': gen(seed + 13, 40, ...c) });
const F = TONES.favorable.base, A = TONES.adverse.base, W = TONES.watch.base, C = TONES.flow.base;

register({
  equity: {
    label: 'Equity · total and usable', unit: '$',
    tip: 'Account equity across both legs. Usable excludes margin already posted against open positions.',
    lines: [
      { k: 'Total', color: F, windows: drift(3, [10160, 1, 14], [10090, 3, 22], [10020, 4, 40]) },
      { k: 'Usable', color: SURFACE.muted, windows: drift(9, [5100, 1, 10], [5050, 2, 16], [4990, 3, 30]) }
    ],
    rows: [['Total equity', '$10,214.60'], ['Usable', '$5,138.20'], ['Deployed', '49.7%'], ['24H return', '+1.82%']],
    query: "SELECT bucket, sum(equity) AS total, sum(equity - margin_posted) AS usable\n  FROM account_snapshots\n WHERE bucket >= now() - interval '24 hours'\n GROUP BY bucket ORDER BY bucket"
  },
  pnl: {
    label: 'P&L · realized and unrealized', unit: '$',
    tip: 'Realized cash on closed legs plus mark-to-market on what is still open.',
    lines: [
      { k: 'Realized', color: F, windows: drift(21, [8, 0.3, 1.6], [40, 1.4, 5], [10, 4, 14]) },
      { k: 'Unrealized', color: SURFACE.muted, windows: drift(31, [2, 0.03, 0.9], [6, 0.1, 2], [4, 0.5, 6]) }
    ],
    rows: [['Realized 24H', '$184.10'], ['Unrealized', '$18.40'], ['Fees paid', '$6.92'], ['Net', '$195.58']],
    query: "SELECT bucket, sum(realized_cash) AS realized, sum(mark_to_market) AS unrealized\n  FROM ledger WHERE bucket >= now() - interval '24 hours'\n GROUP BY bucket ORDER BY bucket"
  },
  fees: {
    label: 'Fee economics · maker credit and taker fee', unit: 'bps',
    tip: 'Fee-tier economics per fill. The pair is not an opposition — on a rebate venue both sides can print positive.',
    lines: [
      { k: 'Maker', color: F, windows: series(5, 0.5, 0.09) },
      { k: 'Taker', color: A, windows: series(11, -0.22, 0.05) }
    ],
    rows: [['Maker credit', '+0.5000 bps'], ['Taker fee', '−0.2200 bps'], ['Net, volume weighted', '+0.2814 bps'], ['Rebate receivable', '$0.7120']],
    query: "SELECT bucket, liquidity, avg(fee_bps) AS bps\n  FROM fills GROUP BY bucket, liquidity ORDER BY bucket"
  },
  markout: {
    label: '10s markout · mean and P05 tail', unit: 'bps',
    tip: 'Mid-price move 10 s after each fill, signed in our favour. Mean is the headline; P05 is the left tail the mean hides.',
    lines: [
      { k: 'Mean', color: F, windows: series(17, 2.3, 0.8) },
      { k: 'P05', color: A, windows: series(23, -0.3, 0.5) }
    ],
    rows: [['Mean', '+2.34 bps'], ['Median', '+1.91 bps'], ['P05 tail', '−0.30 bps'], ['Positive', '84.8% of 46']],
    query: "SELECT bucket, avg(markout_10s_bps) AS mean,\n       percentile_cont(0.05) WITHIN GROUP (ORDER BY markout_10s_bps) AS p05\n  FROM fills GROUP BY bucket ORDER BY bucket"
  },
  fillrate: {
    label: 'Fill rate', unit: '%',
    tip: 'Venue fills ÷ decisions dispatched. A decision with no linked fill event counts as a miss.',
    lines: [{ k: 'Fill rate', color: F, windows: series(41, 89, 4) }],
    rows: [['Fill rate 24H', '88.5%'], ['Target', '85.0%'], ['Mean ACK', '1,220 ms'], ['P95 ACK', '1,737 ms']],
    query: "SELECT bucket, count(*) FILTER (WHERE filled)::float / count(*) AS fill_rate\n  FROM decisions GROUP BY bucket ORDER BY bucket"
  },
  slippage: {
    label: 'Execution slippage', unit: 'bps',
    tip: 'Realized fill price against the decision reference price. A cost — the budget is 3.00 bps and only the breach is drawn red.',
    lines: [{ k: 'Slippage', color: W, windows: series(53, 1.16, 0.5) }],
    rows: [['P50', '1.16 bps'], ['P90', '3.24 bps'], ['P95', '4.02 bps'], ['Budget', '3.00 bps']],
    query: "SELECT bucket, percentile_cont(0.5) WITHIN GROUP (ORDER BY slippage_bps) AS p50,\n       percentile_cont(0.9) WITHIN GROUP (ORDER BY slippage_bps) AS p90\n  FROM fills GROUP BY bucket ORDER BY bucket"
  },
  fillmix: {
    label: 'Fill mix · maker share of filled notional', unit: '%',
    tip: 'Share of filled notional that rested as maker versus crossed as taker. Denominator is notional, not decision count.',
    lines: [{ k: 'Maker share', color: C, windows: series(61, 11, 2.5) }],
    rows: [['Maker share', '11.5%'], ['Target', '25.0%'], ['Filled', '602'], ['Pulled', '4,621']],
    query: "SELECT bucket, sum(notional) FILTER (WHERE liquidity = 'maker') / sum(notional) AS maker_share\n  FROM fills GROUP BY bucket ORDER BY bucket"
  },
  lifecycle: {
    label: 'Quote lifecycle · fill age and rest age', unit: 's',
    tip: 'How long a maker quote must live before it fills against how long it actually rests before it is pulled.',
    lines: [
      { k: 'Fill age', color: W, windows: series(71, 20, 5) },
      { k: 'Rest age', color: SURFACE.muted, windows: series(79, 6.4, 1.6) }
    ],
    rows: [['P50 fill age', '20.3 s'], ['P50 rest age', '6.4 s'], ['P95 fill age', '67.4 s'], ['Ratio', '0.32×']],
    query: "SELECT bucket, percentile_cont(0.5) WITHIN GROUP (ORDER BY age_to_fill_s) AS fill_age,\n       percentile_cont(0.5) WITHIN GROUP (ORDER BY rest_age_s) AS rest_age\n  FROM quotes GROUP BY bucket ORDER BY bucket"
  },
  hedge: {
    label: 'Hedge pair · net delta', unit: '$',
    tip: 'Signed residual exposure after netting both legs. Above 0.25% imbalance the desk rebalances before taking new risk.',
    lines: [{ k: 'Net delta', color: W, windows: series(83, 13, 5) }],
    rows: [['Net delta', '$13.20'], ['Imbalance', '0.16%'], ['Recovery P50', '124.9 s'], ['Recovery P95', '350.3 s']],
    query: "SELECT bucket, sum(signed_notional) AS net_delta\n  FROM positions WHERE pair_id = :pair GROUP BY bucket ORDER BY bucket"
  },
  leg: {
    label: 'Long leg · equity', unit: '$',
    tip: 'Equity of the account that works the long leg.',
    lines: [{ k: 'Equity', color: F, windows: series(3, 5095, 22) }],
    rows: [['Equity', '$5,095.31'], ['Usable', '$3,412.16'], ['Realized', '$402.26']],
    query: "SELECT bucket, equity FROM account_snapshots WHERE account_id = :long ORDER BY bucket"
  }
});

/* ---------- system sections ---------- */

function colourLaw() {
  const rows = [
    ['favorable', F, 'Favorable'], ['adverse', A, 'Adverse'], ['watch', W, 'Watch'],
    ['flow', C, 'Size & flow'], ['structure', SURFACE.struct, 'Structure'], ['reference', TONES.neutral.base, 'Reference']
  ];
  $('colour-grid').innerHTML = rows.map(([k, hex, name]) =>
    `<div class="box"><div class="box__sw"><i style="background:${hex}"></i><span class="hex">${hex.toUpperCase()}</span></div>` +
    `<div class="box__t">${name}</div><div class="box__d">${esc(MEANING[k])}</div></div>`).join('');
  $('nav-legend').innerHTML = rows.map(([, hex, name]) => `<span style="background:${hex}" data-tip="${esc(name)}"></span>`).join('');
  $('nav-live').innerHTML = B.badge('Live', { tone: 'favorable', dot: true });
}

function shadeScale() {
  const roles = [
    ['01 Tint', 'surface wash — header and panel backgrounds only'],
    ['02 Edge', '1px borders on chips, badges, tinted panels'],
    ['03 Dim', 'the secondary span of a mark — P50→P90, remainders'],
    ['04 Base', 'the value itself — numerals, primary bar, 3px rule']
  ];
  const hues = [['favorable', 'Favorable'], ['adverse', 'Adverse'], ['watch', 'Watch'], ['flow', 'Size & flow']];
  let g = `<div class="h"><b style="color:var(--dx-faint)">Hue</b></div>` + roles.map(([t, d]) => `<div class="h"><b>${t}</b><span>${d}</span></div>`).join('');
  for (const [k, name] of hues) {
    const t = TONES[k];
    g += `<div style="font-size:12.5px;font-weight:600;color:${t.base}">${name}</div>`;
    g += ['tint', 'edge', 'dim', 'base'].map((s) =>
      `<div><span class="chipsw" style="background:${t[s]};${s === 'tint' ? 'border:1px solid var(--dx-edge)' : ''}"></span><span class="hex">${t[s].toUpperCase()}</span></div>`).join('');
  }
  const surf = [['page', 'page'], ['panel', 'panel'], ['card', 'card'], ['track', 'track'], ['line', 'hairline'], ['struct', 'structure']];
  $('shade-table').innerHTML =
    `<div class="shades__grid">${g}</div><div class="shades__surf"><div style="font-size:12.5px;font-weight:600;color:var(--dx-muted)">Surfaces</div><div>` +
    surf.map(([k, n]) => `<span class="s hex"><span class="chipsw" style="background:${SURFACE[k]};border:1px solid var(--dx-edge)"></span>${SURFACE[k].toUpperCase()} ${n}</span>`).join('') +
    `</div></div>`;

  const tinted = (tag, title, tone, body) =>
    `<div class="dx-card" style="border-color:${TONES[tone].edge}"><div class="dx-card__head dx-card__head--tinted dx-tone-${tone}"><span class="dx-card__ident"><span class="dx-tag dx-tone-${tone}">${tag}</span><span class="dx-label" style="color:var(--dx-t)">${title}</span></span></div><div class="pad txt">${body}</div></div>`;
  $('tint-examples').innerHTML =
    tinted('A1', 'Long leg', 'favorable', 'Tint as header background, base as title colour. A card only earns a tint when its identity <em class="hl">is</em> a side or a state — long, short, breached.') +
    tinted('A2', 'Short leg', 'adverse', 'The same shade at the same role. Red here is the short side, not a loss — sign and side share a hue because they never appear in the same slot.') +
    `<div class="dx-card"><div class="dx-card__head dx-card__head--tinted dx-tone-neutral" style="border-bottom:none"><span class="dx-label">Metric card</span></div><div class="pad txt">Everything else stays neutral. Tint never sits behind a numeral, and no card carries more than one tinted surface.</div></div>`;
}

function ladders() {
  const ladder = (title, rows) =>
    `<div class="dx-card"><div class="dx-card__rule dx-tone-neutral" style="background:var(--dx-struct)"></div><div class="ladder"><div class="ladder__t">${title}</div>` +
    rows.map(([k, v, d]) => `<div class="ladder__r"><div><span>${k}</span><b>${v}</b></div><p>${d}</p></div>`).join('') + `</div></div>`;
  $('ladders').innerHTML =
    ladder('Type', [['Primary', '41 / 30', 'single value · dual value, mono, −.03em'], ['Money row', '17', 'the one number a row exists for'], ['Data', '13 / 12.5', 'strip values, table cells'], ['Label', '11 / 10.5', 'card labels, badges, axis captions'], ['Two families', 'Geist', 'sans for words, mono for every number']]) +
    ladder('Space', [['Section gap', '38', 'between one idea and the next'], ['Card gutter', '10', 'every grid, no exceptions'], ['Card padding', '13 / 14', 'top-bottom / left-right'], ['Row rhythm', '34', 'one blotter row, badge 20 inside'], ['Min column', '292', 'below it the grid reflows, never squeezes']]) +
    ladder('Shape &amp; state', [['Radius', '10 / 8 / 4', 'card · panel · badge, 3 for a glyph'], ['Rules', '3 / 1', 'status edge on top · hairline #1D2124'], ['Bars', '2 / 6 / 7', 'deviation · bullet · paired axis'], ['Hover', 'dotted', 'a dotted underline means a definition waits'], ['Click', 'pointer', 'a primary number opens its time series']]);
}

function badges() {
  const box = (rule, title, row, text) =>
    `<div class="dx-card"><div class="dx-card__rule dx-tone-${rule}"></div><div class="pad"><div class="pad__t">${title}</div><div class="row">${row}</div><div class="txt">${text}</div></div></div>`;
  $('badge-grid').innerHTML =
    box('favorable', 'Side — what we hold', B.side('long') + B.side('short') + B.side('flat'),
      'Word-set, tinted, and locked to one min-width so long and short are the same size — a side is a category, and categories must not look weighted by their spelling.') +
    box('favorable', 'Direction — what we just did', B.direction('buy') + B.direction('sell') + '<span class="small" style="color:var(--dx-muted)">buy · sell, one order</span>',
      'A 20px square, single glyph, 3px radius. Same hues as side, different shape — so a momentary action never reads as a standing position.') +
    box('watch', 'State — where it is in its life', B.state('P1 · 9 s', { tone: 'watch' }) + B.state('Done') + B.state('Failed', { tone: 'adverse' }),
      'Dotted, min-width 82px. Only a live state earns colour, and it carries the phase it is stuck in — finished is deliberately grey.') +
    `<div class="dx-card"><div class="dx-card__rule" style="background:var(--dx-struct)"></div><div class="pad"><div class="pad__t">Instrument — what it trades</div><div class="row" style="gap:14px">` +
    B.instrument('BTC', { kind: 'PERP', color: '#f7931a', glyph: '₿' }) + B.instrument('ETH', { kind: 'PERP', color: '#627eea', glyph: 'Ξ' }) +
    `</div><div class="txt">Brand mark plus ticker, the one sanctioned exception to the six hues: colour lives inside the disc only, and never reaches a value, a bar or a rule.</div></div></div>`;
}

/* ---------- anatomy + marks + variants ---------- */

const mk = [1.9, 2.4, 2.1, 2.8, 2.2, 1.7, 2.0, 2.6, 3.1, 2.4, 2.2, 2.61];

function anatomy() {
  const html = card({
    label: 'Mean 10s markout', tone: 'favorable',
    tip: 'Mid-price move 10 s after each fill, signed in our favour, averaged over attributed fills.',
    chipHtml: raw(num('01')),
    value: { v: '+2.34', unit: 'bps', tone: 'favorable', series: 'markout', aside: raw(num('02')) },
    marks: raw(`<div style="position:relative">${M.trend(mk, { height: 44 })}${density.notes ? '<span class="num" style="position:absolute;right:0;top:-2px">03</span>' : ''}</div>`),
    foot: foot('median +1.91 · 46 samples', raw(`<span style="display:flex;align-items:center;gap:8px">${B.chip('46/46 covered')}${num('05')}</span>`)),
    strip: strip(),
    windows: win1(['+2.61', '+0.27 vs avg', 0.68, 1], ['+2.18', '−0.16 vs avg', 0.4, -1], ['+2.34'])
  });
  $('anatomy-card').innerHTML = html;
  document.querySelectorAll('[data-notes]').forEach((n) => { n.hidden = !density.notes; });
}

function marksSection() {
  const mark = (title, body, text) => `<div class="mark"><div class="dx-label">${title}</div>${body}<div class="small">${text}</div></div>`;
  $('mark-grid').innerHTML =
    mark('Trend + average', M.trend(mk, { height: 52 }),
      'Rates and prices over the retained window. The dashed line is the window’s own mean — position against it <em class="hl" style="color:var(--dx-muted)">is</em> the reading.') +
    mark('Deviation bar', `<div style="display:flex;flex-direction:column;gap:9px;padding:8px 0 9px">${M.deviation({ w: 0.68, dir: 1, size: 'thick' })}${M.deviation({ w: 0.4, dir: -1, size: 'thick' })}${M.deviation({ size: 'thick' })}</div>`,
      'Signed, zero-centred, one per window. Length is the diff to that window’s average — direction reads before the number does.') +
    mark('Quantile bullet', `<div style="display:flex;flex-direction:column;gap:6px;padding:6px 0 2px">${M.bullet({ p50: 1.16, p90: 3.24, target: 3, max: 4 })}<div class="dx-legend dx-legend--mono"><span class="dx-c dx-tone-favorable">P50</span><span style="color:var(--dx-text)">target</span><span class="dx-c dx-tone-adverse">P90</span></div></div>`,
      'One track carries the whole shape: solid to P50, dim to P90, white tick for the target, and only the length that breaches it turns red. A bar + tick is the degenerate case for share metrics.') +
    mark('Distribution + tail', M.histogram([1, 2, 4, 3, 7, 9, 6, 4, 2, 1], { split: 3, height: 52 }),
      'Markout and slippage are distributions, not averages. Bars left of zero are the losing tail, drawn in red rather than averaged away.') +
    mark('Split of a whole', `<div style="display:flex;flex-direction:column;gap:8px;padding:10px 0 11px">${M.split({ parts: [{ value: 11.5, tone: 'flow' }, { value: 88.5 }], tall: true })}<div class="dx-legend dx-legend--mono"><span class="dx-c dx-tone-flow">maker 11.5%</span><span>taker 88.5%</span></div></div>`,
      'Only where the parts sum to 100%. Never used for two independent quantities — those get a dual value instead.');
}

const feeAxis = () => M.pairedAxis({
  min: -0.4, max: 0.6,
  rows: [
    { k: 'MKR', value: 0.5, tone: 'favorable' },
    { k: 'TKR', value: -0.22, tone: 'adverse' },
    { k: 'NET', value: 0.28, tone: 'favorable', strength: 'dim', tick: true }
  ],
  scale: [{ at: -0.4, label: '−0.4' }, { at: 0, label: '0', ref: true }, { at: 0.28, label: '+0.28', ref: true }, { at: 0.6, label: '+0.6 bps' }]
});
const feeWindows = () => win2(
  [['+0.53', '+0.03', 0.52, 1], ['−0.22', '−0.01', 0.24, -1]],
  [['+0.48', '−0.02', 0.34, -1], ['−0.21', '+0.01', 0.18, 1]],
  [base('+0.50'), base('−0.22')]
);
const fillRateWindows = () => win1(['92.1%', '+3.6', 0.8, 1], ['89.4%', '+0.9', 0.22, 1], ['88.5%']);
const mixWindows = () => win2(
  [['8.2%', '−3.3', 0.76, -1], ['91.8%', '+3.3', 0.76, 1]],
  [['10.4%', '−1.1', 0.26, -1], ['89.6%', '+1.1', 0.26, 1]],
  [base('11.5%'), base('88.5%')]
);
const mixMark = (target) => `<div style="display:flex;flex-direction:column;gap:6px">${M.split({ parts: [{ value: 11.5, tone: 'flow' }, { value: 88.5 }], target: 25 })}<div class="dx-legend"><span>602 filled</span><span>${target}</span></div></div>`;

function variants() {
  $('variant-grid').innerHTML = [
    card({
      caption: 'A · single', label: 'Fill rate', tone: 'favorable', chip: '46/46',
      tip: 'Venue fills ÷ decisions dispatched, within the retained window. A decision with no linked fill event counts as a miss.',
      value: { v: '88.5', unit: '%', series: 'fillrate' },
      marks: raw(`<div style="display:flex;flex-direction:column;gap:6px">${M.meter({ value: 88.5, target: 85 })}<div class="dx-legend"><span>venue fills</span><span>target 85%</span></div></div>`),
      foot: foot('52 decisions · 46 venue fills'), strip: strip(), windows: fillRateWindows()
    }),
    card({
      caption: 'B · dual — a pair, any signs', label: 'Fee economics', tone: 'favorable', chip: '5M tier', variant: 'dual',
      tip: 'Fee-tier economics per fill: maker credit earned and taker fee paid, in bps of notional. Net is volume-weighted, not an average of the two.',
      values: [{ sub: 'Maker', v: '+0.50', unit: 'bps', tone: 'favorable', series: 'fees' }, { sub: 'Taker', v: '−0.22', unit: 'bps', tone: 'adverse', series: 'fees' }],
      marks: raw(feeAxis()), foot: foot('$0.7120 rebate receivable', 'maker 0.5 bps'), strip: strip(), windows: feeWindows()
    }),
    card({
      caption: 'C · dual — a pair summing to 100%', label: 'Fill mix', tone: 'watch', chip: '5,223 pulls', variant: 'split',
      tip: 'Share of filled notional that rested as maker versus crossed as taker. Denominator is filled notional, not decision count.',
      values: [{ sub: 'Maker', v: '11.5', unit: '%', tone: 'flow', series: 'fillmix' }, { sub: 'Taker', v: '88.5', unit: '%', series: 'fillmix' }],
      marks: raw(mixMark('maker target 25%')), foot: foot('4,621 quotes pulled before filling'), strip: strip(), windows: mixWindows()
    }),
    card({
      caption: 'D · state — no window axis', label: 'Shadow ACK P95', tone: 'watch', variant: 'state',
      chip: { label: 'Degraded', tone: 'watch' },
      tip: '95th-percentile acknowledgement latency measured by the recording adapter — not venue latency, and currently degraded.',
      value: { v: '1.161', unit: 'ms' },
      marks: raw(M.columns([0.34, 0.52, 0.41, 0.66, 0.48, 0.59, 0.44, 0.71, 0.88, 1], { from: 7 })),
      foot: foot('recording adapter, not venue latency'),
      facts: [{ k: 'BOOK', v: '0', note: 'mismatched' }, { k: 'TRIPS', v: '0', note: 'circuit' }, { k: 'CLOSES', v: '52', note: 'recorded' }]
    })
  ].join('');
}

/* ---------- applied: vitals ---------- */

function vitals() {
  const eq = [10012, 10028, 10007, 10044, 10061, 10039, 10072, 10090, 10068, 10104, 10131, 10181, 10214];
  const pnl = [0, 14, 9, 31, 47, 38, 62, 84, 71, 103, 128, 151, 184.1];
  const fr = [84, 87, 91, 88, 86, 90, 93, 89, 87, 91, 90, 92.1];
  const slipBullet = `<div style="display:flex;flex-direction:column;gap:6px">${M.bullet({ p50: 1.16, p90: 3.24, target: 3, max: 4 })}<div class="dx-legend"><span class="dx-c dx-tone-favorable">P50 1.16</span><span style="color:var(--dx-muted)">budget 3.00</span><span class="dx-c dx-tone-adverse">P90 3.24</span></div></div>`;
  const lifeBullet = `<div style="display:flex;flex-direction:column;gap:6px">${M.range({
    segments: [{ from: 0, to: 9, tone: 'favorable' }, { from: 9, to: 96, color: TONES.adverse.edge }],
    ticks: [{ at: 9 }, { at: 29, tone: 'watch' }, { at: 96, tone: 'adverse' }]
  })}<div class="dx-legend"><span style="color:var(--dx-text)">pull 6.4 s</span><span class="dx-c dx-tone-watch">P50 fill 20.3 s</span><span class="dx-c dx-tone-adverse">P90 67.4 s</span></div></div>`;

  $('vitals-grid').innerHTML = [
    card({
      label: 'Equity', tone: 'favorable', chip: '2 accounts', variant: 'dual',
      tip: 'Account equity across both legs. Usable excludes margin already posted against open positions.',
      values: [{ sub: 'Total', v: '$10,214', series: 'equity' }, { sub: 'Usable', v: '$5,138', muted: true, series: 'equity' }],
      marks: raw(M.trend(eq, { height: 40 })), foot: foot('$10,214.60 · usable $5,138.20', '49.7% deployed'), strip: strip(),
      windows: win2([['+0.15%', '+0.04', 0.36, 1], ['+0.22%', '+0.06', 0.48, 1]], [['+0.96%', '+0.11', 0.64, 1], ['+1.31%', '+0.18', 0.8, 1]], [base('+1.82%'), base('+2.47%')])
    }),
    card({
      label: 'P&L', tone: 'favorable', chip: '46/46 attributed', variant: 'dual',
      tip: 'Realized cash on closed legs plus mark-to-market on what is still open. Requires complete coverage for every account.',
      values: [{ sub: 'Realized', v: '$184.10', tone: 'favorable', series: 'pnl' }, { sub: 'Unrealized', v: '$18.40', tone: 'favorable', series: 'pnl' }],
      marks: raw(M.trend(pnl, { height: 40 })), foot: foot('fees $6.92 · net $195.58', '$0.00 close fees'), strip: strip(),
      windows: win2([['$14.80', '+18%', 0.58, 1], ['$2.10', '−4%', 0.2, -1]], [['$81.20', '−6%', 0.24, -1], ['$7.60', '+3%', 0.18, 1]], [base('$184.10'), base('$18.40')])
    }),
    card({
      label: 'Fee economics', tone: 'favorable', chip: '5M tier', variant: 'dual',
      tip: 'Fee-tier economics per fill: maker credit earned and taker fee paid, in bps of notional. Net is volume-weighted, not an average of the two.',
      values: [{ sub: 'Maker', v: '+0.50', unit: 'bps', tone: 'favorable', series: 'fees' }, { sub: 'Taker', v: '−0.22', unit: 'bps', tone: 'adverse', series: 'fees' }],
      marks: raw(feeAxis()), foot: foot('$0.7120 receivable', '99 maker fills'), strip: strip(), windows: feeWindows()
    }),
    card({
      label: 'Fill mix', tone: 'watch', chip: '5,223 pulls', variant: 'split',
      tip: 'Share of filled notional that rested as maker versus crossed as taker. Denominator is filled notional, not decision count.',
      values: [{ sub: 'Maker', v: '11.5', unit: '%', tone: 'flow', series: 'fillmix' }, { sub: 'Taker', v: '88.5', unit: '%', series: 'fillmix' }],
      marks: raw(mixMark('maker target 25%')), foot: foot('4,621 pulled', '13.5 pts under target'), strip: strip(), windows: mixWindows()
    }),
    card({
      label: '10s markout', tone: 'favorable', chip: '46 samples', variant: 'dual',
      tip: 'Mid-price move 10 s after each fill, signed in our favour. Mean is the headline; P05 is the left tail that the mean hides.',
      values: [{ sub: 'Mean', v: '+2.34', unit: 'bps', tone: 'favorable', series: 'markout' }, { sub: 'P05 tail', v: '−0.30', unit: 'bps', tone: 'adverse', series: 'markout' }],
      marks: raw(M.histogram([1, 2, 4, 6, 9, 8, 6, 4, 3, 2, 1], { split: 2, height: 40 })), foot: foot('84.8% positive', 'median +1.91'), strip: strip(),
      windows: win2([['+2.61', '+0.27', 0.68, 1], ['−0.12', '+0.18', 0.44, 1]], [['+2.18', '−0.16', 0.4, -1], ['−0.41', '−0.11', 0.28, -1]], [base('+2.34'), base('−0.30')])
    }),
    card({
      label: 'Fill rate', tone: 'favorable', chip: '46/46',
      tip: 'Venue fills ÷ decisions dispatched, within the retained window. A decision with no linked fill event counts as a miss.',
      value: { v: '88.5', unit: '%', series: 'fillrate' },
      marks: raw(`<div style="display:flex;flex-direction:column;gap:6px">${M.meter({ value: 88.5, target: 85 })}<div class="dx-legend"><span>46 of 52 decisions</span><span>target 85%</span></div></div>${M.trend(fr, { height: 34 })}`),
      foot: foot('1,220 ms mean', '1,737 ms P95'), strip: strip(), windows: fillRateWindows()
    }),
    card({
      label: 'Execution slippage', tone: 'watch', chip: '1 ms ACK P95', better: 'down',
      tip: 'Realized fill price against the decision reference price, in bps. A cost — lower is better, and the budget is 3.00 bps.',
      value: { v: '1.16', unit: 'bps', series: 'slippage' },
      marks: raw(slipBullet + M.histogram([1, 4, 8, 10, 7, 6, 4, 3, 1, 1, 1], { split: 8, mode: 'cost', height: 40 })),
      foot: foot('reduce-only IOC', '46 attributed fills'), strip: strip(),
      windows: win1(['1.44', '+0.28', 0.6, 1], ['1.09', '−0.07', 0.16, -1], ['1.16'])
    }),
    card({
      label: 'Quote lifecycle', tone: 'watch', chip: '99 maker fills', variant: 'dual',
      tip: 'How long a maker quote must live before it fills (fill age) against how long it actually rests before it is pulled (rest age).',
      values: [
        { sub: 'Fill age', v: '20.3', unit: 's', series: 'lifecycle', better: 'down' },
        { sub: 'Rest age', v: '6.4', unit: 's', tone: 'watch', series: 'lifecycle', better: 'up' }
      ],
      marks: raw(lifeBullet), foot: foot('P95 67.4 / 29.1 s', '4,621 pulled unfilled'), strip: strip(),
      windows: win2([['18.7 s', '−1.6', 0.4, -1], ['4.9 s', '−1.5', 0.48, -1]], [['19.8 s', '−0.5', 0.14, -1], ['5.8 s', '−0.6', 0.2, -1]], [base('20.3 s'), base('6.4 s')])
    })
  ].join('');

  // the big distribution: 20 bins of 0.5 bps from −2 to +8; zero is bin 4
  const bins = [0, 1, 2, 4, 3, 5, 6, 5, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 0];
  const stat = (k, v, t) => `<div><div class="dx-sub" style="margin-bottom:5px">${k}</div><div class="dx-value dx-value--money dx-tone-${t}"${k !== 'Median' ? ' data-series="markout"' : ''}>${v}</div></div>`;
  $('markout-panel').innerHTML =
    `<div class="panel__head"><div><div class="panel__t">Realized 10s markout, per fill</div><div class="small">46 attributed fills · the average is the thing everyone quotes, the tail is the thing that hurts</div></div>` +
    `<div class="stats">${stat('Mean', '+2.34', 'favorable')}${stat('Median', '+1.91', 'neutral')}${stat('P05', '−0.30', 'adverse')}</div></div>` +
    `<div class="panel__body" style="padding-top:30px;gap:0"><div style="position:relative">${M.histogram(bins, { split: 4, height: 132, gap: 1.1 })}` +
    `<span class="marker" style="left:20%;background:#4a5154"><span style="color:var(--dx-muted)">zero</span></span>` +
    `<span class="marker" style="left:43.4%;background:var(--dx-ref)"><span style="color:var(--dx-text)">mean +2.34</span></span></div>` +
    `<div style="border-top:1px solid var(--dx-line);margin-top:9px;padding-top:9px">${M.scaleRow([-2, 0, 2, 4, 6, 8].map((v) => ({ at: v, label: v === 8 ? '+8 bps' : v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' })), -2, 8)}</div>` +
    `<div class="key"><span><i style="background:${A}"></i>7 fills below zero — 15.2%</span><span><i style="background:${F}"></i>39 fills positive — 84.8%</span></div></div>`;

  const band = (name, v, pos, n, pctPos) =>
    `<div style="display:flex;flex-direction:column;gap:9px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12.5px">${name}</span>` +
    `<span class="dx-mono dx-c dx-tone-favorable" style="font-weight:600;font-size:14px">${v}</span></div>${M.rail(pos)}<div class="dx-legend" style="font-size:11px"><span>${n}</span><span>${pctPos}</span></div></div>`;
  $('score-panel').innerHTML =
    `<div class="panel__head" style="display:block"><div class="panel__t">Score → realized markout</div><div class="small">does more conviction buy more opportunity?</div></div>` +
    `<div class="panel__body">${band('P95–P97', '+2.60 bps', 0.5, '20 decisions', '94.7% positive')}${band('P97–P99', '+1.41 bps', 0.27, '15 decisions', '69.2% positive')}${band('P99+', '+5.22 bps', 1, '1 decision', '100% positive · thin')}` +
    `<div class="small" style="margin-top:auto;padding-top:14px;border-top:1px solid var(--dx-line)">Monotonicity breaks in the middle band: P97–P99 earns less than the band below it. Ranked by bin, not by classifier confidence.</div></div>`;
}

/* ---------- applied: legs ---------- */

function legs() {
  const legCard = (o) => card({
    label: o.side === 'long' ? 'Long leg' : 'Short leg', tag: o.tag, tinted: true,
    tone: o.side === 'long' ? 'favorable' : 'adverse', chip: { label: 'Accounted', tone: o.side === 'long' ? 'favorable' : 'adverse' },
    tip: o.tip, variant: 'dual',
    values: [{ sub: 'Equity', v: o.equity, series: o.series }, { sub: 'Total P&L', v: o.pnl, tone: 'favorable' }],
    marks: raw(`<div style="display:flex;flex-direction:column;gap:6px">${M.meter({ value: o.margin, target: 70, tone: 'flow' })}<div class="dx-legend"><span>margin used ${o.used}</span><span>cap 70%</span></div></div>`),
    foot: foot(o.foot[0], o.foot[1]),
    facts: o.phases.map(([k, v, bar, note, watch]) => ({ k, v, bar, note, tone: watch ? 'watch' : undefined }))
  });

  const position =
    `<div style="display:flex;flex-direction:column;gap:5px;margin-top:2px">${M.diverging({
      max: 0.0741,
      left: { value: 0.0652, target: 0.065, tip: 'A2 short target: −0.0650 BTC. The leg is 0.0002 beyond it.' },
      right: { value: 0.0654, target: 0.065, tip: 'A1 long target: +0.0650 BTC. The leg is 0.0004 beyond it.' }
    })}<div class="dx-pair" style="grid-template-columns:1fr 1fr;font:500 10.5px/1.5 var(--dx-mono);color:var(--dx-muted)">` +
    `<span>target −0.0650 · <span class="dx-c dx-tone-watch">+0.0002 over</span><br><span class="dx-c dx-tone-adverse">$4,102 short</span></span>` +
    `<span style="text-align:right">target +0.0650 · <span class="dx-c dx-tone-watch">+0.0004 over</span><br><span class="dx-c dx-tone-favorable">$4,115 long</span></span></div></div>` +
    `<div style="border-top:1px solid var(--dx-line);padding-top:9px;display:flex;flex-direction:column;gap:5px">` +
    `<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="dx-label dx-defn" data-tip="Each leg is sized to its own target; what the two misses fail to cancel is the residual, drawn on a ±0.0010 BTC axis. The pale band is the rebalance tolerance." style="font-size:10.5px">Residual vs flat</span>` +
    `<span class="dx-strip__v">+0.0002 BTC · $13.20</span></div>${M.band({ value: 0.0002, tol: 0.00025, max: 0.001 })}` +
    M.scaleRow([{ at: -0.001, label: '−0.0010' }, { at: -0.00025, label: '−tol', dim: true }, { at: 0, label: 'flat', ref: true }, { at: 0.00025, label: '+tol', dim: true }, { at: 0.001, label: '+0.0010' }], -0.001, 0.001) +
    `</div>`;

  $('legs-grid').innerHTML = [
    card({
      label: 'Leg position', tone: 'favorable', span: 2, variant: 'dual',
      chip: { label: 'Within tolerance', tone: 'favorable' },
      tip: 'Each leg carries its own size target — white ticks on the outer axis. What the two misses fail to cancel becomes the residual below, which is the only number that has to be flat.',
      values: [{ sub: 'A2 · short', v: '−0.0652', unit: 'BTC', tone: 'adverse', series: 'hedge' }, { sub: 'A1 · long', v: '+0.0654', unit: 'BTC', tone: 'favorable', series: 'hedge' }],
      marks: raw(position), foot: foot('imbalance 0.16% of gross · limit 0.25%', 'rebalance in 124.9 s median'), strip: strip(),
      better: 'down',
      windows: win1(['+0.0004', '+0.0002', 0.6, 1], ['+0.0001', '−0.0001', 0.32, -1], ['+0.0002'])
    }),
    card({
      label: 'Hedge pair', tone: 'watch', variant: 'dual', chip: { label: 'Live', tone: 'favorable', dot: true },
      tip: 'The long and short legs treated as one position. Delta is what the hedge fails to cancel; imbalance is that delta over gross exposure.',
      values: [{ sub: 'Net delta', v: '$13.20', series: 'hedge' }, { sub: 'Imbalance', v: '0.16', unit: '%', tone: 'watch', series: 'hedge' }],
      marks: raw(`<div style="display:flex;flex-direction:column;gap:6px">${M.bullet({ p50: 124.9, p90: 350.3, target: 300, max: 350.3 })}<div class="dx-legend"><span class="dx-c dx-tone-favorable">P50 124.9 s</span><span style="color:var(--dx-muted)">tolerance 300 s</span><span class="dx-c dx-tone-adverse">P95 350.3 s</span></div></div>`),
      foot: foot('balance recovery · P0 + P1 + P2', '1 venue'),
      facts: [{ k: 'PHASE', v: 'LIVE', note: 'single venue', tone: 'favorable' }, { k: 'FEED', v: 'DEGR', note: 'shadow ACK', tone: 'watch' }, { k: 'CLOSES', v: '52', note: 'recorded' }]
    }),
    legCard({
      side: 'long', tag: 'A1', series: 'leg', equity: '$5,095', pnl: '$402.26', margin: 33, used: '$1,681',
      tip: 'Account A1 works the long leg of the hedge: it buys to open and sells to close. Side, not sign — the tint is identity.',
      foot: ['usable $3,412 · +8.57% return', 'realized $402.26'],
      phases: [['P0', '35 / 0', 1, 'P95 10.0 s'], ['P1', '25 / 9', 0.74, 'P95 233.2 s', true], ['P2', '26 / 0', 1, 'P95 171.8 s']]
    }),
    legCard({
      side: 'short', tag: 'A2', equity: '$5,119', pnl: '$121.40', margin: 66, used: '$3,378',
      tip: 'Account A2 works the short leg of the hedge: it sells to open and buys to close.',
      foot: ['usable $1,726 · +2.43% return', 'realized $103.26'],
      phases: [['P0', '31 / 0', 1, 'P95 9.4 s'], ['P1', '28 / 2', 0.93, 'P95 96.5 s'], ['P2', '24 / 0', 1, 'P95 168.1 s']]
    })
  ].join('');
}

/* ---------- applied: decisions blotter ---------- */

function blotter() {
  const ins = { BTC: ['#f7931a', '₿'], ETH: ['#627eea', 'Ξ'], SOL: ['#14b8a6', 'S'] };
  const rows = [
    ['done', '14:22:07', 'sell', 'BTC', 'A2', 'short', '$798', 1.04, 2.4, 1.81, 2.61, 2.42, 1.92],
    ['done', '14:22:03', 'buy', 'BTC', 'A1', 'long', '$779', 0.42, 2.9, 2.44, 3.1, 2.86, 2.41],
    ['done', '14:21:58', 'sell', 'ETH', 'A2', 'short', '$612', 1.61, 1.1, -0.42, -0.3, 0.12, -0.18],
    ['P1 · 9 s', '14:21:44', 'buy', 'BTC', 'A1', 'long', '$673', 0.88, 2.1, 1.44, 1.91, null, 1.28],
    ['done', '14:21:30', 'sell', 'BTC', 'A2', 'short', '$1,096', 0.35, 2.2, 2.05, 2.42, 2.31, 2.65],
    ['P2 · 23 s', '14:21:12', 'buy', 'SOL', 'A1', 'long', '$541', 2.04, 1.6, 0.22, 0.61, null, 0.33],
    ['done', '14:20:57', 'sell', 'BTC', 'A2', 'short', '$620', 1.16, 2.0, 1.62, 2.18, 2.05, 1.35],
    ['done', '14:20:41', 'buy', 'ETH', 'A1', 'long', '$532', 0.51, 0.8, 0.05, -0.12, 0.31, -0.06]
  ];
  const sgn = (v, d = 2) => (v == null ? '<span style="color:var(--dx-faint)">—</span>' : `<span class="dx-c dx-tone-${v < 0 ? 'adverse' : 'favorable'}">${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(d)}</span>`);
  const money = (v) => `<span class="dx-c dx-tone-${v < 0 ? 'adverse' : 'favorable'}" style="font-weight:600">${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(2)}</span>`;
  const slip = (v) => `<span${v > 1.5 ? ' class="dx-c dx-tone-watch"' : ''}>${v.toFixed(2)}</span>`;
  const body = rows.map((r) => {
    const st = r[0] === 'done' ? B.state('Done') : B.state(r[0], { tone: 'watch' });
    return `<tr><td>${st}</td><td class="dx-mono" style="color:var(--dx-muted)">${r[1]}</td><td>${B.direction(r[2])}</td>` +
      `<td>${B.instrument(r[3], { kind: 'PERP', color: ins[r[3]][0], glyph: ins[r[3]][1] })}</td>` +
      `<td><span style="display:inline-flex;gap:8px;align-items:center"><span class="dx-mono" style="color:var(--dx-muted)">${r[4]}</span>${B.side(r[5])}</span></td>` +
      `<td class="dx-num">${r[6]}</td><td class="dx-num">${slip(r[7])}</td><td class="dx-num" style="color:var(--dx-muted)">+${r[8].toFixed(2)}</td>` +
      `<td class="dx-num">${sgn(r[9])}</td><td class="dx-num">${sgn(r[10])}</td><td class="dx-num">${sgn(r[11])}</td><td class="dx-num">${money(r[12])}</td></tr>`;
  }).join('');
  $('blotter').innerHTML =
    `<div class="blotter__bar"><div class="blotter__counts"><span><b>52</b>decisions</span><span><b>46</b>filled</span><span><b class="dx-c dx-tone-watch">6</b>active</span><span><b>78%</b>model hit rate</span><span><b>1,220 ms</b>median ack</span></div>` +
    `<div class="dx-seg" id="blotter-seg"><button type="button" aria-pressed="true">All</button><button type="button" aria-pressed="false">Active only</button><button type="button" aria-pressed="false">Missed model</button></div></div>` +
    `<div class="blotter"><table class="dx-table"><thead><tr class="dx-group"><th colspan="5">Decision</th><th colspan="2" class="dx-num" style="text-align:left">Execution</th><th colspan="4">Markout vs model · bps</th><th class="dx-num">Result</th></tr>` +
    `<tr><th>State</th><th>Time</th><th></th><th>Instrument</th><th>Account · leg</th><th class="dx-num">Notional</th><th class="dx-num">Slip</th><th class="dx-num">Model</th><th class="dx-num">1s</th><th class="dx-num">10s</th><th class="dx-num">60s</th><th class="dx-num">P&amp;L</th></tr></thead>` +
    `<tbody>${body}</tbody></table></div>` +
    `<div class="blotter__foot"><span>showing 8 of 52 · newest first</span><span>model is the frozen prediction at decision time; 1s / 10s / 60s are realized against it</span></div>`;
  const filter = $('blotter-seg');
  filter.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => {
    filter.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('blotter').querySelectorAll('tbody tr').forEach((tr, j) => {
      const r = rows[j];
      tr.hidden = i === 1 ? r[0] === 'done' : i === 2 ? !(r[10] != null && r[10] < r[8] - 1) : false;
    });
  }));
}

/* ---------- component + removes ---------- */

const SAMPLE = `<span class="c">// one import, zero dependencies</span>
import { card, marks, lint } from '@dabaihk/dimension-ui';

const fillRate = {
  label: <span class="s">'Fill rate'</span>, tone: <span class="s">'favorable'</span>, chip: <span class="s">'46/46'</span>,
  tip: <span class="s">'Venue fills ÷ decisions dispatched.'</span>,
  value: { v: <span class="s">'88.5'</span>, unit: <span class="s">'%'</span>, series: <span class="s">'fillrate'</span> },
  marks: marks.meter({ value: 88.5, target: 85 }),
  windows: [
    { win: <span class="s">'10M'</span>, rows: [{ v: <span class="s">'92.1%'</span>, d: <span class="s">'+3.6'</span>, w: 0.8, dir: 1 }] },
    { win: <span class="s">'1H'</span>,  rows: [{ v: <span class="s">'89.4%'</span>, d: <span class="s">'+0.9'</span>, w: 0.2, dir: 1 }] },
    { win: <span class="s">'24H'</span>, rows: [{ v: <span class="s">'88.5%'</span> }] }
  ]
};

lint(fillRate);                <span class="c">// [] — it ships</span>
el.innerHTML = card(fillRate); <span class="c">// an HTML string: works in any framework, or none</span>`;

function component() {
  $('code-sample').innerHTML = SAMPLE;
  $('component-grid').innerHTML = [
    card({
      label: 'Fee economics', tone: 'favorable', chip: '5M tier', variant: 'dual',
      tip: 'Fee-tier economics per fill: maker credit earned and taker fee paid, in bps of notional. Net is volume-weighted.',
      values: [{ sub: 'Maker', v: '+0.50', unit: 'bps', tone: 'favorable', series: 'fees' }, { sub: 'Taker', v: '−0.22', unit: 'bps', tone: 'adverse', series: 'fees' }],
      foot: foot('$0.7120 receivable', '99 maker fills'), strip: strip(), windows: feeWindows()
    }),
    card({
      label: 'Fill rate', tone: 'favorable', chip: '46/46',
      tip: 'Venue fills ÷ decisions dispatched. A decision with no linked fill event counts as a miss.',
      value: { v: '88.5', unit: '%', series: 'fillrate' },
      foot: foot('52 decisions', '1,737 ms P95'), strip: strip(), windows: fillRateWindows()
    }),
    card({
      label: 'Long leg', tag: 'A1', tinted: true, tone: 'favorable', chip: { label: 'Accounted', tone: 'favorable' }, variant: 'dual',
      tip: 'Account A1 works the long leg of the hedge. The tint is identity, not sentiment.',
      values: [{ sub: 'Equity', v: '$5,095', series: 'leg' }, { sub: 'Total P&L', v: '$402.26', tone: 'favorable' }],
      foot: foot('usable $3,412', '+8.57% return'),
      facts: [{ k: 'P0', v: '35 / 0', bar: 1, note: 'clear' }, { k: 'P1', v: '25 / 9', bar: 0.74, note: '233 s', tone: 'watch' }, { k: 'P2', v: '26 / 0', bar: 1, note: 'clear' }]
    })
  ].join('');
}

function removes() {
  const stat = (n, t, title, text) =>
    `<div class="dx-card"><div class="dx-card__rule dx-tone-${t}"></div><div class="dx-card__body"><div class="big dx-c dx-tone-${t}">${n}</div><div class="dx-label">${title}</div><div class="txt">${text}</div></div></div>`;
  $('removes-grid').innerHTML =
    stat('−9', 'favorable', 'tiles above the fold', '13 KPI cards + 4 window cards → 8 cards. No orphan in the 4-column grid.') +
    stat('−1', 'favorable', 'global control', 'The aggregation-window switcher goes away; each card shows all three windows at once, so nothing hides behind a mode.') +
    stat('4', 'flow', 'pairs reunited', 'maker↔taker bps, maker↔taker share, mean↔tail markout, fill age↔rest age.') +
    stat('5', 'neutral', 'marks, six colours', 'Trend, deviation, quantile bullet, distribution, split — each bound to one of six hues. A new metric picks from the set or it doesn’t ship.');
}

/* ---------- boot ---------- */

function render() {
  anatomy(); marksSection(); variants(); vitals(); legs(); component();
}

colourLaw(); shadeScale(); ladders(); badges(); blotter(); removes();
render();
scrollSpy(document);

document.querySelectorAll('[data-density]').forEach((box) => box.addEventListener('change', () => {
  density[box.dataset.density] = box.checked;
  render();
}));
const seg = $('baseline-seg');
seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
