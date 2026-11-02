import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

/** Pagefind's search modal. */
const modal = `<pagefind-modal>
  <pagefind-modal-header><pagefind-input></pagefind-input></pagefind-modal-header>
  <pagefind-modal-body>
    <pagefind-summary></pagefind-summary>
    <pagefind-results></pagefind-results>
  </pagefind-modal-body>
  <pagefind-modal-footer><pagefind-keyboard-hints></pagefind-keyboard-hints></pagefind-modal-footer>
</pagefind-modal>`

/** The parts of Pagefind's `window.PagefindComponents` the search box calls. */
interface Pagefind {
  getInstanceManager(): { hasInstance(name: string): boolean }
  configureInstance(name: string, options: object): void
}

/**
 * The navbar search over the index of the built site (scripts/search.mts), Pagefind's elements
 * loaded by the config's `scripts`. The elements rewrite their own children, so they are set
 * after hydration, outside React. The index exists after `docusaurus build` only.
 */
export default function SearchBar(): ReactNode {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // the index sits next to the script under the site's base URL; Pagefind falls back to /pagefind/
    const script = document.querySelector<HTMLScriptElement>(
      'script[src$="pagefind-component-ui.js"]',
    )
    const base = script?.src.replace(/pagefind\/[^/]+$/, '')
    const pagefind = (window as { PagefindComponents?: Pagefind }).PagefindComponents
    if (base && pagefind && !pagefind.getInstanceManager().hasInstance('default'))
      pagefind.configureInstance('default', { bundlePath: `${base}pagefind/` })
    // phone width (the navbar's breakpoint): the icon only, so the site title fits
    const compact = matchMedia('(max-width: 996px)').matches ? ' compact hide-shortcut' : ''
    if (box.current)
      box.current.innerHTML = `<pagefind-modal-trigger${compact}></pagefind-modal-trigger>${modal}`
  }, [])
  return <div ref={box} />
}
