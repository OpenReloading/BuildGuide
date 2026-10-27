// Browser checks of the board gestures: pinch, wheel and swipe with touch emulation at 360, 390 and 820 px.
// A board zooms and pans, and the page keeps scrolling. Expectations come from example/guide.json.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('../example/guide.json', import.meta.url)));
const BASE = `http://127.0.0.1:8080${process.env.BUILDGUIDE_PREFIX ?? ''}/example/`;
const boards = Object.keys(D.boards);
const ready = page => expect(page.locator('.ag-board-canvas')).toHaveAttribute('data-ready', 'true');

test.use({ hasTouch: true, isMobile: true });

// real touch input through the browser's input pipeline (pointer events, touch-action and scroll chaining apply):
// each finger is a list of points over time
const touch = async (page, fingers) => {
  // the compositor learns of a scroll or a layout change a frame later: a touch before that does not scroll
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const cdp = await page.context().newCDPSession(page);
  const at = i => fingers.map((f, id) => ({ x: f[i].x, y: f[i].y, id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let i = 1; i < fingers[0].length; i++) { await page.waitForTimeout(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i) }); }
  await page.waitForTimeout(16);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const STEPS = 12, line = (from, to) => Array.from({ length: STEPS + 1 }, (_, i) => ({ x: from.x + (to.x - from.x) * i / STEPS, y: from.y + (to.y - from.y) * i / STEPS }));
const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
// two fingers 60 px apart that move to `scale` times that distance, around the middle of the box
const pinch = (page, box, scale) => {
  const c = centre(box), half = 30;
  return touch(page, [-1, 1].map(side => line({ x: c.x + side * half, y: c.y }, { x: c.x + side * half * scale, y: c.y })));
};
const swipe = (page, box, dy) => { const c = centre(box); return touch(page, [line(c, { x: c.x, y: c.y + dy })]); };
const widthOf = page => page.locator('.ag-board-canvas .joint-paper').evaluate(el => el.getBoundingClientRect().width);
// the page scrolled and the browser's own pinch zoom did not happen
const pageZoom = page => page.evaluate(() => visualViewport.scale);

for (const width of [360, 390, 820]) {
  for (const key of boards) {
    test(`${key} at ${width} px: pinch zooms the board within the button limits, swipes scroll the page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${BASE}${key}/`); await ready(page);
      const canvas = page.locator('.ag-board-canvas');
      await canvas.scrollIntoViewIfNeeded();
      await page.locator('[data-action=zoom-fit]').click();
      const fit = await widthOf(page);

      // a one-finger swipe over a board that shows the whole drawing scrolls the page and moves nothing in the board
      await page.evaluate(() => scrollTo(0, 0));
      await canvas.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY), scrolled = await canvas.evaluate(el => [el.scrollLeft, el.scrollTop]);
      await swipe(page, await canvas.boundingBox(), -150);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
      expect(await canvas.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual(scrolled);

      // a pinch out enlarges the board, a pinch in returns to the whole board and not below it
      await canvas.scrollIntoViewIfNeeded();
      await pinch(page, await canvas.boundingBox(), 2);
      const larger = await widthOf(page);
      expect(larger).toBeGreaterThan(fit * 1.5);
      await pinch(page, await canvas.boundingBox(), 0.2);
      expect(await widthOf(page)).toBeLessThanOrEqual(fit + 1);
      expect(await widthOf(page)).toBeGreaterThanOrEqual(fit - 1);
      // and not above the largest size of the Zoom button
      await pinch(page, await canvas.boundingBox(), 8);
      const largest = await widthOf(page);
      for (let i = 0; i < 40; i++) await page.locator('[data-action=zoom-in]').click();
      expect(largest).toBeLessThanOrEqual(await widthOf(page) + 1);
      expect(await pageZoom(page)).toBe(1);

      // Fit resets the zoom and the pan
      await page.locator('[data-action=zoom-fit]').click();
      expect(await widthOf(page)).toBeLessThanOrEqual(fit + 1);
      expect(await canvas.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0]);
    });
  }
}

test('pinch keeps the board point under the fingers', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const canvas = page.locator('.ag-board-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await page.locator('[data-action=zoom-fit]').click();
  const box = await canvas.boundingBox(), paper = page.locator('.ag-board-canvas .joint-paper');
  const before = await paper.boundingBox();
  // the pinch centre is the middle of the canvas: the board point there stays put
  const at = b => ({ x: (box.x + box.width / 2 - b.x) / b.width, y: (box.y + box.height / 2 - b.y) / b.height });
  const from = at(before);
  await pinch(page, box, 2);
  const after = at(await paper.boundingBox());
  expect(after.x).toBeCloseTo(from.x, 1);
  expect(after.y).toBeCloseTo(from.y, 1);
});

