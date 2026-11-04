/* BuildGuide components: a BOM checklist, a text step list and board workspaces (wiring, tubing) from one guide data object, alone or behind tabs.
   Markup: <div data-buildguide="bom"></div>, <div data-buildguide="steps"></div>, <div data-buildguide="board" data-board="wiring"></div> or <div data-buildguide="guide"></div>, any number per page,
   plus the data in <script type="application/json" id="guide-data"> (any element with that id) or a data-src="guide.json" URL on the div.
   This file is a script, not a module: it compiles to a classic script, and the declarations below are global. */

/** The saved ticks of one guide, stored as one JSON object under its `storage` key: tick key to ticked or not. */
type BuildGuideProgress = Record<string, boolean>;
/** The options of `BuildGuide.mount`; view, board and assets fall back to the root's `data-buildguide`, `data-board` and `data-assets`.
    `strings` replaces the English texts of the keys it names; the guide's and the board's `strings` win over it. */
interface BuildGuideMountOptions {
  view?: 'bom' | 'steps' | 'board' | 'guide' | undefined; board?: string | undefined; assets?: string | undefined;
  strings?: Partial<Omit<import('./buildguide-check.mjs').Strings, 'noScript'>> | undefined;
}
/** The detail of the `buildguide-progress` event, sent on `document` when a component imports, resets or restores progress. */
interface BuildGuideProgressDetail { storage: string; saved: BuildGuideProgress; before: BuildGuideProgress }
// biome-ignore lint/correctness/noUnusedVariables: merges into the DOM's DocumentEventMap, so document.addEventListener types the event
interface DocumentEventMap { 'buildguide-progress': CustomEvent<BuildGuideProgressDetail> }

// The contracts between this file and the files it loads on demand (buildguide-board.js and buildguide-<name>.js)
/** The text of a key in the component's language, each {name} in it replaced by vars.name (`noScript` is the plugins' own). */
type BuildGuideText = (key: Exclude<keyof import('./buildguide-check.mjs').Strings, 'noScript'>, vars?: Record<string, string | number>) => string;
interface BuildGuideBoardOptions {
  t: BuildGuideText; key: string; name: string; step: number; wire: number; scope: string; zoom: number; base: string; focus?: string | undefined;
  label(connection: import('./buildguide-check.mjs').Connection, end: 'a' | 'b'): string; zoomed?(zoom: number): void; done?(no: string): boolean; select(no: string): void;
}
interface BuildGuideDrawing { destroy(): void; zoomBy(step: number): number; fit(): void; highlight(no: string, on?: boolean): void }
type BuildGuideBoardRenderer = ((root: HTMLElement, board: import('./buildguide-check.mjs').Board, options: BuildGuideBoardOptions) => BuildGuideDrawing) & { wheelFactor?(delta: number, mode?: number): number };
/** What the progress tools get from one component: its state through accessors. */
interface BuildGuideProgressContext {
  D: import('./buildguide-check.mjs').Guide; root: HTMLElement; t: BuildGuideText; download(blob: Blob, name: string): void; isProgress(value: unknown): value is BuildGuideProgress;
  alive(): boolean; say(message: string): void; share(progress: BuildGuideProgress, message: string, before?: BuildGuideProgress): void;
  saved(): BuildGuideProgress; ok(): boolean; fail(): void;
}
type BuildGuideProgressAction = ['export'] | ['reset'] | ['import', File] | ['undo', BuildGuideProgress];
/** What the CSV export and the print list get from one component. */
interface BuildGuideExportContext {
  root: HTMLElement; t: BuildGuideText; board: import('./buildguide-check.mjs').Board | null | undefined; boardKey: string | undefined; bom: Partial<import('./buildguide-check.mjs').Bom>;
  esc(value: unknown): string; label(connection: import('./buildguide-check.mjs').Connection, end: 'a' | 'b'): string; download(blob: Blob, name: string): void;
  parts(): import('./buildguide-check.mjs').BomItem[]; checked(key: string): boolean; connKey(connection: import('./buildguide-check.mjs').Connection): string; bomKey(item: import('./buildguide-check.mjs').BomItem): string;
}
/** What the tabs of the combined component get: core's hash helpers, mount for the panel and an id for the tab elements. */
interface BuildGuideTabsContext {
  t: BuildGuideText; esc(value: unknown): string; own<T>(object: Record<string, T> | undefined, key: string | undefined): T | undefined; decode(value: string): string;
  pairs(): string[]; nameOf(pair: string): string | null; pairValue(pair: string): string; putPair(name: string, value: string): boolean;
  mount(root: HTMLElement, data: import('./buildguide-check.mjs').Guide, options: BuildGuideMountOptions): () => void; id: string;
}
/** The features loaded on first use: buildguide-<name>.js sets window.BuildGuideModules[name]. */
interface BuildGuideModuleMap {
  progress: (context: BuildGuideProgressContext, ...action: BuildGuideProgressAction) => Promise<void>;
  zoom: (context: { root: HTMLElement; t: BuildGuideText }, key: string) => () => void;
  export: (context: BuildGuideExportContext, action: 'csv' | 'print') => void;
  tabs: (context: BuildGuideTabsContext, root: HTMLElement, data: import('./buildguide-check.mjs').Guide, options: BuildGuideMountOptions) => () => void;
}
// biome-ignore lint/correctness/noUnusedVariables: merges into the DOM's Window
interface Window {
  /** Set once buildguide.js has run: mount one component, or scan the page for new ones. */
  BuildGuide?: {
    mount(root: HTMLElement, data: import('./buildguide-check.mjs').Guide, options?: BuildGuideMountOptions): () => void;
    scan(): void;
  };
  BuildGuideModules?: Partial<BuildGuideModuleMap>;
  BuildGuideBoard?: BuildGuideBoardRenderer;
  /** Material for MkDocs instant navigation: the page changed without a reload. */
  document$?: { subscribe(next: () => void): unknown };
}

