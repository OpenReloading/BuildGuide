/* BuildGuide components: a BOM checklist and board workspaces (wiring, tubing) from one guide data object, alone or behind tabs.
   Markup: <div data-buildguide="bom"></div>, <div data-buildguide="board" data-board="wiring"></div> or <div data-buildguide="guide"></div>, any number per page,
   plus the data in <script type="application/json" id="guide-data"> (any element with that id) or a data-src="guide.json" URL on the div. */
(() => {
  'use strict';
  // a second evaluation (Material's instant navigation runs the scripts of the new page again) only mounts what is new
  if (window.BuildGuide) { window.BuildGuide.scan(); return; }
  const HERE = new URL('.', document.currentScript.src);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // guide data may come from anyone: URLs from it resolve to web or file locations only, anything else becomes '#'
  const safeURL = (value, base) => { try { const u = new URL(value, base); if (/^(https?|file):$/.test(u.protocol)) return u.href; } catch {} return '#'; };
  const decode = v => { try { return decodeURIComponent(v); } catch { return v; } };
  const button = (text, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${text}</button>`;
  const loaded = {};
  // a failed load is not cached: the next render tries again
  const loadScript = src => loaded[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('cannot load ' + src));
    document.head.appendChild(s);
  }).catch(error => { delete loaded[src]; throw error; });
  // JointJS and the board renderer load only when a board component mounts
  const boardRenderer = () => loadScript(new URL('vendor/joint/joint.min.js', HERE).href)
    .then(() => loadScript(new URL('buildguide-board.js', HERE).href)).then(() => window.BuildGuideBoard);

  const mounted = new WeakMap();
  // data keys come from anyone: only own properties count, never Object.prototype's
  const own = (object, key) => Object.hasOwn(object ?? {}, key) ? object[key] : undefined;
  // the page-wide hash holds one key=value pair per board, so boards on one page keep their own position
  const pairs = () => location.hash.slice(1).split('&').filter(Boolean);
  // a fragment without = is an anchor (#wiring), never a board's position
  const nameOf = pair => pair.includes('=') ? decode(pair.split('=')[0]) : null;
  const pairValue = pair => pair.slice(pair.indexOf('=') + 1);
  // the pair of name keeps its place among the others. False when pushState failed and the hash was set instead: hashchange follows
  function putPair(name, value) {
    const mine = `${encodeURIComponent(name)}=${value}`, all = pairs();
    const next = (all.some(p => nameOf(p) === name) ? all.map(p => nameOf(p) === name ? mine : p) : [...all, mine]).join('&');
    // pushState, not location.hash: it fires no popstate, which Material's instant navigation answers with a swap of the whole page (on the first hash change)
    if (location.hash.slice(1) !== next) { try { history.pushState(history.state, '', `${location.pathname}${location.search}#${next}`); } catch { location.hash = next; return false; } }
    return true;
  }

  // mount(root, data, {view, board, assets}) renders one component into root and returns the function that removes it again
  function mount(root, D, options = {}) {
    mounted.get(root)?.();
    const view = options.view ?? root.dataset.buildguide, boardKey = options.board ?? root.dataset.board;
    if (view === 'guide') return mountTabs(root, D, options);
    const board = view === 'board' ? own(D.boards, boardKey) : null;
    if (view === 'bom' ? !D.bom : !board) { root.textContent = `Unknown guide component: ${view}${boardKey ? ' ' + boardKey : ''}.`; return () => {}; }
    const ASSETS = new URL(options.assets ?? root.dataset.assets ?? 'assets/', location.href);
    const steps = board?.steps || [];
    const title = board?.title || boardKey;
    const prefix = board?.prefix || boardKey;
    let persistent = true, saved = {};
    const load = () => {
      let raw = null, found = {};
      try { raw = localStorage.getItem(D.storage); } catch { persistent = false; }
      try { found = JSON.parse(raw || '{}') || {}; } catch {}
      return typeof found === 'object' && !Array.isArray(found) ? found : {};
    };
    saved = load();
    const checked = key => saved[key] === true;
    // other components on the page store into the same object: merge what is stored into the copy in memory before each write,
    // so ticks survive in memory when the storage is blocked or full
    const save = (key, value) => { saved = {...saved, ...load()}; saved[key] = value; try { localStorage.setItem(D.storage, JSON.stringify(saved)); } catch { persistent = false; } };
    // a tick belongs to one exact connection: change either end and it is unchecked again
    const connKey = c => `${prefix}-${c.no}:${c.a}:${c.b}`, bomKey = p => `bom-${p.id}:${p.part}`;
    const count = (items, key) => items.filter(x => checked(key(x))).length;
    const state = {step: 0, wire: 0, scope: board?.scope || 'step', zoom: 1, expanded: false, search: '', message: ''};
    const end = e => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)]; };
    const label = (c, side) => c['l' + side] ?? (([id, pin]) => `${own(board.parts, id)?.name ?? id} · ${pin}`)(end(c[side]));
    const color = c => own(board.colors, c.color) || {};
    const hashOf = (s, c) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');
    const cleanups = [];
    const listen = (target, type, handler) => { target.addEventListener(type, handler); cleanups.push(() => target.removeEventListener(type, handler)); };

    function navigate(index = 0, wire = 0) {
      if (putPair(boardKey, hashOf(steps[index], steps[index].connections[wire]))) { readHash(); render(); }
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
      const j = steps[state.step].connections.findIndex(c => c.no === bits[1]); state.wire = j >= 0 ? j : 0;
      return state.step !== step || state.wire !== wire;
    }

    // a render replaces the markup: the focused control is found again by its data attribute
    function focusSelector() {
      const el = document.activeElement;
      if (!root.contains(el)) return null;
      for (const name of ['data-action', 'data-step', 'data-conn', 'data-role']) if (el.hasAttribute(name)) return `[${name}="${CSS.escape(el.getAttribute(name))}"]`;
      return null;
    }
    let drawing, stopSizing;
    function render() {
      const refocus = focusSelector();
      // a connection path is drawn again once the renderer is ready: it takes the focus back then
      const active = document.activeElement, focusConn = root.contains(active) ? active.dataset?.connection : undefined;
      stopSizing?.();
      drawing?.destroy(); drawing = null;
      root.classList.add('ag-guide');
      root.classList.toggle('ag-expanded', state.expanded);
      const message = state.message; state.message = '';
      root.innerHTML = `${board ? renderBoard() : renderBOM()}<p class="ag-status">${persistent ? 'Progress saved in this browser.' : 'Storage unavailable: progress is not saved.'}</p>
        <div class="ag-progress-tools">${button('Export progress', 'export-progress')}${button('Import progress', 'import-progress')}<input type="file" accept=".json,application/json" data-role="import-file" aria-label="Progress file" hidden>${button('Reset progress', 'reset-progress')}<span class="ag-message" role="status"></span></div>`;
      // a live region announces text added to an element that already exists, not text that arrives with it
      if (message) setTimeout(() => { const live = root.querySelector('.ag-message'); if (live) live.textContent = message; }, 50);
      bind();
      if (board) {
        const canvas = root.querySelector('.ag-board-canvas');
        drawing = {destroy() { this.dead = true; this.inner?.destroy(); }, zoom(v) { this.inner?.zoom(v); }, fit() { this.inner?.fit(); }, highlight(...a) { this.inner?.highlight(...a); }}; const rendered = drawing;
        boardRenderer().then(mountBoard => {
          if (rendered.dead) return;
          rendered.inner = mountBoard(canvas, board, {key: boardKey, name: board.label || title, step: state.step, wire: state.wire, scope: state.scope, zoom: state.zoom, base: new URL('vendor/libavoid/', HERE).href,
            focus: focusConn,
            label, select(no) { const i = steps.findIndex(s => s.connections.some(c => c.no === no)); navigate(i, steps[i].connections.findIndex(c => c.no === no)); }});
        }).catch(error => { console.error(error); canvas.textContent = 'Board renderer unavailable. Use the connection list below.'; canvas.dataset.ready = 'error'; });
        root.querySelectorAll('[data-wire]').forEach(row => {
          const no = steps[state.step].connections[Number(row.dataset.wire)].no;
          row.onmouseenter = () => drawing?.highlight(no, true);
          row.onmouseleave = () => drawing?.highlight(no, no === steps[state.step].connections[state.wire].no);
        });
        stopSizing = fitWorkspace();
      }
      updateScreenButton();
      if (refocus) root.querySelector(refocus)?.focus({preventScroll: true});
      // phones: bring the current step into the strip without moving the page
      const strip = root.querySelector('.ag-steps'), current = strip?.querySelector('[aria-current]');
      if (current) { const a = strip.getBoundingClientRect(), b = current.getBoundingClientRect(); strip.scrollLeft += b.left - a.left - (a.width - b.width) / 2; }
    }
    function fitWorkspace() {
      const canvas = root.querySelector('.ag-board-canvas');
      let frame;
      const fit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (state.expanded) return;
          // the same breakpoint as the stylesheet's container query
          const below = root.querySelectorAll(root.clientWidth >= 900 ? '.ag-board-legend' : '.ag-board-legend, .ag-board-toolbar, .ag-connection-detail, .ag-wire-navigation');
          const reserved = [...below].reduce((sum, el) => {
            const style = getComputedStyle(el);
            return sum + el.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
          }, 14);
          // as tall as the window leaves below the component's own top, never smaller than half the screen or the diagram's height at full width
          const top = canvas.getBoundingClientRect().top - root.getBoundingClientRect().top;
          const floor = Math.min(Math.round(window.innerHeight * .5), Math.round(canvas.clientWidth * board.size[1] / board.size[0]));
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
      return `<nav class="ag-steps" aria-label="${esc(title)} steps">${steps.map((s, i) => {
        const total = s.connections.length, done = count(s.connections, connKey);
        return `<button type="button" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''}><span class="ag-step-id ${done === total ? 'complete' : ''}">${done === total ? '✓' : esc(s.id)}</span><span><b>${esc(s.title)}</b><small>${done} / ${total}</small></span></button>`;
      }).join('')}</nav>`;
    }
    function toolbar() {
      const option = (value, text) => `<option value="${value}" ${state.scope === value ? 'selected' : ''}>${text}</option>`;
      return `<div class="ag-board-toolbar"><label>Show <select data-role="scope" aria-label="Visible connections">${option('step', 'This step')}${board.single ? option('single', 'Selected connection') : ''}${option('all', 'All connections')}</select></label><div class="ag-board-controls">${button('−', 'zoom-out', 'aria-label="Zoom out"')}${button('Fit', 'zoom-fit')}${button('+', 'zoom-in', 'aria-label="Zoom in"')}${button('⛶ Fullscreen', 'fullscreen', 'class="ag-fullscreen-button"')}</div></div>`;
    }
    function connectionSummary(c) {
      const diode = color(c).diode, key = connKey(c), cable = diode ? '' : [c.cable, c.size].filter(Boolean).join(' · ');
      return `<div class="ag-connection-detail"><div><small>FROM${diode ? ' · RING END' : ''}</small><strong>${esc(label(c, 'a'))}</strong></div><span class="ag-detail-arrow">→</span><div><small>TO${diode ? ' · PLAIN END' : ''}</small><strong>${esc(label(c, 'b'))}</strong></div>${cable ? `<div class="ag-cable"><small>CABLE</small><strong>${esc(cable)}</strong></div>` : ''}<label class="ag-verify"><input type="checkbox" data-check="${esc(key)}" ${checked(key) ? 'checked' : ''}>${checked(key) ? 'Checked' : 'Mark checked'}</label></div>`;
    }
    const legendItem = l => typeof l === 'string' ? `<span>${esc(l)}</span>` : `<span>${l.key === 'diode' ? '<i class="ag-diode-key"></i>' : ''}${esc(l.text)}</span>`;
    function renderBoard() {
      const s = steps[state.step], c = s.connections[state.wire], all = steps.flatMap(x => x.connections);
      const atEnd = state.step === steps.length - 1 && state.wire === s.connections.length - 1;
      const first = state.step === 0 && state.wire === 0;
      const next = state.wire === s.connections.length - 1 ? 'Next step →' : 'Next connection →';
      const listed = board.listAll ? all : s.connections;
      return `<section class="ag-workspace"><div class="ag-head"><span class="ag-progress">${count(all, connKey)} / ${all.length} checked</span></div>${stepNavigation()}<div class="ag-work"><div class="ag-work-heading"><h2>${esc(s.title)}</h2></div>
      <div class="ag-panel ag-full-board"><div class="ag-board-canvas" tabindex="0" role="region" aria-label="${esc(board.label || title)}"><span class="ag-board-loading">Loading board…</span></div><div class="ag-board-legend">${(board.legend || []).map(legendItem).join('')}</div></div>
      ${toolbar()}
      ${connectionSummary(c)}
      <div class="ag-wire-navigation">${button('← Previous', 'prev-wire', `class="ag-quiet" ${first ? 'disabled' : ''}`)}<span>${state.wire + 1} / ${s.connections.length}</span>${button(atEnd ? 'Last connection' : next, 'next-wire', `class="ag-primary" ${atEnd ? 'disabled' : ''}`)}</div>
      ${s.note ? `<p class="ag-step-note">${esc(s.note)}</p>` : ''}
      <div class="ag-list-heading"><h3>${board.listAll ? `All ${esc(title.toLowerCase())} connections` : 'Connections in this step'}</h3></div><div class="ag-wire-list">${listed.map(v => connectionRow(v, v === c, s.connections.indexOf(v))).join('')}</div>
      </div></section>`;
    }
    function connectionRow(c, selected, index) {
      const key = connKey(c), done = checked(key), swatch = board.listColor !== false && !color(c).diode ? color(c).swatch || color(c).line : null, paint = swatch && CSS.supports('color', swatch);
      const target = `data-conn="${esc(c.no)}" ` + (index >= 0 ? `data-wire="${index}"` : `data-goto="${esc(c.no)}"`);
      return `<div class="ag-wire-row ${selected ? 'selected' : ''} ${done ? 'is-done' : ''}"><input type="checkbox" data-check="${esc(key)}" aria-label="Connection ${esc(c.no)}" ${done ? 'checked' : ''}><button type="button" ${target} ${selected ? 'aria-current="true"' : ''}><span class="ag-wire-number">${esc(c.no)}</span><span>${esc(label(c, 'a'))}</span><span class="ag-row-arrow">→</span><span>${esc(label(c, 'b'))}</span>${paint ? `<span class="ag-row-color"><i style="--wire:${esc(swatch)}"></i>${esc(c.color)}</span>` : ''}</button></div>`;
    }
    const bom = D.bom || {}, items = bom.items || [];
    const filteredParts = () => items.filter(p => `${p.part} ${p.spec ?? ''} ${p.group}`.toLowerCase().includes(state.search.toLowerCase()));
    function renderBOM() {
      return `<section class="ag-bom"><div class="ag-head"><div>${bom.note ? `<p>${esc(bom.note)}</p>` : ''}</div><div class="ag-bom-actions"><span class="ag-progress">${count(items, bomKey)} / ${items.length} checked</span>${button('Print', 'print', 'class="ag-quiet"')}${button('↓ Export CSV', 'export', 'class="ag-primary"')}</div></div><div class="ag-bom-tools"><label class="ag-search"><input type="search" data-role="search" placeholder="Find a component…" aria-label="Search BOM" value="${esc(state.search)}"></label></div><div class="ag-bom-results">${bomRows()}</div></section>`;
    }
    function bomRows() {
      const parts = filteredParts();
      if (!parts.length) return '<div class="ag-empty">No matching components.</div>';
      let group = '';
      const row = p => {
        const head = p.group !== group ? `<tr class="ag-group"><th colspan="3" scope="rowgroup">${esc(p.group)}</th></tr>` : ''; group = p.group;
        const link = p.link ? ` <a class="ag-source-link" href="${esc(safeURL(p.link, location.href))}" target="_blank" rel="noopener">${esc(bom.linkLabel || 'Link')} ↗</a>` : '';
        const done = checked(bomKey(p));
        return `${head}<tr class="${done ? 'is-done' : ''}"><td class="ag-qty"><label class="ag-have"><input type="checkbox" data-check="${esc(bomKey(p))}" aria-label="${esc(p.part)}" ${done ? 'checked' : ''}>${esc(p.qty)}</label></td><td><div class="ag-part-cell">${p.image ? `<img src="${esc(safeURL(p.image, ASSETS))}" alt="" loading="lazy">` : ''}<div><strong>${esc(p.part)}</strong></div></div></td><td>${esc(p.spec)}${link}</td></tr>`;
      };
      return `<div class="ag-bom-table"><table class="ag-table"><caption class="ag-sr">Bill of materials</caption><thead><tr><th scope="col">Qty</th><th scope="col">Component</th><th scope="col">Specification</th></tr></thead><tbody>${parts.map(row).join('')}</tbody></table></div><p class="ag-result-count">${parts.length} / ${items.length} components</p>`;
    }
    function exportCSV() {
      const rows = [['Group', 'Component', 'Specification', 'Quantity', bom.linkLabel || 'Link'], ...filteredParts().map(p => [p.group, p.part, p.spec, p.qty, p.link || ''])];
      // a leading = + - @ would run as a spreadsheet formula
      const cell = v => '"' + String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
      const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = bom.export || 'bom.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    // progress files hold one object of true/false values, the shape this script stores
    const isProgress = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'boolean');
    // every mounted component on the page takes the new object, so a later tick does not write the old ticks back
    const shareProgress = (progress, message = '') => {
      state.message = message;
      document.dispatchEvent(new CustomEvent('buildguide-progress', {detail: {storage: D.storage, saved: progress}}));
    };
    listen(document, 'buildguide-progress', e => { if (e.detail?.storage === D.storage && isProgress(e.detail.saved)) { saved = {...e.detail.saved}; render(); } });
    // another tab ticked, imported or reset: show what it stored (key null: the whole storage was cleared)
    listen(window, 'storage', e => { if (e.key === D.storage || e.key === null) { saved = load(); render(); } });
    function exportProgress() {
      const blob = new Blob([JSON.stringify({...saved, ...load()}, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${D.storage}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function importProgress(file) {
      let progress;
      try { progress = file.size < 1e6 && JSON.parse(await file.text()); } catch {}
      if (mounted.get(root) !== destroy) return;
      if (!isProgress(progress)) { state.message = file.size < 1e6 ? 'Not imported: the file is not a progress export.' : 'Not imported: the file is larger than 1 MB.'; render(); return; }
      try { localStorage.setItem(D.storage, JSON.stringify(progress)); } catch { persistent = false; }
      shareProgress(progress, persistent ? 'Progress imported.' : 'Imported, but storage is unavailable: progress is not saved.');
    }
    function resetProgress() {
      if (!confirm('Reset all saved progress of this guide, in every component on the page?')) return;
      try { localStorage.removeItem(D.storage); } catch { persistent = false; }
      shareProgress({}, persistent ? 'Progress reset.' : 'Reset for this visit: storage is unavailable.');
    }
    function moveWire(dir) {
      let i = state.step, j = state.wire + dir;
      if (j < 0) { i--; if (i < 0) return; j = steps[i].connections.length - 1; }
      if (j >= steps[i].connections.length) { i++; j = 0; }
      if (i >= steps.length) return;
      navigate(i, j);
    }
    function updateScreenButton() { root.querySelectorAll('[data-action=fullscreen]').forEach(b => { b.textContent = state.expanded ? '⤢ Exit fullscreen' : '⛶ Fullscreen'; b.setAttribute('aria-pressed', String(state.expanded)); }); }
    function setExpanded(value) {
      state.expanded = value;
      root.classList.toggle('ag-expanded', value); document.body.classList.toggle('ag-no-scroll', value); updateScreenButton();
    }
    async function toggleScreen() {
      if (state.expanded) { if (document.fullscreenElement === root) await document.exitFullscreen(); setExpanded(false); }
      else { setExpanded(true); try { await root.requestFullscreen(); } catch {} }
    }
    listen(document, 'fullscreenchange', () => { if (state.expanded && document.fullscreenElement !== root) setExpanded(false); });
    listen(document, 'keydown', e => { if (e.key === 'Escape' && state.expanded && document.fullscreenElement !== root) toggleScreen(); });
    function bindChecks(scope) {
      // a BOM row toggles its tick wherever you click it (the box, its label and links keep their own click)
      for (const box of scope.querySelectorAll('.ag-bom-table [data-check]')) box.closest('tr').onclick = e => { if (!e.target.closest('input,label,a')) box.click(); };
      for (const box of scope.querySelectorAll('[data-check]')) box.onchange = () => {
        const key = box.dataset.check, sel = `[data-check="${CSS.escape(key)}"]`, index = [...root.querySelectorAll(sel)].indexOf(box);
        save(key, box.checked); render();
        root.querySelectorAll(sel)[index]?.focus({preventScroll: true});
      };
    }
    function bind() {
      const scope = root.querySelector('[data-role=scope]'); if (scope) scope.onchange = () => { state.scope = scope.value; render(); };
      for (const b of root.querySelectorAll('[data-step]')) b.onclick = () => navigate(Number(b.dataset.step));
      for (const b of root.querySelectorAll('[data-wire]')) b.onclick = () => navigate(state.step, Number(b.dataset.wire));
      for (const b of root.querySelectorAll('[data-goto]')) b.onclick = () => { const i = steps.findIndex(s => s.connections.some(c => c.no === b.dataset.goto)); navigate(i, steps[i].connections.findIndex(c => c.no === b.dataset.goto)); };
      bindChecks(root);
      const file = root.querySelector('[data-role=import-file]'); file.onchange = () => { if (file.files[0]) importProgress(file.files[0]); };
      const search = root.querySelector('[data-role=search]'); if (search) search.oninput = () => { state.search = search.value; const results = root.querySelector('.ag-bom-results'); results.innerHTML = bomRows(); bindChecks(results); };
      for (const b of root.querySelectorAll('[data-action]')) b.onclick = () => {
        switch (b.dataset.action) {
          case 'fullscreen': toggleScreen(); break;
          case 'zoom-in': state.zoom = Math.min(3, state.zoom + .25); drawing?.zoom(state.zoom); break;
          case 'zoom-out': state.zoom = Math.max(1, state.zoom - .25); drawing?.zoom(state.zoom); break;
          case 'zoom-fit': state.zoom = 1; drawing?.fit(); break;
          case 'next-wire': moveWire(1); break;
          case 'prev-wire': moveWire(-1); break;
          case 'export': exportCSV(); break;
          case 'print': window.print(); break;
          case 'export-progress': exportProgress(); break;
          case 'import-progress': root.querySelector('[data-role=import-file]').click(); break;
          case 'reset-progress': resetProgress(); break;
        }
      };
    }
    // history.pushState alone fires neither event: a host that pushes a hash dispatches popstate or hashchange itself
    const follow = () => { if (readHash()) render(); };
    listen(window, 'hashchange', follow); listen(window, 'popstate', follow);
    readHash(); render();
    const destroy = () => {
      if (mounted.get(root) !== destroy) return;
      for (const stop of cleanups) stop();
      stopSizing?.(); drawing?.destroy(); drawing = null;
      if (state.expanded) { document.body.classList.remove('ag-no-scroll'); if (document.fullscreenElement === root) document.exitFullscreen(); }
      root.replaceChildren(); root.classList.remove('ag-guide', 'ag-expanded');
      mounted.delete(root);
    };
    mounted.set(root, destroy);
    return destroy;
  }

  // The combined component: tabs for the BOM and the boards over one panel. Only the shown tab is mounted, so a board is never drawn in a hidden box
  // and a tab that is left releases its drawing. Hash: one guide=<key> pair next to the boards' own pairs; 'bom' names the BOM.
  let tabSeq = 0;
  function mountTabs(root, D, options) {
    const asked = (options.board ?? root.dataset.board ?? '').split(/\s+/).filter(Boolean);
    const keys = asked.length ? asked : [...(D.bom ? ['bom'] : []), ...Object.keys(D.boards ?? {})];
    if (!keys.length || keys.some(k => k === 'bom' ? !D.bom : !own(D.boards, k))) { root.textContent = `Unknown guide component: guide${asked.map(k => ' ' + k).join('')}.`; return () => {}; }
    const id = `ag-tabs-${++tabSeq}`, assets = options.assets ?? root.dataset.assets;
    root.classList.add('ag-guide', 'ag-tabbed');
    root.innerHTML = `<div class="ag-tabs" role="tablist" aria-label="Guide">${keys.map((k, i) => `<button type="button" role="tab" id="${id}-${i}" aria-controls="${id}">${esc(k === 'bom' ? 'Bill of materials' : own(D.boards, k).title || k)}</button>`).join('')}</div><div id="${id}" role="tabpanel"></div>`;
    const tabs = [...root.querySelectorAll('[role=tab]')], panel = root.lastElementChild;
    let active = -1, seen = new Map(), handled = null;
    const show = i => {
      active = i;
      tabs.forEach((tab, j) => { tab.setAttribute('aria-selected', String(j === i)); tab.tabIndex = j === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', tabs[i].id);
      mount(panel, D, keys[i] === 'bom' ? {view: 'bom', assets} : {view: 'board', board: keys[i], assets});
    };
    // seen: the pairs and handled: the hash this component acted on last
    const sync = () => { seen = read(); handled = location.hash; };
    const select = i => { if (putPair('guide', encodeURIComponent(keys[i]))) { sync(); if (i !== active) show(i); } };
    tabs.forEach((tab, i) => { tab.onclick = () => select(i); });
    root.firstElementChild.onkeydown = e => {
      const i = {ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: keys.length - 1}[e.key];
      // Alt+Arrow is the browser's history shortcut
      if (typeof i !== 'number' || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault(); const to = (i + keys.length) % keys.length; select(to); tabs[to].focus();
    };
    const read = () => new Map(pairs().filter(p => nameOf(p)).map(p => [nameOf(p), pairValue(p)]));
    // Which tab the hash asks for: the one the guide pair names, else the board whose pair changed since the last look (on load: the first pair).
    // Else an anchor or the shown board's own pair leaves the tab as it is, else the first board pair opens its tab, else the first tab shows.
    function follow() {
      // a hash set from outside fires popstate and hashchange: the second finds it handled
      if (location.hash === handled) return;
      const now = read(), named = keys.indexOf(decode(now.get('guide') ?? ''));
      const moved = keys.findIndex((k, i) => i !== active && k !== 'bom' && now.has(k) && now.get(k) !== seen.get(k));
      const stay = pairs().some(p => !nameOf(p)) || now.has(keys[active]);
      const target = Math.max(named >= 0 ? named : moved >= 0 ? moved : stay ? active : keys.findIndex(k => k !== 'bom' && now.has(k)), 0);
      sync();
      if (target !== active) show(target);
    }
    // the listeners of the shown component come after these, so a tab that changes is replaced before the old board hears the same event
    window.addEventListener('hashchange', follow); window.addEventListener('popstate', follow);
    follow();
    const destroy = () => {
      if (mounted.get(root) !== destroy) return;
      window.removeEventListener('hashchange', follow); window.removeEventListener('popstate', follow);
      mounted.get(panel)?.();
      root.replaceChildren(); root.classList.remove('ag-guide', 'ag-tabbed');
      mounted.delete(root);
    };
    mounted.set(root, destroy);
    return destroy;
  }

  // every [data-buildguide] element mounts itself; elements that name the same data-src share one request
  const auto = new Map(), requests = {};
  const fetchData = src => { const url = new URL(src, location.href).href; requests[url] ||= fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(error => { delete requests[url]; throw error; }); return requests[url]; };
  // Runs at load and whenever the page changes without a reload (Material's document$): mounts the new components, unmounts those that left the document
  function scan() {
    for (const [root, entry] of auto) if (!root.isConnected) { auto.delete(root); entry.dead = true; entry.stop?.(); }
    const inline = document.getElementById('guide-data'), pending = [];
    let inlineData;
    for (const root of document.querySelectorAll('[data-buildguide]')) {
      if (auto.has(root)) continue;
      const entry = {dead: false};
      auto.set(root, entry);
      const data = root.dataset.src ? fetchData(root.dataset.src) : Promise.resolve().then(() => inlineData ||= inline && JSON.parse(inline.textContent));
      pending.push(data.then(D => { if (!D) throw new Error('no guide data'); if (!entry.dead) entry.stop = mount(root, D, {assets: root.dataset.assets ?? inline?.dataset.assets}); }).catch(() => { root.textContent = 'Guide data unavailable.'; }));
    }
    // a fragment such as #top&wiring=B/1 names no element, so the browser does not scroll: do it once the components have their height
    if (pending.length) Promise.allSettled(pending).then(() => {
      const anchor = location.hash.slice(1).split('&').find(pair => pair && !pair.includes('='));
      if (anchor) document.getElementById(decode(anchor))?.scrollIntoView();
    });
  }
  window.BuildGuide = {mount, scan};
  scan();
  window.document$?.subscribe(scan);
})();
