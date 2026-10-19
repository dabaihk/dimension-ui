import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marks as M, badges as B, fmt, gen } from '../src/index.js';

test('trend draws line, area, dashed average and end tick', () => {
  const svg = M.trend([1, 3, 2, 4], { height: 40 });
  assert.match(svg, /^<svg/);
  assert.equal((svg.match(/<path/g) || []).length, 2);
  assert.match(svg, /stroke-dasharray="2 3"/);
  assert.match(svg, /height:40px/);
  assert.equal(M.trend([1]), '');
});

test('deviation bar sides and widths', () => {
  assert.match(M.deviation({ w: 1, dir: 1 }), /left:50%;width:50%/);
  assert.match(M.deviation({ w: 0.5, dir: -1 }), /right:50%;width:25%/);
  assert.ok(!M.deviation({}).includes('dx-dev__bar'));
});

test('bullet: only the breach past the target turns red', () => {
  const html = M.bullet({ p50: 1, p90: 3.2, target: 3, max: 4 });
  assert.match(html, /left:75%;width:5%;background:#ff6b5e/);
  assert.match(html, /dx-tick[^>]*left:75%/);
  assert.ok(!M.bullet({ p50: 1, p90: 2, target: 3, max: 4 }).includes('#ff6b5e'));
});

test('histogram colours the losing tail', () => {
  const svg = M.histogram([1, 2, 3, 4], { split: 2 });
  assert.equal((svg.match(/fill="#ff6b5e"/g) || []).length, 2);
  const cost = M.histogram([1, 2, 3, 4], { split: 3, mode: 'cost' });
  assert.equal((cost.match(/fill="#ff6b5e"/g) || []).length, 1);
});

test('split normalises parts to 100%', () => {
  const html = M.split({ parts: [{ value: 1, tone: 'flow' }, { value: 3 }] });
  assert.match(html, /width:25%;background:#3fd3e8/);
  assert.match(html, /width:75%;background:var\(--dx-struct\)/);
});

test('paired axis places zero on a shared signed scale', () => {
  const html = M.pairedAxis({ min: -0.4, max: 0.6, rows: [{ k: 'MKR', value: 0.5 }, { k: 'TKR', value: -0.22 }] });
  assert.match(html, /dx-axis__zero" style="left:40%/);
  assert.match(html, /left:18%;width:22%/);
});

test('badges validate their vocabulary', () => {
  assert.match(B.side('long'), /dx-tone-favorable/);
  assert.match(B.direction('sell'), />S</);
  assert.throws(() => B.side('up'));
  assert.ok(!B.state('Failed', { tone: 'adverse' }).includes('dx-badge__dot'));
});

test('fmt and gen', () => {
  assert.equal(fmt(-1234.5, '$'), '−$1,235');
  assert.equal(fmt(2.345, 'bps'), '+2.35 bps');
  assert.equal(fmt(88.5, '%'), '88.50%');
  assert.deepEqual(gen(1, 5, 0), gen(1, 5, 0));
  assert.equal(gen(1, 5, 0).length, 5);
});
