// Browser checks of the docs site: the board on the home page, every page on a phone and a tablet, the navigation menu
// by keyboard and the text contrast in both schemes. The components themselves are tested by packages/core/tests against
// the core, MkDocs and Docusaurus examples.
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const ORIGIN = 'http://127.0.0.1:8080'
const BASE = `${ORIGIN}/BuildGuide/`
const guide = (file) => JSON.parse(readFileSync(new URL(`../../packages/core/example/${file}`, import.meta.url), 'utf8'))
const HOME = guide('minimal/wiring.json')

let problems
test.beforeEach(async ({ page }) => {
  problems = { errors: [], missing: [], external: [] }
  page.on('pageerror', (e) => problems.errors.push(String(e)))
  page.on('response', (r) => r.status() >= 400 && problems.missing.push(r.url()))
  page.on('request', (r) => /^https?:/.test(r.url()) && !r.url().startsWith(ORIGIN) && problems.external.push(r.url()))
  // nothing outside the test server may load: the route only aborts, the listener above reports
  await page.route('**/*', (r) => (r.request().url().startsWith(ORIGIN) || !/^https?:/.test(r.request().url()) ? r.continue() : r.abort()))
})
test.afterEach(() => expect(problems).toEqual({ errors: [], missing: [], external: [] }))

// the components mount after the page has loaded core and the guide data
const settled = async (page) => {
  await page.waitForLoadState('networkidle')
  for (const canvas of await page.locator('.ag-board-canvas').all()) await expect(canvas).toHaveAttribute('data-ready', 'true')
}

test('the site serves core without its declarations and source map, which are for Node only', async ({ request }) => {
  expect((await request.get(`${BASE}assets/buildguide/buildguide.js`)).ok()).toBe(true)
  for (const file of ['buildguide.d.ts', 'buildguide-check.d.mts', 'buildguide-check.mjs.map']) {
    expect((await request.get(`${BASE}assets/buildguide/${file}`)).status(), file).toBe(404)
  }
})

test('home: the board ticks a connection of its own guide, kept over a reload, with the progress tools', async ({ page }) => {
  const [c] = HOME.boards.wiring.steps[0].connections
  const box = page.getByRole('checkbox', { name: `Connection ${c.no}`, exact: true })
  const stored = (key) => page.evaluate((k) => localStorage.getItem(k), key)
  await page.goto(BASE)
  await settled(page)
  await box.check()
  expect(JSON.parse(await stored(HOME.storage))).toEqual({ [`wiring-${c.no}:${c.a}:${c.b}`]: true })
  for (const other of [guide('guide.json'), guide('minimal/all.json')]) expect(await stored(other.storage)).toBeNull()
  await page.reload()
  await settled(page)
  await expect(box).toBeChecked()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export progress' }).click()
  expect((await download).suggestedFilename()).toBe(`${HOME.storage}.json`)
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect(box).not.toBeChecked()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(box).toBeChecked()
})

// the page never scrolls sideways, every control is a 44 px target
const PAGES = ['', 'docusaurus/', 'data-format/', 'theming/', 'example/wiring/', 'example/guide/']
test('pages fit 360, 390 and 820 px with 44 px targets', async ({ page }) => {
  for (const width of [360, 390, 820])
    for (const path of PAGES) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`${BASE}${path}`)
      await settled(page)
      const where = `${path || 'home'} at ${width} px`
      expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBeLessThanOrEqual(width)
      const small = await page.evaluate(() => {
        const shown = (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && e.getBoundingClientRect().width > 0
        // a link inside running text is exempt (WCAG 2.5.8); one alone in its paragraph, list item or table cell is not
        const inline = (a) => {
          const text = a.parentElement.closest(':is(p, li, td, th, dd)')
          return getComputedStyle(a).display === 'inline' && !!text && text.textContent.trim() !== a.textContent.trim()
        }
        const out = []
        for (const e of document.querySelectorAll('a[href], button, input, select, label[for], [role=tab]')) {
          if (!shown(e) || (e.matches('a') && inline(e))) continue
          // a tick box of a component toggles with its label, or alone where it has none: the WCAG 2.2 minimum of 24 px
          const tick = e.matches('.ag-guide input[type=checkbox]')
          const r = (tick ? (e.closest('label') ?? e) : e).getBoundingClientRect()
          const min = tick ? 24 : 44
          if (r.height < min || r.width < min) out.push(`${e.outerHTML.slice(0, 100)}: ${Math.round(r.width)} x ${Math.round(r.height)}`)
        }
        return out
      })
      expect(small, where).toEqual([])
    }
})

