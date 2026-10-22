/* BuildGuide components: a BOM checklist and board workspaces (wiring, tubing) from one guide data object.
   Markup: <div data-buildguide="bom"></div> or <div data-buildguide="board" data-board="wiring"></div>, any number per page,
   plus the data in <script type="application/json" id="guide-data"> or a data-src="guide.json" URL on the div. */
(() => {
  'use strict';
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

  // mount(root, data, {view, board, assets}) renders one component into root and returns the function that removes it again
  function mount(root, D, options = {}) {
    mounted.get(root)?.();
    const view = options.view ?? root.dataset.buildguide, boardKey = options.board ?? root.dataset.board;
    const board = view === 'board' ? own(D.boards, boardKey) : null;
    if (view === 'bom' ? !D.bom : !board) { root.textContent = `Unknown guide component: ${view}${boardKey ? ' ' + boardKey : ''}.`; return () => {}; }
    const ASSETS = new URL(options.assets ?? root.dataset.assets ?? 'assets/', location.href);
    const steps = board?.steps || [];
    const title = board?.title || boardKey;
    const prefix = board?.prefix || boardKey;
    // the page-wide hash holds one key=value pair per board, so boards on one page keep their own position
    const param = encodeURIComponent(boardKey ?? '');
    const pairs = () => location.hash.slice(1).split('&').filter(Boolean);
    // a fragment without = is an anchor (#wiring), never a board's position
    const nameOf = pair => pair.includes('=') ? decode(pair.split('=')[0]) : null;
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
    const state = {step: 0, wire: 0, scope: board?.scope || 'step', zoom: 1, expanded: false, search: ''};
    const end = e => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)]; };
    const label = (c, side) => c['l' + side] ?? (([id, pin]) => `${own(board.parts, id)?.name ?? id} · ${pin}`)(end(c[side]));
    const color = c => own(board.colors, c.color) || {};
    const hashOf = (s, c) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');
    const cleanups = [];
    const listen = (target, type, handler) => { target.addEventListener(type, handler); cleanups.push(() => target.removeEventListener(type, handler)); };

    function navigate(index = 0, wire = 0) {
      // this board's pair keeps its place among the others
      const mine = `${param}=${hashOf(steps[index], steps[index].connections[wire])}`, all = pairs();
      const next = (all.some(p => nameOf(p) === boardKey) ? all.map(p => nameOf(p) === boardKey ? mine : p) : [...all, mine]).join('&');
      if (location.hash.slice(1) === next) { readHash(); render(); } else location.hash = next;
    }
    // true when this board's position changed. A foreign fragment such as #intro stays in the hash, but once a board pair
    // is added the browser no longer scrolls to it: the whole fragment is the anchor name
    function readHash() {
      if (!board) return false;
      const mine = pairs().find(p => nameOf(p) === boardKey);
      // no pair of this board (a heading anchor, another tool's hash): the board stays where it is
      if (mine === undefined) return false;
      const bits = mine.slice(mine.indexOf('=') + 1).split('/').map(decode);
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
      stopSizing?.();
      drawing?.destroy(); drawing = null;
      root.classList.add('ag-guide');
      root.classList.toggle('ag-expanded', state.expanded);
      root.innerHTML = `${board ? renderBoard() : renderBOM()}<p class="ag-status">${persistent ? 'Progress saved in this browser.' : 'Storage unavailable: progress is not saved.'}</p>`;
      bind();
      if (board) {
        const canvas = root.querySelector('.ag-board-canvas');
        drawing = {destroy() { this.dead = true; this.inner?.destroy(); }, zoom(v) { this.inner?.zoom(v); }, fit() { this.inner?.fit(); }, highlight(...a) { this.inner?.highlight(...a); }}; const rendered = drawing;
        boardRenderer().then(mountBoard => {
          if (rendered.dead) return;
          rendered.inner = mountBoard(canvas, board, {key: boardKey, name: board.label || title, step: state.step, wire: state.wire, scope: state.scope, zoom: state.zoom, base: new URL('vendor/libavoid/', HERE).href,
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
      return `<section class="ag-bom"><div class="ag-head"><div>${bom.note ? `<p>${esc(bom.note)}</p>` : ''}</div><div class="ag-bom-actions"><span class="ag-progress">${count(items, bomKey)} / ${items.length} checked</span>${button('↓ Export CSV', 'export', 'class="ag-primary"')}</div></div><div class="ag-bom-tools"><label class="ag-search"><input type="search" data-role="search" placeholder="Find a component…" aria-label="Search BOM" value="${esc(state.search)}"></label></div><div class="ag-bom-results">${bomRows()}</div></section>`;
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

  window.BuildGuide = {mount};
  // every [data-buildguide] element mounts itself; elements that name the same data-src share one request
  const inline = document.getElementById('guide-data'), requests = {};
  let inlineData;
  const fetchData = src => requests[src] ||= fetch(new URL(src, location.href)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  for (const root of document.querySelectorAll('[data-buildguide]')) {
    const data = root.dataset.src ? fetchData(root.dataset.src) : Promise.resolve().then(() => inlineData ||= inline && JSON.parse(inline.textContent));
    data.then(D => { if (!D) throw new Error('no guide data'); mount(root, D, {assets: root.dataset.assets ?? inline?.dataset.assets}); }).catch(() => { root.textContent = 'Guide data unavailable.'; });
  }
})();
