import { test } from 'node:test';
import assert from 'node:assert/strict';
import { card, lint, raw, marks } from '../src/index.js';

const windows = [
  { win: '10M', rows: [{ v: '92.1%', d: '+3.6', w: 0.8, dir: 1 }] },
  { win: '1H', rows: [{ v: '89.4%', d: '−0.9', w: 0.2, dir: -1 }] },
  { win: '24H', rows: [{ v: '88.5%' }] }
];
const fillRate = {
  label: 'Fill rate', tone: 'favorable', chip: '46/46', tip: 'Fills ÷ decisions.',
  value: { v: '88.5', unit: '%', series: 'fillrate' }, windows
};

test('single card renders label, value, unit, series and strip', () => {
  const html = card(fillRate);
  assert.match(html, /dx-card--single/);
  assert.match(html, /data-tip="Fills ÷ decisions."/);
  assert.match(html, /data-series="fillrate"/);
  assert.match(html, />88\.5<span class="dx-unit">%<\/span>/);
  assert.equal((html.match(/dx-strip__cell/g) || []).length, 3);
  assert.match(html, /dx-tone-favorable[^>]*style="left:50%;width:40%"/);
  assert.match(html, /dx-tone-adverse[^>]*style="right:50%;width:10%"/);
});

test('a cost metric flips the verdict', () => {
  const html = card({ ...fillRate, better: 'down' });
  assert.match(html, /dx-dev__bar dx-tone-adverse" style="left:50%/);
});

test('dual card with paired windows uses the two-column strip', () => {
  const html = card({
    label: 'Fee economics', tip: 'x', variant: 'dual',
    values: [{ sub: 'Maker', v: '+0.50', tone: 'favorable' }, { sub: 'Taker', v: '−0.22', tone: 'adverse' }],
    windows: [
      { win: '10M', rows: [{ v: '+0.53', d: '+0.03', w: 0.5, dir: 1 }, { v: '−0.22', d: '−0.01', w: 0.2, dir: -1 }] },
      { win: '24H', rows: [{ v: '+0.50' }, { v: '−0.22' }] }
    ]
  });
  assert.match(html, /dx-pair/);
  assert.match(html, /dx-strip--pair/);
  assert.equal((html.match(/dx-strip__row"/g) || []).length, 4);
});

test('state card renders facts and no window strip', () => {
  const html = card({ label: 'ACK P95', tip: 'x', value: { v: '1.1' }, facts: [{ k: 'BOOK', v: '0', note: 'mismatched' }] });
  assert.match(html, /dx-card--state/);
  assert.match(html, /mismatched/);
});

test('text is escaped, raw slots pass through', () => {
  const html = card({ label: '<b>x</b>', tip: '"q"', value: { v: '<1>' }, marks: raw('<i id="m"></i>'), strip: false });
  assert.ok(!html.includes('<b>x</b>'));
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /data-tip="&quot;q&quot;"/);
  assert.match(html, /<i id="m"><\/i>/);
});

test('tinted card puts the head in a tinted bar', () => {
  const html = card({ label: 'Long leg', tag: 'A1', tinted: true, tone: 'favorable', tip: 'x', value: { v: '1' }, strip: false });
  assert.match(html, /dx-card__head--tinted dx-tone-favorable/);
  assert.match(html, /dx-tag dx-tone-favorable">A1/);
});

test('guards: label required, at most two values, valid variant', () => {
  assert.throws(() => card({}), /needs a label/);
  assert.throws(() => card({ label: 'x', values: [{ v: 1 }, { v: 2 }, { v: 3 }] }), /never more/);
  assert.throws(() => card({ label: 'x', variant: 'quad' }), /unknown variant/);
  assert.throws(() => card({ label: 'x', value: { v: 1, tone: 'purple' } }), /not a tone/);
});

test('lint passes a well-formed card and reports broken rules', () => {
  assert.deepEqual(lint(fillRate), []);
  const problems = lint({
    label: 'Maker fill age by venue', variant: 'split',
    values: [{ v: '40%' }, { v: '40%' }], tinted: true
  });
  assert.ok(problems.some((p) => p.startsWith('label:')));
  assert.ok(problems.some((p) => p.startsWith('tip:')));
  assert.ok(problems.some((p) => p.includes('sum to 80')));
  assert.ok(problems.some((p) => p.startsWith('tinted:')));
  assert.ok(problems.some((p) => p.startsWith('strip:')));
});

test('card accepts marks as strings', () => {
  const html = card({ ...fillRate, marks: raw(marks.meter({ value: 88.5, target: 85 })) });
  assert.match(html, /dx-meter/);
});
