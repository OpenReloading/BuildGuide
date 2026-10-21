// <BuildGuide page="wiring"/>: mounts that page of the guide. Data and URLs come from the plugin's #buildguide-data.
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

export default function BuildGuide({ page }) {
  const root = useRef(null);
  useEffect(() => {
    const el = document.getElementById('buildguide-data');
    const { core: url, site, assets } = el.dataset;
    loadCore(`${url}buildguide.js`)
      .then((B) => B.mount(root.current, JSON.parse(el.textContent), { page, site, assets }))
      .catch(() => {
        if (root.current) root.current.textContent = 'Guide data unavailable.';
      });
  }, [page]);
  // the root stays empty for React: core owns its content
  return React.createElement(React.Fragment, null, React.createElement('div', { id: 'assembly-guide', ref: root }), React.createElement('noscript', null, 'This guide needs JavaScript.'));
}