test('pinch: the centre may drift while the fingers spread, the second finger may land after the first', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const canvas = page.locator('.ag-board-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await page.locator('[data-action=zoom-fit]').click();
  const fit = await widthOf(page), c = centre(await canvas.boundingBox()), y = await page.evaluate(() => scrollY);
  const from = side => ({ x: c.x + side * 30, y: c.y });
  await touch(page, [-1, 1].map(side => line(from(side), { x: c.x + side * 120, y: c.y - 40 })));
  expect(await widthOf(page)).toBeGreaterThan(fit * 1.5);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.locator('[data-action=zoom-fit]').click();
  // the first finger rests (inside the touch slop) before the second lands
  const first = [{ x: c.x - 30, y: c.y }, { x: c.x - 31, y: c.y }, { x: c.x - 32, y: c.y }, ...line({ x: c.x - 32, y: c.y }, { x: c.x - 120, y: c.y })];
  const second = [{ x: c.x + 30, y: c.y }, { x: c.x + 30, y: c.y }, { x: c.x + 30, y: c.y }, ...line({ x: c.x + 30, y: c.y }, { x: c.x + 120, y: c.y })];
  await touch(page, [first, second]);
  expect(await widthOf(page)).toBeGreaterThan(fit * 1.5);
});

test('tap: a tap on a connection selects it once', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const target = page.locator('.joint-labels-layer [joint-selector=num]').nth(1), no = (await target.textContent()).trim();
  await target.scrollIntoViewIfNeeded();
  const entries = await page.evaluate(() => history.length);
  await target.tap();
  await expect(page.locator('.ag-wire-row.selected .ag-wire-number')).toHaveText(no);
  expect(await page.evaluate(() => history.length) - entries).toBeLessThanOrEqual(1);
});

test('mouse: dragging a zoomed board pans it and selects no text', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const canvas = page.locator('.ag-board-canvas');
  await page.locator('[data-action=zoom-in]').click();
  await page.locator('[data-action=zoom-in]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.evaluate(() => { document.querySelector('.ag-board-canvas').scrollLeft = 200; });
  const c = centre(await canvas.boundingBox()), left = await canvas.evaluate(el => el.scrollLeft);
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 80, c.y, { steps: 6 }); await page.mouse.up();
  expect(await canvas.evaluate(el => el.scrollLeft)).toBeLessThan(left);
  expect(await page.evaluate(() => getSelection().isCollapsed)).toBe(true);
});

test('wheel: a plain wheel scrolls the page also over a zoomed board, ctrl or cmd with the wheel zooms the board', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const canvas = page.locator('.ag-board-canvas');
  await page.locator('[data-action=zoom-in]').click();
  await page.locator('[data-action=zoom-in]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await canvas.scrollIntoViewIfNeeded();
  expect(await canvas.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const y = await page.evaluate(() => scrollY), top = await canvas.evaluate(el => el.scrollTop);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
  expect(await canvas.evaluate(el => el.scrollTop)).toBe(top);

  const size = await widthOf(page), scrollY0 = await page.evaluate(() => scrollY);
  for (const key of ['Control', 'Meta']) {
    await page.keyboard.down(key);
    await page.mouse.wheel(0, -100);
    await page.keyboard.up(key);
  }
  await expect.poll(() => widthOf(page)).toBeGreaterThan(size);
  expect(await page.evaluate(() => scrollY)).toBe(scrollY0);
  expect(await pageZoom(page)).toBe(1);
  // zoomed out all the way it stops at the whole board
  await page.keyboard.down('Control');
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');
  await expect.poll(() => canvas.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('wheel: at the edge of the nearest scrolling ancestor the next one takes over', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  const canvas = page.locator('.ag-board-canvas');
  await page.locator('[data-action=zoom-in]').click();
  await page.locator('[data-action=zoom-in]').click();
  // an outer scroller around the component, scrolled to its end, and a page below it that can scroll
  await canvas.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const guide = document.querySelector('.ag-guide'), outer = document.createElement('div'), tail = document.createElement('div');
    outer.id = 'outer'; outer.style.cssText = `height:${guide.offsetHeight - 100}px;overflow-y:auto`; tail.style.height = '2000px';
    guide.before(outer); outer.append(guide); outer.after(tail);
    outer.scrollTop = outer.scrollHeight;
  });
  await page.evaluate(() => scrollTo(0, document.querySelector('#outer').getBoundingClientRect().top + scrollY));
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const outer = page.locator('#outer'), outerTop = await outer.evaluate(el => el.scrollTop), y = await page.evaluate(() => scrollY), top = await canvas.evaluate(el => el.scrollTop);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
  expect(await outer.evaluate(el => el.scrollTop)).toBe(outerTop);
  expect(await canvas.evaluate(el => el.scrollTop)).toBe(top);
});

test('phone fullscreen: pinch works, the page behind stays where it was', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${boards[0]}/`); await ready(page);
  await page.locator('[data-action=zoom-fit]').click();
  await page.evaluate(() => scrollTo(0, 300));
  const y = await page.evaluate(() => scrollY);
  await page.locator('[data-action=fullscreen]').click();
  await expect(page.locator('.ag-guide')).toHaveClass(/ag-expanded/);
  const behind = await page.evaluate(() => scrollY);   // the page is shorter while the component is out of its flow
  await page.locator('[data-action=zoom-fit]').click();
  const canvas = page.locator('.ag-board-canvas'), fit = await widthOf(page);
  await pinch(page, await canvas.boundingBox(), 2);
  expect(await widthOf(page)).toBeGreaterThan(fit * 1.5);
  await page.mouse.move(100, 400);
  await page.mouse.wheel(0, 300);
  await swipe(page, await canvas.boundingBox(), -300);
  expect(await page.evaluate(() => scrollY)).toBe(behind);
  await page.locator('[data-action=fullscreen]').click();
  await expect(page.locator('.ag-guide')).not.toHaveClass(/ag-expanded/);
  expect(await page.evaluate(() => scrollY)).toBe(y);
});
