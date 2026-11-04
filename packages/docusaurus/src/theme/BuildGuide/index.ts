// <BuildGuide view="bom"/>, <BuildGuide view="steps"/>, <BuildGuide view="board" board="wiring"/> and <BuildGuide view="guide"/>: one guide component, any number per page.
// guide="ID" shows a guide of the plugin's guides option. The URLs come from the plugin's <meta name="buildguide">; the data is fetched once per file (guide.json, guides/ID.json).
// biome-ignore lint/correctness/noUndeclaredDependencies: Docusaurus alias, provided by @docusaurus/core
import { usePluginData } from '@docusaurus/useGlobalData';
import React, { useEffect, useRef } from 'react';

type Core = NonNullable<Window['BuildGuide']>;
type Guide = Parameters<Core['mount']>[1];
/** The props of the component: one BuildGuide view of the site's guide, or of the guide `guide` of the plugin's guides option. */
export interface Props { view: 'bom' | 'steps' | 'board' | 'guide'; board?: string; guide?: string }
/** The plugin's global data: the messages of the site's guide and of each guide of the guides option, from their strings. */
interface Messages { noScript?: string; unavailable?: string }

let core: Promise<Core> | null = null;
// core loads once per full page load; it finds vendor/ and the board renderer next to its own URL
const loadCore = (src: string) =>
  (core ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(window.BuildGuide as Core);
    script.onerror = () => {
      core = null; // the next mount tries again
      reject(new Error(`cannot load ${src}`));
    };
    document.head.appendChild(script);
  }));

const guides = new Map<string, Promise<Guide>>();
// components on one page share the request for a file; a failed one is tried again by the next mount
const loadData = (src: string): Promise<Guide> => {
  let request = guides.get(src);
  if (!request) {
    request = fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`cannot load ${src}`);
        return response.json() as Promise<Guide>;
      })
      .catch((error: unknown) => {
        guides.delete(src);
        throw error;
      });
    guides.set(src, request);
  }
  return request;
};

export default function BuildGuide({ view, board, guide }: Props): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const data = usePluginData('docusaurus-plugin-buildguide') as Messages & { guides: Record<string, Messages> };
  const { noScript, unavailable } = { noScript: 'This guide needs JavaScript.', unavailable: 'Guide data unavailable.', ...(guide ? data.guides[guide] : data) };
  useEffect(() => {
    const { core: url, assets, src } = (document.querySelector('meta[name="buildguide"]') as HTMLMetaElement).dataset;
    let unmount: (() => void) | undefined;
    let gone = false;
    Promise.all([loadCore(`${url}buildguide.js`), loadData(guide ? `${url}guides/${encodeURIComponent(guide)}.json` : `${src}`)])
      .then(([B, D]) => {
        // the component may be gone before core has loaded (navigation, StrictMode)
        if (!gone && root.current) unmount = B.mount(root.current, D, { view, board, assets });
      })
      .catch(() => {
        // not after the effect ran again for another guide: that request owns the root now
        if (!gone && root.current) root.current.textContent = unavailable;
      });
    return () => {
      gone = true;
      unmount?.();
    };
  }, [view, board, guide, unavailable]);
  // the root stays empty for React: core owns its content
  return React.createElement(React.Fragment, null, React.createElement('div', { ref: root }), React.createElement('noscript', null, noScript));
}