// Docusaurus' own menu: closed it takes no focus, the toggle opens it by Enter, every stop in it shows a 2 px ring, a
// link closes it again; the panel not shown is inert
test('the navigation menu works by keyboard at 360, 390 and 820 px, and is a sidebar at 1440 px', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Toggle navigation bar' })
  const menu = page.locator('.navbar-sidebar')
  // Tab from the menu button until the page itself: the stops in the menu
  const stops = async () => {
    await toggle.focus()
    const out = []
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab')
      const f = await page.evaluate(() => {
        const e = document.activeElement
        const o = getComputedStyle(e)
        return { text: (e.getAttribute('aria-label') || e.textContent).trim(), page: !!e.closest('main, footer'), menu: !!e.closest('.navbar-sidebar'), ring: o.outlineStyle !== 'none' && parseFloat(o.outlineWidth) >= 2 }
      })
      if (f.page) return out
      if (f.menu) {
        expect(f.ring, f.text).toBe(true)
        out.push(f.text)
      }
    }
    throw new Error('Tab never reached the page')
  }
  const docs = ['Home', 'Plain HTML', 'Data format', 'Theming and dark mode', 'Two guides']
  for (const width of [360, 390, 820]) {
    const where = `${width} px`
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${BASE}data-format/`)
    expect(await stops(), `${where} closed`).toEqual([])
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // shown once its opening transition has started
    await expect(menu).toBeVisible()
    // a docs page opens the menu on its sidebar: every page, and nothing of the main menu behind it
    let s = await stops()
    expect(s, where).toEqual(expect.arrayContaining(['Close navigation bar', ...docs]))
    expect(s, where).not.toContain('Live example')
    const { violations } = await new AxeBuilder({ page }).include('.navbar-sidebar').withRules(['aria-allowed-role', 'aria-allowed-attr', 'button-name', 'nested-interactive']).analyze()
    expect(violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 80)}`)), where).toEqual([])
    // back to the main menu, then a link: the menu closes on the new page
    await menu.getByRole('button', { name: /main menu/ }).focus()
    await page.keyboard.press('Enter')
    s = await stops()
    expect(s, `${where} main menu`).toEqual(expect.arrayContaining(['Live example', 'Docs']))
    expect(s, `${where} main menu`).not.toContain('Plain HTML')
    await menu.getByRole('link', { name: 'Live example', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/example\/$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // hidden once its closing transition has run
    await expect(menu).toBeHidden()
    expect(await stops(), `${where} after navigation`).toEqual([])
    // and the close button by keyboard
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: 'Close navigation bar' }).focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}data-format/`)
  await expect(toggle).toBeHidden()
  await expect(page.locator('.theme-doc-sidebar-container').getByRole('link', { name: 'Two guides' })).toBeVisible()
})

// every text of the page, the components included, reaches 4.5:1 (3:1 large) in both schemes
for (const scheme of ['light', 'dark'])
  test(`text contrast in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const found = []
    for (const path of ['', 'docusaurus/', 'theming/', 'example/wiring/', 'example/bom/', '404.html']) {
      await page.goto(`${BASE}${path}`)
      await settled(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
      const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      found.push(...violations.flatMap((v) => v.nodes.map((n) => `${path || 'home'}: ${n.target.join(' ')}: ${n.failureSummary?.split('\n').at(-1)}`)))
    }
    expect(found).toEqual([])
  })

// a page without JavaScript has no data-theme, which an inline script sets; axe needs scripts, so the test takes the attribute away
test('text contrast without data-theme, as on a page without JavaScript', async ({ page }) => {
  const found = []
  for (const path of ['docusaurus/', 'data-format/', '404.html']) {
    await page.goto(`${BASE}${path}`)
    await settled(page)
    await page.locator('html').evaluate((html) => html.removeAttribute('data-theme'))
    const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
    found.push(...violations.flatMap((v) => v.nodes.map((n) => `${path}: ${n.target.join(' ')}: ${n.failureSummary?.split('\n').at(-1)}`)))
  }
  expect(found).toEqual([])
})

test('search: the index of the built site answers a query', async ({ page }) => {
  await page.goto(`${BASE}`)
  const hits = await page.evaluate(async (base) => {
    const pagefind = await import(`${base}pagefind/pagefind.js`)
    const search = await pagefind.search('storage')
    return Promise.all(search.results.slice(0, 5).map(async (r) => (await r.data()).url))
  }, BASE)
  expect(hits.length).toBeGreaterThan(0)
  expect(hits.every((url) => url.startsWith('/BuildGuide/'))).toBe(true)
})
