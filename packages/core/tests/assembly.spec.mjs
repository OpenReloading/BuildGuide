// Browser checks of the assembly prototype (example/assembly/): expectations come from its guide.json.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const A = JSON.parse(readFileSync(new URL('../example/assembly/guide.json', import.meta.url))).assembly;
const ORIGIN = 'http://127.0.0.1:8080';

let problems;
test.beforeEach(async ({ page }) => {
  problems = { errors: [], missing: [], external: [] };
  page.on('pageerror', e => problems.errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && problems.errors.push(m.text()));
  page.on('response', r => r.status() >= 400 && problems.missing.push(r.url()));
  page.on('request', r => /^https?:/.test(r.url()) && !r.url().startsWith(ORIGIN) && problems.external.push(r.url()));
  await page.route('**/*', r => r.request().url().startsWith(ORIGIN) || !/^https?:/.test(r.request().url()) ? r.continue() : r.abort());
});
test.afterEach(() => expect(problems).toEqual({ errors: [], missing: [], external: [] }));

// pixels of the canvas that differ from its corner (the background), counted in the browser from a screenshot
const drawn = async page => {
  const png = (await page.locator('.ag-assembly-canvas').screenshot()).toString('base64');
  return page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    c.drawImage(bitmap, 0, 0);
    const px = c.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let n = 0;
    for (let i = 4; i < px.length; i += 4) if (px[i] !== px[0] || px[i + 1] !== px[1] || px[i + 2] !== px[2]) n++;
    return n;
  }, png);
};

test('mounts, loads each model once and draws', async ({ page }) => {
  const stl = [];
  page.on('request', r => r.url().endsWith('.stl') && stl.push(r.url().split('/').pop()));
  await page.goto(`${ORIGIN}/example/assembly/`);
  const canvas = page.locator('.ag-assembly-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  expect(stl.sort()).toEqual(Object.values(A.models).sort());
  await expect(page.locator('.ag-assembly-steps li')).toHaveCount(A.steps.length);
  // the first step has drawn the lower half only
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-action="next-step"]').click();
  await expect.poll(() => drawn(page)).toBeGreaterThan(1000);
});

test('steps through the assembly with buttons and the list', async ({ page }) => {
  await page.goto(`${ORIGIN}/example/assembly/`);
  const status = page.locator('.ag-assembly-count');
  await expect(status).toHaveText(`Step 1 of ${A.steps.length}: ${A.steps[0].title}`);
  await expect(page.locator('[data-action="prev-step"]')).toBeDisabled();
  await page.locator('[data-action="next-step"]').click();
  await expect(status).toHaveText(`Step 2 of ${A.steps.length}: ${A.steps[1].title}`);
  await page.locator(`[data-step="${A.steps.length - 1}"]`).click();
  await expect(page.locator('[data-action="next-step"]')).toBeDisabled();
  await expect(page.locator('.ag-assembly-canvas')).toHaveAttribute('aria-label', new RegExp(A.steps.at(-1).text.slice(0, 20)));
});

test('the camera moves with the keyboard', async ({ page }) => {
  await page.goto(`${ORIGIN}/example/assembly/`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const canvas = page.locator('.ag-assembly-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const shot = () => canvas.screenshot();
  const before = await shot();
  await canvas.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => !(await shot()).equals(before)).toBe(true);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await shot()).equals(before)).toBe(true);
});

test('reduced motion draws the final position at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${ORIGIN}/example/assembly/`);
  await expect(page.locator('.ag-assembly-canvas')).toHaveAttribute('data-ready', 'true');
  const first = await drawn(page);
  expect(await drawn(page)).toBe(first);
});
