import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXT, GRAPHICS } from './contrast-pairs.mjs';

// every --ag-* colour is light-dark(light, dark) in buildguide.css; contrast-pairs.mjs lists the ones the stylesheet puts on each other
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