(() => {
  type Guide = import('./buildguide-check.mjs').Guide;
  type Bom = import('./buildguide-check.mjs').Bom;
  type BomItem = import('./buildguide-check.mjs').BomItem;
  type Board = import('./buildguide-check.mjs').Board;
  type BoardStep = import('./buildguide-check.mjs').BoardStep;
  type Connection = import('./buildguide-check.mjs').Connection;
  type ColorCode = import('./buildguide-check.mjs').ColorCode;
  type Note = import('./buildguide-check.mjs').Note;
  type TextStep = import('./buildguide-check.mjs').TextStep;
  type Progress = BuildGuideProgress;
  // a second evaluation (Material's instant navigation runs the scripts of the new page again) only mounts what is new
  if (window.BuildGuide) { window.BuildGuide.scan(); return; }
  const HERE = new URL('.', (document.currentScript as HTMLScriptElement).src);
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  // guide data may come from anyone: URLs from it resolve to web or file locations only, anything else becomes '#'
  const safeURL = (value: string, base: string | URL) => { try { const u = new URL(value, base); if (/^(https?|file):$/.test(u.protocol)) return u.href; } catch {} return '#'; };
  const decode = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
  // end of a fire-and-forget promise: a refused fullscreen request or unreadable import has nothing to report
  const ignore = () => {};
  const button = (text: string, action: string, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(text)}</button>`;
  // Every text the components show or speak, by key (the keys are STRING_KEYS of buildguide-check.mts). A mount takes these,
  // then the strings of the mount options, of the guide data and of the board, each replacing the keys it names.
  // {name} is filled in at use; the plugins keep the English noScript text themselves.
  // --8<-- [start:strings]
  const EN: Omit<import('./buildguide-check.mjs').Strings, 'noScript'> = {
    // the status line and the progress tools
    saved: 'Progress saved in this browser.',
    notSaved: 'Storage unavailable: progress is not saved.',
    exportProgress: 'Export progress',
    importProgress: 'Import progress',
    progressFile: 'Progress file',
    resetProgress: 'Reset progress',
    undo: 'Undo',
    imported: 'Progress imported.',
    importedNotSaved: 'Imported, but storage is unavailable: progress is not saved.',
    notProgress: 'Not imported: the file is not a progress export.',
    tooLarge: 'Not imported: the file is larger than 1 MB.',
    reset: 'Progress reset.',
    resetNotSaved: 'Reset for this visit: storage is unavailable.',
    restored: 'Progress restored.',
    restoredNotSaved: 'Restored for this visit: storage is unavailable.',
    toolsFailed: 'Progress tools did not load. Try again.',
    // the count of a component: {what} is the word for its items below
    checked: '{n} / {m} checked',
    allChecked: 'All {what} checked',
    whatChecked: '{what} checked',
    parts: 'parts',
    steps: 'steps',
    connections: 'connections',
    print: 'Print',
    exportCsv: 'Export CSV',
    exportFailed: 'Export did not load. Try again.',
    // the BOM, its CSV and the enlarged image
    bom: 'Bill of materials',
    find: 'Find a component…',
    search: 'Search BOM',
    showParts: 'Show parts',
    all: 'All',
    missing: 'Missing',
    done: 'Done',
    noMatch: 'No matching components.',
    filter: 'Filter: {filter}.',
    qty: 'Qty',
    component: 'Component',
    specification: 'Specification',
    quantity: 'Quantity',
    group: 'Group',
    components: '{n} / {m} components',
    link: 'Link',
    enlarge: 'Enlarge image: {name}',
    image: 'Image',
    close: 'Close',
    zoomFailed: 'Image zoom did not load. Try again.',
    // the text steps
    stepsTitle: 'Steps',
    usesParts: 'Parts: {parts}',
    note: 'note',
    caution: 'caution',
    warning: 'warning',
    // a board: {title} is the board's title, {lower} the same in lower case
    stepsOf: '{title} steps',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fit: 'Fit',
    show: 'Show',
    visible: 'Visible connections',
    thisStep: 'This step',
    selectedConnection: 'Selected connection',
    allConnections: 'All connections',
    from: 'From',
    to: 'To',
    cable: 'Cable',
    ringEnd: 'Ring end',
    plainEnd: 'Plain end',
    markChecked: 'Mark checked',
    isChecked: 'Checked',
    loading: 'Loading board…',
    previous: 'Previous',
    nextStep: 'Next step',
    nextConnection: 'Next connection',
    lastConnection: 'Last connection',
    inStep: 'Connections in this step',
    allOf: 'All {lower} connections',
    connection: 'Connection {no}',
    boardLabel: '{name}. Select a numbered connection to inspect it.',
    connectionLabel: '{no}: {a} to {b}',
    ringAt: 'ring at {a}',
    checkedLabel: 'checked',
    noRenderer: 'Board renderer unavailable. Use the connection list below.',
    noRouter: 'Router unavailable. Use the labeled connection list below.',
    // the columns of a board's CSV and print list
    number: 'No',
    color: 'Color',
    size: 'Size',
    yes: 'Yes',
    no: 'No',
    byStep: 'All connections by step',
    // the combined guide and the errors of a component
    guide: 'Guide',
    tabsFailed: 'Guide tabs did not load.',
    unknown: 'Unknown guide component: {name}.',
    unavailable: 'Guide data unavailable.',
  };
  // --8<-- [end:strings]
  const download = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const loaded: Record<string, Promise<unknown>> = {};
  // a failed load is not cached: the next render tries again
  const loadScript = (src: string) => loaded[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('cannot load ' + src));
    document.head.appendChild(s);
  }).catch(error => { delete loaded[src]; throw error; });
  // the renderer sets window.BuildGuideBoard; a file that does not fails at the first call, which the caller catches
  const boardRenderer = () => loadScript(new URL('vendor/joint/joint.min.js', HERE).href)
    .then(() => loadScript(new URL('buildguide-board.js', HERE).href)).then(() => window.BuildGuideBoard as BuildGuideBoardRenderer);
  // a feature loaded on first use: buildguide-<name>.js next to this file sets window.BuildGuideModules[name]; a file that does not is not cached
  const ext = <K extends keyof BuildGuideModuleMap>(name: K, src = new URL(`buildguide-${name}.js`, HERE).href) => loadScript(src).then(() => {
    const run = window.BuildGuideModules?.[name];
    if (typeof run !== 'function') { delete loaded[src]; throw Error('no module in ' + src); }
    return run as BuildGuideModuleMap[K];
  });

  const mounted = new WeakMap<HTMLElement, () => void>();
  let tabSeq = 0;
  // Undo of a reset or import, one per page: until the next tick, a change elsewhere or 10 s
  let undo: { before: Progress; root: HTMLElement; timer: number } | null | undefined;
  const dropUndo = () => { clearTimeout(undo?.timer); undo?.root.querySelector('.ag-message')?.replaceChildren(); undo = null; };
  // data keys come from anyone: only own properties count, never Object.prototype's
  const own = <T,>(object: Record<string, T> | undefined, key: string | undefined) => Object.hasOwn(object ?? {}, key as string) ? object?.[key as string] : undefined;
  // the page-wide hash holds one key=value pair per board, so boards on one page keep their own position
  const pairs = () => location.hash.slice(1).split('&').filter(Boolean);
  // a fragment without = is an anchor (#wiring), never a board's position
  const nameOf = (pair: string) => pair.includes('=') ? decode(pair.split('=')[0] as string) : null;
  const pairValue = (pair: string) => pair.slice(pair.indexOf('=') + 1);
  // the pair of name keeps its place among the others. False when pushState failed and the hash was set instead (hashchange follows)
  function putPair(name: string, value: string) {
    const mine = `${encodeURIComponent(name)}=${value}`, all = pairs();
    const next = (all.some(p => nameOf(p) === name) ? all.map(p => nameOf(p) === name ? mine : p) : [...all, mine]).join('&');
    // pushState, not location.hash: no popstate, which Material's instant navigation answers by swapping the whole page
    if (location.hash.slice(1) !== next) { try { history.pushState(history.state, '', `${location.pathname}${location.search}#${next}`); } catch { location.hash = next; return false; } }
    return true;
  }

  function mount(root: HTMLElement, D: Guide, options: BuildGuideMountOptions = {}): () => void {
    mounted.get(root)?.();
    const view = options.view ?? root.dataset.buildguide, boardKey = options.board ?? root.dataset.board;
    const board = view === 'board' ? own(D.boards, boardKey) : null;
    // guide data comes from anyone: a key without a text keeps the English one, String() keeps any other value from breaking the component
    const S = {...EN, ...options.strings, ...D.strings, ...board?.strings};
    const t: BuildGuideText = (key, vars = {}) => String(S[key] ?? EN[key]).replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m));
    if (view === 'guide') {
      // buildguide-tabs.js: scan() mounts once it is here, so the tabs draw at once; a mount before it loads returns an unmount that works meanwhile
      let stop = () => {};
      const destroy = () => { if (mounted.get(root) === destroy) { mounted.delete(root); stop(); } };
      const start = (run: BuildGuideModuleMap['tabs']) => { if (mounted.get(root) === destroy) stop = run({t, esc, own, decode, pairs, nameOf, pairValue, putPair, mount, id: `ag-tabs-${++tabSeq}`}, root, D, options); };
      mounted.set(root, destroy);
      const tabs = window.BuildGuideModules?.tabs;
      if (tabs) start(tabs); else ext('tabs').then(start).catch(error => { console.error(error); if (mounted.get(root) === destroy) root.textContent = t('tabsFailed'); });
      return destroy;
    }
    if (view === 'bom' ? !D.bom : view === 'steps' ? !D.steps : !board) { root.textContent = t('unknown', {name: `${view}${boardKey ? ' ' + boardKey : ''}`}); return () => {}; }
    const ASSETS = new URL(options.assets ?? root.dataset.assets ?? 'assets/', location.href);
    const steps = board?.steps || [];
    // the key, title and prefix of a board; only a board view reads them
    const title = (board?.title || boardKey) as string;
    const prefix = board?.prefix || boardKey;
    let persistent = true, saved: Progress = {};
    const load = (): Progress => {
      let raw: string | null = null, found: Progress = {};
      try { raw = localStorage.getItem(D.storage); } catch { persistent = false; }
      try { found = JSON.parse(raw || '{}') || {}; } catch {}
      return typeof found === 'object' && !Array.isArray(found) ? found : {};
    };
    saved = load();
    const checked = (key: string) => saved[key] === true;
    // other components on the page store into the same object: merge what is stored into the copy in memory before each write,
    // so ticks survive in memory when the storage is blocked or full
    const save = (key: string, value: boolean) => { dropUndo(); saved = {...saved, ...load()}; saved[key] = value; try { localStorage.setItem(D.storage, JSON.stringify(saved)); } catch { persistent = false; } };
    // a tick belongs to one exact connection: change either end and it is unchecked again
    const connKey = (c: Connection) => `${prefix}-${c.no}:${c.a}:${c.b}`, bomKey = (p: BomItem) => `bom-${p.id}:${p.part}`;
    const count = <T,>(list: T[], key: (item: T) => string) => list.filter(x => checked(key(x))).length;
    const stepKey = (s: TextStep) => `step-${s.id}`;
    const all = () => steps.flatMap(s => s.connections);
    const tally = (): [number, number] => view === 'steps' ? [count(textSteps, stepKey), textSteps.length] : board ? [count(all(), connKey), all().length] : [count(items, bomKey), items.length];
    const what = t(board ? 'connections' : view === 'steps' ? 'steps' : 'parts');
    let wasDone: boolean | undefined;
    const state: { step: number; wire: number; scope: string; zoom: number; expanded: boolean; search: string; filter: 'All' | 'Missing' | 'Done'; message: string; pageY?: number } =
      {step: 0, wire: 0, scope: board?.scope || 'step', zoom: 0, expanded: false, search: '', filter: 'All', message: ''};
    const end = (e: string) => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)] as const; };
    // the note of a step, a string or {level, text}, in a board step and in a text step; a level the table lacks is shown as written
    const noteLine = (note?: Note) => {
      if (!note) return '';
      const {level, text} = typeof note === 'string' ? {level: '', text: note} : note;
      return `<p class="ag-step-note" data-level="${esc(level)}">${level ? `<strong>${esc(own(S, level) ?? level)}</strong> ` : ''}${esc(text)}</p>`;
    };
    const label = (c: Connection, side: 'a' | 'b') => c[('l' + side) as 'la' | 'lb'] ?? (([id, pin]) => `${own(B().parts, id)?.name ?? id} · ${pin}`)(end(c[side]));
    const color = (c: Connection): Partial<ColorCode> => own(B().colors, c.color) || {};
    const hashOf = (s: BoardStep, c: Connection) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');
    // the board of a board view (the functions that read it run only there)
    const B = () => board as Board;
    const stepAt = (i: number) => steps[i] as BoardStep;
    const cleanups: (() => void)[] = [];
    const listen = <E extends Event>(target: EventTarget, type: string, handler: (e: E) => void) => { target.addEventListener(type, handler as EventListener); cleanups.push(() => target.removeEventListener(type, handler as EventListener)); };
    cleanups.push(() => undo?.root === root && dropUndo());
    const line = (m: string) => esc(m) + (undo?.root === root ? ' ' + button(t('undo'), 'undo-progress') : '');

    function navigate(index = 0, wire = 0) {
      const s = stepAt(index);
      if (putPair(boardKey as string, hashOf(s, s.connections[wire] as Connection))) { readHash(); render(); }
    }
    // true when this board's position changed. A foreign fragment such as #intro stays in the hash; scan() scrolls to it,
    // because once a board pair follows it the whole fragment is the anchor name and the browser finds no element
    function readHash() {
      if (!board) return false;
      const mine = pairs().find(p => nameOf(p) === boardKey);
      // no pair of this board (a heading anchor, another tool's hash): the board stays where it is
      if (mine === undefined) return false;
      const bits = pairValue(mine).split('/').map(decode);
      const {step, wire} = state;
      const i = steps.findIndex(s => s.id === bits[0]); state.step = i >= 0 ? i : 0;
      const j = stepAt(state.step).connections.findIndex(c => c.no === bits[1]); state.wire = j >= 0 ? j : 0;
      return state.step !== step || state.wire !== wire;
    }

    // a render replaces the markup: the focused control is found again by its attribute
    function focusSelector() {
      const el = document.activeElement;
      if (!el || !root.contains(el)) return null;
      for (const name of ['data-action', 'data-step', 'data-conn', 'data-role', 'data-zoom']) if (el.hasAttribute(name)) return `[${name}="${CSS.escape(el.getAttribute(name) as string)}"]`;
      return null;
    }
    // a board's drawing until the renderer has loaded: dead once replaced, inner once drawn
    type Drawing = BuildGuideDrawing & { dead?: boolean; inner?: BuildGuideDrawing };
    let drawing: Drawing | null | undefined, stopSizing: (() => void) | undefined;
    function render() {
      const refocus = focusSelector();
      // a connection path is drawn again once the renderer is ready: it takes the focus back then
      const active = document.activeElement as HTMLElement | null, focusConn = active && root.contains(active) ? active.dataset?.connection : undefined;
      stopSizing?.();
      drawing?.destroy(); drawing = null;
      root.classList.add('ag-guide');
      if (board) root.style.setProperty('--ag-board-ratio', board.size.join(' / '));
      root.classList.toggle('ag-expanded', state.expanded);
      let message = state.message; state.message = '';
      const [n, m] = tally(), done = m > 0 && n === m;
      // announced once, when the last tick arrives: not at mount and not on later renders
      const last = done && wasDone === false && !message;
      if (last) message = t('allChecked', {what});
      wasDone = done;
      root.toggleAttribute('data-complete', done);
      root.innerHTML = `${board ? renderBoard() : view === 'steps' ? renderSteps() : renderBOM()}<p class="ag-status">${esc(t(persistent ? 'saved' : 'notSaved'))}</p>
        <div class="ag-progress-tools">${button(t('exportProgress'), 'export-progress')}${button(t('importProgress'), 'import-progress')}<input type="file" accept=".json,application/json" data-role="import-file" aria-label="${esc(t('progressFile'))}" hidden>${button(t('resetProgress'), 'reset-progress')}<span class="ag-message" role="status">${message ? '' : line('')}</span></div>`;
      // a live region announces text added to an existing element, not text that arrives with it
      if (message) setTimeout(() => { const live = root.querySelector('.ag-message'); if (live && alive() && (!last || root.hasAttribute('data-complete'))) { live.innerHTML = line(message); bind(); } }, 50);
      bind();
      if (board) {
        void exporter('print');
        const canvas = root.querySelector('.ag-board-canvas') as HTMLElement;
        drawing = {destroy() { this.dead = true; this.inner?.destroy(); }, zoomBy(d) { return this.inner?.zoomBy(d) ?? state.zoom; }, fit() { this.inner?.fit(); }, highlight(...a) { this.inner?.highlight(...a); }}; const rendered = drawing;
        boardRenderer().then(mountBoard => {
          if (rendered.dead) return;
          rendered.inner = mountBoard(canvas, board, {t, key: boardKey as string, name: board.label || title, step: state.step, wire: state.wire, scope: state.scope, zoom: state.zoom, zoomed: value => { state.zoom = value; }, base: new URL('vendor/libavoid/', HERE).href,
            focus: focusConn, done: no => checked(connKey(all().find(c => c.no === no) as Connection)),
            label, select(no) { const i = steps.findIndex(s => s.connections.some(c => c.no === no)); navigate(i, stepAt(i).connections.findIndex(c => c.no === no)); }});
        }).catch(error => { console.error(error); canvas.textContent = t('noRenderer'); canvas.dataset.ready = 'error'; });
        root.querySelectorAll<HTMLElement>('[data-wire]').forEach(row => {
          const no = (stepAt(state.step).connections[Number(row.dataset.wire)] as Connection).no;
          row.onmouseenter = () => drawing?.highlight(no, true);
          row.onmouseleave = () => drawing?.highlight(no, no === stepAt(state.step).connections[state.wire]?.no);
        });
        stopSizing = fitWorkspace();
      }
      updateScreenButton();
      if (refocus) root.querySelector<HTMLElement>(refocus)?.focus({preventScroll: true});
      const strip = root.querySelector('.ag-steps'), current = strip?.querySelector('[aria-current]');
      if (strip && current) { const a = strip.getBoundingClientRect(), b = current.getBoundingClientRect(); strip.scrollLeft += b.left - a.left - (a.width - b.width) / 2; }
    }
    function fitWorkspace() {
      const canvas = root.querySelector('.ag-board-canvas') as HTMLElement;
      let frame = 0;
      const fit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (state.expanded) return;
          // the same breakpoint as the stylesheet's container query
          const below = root.querySelectorAll(root.clientWidth >= 900 ? '.ag-board-legend' : '.ag-board-legend, .ag-connection-detail, .ag-wire-navigation');
          const reserved = [...below].reduce((sum, el) => {
            const style = getComputedStyle(el);
            return sum + el.getBoundingClientRect().height + Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom);
          }, 14);
          // as tall as the window leaves below the component's top, at least half the screen or the diagram's height at full width
          const top = canvas.getBoundingClientRect().top - root.getBoundingClientRect().top, [w, h] = B().size;
          const floor = Math.min(Math.round(window.innerHeight * .5), Math.round(canvas.clientWidth * h / w));
          canvas.style.setProperty('--ag-canvas-height', Math.max(floor, window.innerHeight - top - reserved) + 'px');
        });
      };
      const observer = new ResizeObserver(fit);
      for (const el of root.querySelectorAll('.ag-steps, .ag-work-heading, .ag-board-toolbar, .ag-board-legend, .ag-connection-detail, .ag-wire-navigation')) observer.observe(el);
      observer.observe(root);
      window.addEventListener('resize', fit); fit();
      return () => { observer.disconnect(); window.removeEventListener('resize', fit); cancelAnimationFrame(frame); };
    }
    function stepNavigation() {
      return `<nav class="ag-steps" aria-label="${esc(t('stepsOf', {title}))}">${steps.map((s, i) => {
        const total = s.connections.length, done = count(s.connections, connKey);
        return `<button type="button" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''}><span class="ag-step-id ${done === total ? 'complete' : ''}">${done === total ? '✓' : esc(s.id)}</span><span><b>${esc(s.title)}</b><small>${done} / ${total}</small></span></button>`;
      }).join('')}</nav>`;
    }
    function toolbar() {
      return `<div class="ag-board-toolbar"><div class="ag-board-controls">${button('⛶ ' + t('fullscreen'), 'fullscreen', 'class="ag-fullscreen-button"')}${button('−', 'zoom-out', `aria-label="${esc(t('zoomOut'))}"`)}${button(t('fit'), 'zoom-fit')}${button('+', 'zoom-in', `aria-label="${esc(t('zoomIn'))}"`)}</div><label>${esc(t('show'))} <select data-role="scope" aria-label="${esc(t('visible'))}"><option value="step">${esc(t('thisStep'))}</option>${B().single ? `<option value="single">${esc(t('selectedConnection'))}</option>` : ''}<option value="all">${esc(t('allConnections'))}</option></select></label></div>`;
    }
    function connectionSummary(c: Connection) {
      const diode = color(c).diode, key = connKey(c), cable = diode ? '' : [c.cable, c.size].filter(Boolean).join(' · ');
      return `<div class="ag-connection-detail"><div><small>${esc(t('from') + (diode ? ' · ' + t('ringEnd') : ''))}</small><strong>${esc(label(c, 'a'))}</strong></div><span class="ag-detail-arrow">→</span><div><small>${esc(t('to') + (diode ? ' · ' + t('plainEnd') : ''))}</small><strong>${esc(label(c, 'b'))}</strong></div>${cable ? `<div class="ag-cable"><small>${esc(t('cable'))}</small><strong>${esc(cable)}</strong></div>` : ''}<label class="ag-verify"><input type="checkbox" data-check="${esc(key)}" ${checked(key) ? 'checked' : ''}>${esc(t(checked(key) ? 'isChecked' : 'markChecked'))}</label></div>`;
    }
    const legendItem = (l: NonNullable<Board['legend']>[number]) => typeof l === 'string' ? `<span>${esc(l)}</span>` : `<span>${l.key === 'diode' ? '<i class="ag-diode-key"></i>' : ''}${esc(l.text)}</span>`;
    function progress() {
      const [n, m] = tally();
      return `<span class="ag-progress">${esc(m > 0 && n === m ? t('allChecked', {what}) : t('checked', {n, m}))}<progress value="${n}" max="${m}" aria-label="${esc(t('whatChecked', {what}))}"></progress></span>`;
    }
    const actions = () => `<div class="ag-bom-actions">${progress()}${button(t('print'), 'print', 'class="ag-quiet"')}${button('↓ ' + t('exportCsv'), 'export', 'class="ag-primary"')}</div>`;
    function renderBoard() {
      const b = B(), s = stepAt(state.step), c = s.connections[state.wire] as Connection;
      const atEnd = state.step === steps.length - 1 && state.wire === s.connections.length - 1;
      const first = state.step === 0 && state.wire === 0;
      const next = t(state.wire === s.connections.length - 1 ? 'nextStep' : 'nextConnection') + ' →';
      const listed = b.listAll ? all() : s.connections;
      return `<section class="ag-workspace"><div class="ag-head">${actions()}</div>${stepNavigation()}<div class="ag-work"><div class="ag-work-heading"><h2>${esc(s.title)}</h2></div>
      ${toolbar()}
      <div class="ag-panel ag-full-board"><div class="ag-board-canvas" tabindex="0" role="region" aria-label="${esc(b.label || title)}"><span class="ag-board-loading">${esc(t('loading'))}</span></div><div class="ag-board-legend">${(b.legend || []).map(legendItem).join('')}</div></div>
      ${connectionSummary(c)}
      <div class="ag-wire-navigation">${button('← ' + t('previous'), 'prev-wire', `class="ag-quiet" ${first ? 'disabled' : ''}`)}<span>${state.wire + 1} / ${s.connections.length}</span>${button(atEnd ? t('lastConnection') : next, 'next-wire', `class="ag-primary" ${atEnd ? 'disabled' : ''}`)}</div>
      ${noteLine(s.note)}
      <div class="ag-list-heading"><h3>${esc(b.listAll ? t('allOf', {title, lower: title.toLowerCase()}) : t('inStep'))}</h3></div><div class="ag-wire-list">${listed.map(v => connectionRow(v, v === c, s.connections.indexOf(v))).join('')}</div>
      <div class="ag-bom-table ag-print-list"></div></div></section>`;
    }
    function connectionRow(c: Connection, selected: boolean, index: number) {
      const key = connKey(c), done = checked(key), swatch = B().listColor !== false && !color(c).diode ? color(c).swatch || color(c).line : null, paint = swatch && CSS.supports('color', swatch);
      const target = `data-conn="${esc(c.no)}" ` + (index >= 0 ? `data-wire="${index}"` : `data-goto="${esc(c.no)}"`);
      return `<div class="ag-wire-row ${selected ? 'selected' : ''} ${done ? 'is-done' : ''}"><input type="checkbox" data-check="${esc(key)}" aria-label="${esc(t('connection', {no: c.no}))}" ${done ? 'checked' : ''}><button type="button" ${target} ${selected ? 'aria-current="true"' : ''}><span class="ag-wire-number">${esc(c.no)}</span><span>${esc(label(c, 'a'))}</span><span class="ag-row-arrow">→</span><span>${esc(label(c, 'b'))}</span>${paint ? `<span class="ag-row-color"><i style="--wire:${esc(swatch)}"></i>${esc(c.color)}</span>` : ''}</button></div>`;
    }
    const bom: Partial<Bom> = D.bom || {}, items = bom.items || [], textSteps = D.steps?.items || [];
    const filteredParts = () => items.filter(p => `${p.part} ${p.spec ?? ''} ${p.group}`.toLowerCase().includes(state.search.toLowerCase()) && (state.filter === 'All' || checked(bomKey(p)) === (state.filter === 'Done')));
    function renderBOM() {
      return `<section class="ag-bom"><div class="ag-head"><div>${bom.note ? `<p>${esc(bom.note)}</p>` : ''}</div>${actions()}</div><div class="ag-bom-tools"><label class="ag-search"><input type="search" data-role="search" placeholder="${esc(t('find'))}" aria-label="${esc(t('search'))}" value="${esc(state.search)}"></label><select data-role="filter" aria-label="${esc(t('showParts'))}">${(['All', 'Missing', 'Done'] as const).map(v => `<option value="${v}">${esc(t(v.toLowerCase() as Lowercase<typeof v>))}</option>`).join('')}</select></div><div class="ag-bom-results">${bomRows()}</div></section>`;
    }
    function renderSteps() {
      const row = (s: TextStep, i: number) => {
        const done = checked(stepKey(s)), parts = (s.parts || []).map(id => items.find(p => p.id === id)?.part ?? id);
        return `<li class="ag-step-item ${done ? 'is-done' : ''}"><label class="ag-have"><input type="checkbox" data-check="${esc(stepKey(s))}" aria-label="${esc(s.title)}" ${done ? 'checked' : ''}></label><span class="ag-step-id ${done ? 'complete' : ''}" aria-hidden="true">${i + 1}</span><div class="ag-step-body"><strong class="ag-step-title">${esc(s.title)}</strong>${s.text ? `<p class="ag-step-text">${esc(s.text)}</p>` : ''}${noteLine(s.note)}${parts.length ? `<p class="ag-step-parts">${esc(t('usesParts', {parts: parts.join(', ')}))}</p>` : ''}</div></li>`;
      };
      return `<section class="ag-text-steps"><div class="ag-head"><div>${D.steps?.note ? `<p>${esc(D.steps.note)}</p>` : ''}</div><div class="ag-bom-actions">${progress()}${button(t('print'), 'print', 'class="ag-quiet"')}</div></div><ol class="ag-step-list">${textSteps.map(row).join('')}</ol></section>`;
    }
    const groupTally = (g: string) => { const of = items.filter(p => p.group === g); return `${count(of, bomKey)} / ${of.length}`; };
    function bomRows() {
      const parts = filteredParts();
      if (!parts.length) return `<div class="ag-empty">${esc(t('noMatch') + (state.filter === 'All' ? '' : ' ' + t('filter', {filter: t(state.filter.toLowerCase() as Lowercase<typeof state.filter>)})))}</div>`;
      let group = '';
      const row = (p: BomItem) => {
        const head = p.group !== group ? `<tr class="ag-group"><th colspan="3" scope="rowgroup">${esc(p.group)} · ${groupTally(p.group)}</th></tr>` : ''; group = p.group;
        const link = p.link ? ` <a class="ag-source-link" href="${esc(safeURL(p.link, location.href))}" target="_blank" rel="noopener">${esc(bom.linkLabel || t('link'))} ↗</a>` : '';
        const done = checked(bomKey(p));
        return `${head}<tr class="${done ? 'is-done' : ''}"><td class="ag-qty"><label class="ag-have"><input type="checkbox" data-check="${esc(bomKey(p))}" aria-label="${esc(p.part)}" ${done ? 'checked' : ''}>${esc(p.qty)}</label></td><td><div class="ag-part-cell">${p.image ? `<button type="button" class="ag-zoom" data-zoom="${esc(p.id)}" aria-label="${esc(t('enlarge', {name: p.imageAlt || p.part}))}"><img src="${esc(safeURL(p.image, ASSETS))}" alt="${esc(p.imageAlt)}" loading="lazy"></button>` : ''}<div><strong>${esc(p.part)}</strong></div></div></td><td>${esc(p.spec)}${link}</td></tr>`;
      };
      return `<div class="ag-bom-table"><table class="ag-table"><caption class="ag-sr">${esc(t('bom'))}</caption><thead><tr>${(['qty', 'component', 'specification'] as const).map(k => `<th scope="col">${esc(t(k))}</th>`).join('')}</tr></thead><tbody>${parts.map(row).join('')}</tbody></table></div><p class="ag-result-count">${esc(t('components', {n: parts.length, m: items.length}))}</p>`;
    }
    // progress files hold one object of true/false values
    const isProgress = (v: unknown): v is Progress => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'boolean');
    // every mounted component takes the new object, so a later tick does not write the old ticks back
    const shareProgress = (progress: Progress, message: string, before?: Progress) => {
      dropUndo();
      state.message = message;
      if (before) undo = {before, root, timer: setTimeout(dropUndo, 1e4)};
      document.dispatchEvent(new CustomEvent('buildguide-progress', {detail: {storage: D.storage, saved: progress, before: before || {}}}));
    };
    listen(document, 'buildguide-progress', ({detail: d}: CustomEvent<BuildGuideProgressDetail | undefined>) => { if (d?.storage === D.storage && isProgress(d.saved)) { if (d.before !== undo?.before) dropUndo(); Object.assign(d.before || {}, {...saved, ...d.before}); saved = {...d.saved}; render(); } });
    // another tab ticked, imported or reset: show what it stored (key null: storage cleared); sessionStorage events do not count
    const area = () => { try { return localStorage; } catch { return undefined; } };
    listen(window, 'storage', (e: StorageEvent) => { if (e.storageArea === area() && (e.key === D.storage || e.key === null)) { dropUndo(); saved = load(); render(); } });
    const alive = () => mounted.get(root) === destroy;
    const say = (m: string) => { state.message = m; render(); };
    // export, import, reset and undo: buildguide-progress.js, with the state of this component through accessors
    const tools = (...a: BuildGuideProgressAction) => ext('progress').then<unknown, unknown>(run => alive() && run({D, root, t, download, isProgress, alive, say, share: shareProgress,
      saved: () => ({...saved, ...load()}), ok: () => persistent, fail() { persistent = false; }}, ...a),
    () => alive() && say(t('toolsFailed')));
    // a BOM image in a dialog: buildguide-zoom.js, which returns a function that closes it. A second click while the file loads does nothing
    let zooming: Promise<unknown> | null = null;
    const zoom = (b: HTMLElement) => { if (!zooming) zooming = ext('zoom').then(run => alive() && cleanups.push(run({root, t}, b.dataset.zoom as string)), () => alive() && say(t('zoomFailed'))).finally(() => { zooming = null; }); };
    // CSV of the BOM or a board and a board's print list: buildguide-export.js, loaded when a board renders (printing cannot wait for a load) or on Export CSV
    const exporter = (action: 'csv' | 'print') => ext('export').then(run => alive() && run({root, t, board, boardKey, bom, esc, label, download, parts: filteredParts, checked, connKey, bomKey}, action),
      () => action === 'csv' && alive() && say(t('exportFailed')));
    function moveWire(dir: number) {
      let i = state.step, j = state.wire + dir;
      if (j < 0) { i--; if (i < 0) return; j = stepAt(i).connections.length - 1; }
      if (j >= stepAt(i).connections.length) { i++; j = 0; }
      if (i >= steps.length) return;
      navigate(i, j);
    }
    function updateScreenButton() { root.querySelectorAll('[data-action=fullscreen]').forEach(b => { b.textContent = state.expanded ? '⤢ ' + t('exitFullscreen') : '⛶ ' + t('fullscreen'); b.setAttribute('aria-pressed', String(state.expanded)); }); }
    function setExpanded(value: boolean) {
      if (value) state.pageY = scrollY;
      state.expanded = value;
      root.classList.toggle('ag-expanded', value); document.body.classList.toggle('ag-no-scroll', value); updateScreenButton();
      if (!value && state.pageY != null) scrollTo({top: state.pageY, behavior: 'instant'});   // the page was shorter meanwhile
    }
    async function toggleScreen() {
      if (state.expanded) { if (document.fullscreenElement === root) await document.exitFullscreen(); setExpanded(false); }
      else { setExpanded(true); try { await root.requestFullscreen(); } catch {} }
    }
    listen(document, 'fullscreenchange', () => { if (state.expanded && document.fullscreenElement !== root) setExpanded(false); });
    listen(document, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && state.expanded && document.fullscreenElement !== root) toggleScreen().catch(ignore); });
    function bindChecks(scope: ParentNode) {
      // a BOM row toggles its tick wherever you click it (the box, its label and links keep their own click)
      for (const box of scope.querySelectorAll<HTMLInputElement>('.ag-bom-table [data-check]')) (box.closest('tr') as HTMLElement).onclick = e => { if (!(e.target as Element).closest('input,label,a,button')) box.click(); };
      for (const b of scope.querySelectorAll<HTMLElement>('[data-zoom]')) b.onclick = () => zoom(b);
      for (const box of scope.querySelectorAll<HTMLInputElement>('[data-check]')) box.onchange = () => {
        const key = box.dataset.check as string, sel = `[data-check="${CSS.escape(key)}"]`, index = [...root.querySelectorAll(sel)].indexOf(box);
        save(key, box.checked); render();
        // a row the filter hides is gone: the filter takes the focus
        (root.querySelectorAll<HTMLElement>(sel)[index] ?? root.querySelector<HTMLElement>('[data-role=filter]'))?.focus({preventScroll: true});
      };
    }
    function bind() {
      for (const select of root.querySelectorAll('select')) { const role = select.dataset.role as 'scope' | 'filter'; select.value = state[role]; select.onchange = () => { if (role === 'scope') state.scope = select.value; else state.filter = select.value as typeof state.filter; render(); }; }
      for (const b of root.querySelectorAll<HTMLElement>('[data-step]')) b.onclick = () => navigate(Number(b.dataset.step));
      for (const b of root.querySelectorAll<HTMLElement>('[data-wire]')) b.onclick = () => navigate(state.step, Number(b.dataset.wire));
      for (const b of root.querySelectorAll<HTMLElement>('[data-goto]')) b.onclick = () => { const i = steps.findIndex(s => s.connections.some(c => c.no === b.dataset.goto)); navigate(i, stepAt(i).connections.findIndex(c => c.no === b.dataset.goto)); };
      bindChecks(root);
      const file = root.querySelector('[data-role=import-file]') as HTMLInputElement; file.onchange = () => { const f = file.files?.[0]; if (f) void tools('import', f); };
      const search = root.querySelector<HTMLInputElement>('[data-role=search]'); if (search) search.oninput = () => { state.search = search.value; const results = root.querySelector('.ag-bom-results') as HTMLElement; results.innerHTML = bomRows(); bindChecks(results); };
      for (const b of root.querySelectorAll<HTMLElement>('[data-action]')) b.onclick = () => {
        switch (b.dataset.action) {
          case 'fullscreen': toggleScreen().catch(ignore); break;
          case 'zoom-in': state.zoom = drawing?.zoomBy(.25) ?? state.zoom; break;
          case 'zoom-out': state.zoom = drawing?.zoomBy(-.25) ?? state.zoom; break;
          case 'zoom-fit': state.zoom = 1; drawing?.fit(); break;
          case 'next-wire': moveWire(1); break;
          case 'prev-wire': moveWire(-1); break;
          case 'export': void exporter('csv'); break;
          case 'print': window.print(); break;
          case 'export-progress': void tools('export'); break;
          case 'import-progress': file.click(); break;
          case 'reset-progress': void tools('reset'); break;
          case 'undo-progress': if (undo) void tools('undo', undo.before); break;
        }
      };
    }
    // pushState fires neither event: a host that pushes a hash dispatches popstate or hashchange itself
    const follow = () => { if (readHash()) render(); };
    listen(window, 'hashchange', follow); listen(window, 'popstate', follow);
    readHash(); render();
    const destroy = () => {
      if (mounted.get(root) !== destroy) return;
      for (const stop of cleanups) stop();
      stopSizing?.(); drawing?.destroy(); drawing = null;
      if (state.expanded) { document.body.classList.remove('ag-no-scroll'); if (document.fullscreenElement === root) document.exitFullscreen().catch(ignore); }
      root.replaceChildren(); root.classList.remove('ag-guide', 'ag-expanded'); root.removeAttribute('data-complete'); root.style.removeProperty('--ag-board-ratio');
      mounted.delete(root);
    };
    mounted.set(root, destroy);
    return destroy;
  }

  // elements that name the same data-src share one request
  const auto = new Map<HTMLElement, { dead: boolean; stop?: () => void }>(), requests: Record<string, Promise<Guide>> = {};
  const fetchData = (src: string) => { const url = new URL(src, location.href).href; requests[url] ||= fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }).catch(error => { delete requests[url]; throw error; }); return requests[url] as Promise<Guide>; };
  // Runs at load and when the page changes without a reload (Material's document$): mounts new components, unmounts those that left
  function scan() {
    for (const [root, entry] of auto) if (!root.isConnected) { auto.delete(root); entry.dead = true; entry.stop?.(); }
    const inline = document.getElementById('guide-data'), pending = [];
    let inlineData: Guide | null | undefined;
    for (const root of document.querySelectorAll<HTMLElement>('[data-buildguide]')) {
      if (auto.has(root)) continue;
      const entry: { dead: boolean; stop?: () => void } = {dead: false};
      auto.set(root, entry);
      // a guide's tabs file loads while the data does, and the guide mounts once both are here: the scroll below then finds it drawn
      const tabs = root.dataset.buildguide === 'guide' && ext('tabs').catch(ignore);
      const data = root.dataset.src ? fetchData(root.dataset.src) : Promise.resolve().then(() => inlineData ||= inline && JSON.parse(inline.textContent as string));
      pending.push(Promise.all([data, tabs]).then(([D]) => { if (!D) throw new Error('no guide data'); if (!entry.dead) entry.stop = mount(root, D, {assets: root.dataset.assets ?? inline?.dataset.assets}); }).catch(() => { root.textContent = EN.unavailable; }));
    }
    // a fragment such as #top&wiring=B/1 names no element, so the browser does not scroll: do it once the components have their height
    if (pending.length) Promise.allSettled(pending).then(() => {
      const anchor = location.hash.slice(1).split('&').find(pair => pair && !pair.includes('='));
      if (anchor) document.getElementById(decode(anchor))?.scrollIntoView();
    }).catch(ignore);
  }
  window.BuildGuide = {mount, scan};
  scan();
  window.document$?.subscribe(scan);
})();
