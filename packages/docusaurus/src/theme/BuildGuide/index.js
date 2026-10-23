// <BuildGuide view="bom"/>, <BuildGuide view="board" board="wiring"/> and <BuildGuide view="guide"/>: one guide component, any number per page.
// Data and URLs come from the plugin's #buildguide-data.
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

export default function BuildGuide({ view, board }) {
  const root = useRef(null);
  useEffect(() => {
    const el = document.getElementById('buildguide-data');
    const { core: url, assets } = el.dataset;
    let unmount;
    let gone = false;
    loadCore(`${url}buildguide.js`)
      .then((B) => {
        // the component may be gone before core has loaded (navigation, StrictMode)
        if (!gone) unmount = B.mount(root.current, JSON.parse(el.textContent), { view, board, assets });
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
