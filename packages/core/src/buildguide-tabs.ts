/* BuildGuide tabs: the combined component, tabs over one panel. buildguide.js loads this file for a data-buildguide="guide" component
   (scan requests it together with the data) and calls the function with its helpers, the root, the data and the mount options; it
   returns a function that unmounts the tabs. Only the shown tab is mounted, so a board is never drawn in a hidden box.
   Hash: one guide=<key> pair next to the boards' own pairs; 'bom' names the BOM. */
window.BuildGuideModules = {...window.BuildGuideModules, tabs: (c, root, D, options) => {
  const {t, esc, own, decode, pairs, nameOf, pairValue, putPair, id} = c;
  const asked = (options.board ?? root.dataset.board ?? '').split(/\s+/).filter(Boolean);
  // 'bom' and, with steps data, 'steps' name the components; any other key is a board
  const text = (k: string) => k === 'steps' && D.steps, component = (k: string) => k === 'bom' || text(k);
  const keys = asked.length ? asked : [...(D.bom ? ['bom'] : []), ...(D.steps ? ['steps'] : []), ...Object.keys(D.boards ?? {})];
  if (!keys.length || keys.some(k => k === 'bom' ? !D.bom : !text(k) && !own(D.boards, k))) { root.textContent = t('unknown', {name: ['guide', ...asked].join(' ')}); return () => {}; }
  const {assets = root.dataset.assets, strings} = options;
  root.classList.add('ag-guide', 'ag-tabbed');
  root.innerHTML = `<div class="ag-tabs" role="tablist" aria-label="${esc(t('guide'))}">${keys.map((k, i) => `<button type="button" role="tab" id="${id}-${i}" aria-controls="${id}">${esc(k === 'bom' ? t('bom') : text(k) ? D.steps?.title || t('stepsTitle') : own(D.boards, k)?.title || k)}</button>`).join('')}</div><div id="${id}" role="tabpanel"></div>`;
  const tabs = [...root.querySelectorAll<HTMLElement>('[role=tab]')], panel = root.lastElementChild as HTMLElement;
  let active = -1, seen = new Map<string | null, string>(), handled: string | null = null, unmount = () => {};
  const show = (i: number) => {
    active = i;
    tabs.forEach((tab, j) => { tab.setAttribute('aria-selected', String(j === i)); tab.tabIndex = j === i ? 0 : -1; });
    panel.setAttribute('aria-labelledby', (tabs[i] as HTMLElement).id);
    const key = keys[i] as string;
    unmount = c.mount(panel, D, component(key) ? {view: key as 'bom' | 'steps', assets, strings} : {view: 'board', board: key, assets, strings});
  };
  // seen: the pairs and handled: the hash this component acted on last
  const sync = () => { seen = read(); handled = location.hash; };
  const select = (i: number) => { if (putPair('guide', encodeURIComponent(keys[i] as string))) { sync(); if (i !== active) show(i); } };
  tabs.forEach((tab, i) => { tab.onclick = () => select(i); });
  (root.firstElementChild as HTMLElement).onkeydown = e => {
    const i = ({ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: keys.length - 1} as Record<string, number | undefined>)[e.key];
    // Alt+Arrow is the browser's history shortcut
    if (typeof i !== 'number' || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); const to = (i + keys.length) % keys.length; select(to); tabs[to]?.focus();
  };
  const read = () => new Map(pairs().filter(p => nameOf(p)).map(p => [nameOf(p), pairValue(p)] as const));
  // Which tab the hash asks for: the one the guide pair names, else the board whose pair changed since the last look (on load: the first pair).
  // Else an anchor or the shown board's own pair leaves the tab as it is, else the first board pair opens its tab, else the first tab shows.
  function follow() {
    // a hash set from outside fires popstate and hashchange: the second finds it handled
    if (location.hash === handled) return;
    const now = read(), named = keys.indexOf(decode(now.get('guide') ?? ''));
    const moved = keys.findIndex((k, i) => i !== active && !component(k) && now.has(k) && now.get(k) !== seen.get(k));
    const stay = pairs().some(p => !nameOf(p)) || now.has(keys[active] as string);
    const target = Math.max(named >= 0 ? named : moved >= 0 ? moved : stay ? active : keys.findIndex(k => !component(k) && now.has(k)), 0);
    sync();
    if (target !== active) show(target);
  }
  // the shown component's listeners come after these, so a changed tab is replaced before the old board hears the event
  window.addEventListener('hashchange', follow); window.addEventListener('popstate', follow);
  follow();
  return () => {
    window.removeEventListener('hashchange', follow); window.removeEventListener('popstate', follow);
    unmount();
    root.replaceChildren(); root.classList.remove('ag-guide', 'ag-tabbed');
  };
}};
