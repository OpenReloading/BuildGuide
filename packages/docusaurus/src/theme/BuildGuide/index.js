// <BuildGuide view="bom"/>, <BuildGuide view="board" board="wiring"/> and <BuildGuide view="guide"/>: one guide component, any number per page.
// The URLs come from the plugin's <meta name="buildguide">; the data is fetched once from guide.json.
import React, { useEffect, useRef } from 'react';

let core;
// core loads once per full page load; it finds vendor/ and the board renderer next to its own URL
const loadCore = (src) =>
  (core ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(window.BuildGuide);
    script.onerror = () => {
      core = null; // the next mount tries again
      reject(new Error(`cannot load ${src}`));
    };
    document.head.appendChild(script);
  }));

let guide;
// components on one page share the request; a failed one is tried again by the next mount
const loadData = (src) =>
  (guide ||= fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`cannot load ${src}`);
      return response.json();
    })
    .catch((error) => {
      guide = null;
      throw error;
    }));

export default function BuildGuide({ view, board }) {
  const root = useRef(null);
  useEffect(() => {
    const { core: url, assets, src } = document.querySelector('meta[name="buildguide"]').dataset;
    let unmount;
    let gone = false;
    Promise.all([loadCore(`${url}buildguide.js`), loadData(src)])
      .then(([B, D]) => {
        // the component may be gone before core has loaded (navigation, StrictMode)
        if (!gone) unmount = B.mount(root.current, D, { view, board, assets });
      })
      .catch(() => {
        if (root.current) root.current.textContent = 'Guide data unavailable.';
      });
    return () => {
      gone = true;
      unmount?.();
    };
  }, [view, board]);
  // the root stays empty for React: core owns its content
  return React.createElement(React.Fragment, null, React.createElement('div', { ref: root }), React.createElement('noscript', null, 'This guide needs JavaScript.'));
}
