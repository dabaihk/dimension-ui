import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TONES, tone, toneKey, isLawful, verdict } from '../src/index.js';

test('every tone has exactly four strengths', () => {
  for (const [k, t] of Object.entries(TONES)) {
    assert.deepEqual(Object.keys(t).sort(), ['base', 'dim', 'edge', 'tint'], k);
  }
});

test('aliases resolve and unknown tones throw', () => {
  assert.equal(toneKey('lime'), 'favorable');
  assert.equal(tone('red').base, '#ff6b5e');
  assert.throws(() => tone('purple'), /not a tone/);
});

test('isLawful accepts system colours only', () => {
  assert.ok(isLawful('#BFF24D'));
  assert.ok(isLawful('#101315'));
  assert.ok(!isLawful('#8a2be2'));
});

test('verdict follows the better direction', () => {
  assert.equal(verdict(1), 'favorable');
  assert.equal(verdict(-1), 'adverse');
  assert.equal(verdict(1, 'down'), 'adverse');
  assert.equal(verdict(0), 'neutral');
});

test('tokens.css and tokens.js agree', async () => {
  const css = (await readFile(new URL('../src/tokens.css', import.meta.url), 'utf8')).toLowerCase();
  const prefix = { favorable: 'fav', adverse: 'adv', watch: 'watch', flow: 'flow' };
  for (const [k, p] of Object.entries(prefix)) {
    const t = TONES[k];
    assert.match(css, new RegExp(`--dx-${p}-tint: ${t.tint}`));
    assert.match(css, new RegExp(`--dx-${p}-edge: ${t.edge}`));
    assert.match(css, new RegExp(`--dx-${p}-dim: ${t.dim}`));
    assert.match(css, new RegExp(`--dx-${p}: ${t.base}`));
  }
});
