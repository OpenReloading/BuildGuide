import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// every --ag-* colour is light-dark(light, dark) in buildguide.css; the pairs below are the ones the stylesheet puts on each other
const css = readFileSync(new URL('../src/buildguide.css', import.meta.url), 'utf8');
const tokens = { light: {}, dark: {} };
for (const [, name, light, dark] of css.matchAll(/--ag-([\w-]+):light-dark\((#[0-9a-f]+), (#[0-9a-f]+)\)/g)) { tokens.light[name] = light; tokens.dark[name] = dark; }

const channel = (hex, i) => {
  const full = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join('') : hex.slice(1);
  const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = hex => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// text pairs need 4.5, controls, focus rings and drawn parts 3 (WCAG 2.2 AA, 1.4.3 and 1.4.11)
const TEXT = [['ink', 'surface'], ['ink', 'page'], ['muted', 'surface'], ['muted', 'page'], ['muted', 'surface-head'], ['muted', 'surface-soft'], ['muted', 'step-current-bg'],
  ['text', 'surface'], ['text', 'bom-hover'], ['accent', 'surface'], ['accent', 'page'], ['surface', 'primary'], ['surface', 'primary-hover'], ['surface', 'done'],
  ['control-ink', 'surface'], ['control-ink', 'control-hover'], ['ink', 'step-current-bg'], ['ink', 'row-selected'], ['ink', 'row-hover'], ['ink', 'error-bg'], ['muted', 'row-hover'],
  ['muted', 'done-bg'], ['ink', 'done-bg'], ['done', 'done-bg'], ['muted', 'row-selected'], ['muted', 'bom-hover'], ['ink', 'caution-bg'], ['ink', 'warning-bg']];
const GRAPHICS = [['control-line', 'surface'], ['control-line', 'page'], ['control-line', 'control-hover'], ['control-line', 'surface-soft'], ['focus', 'surface'], ['focus', 'page'],
  ['glow', 'surface'], ['swatch-line', 'surface'], ['swatch-line', 'row-selected'], ['swatch-line', 'row-hover'], ['swatch-line', 'bom-hover'], ['diode-body', 'surface'],
  ['diode-band', 'diode-body'], ['step-current-line', 'surface'],
  ['caution-line', 'surface'], ['caution-line', 'caution-bg'], ['warning-line', 'surface'], ['warning-line', 'warning-bg']];

test('the dark tokens are the same set as the light ones', () => {
  assert.ok(Object.keys(tokens.light).length > 25);
  assert.deepEqual(Object.keys(tokens.dark), Object.keys(tokens.light));
});

for (const scheme of ['dark', 'light']) {
  test(`${scheme} tokens: text pairs reach 4.5, control borders, focus rings and drawn parts 3`, () => {
    const t = tokens[scheme], low = [];
    for (const [a, b] of TEXT) if (ratio(t[a], t[b]) < 4.5) low.push(`${a} on ${b}: ${ratio(t[a], t[b]).toFixed(2)}`);
    for (const [a, b] of GRAPHICS) if (ratio(t[a], t[b]) < 3) low.push(`${a} on ${b}: ${ratio(t[a], t[b]).toFixed(2)}`);
    assert.deepEqual(low, []);
  });
}
