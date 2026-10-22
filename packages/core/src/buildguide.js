/* BuildGuide: page shell, introduction, BOM checklist and board workspaces from one guide data object.
   Markup: <div id="assembly-guide" data-page="wiring" data-site="../"></div> plus the data in
   <script type="application/json" id="guide-data"> or a data-src="guide.json" URL on the same div. */
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
  // JointJS and the board renderer load only on board pages
  const boardRenderer = () => loadScript(new URL('vendor/joint/joint.min.js', HERE).href)
    .then(() => loadScript(new URL('buildguide-board.js', HERE).href)).then(() => window.BuildGuideBoard);

  function mount(root, D, options = {}) {
    const SITE = new URL(options.site ?? root.dataset.site ?? './', location.href);
    const ASSETS = new URL(options.assets ?? root.dataset.assets ?? 'assets/', SITE);
    const pages = D.pages, page = pages.find(p => p.id === (options.page ?? root.dataset.page)) || pages[0];
    const pathOf = p => p.path ?? (p === pages[0] ? '' : p.id + '/');
    const pageURL = (p, hash = '') => safeURL(pathOf(p) + hash, SITE);
    const board = page.view === 'board' ? D.boards[page.board] : null;
    const steps = board?.steps || [];
    const prefix = board?.prefix || page.board;
    let saved = {}, persistent = true, raw = null;
    try { raw = localStorage.getItem(D.storage); } catch { persistent = false; }
    try { saved = JSON.parse(raw || '{}') || {}; } catch {}
    if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    const checked = key => saved[key] === true;
    const save = (key, value) => { saved[key] = value; try { localStorage.setItem(D.storage, JSON.stringify(saved)); } catch { persistent = false; } };
    // a tick belongs to one exact connection: change either end and it is unchecked again
    const connKey = c => `${prefix}-${c.no}:${c.a}:${c.b}`, bomKey = p => `bom-${p.id}:${p.part}`;
    const count = (items, key) => items.filter(x => checked(key(x))).length;
    const state = {step: 0, wire: 0, scope: board?.scope || 'step', zoom: 1, expanded: false, search: ''};
    const end = e => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)]; };
    const label = (c, side) => c['l' + side] ?? (([id, pin]) => `${board.parts[id]?.name ?? id} · ${pin}`)(end(c[side]));
    const color = c => board.colors[c.color] || {};
    const hashOf = (s, c) => encodeURIComponent(s.id) + (s.connections.length > 1 ? '/' + encodeURIComponent(c.no) : '');

    function navigate(target, index = 0, wire = 0) {
      const b = target.view === 'board' ? D.boards[target.board] : null;
      const hash = b ? hashOf(b.steps[index], b.steps[index].connections[wire]) : '';
      if (target !== page) { location.href = pageURL(target, hash ? '#' + hash : ''); return; }
      if (location.hash.slice(1) === hash) { readHash(); render(); } else location.hash = hash;
    }
    function readHash() {
      if (!board) return;
      const bits = location.hash.slice(1).split('/').map(decode);
      const i = steps.findIndex(s => s.id === bits[0]); state.step = i >= 0 ? i : 0;
      const j = steps[state.step].connections.findIndex(c => c.no === bits[1]); state.wire = j >= 0 ? j : 0;
    }

    // a render replaces the markup: the focused control is found again by its data attribute or id
    function focusSelector() {
      const el = document.activeElement;
      if (!root.contains(el)) return null;
      for (const name of ['data-action', 'data-step', 'data-conn']) if (el.hasAttribute(name)) return `[${name}="${CSS.escape(el.getAttribute(name))}"]`;
      return el.id ? '#' + CSS.escape(el.id) : null;
    }
    let drawing, stopSizing;
    function render() {
      const refocus = focusSelector();
      stopSizing?.();
      drawing?.destroy(); drawing = null;
      root.classList.toggle('ag-diagram-page', !!board);
      root.classList.toggle('ag-expanded', state.expanded);
      const B = D.brand || {}, words = [].concat(B.wordmark || []);
      // board pages: the short text, the full text one click away
      const notice = (n, cls, fallback, role) => !n ? '' : board && n.short != null
        ? `<div class="ag-notice ${cls}" role="${role}"><details class="ag-notice-details"><summary class="ag-notice-summary"><b>${esc(n.label || fallback)}</b> ${esc(n.short)}</summary><p class="ag-notice-full">${esc(n.text)}</p></details></div>`
        : `<p class="ag-notice ${cls}" role="${role}"><b>${esc(n.label || fallback)}</b> ${esc(n.text)}</p>`;
      root.innerHTML = `<header class="ag-top"><div class="ag-top-inner"><a class="ag-brand" href="${esc(pageURL(pages[0]))}">${B.mark ? `<img class="ag-mark" src="${esc(safeURL(B.mark, ASSETS))}" alt="" width="36" height="36">` : ''}<span class="ag-wordmark">${esc(words[0])}${words[1] ? `<span>${esc(words[1])}</span>` : ''}</span>${B.label ? `<span class="ag-brand-label">${esc(B.label)}</span>` : ''}</a></div></header>
      <main class="ag-main">${notice(D.prerelease, 'ag-prerelease', 'Pre-release', 'alert')}<nav class="ag-nav" aria-label="Guide pages">${pages.map(p => `<a href="${esc(pageURL(p))}" ${p === page ? 'aria-current="page"' : ''}>${esc(p.title)}</a>`).join('')}</nav>${notice(D.warning, 'ag-warning', 'Safety', 'note')}<div id="ag-content">${page.view === 'intro' ? renderIntro() : page.view === 'bom' ? renderBOM() : renderBoard()}</div>
      <footer class="ag-footer"><span>${board ? (persistent ? 'Progress saved in this browser' : 'Storage unavailable · progress lasts for this visit') : esc(B.footer || '')}${D.revision ? ' · revision ' + esc(D.revision) : ''}</span>${button('Print', 'print')}</footer></main>`;
      bind();
      if (board) {
        const canvas = root.querySelector('.ag-board-canvas');
        drawing = {destroy() { this.dead = true; this.inner?.destroy(); }, zoom(v) { this.inner?.zoom(v); }, fit() { this.inner?.fit(); }, highlight(...a) { this.inner?.highlight(...a); }}; const rendered = drawing;
        boardRenderer().then(mountBoard => {
          if (rendered.dead) return;
          rendered.inner = mountBoard(canvas, board, {key: page.board, step: state.step, wire: state.wire, scope: state.scope, zoom: state.zoom, base: new URL('vendor/libavoid/', HERE).href,
            label, select(no) { const i = steps.findIndex(s => s.connections.some(c => c.no === no)); navigate(page, i, steps[i].connections.findIndex(c => c.no === no)); }});
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
    const twoColumns = matchMedia('(min-width:900px)');
    function fitWorkspace() {
      const canvas = root.querySelector('.ag-board-canvas');
      let frame;
      const fit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (state.expanded) return;
          const below = root.querySelectorAll(twoColumns.matches ? '.ag-board-legend' : '.ag-board-legend, .ag-board-toolbar, .ag-connection-detail, .ag-wire-navigation');
          const reserved = [...below].reduce((sum, el) => {
            const style = getComputedStyle(el);
            return sum + el.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
          }, 14);
          const top = canvas.getBoundingClientRect().top + window.scrollY;
          // stacked layout: never smaller than half the screen or the diagram's own height at full width
          const floor = twoColumns.matches ? 120 : Math.min(Math.round(window.innerHeight * .5), Math.round(canvas.clientWidth * board.size[1] / board.size[0]));
          canvas.style.setProperty('--ag-canvas-height', Math.max(floor, window.innerHeight - top - reserved) + 'px');
        });
      };
      const observer = new ResizeObserver(fit);
      for (const el of root.querySelectorAll('.ag-top, .ag-prerelease, .ag-nav, .ag-warning, .ag-page-heading, .ag-steps, .ag-work-heading, .ag-board-toolbar, .ag-board-legend, .ag-connection-detail, .ag-wire-navigation')) observer.observe(el);
      window.addEventListener('resize', fit); fit();
      return () => { observer.disconnect(); window.removeEventListener('resize', fit); cancelAnimationFrame(frame); };
    }
    // intro sections: a list item is text or [bold lead, text]; a section has list, steps or text
    const item = t => Array.isArray(t) ? `<b>${esc(t[0])}</b> ${esc(t[1])}` : esc(t);
    const paragraphs = (text, className) => (Array.isArray(text) ? text : [text]).filter(t => t != null).map(t => `<p class="${className}">${esc(t)}</p>`).join('');
    const block = s => s.steps ? `<ol class="ag-list">${s.steps.map(t => `<li>${item(t)}</li>`).join('')}</ol>`
      : s.list ? `<ul class="ag-list">${s.list.map(t => `<li>${item(t)}</li>`).join('')}</ul>` : paragraphs(s.text, 'ag-text');
    const ICON = {video: '<rect x="5" y="10" width="38" height="28" rx="5"/><path d="m20 17 11 7-11 7Z"/>', image: '<rect x="5" y="5" width="38" height="38" rx="5"/><circle cx="16" cy="16" r="4"/><path d="m5 35 12-12 9 9 7-7 10 10"/>'};
    function media(m) {
      const kind = m.kind === 'video' ? 'video' : 'image';
      if (m.src) {
        const src = esc(safeURL(m.src, ASSETS));
        return `<figure class="ag-media ag-media-${kind}">${kind === 'video' ? `<video src="${src}" controls preload="metadata"></video>` : `<img src="${src}" alt="${esc(m.alt)}" loading="lazy">`}${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
      }
      return `<figure class="ag-media-placeholder ag-media-${kind}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${ICON[kind]}</svg><figcaption>${esc(m.caption)}</figcaption></figure>`;
    }
    function renderIntro() {
      const I = D.intro, M = I.media || [];
      return `<section class="ag-intro"><div class="ag-intro-copy"><h1>${esc(I.title)}</h1>${paragraphs(I.lead, 'ag-lead')}${(I.sections || []).map(s => `<h2>${esc(s.title)}</h2>${block(s)}`).join('')}</div>
        ${M.length ? `<aside class="ag-intro-media" aria-label="Media">${M.map(media).join('')}</aside>` : ''}</section>`;
    }
    function stepNavigation() {
      return `<nav class="ag-steps" aria-label="${esc(page.title)} steps">${steps.map((s, i) => {
        const total = s.connections.length, done = count(s.connections, connKey);
        return `<button type="button" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''}><span class="ag-step-id ${done === total ? 'complete' : ''}">${done === total ? '✓' : esc(s.id)}</span><span><b>${esc(s.title)}</b><small>${done} / ${total}</small></span></button>`;
      }).join('')}</nav>`;
    }
    function toolbar() {
      const option = (value, text) => `<option value="${value}" ${state.scope === value ? 'selected' : ''}>${text}</option>`;
      return `<div class="ag-board-toolbar"><label>Show <select id="ag-wire-scope" aria-label="Visible connections">${option('step', 'This step')}${board.single ? option('single', 'Selected connection') : ''}${option('all', 'All connections')}</select></label><div class="ag-board-controls">${button('−', 'zoom-out', 'aria-label="Zoom out"')}${button('Fit', 'zoom-fit')}${button('+', 'zoom-in', 'aria-label="Zoom in"')}${button('⛶ Fullscreen', 'fullscreen', 'class="ag-fullscreen-button"')}</div></div>`;
    }
    function connectionSummary(c) {
      const diode = color(c).diode, key = connKey(c), cable = diode ? '' : [c.cable, c.size].filter(Boolean).join(' · ');
      return `<div class="ag-connection-detail"><div><small>FROM${diode ? ' · RING END' : ''}</small><strong>${esc(label(c, 'a'))}</strong></div><span class="ag-detail-arrow">→</span><div><small>TO${diode ? ' · PLAIN END' : ''}</small><strong>${esc(label(c, 'b'))}</strong></div>${cable ? `<div class="ag-cable"><small>CABLE</small><strong>${esc(cable)}</strong></div>` : ''}<label class="ag-verify"><input type="checkbox" data-check="${esc(key)}" ${checked(key) ? 'checked' : ''}>${checked(key) ? 'Checked' : 'Mark checked'}</label></div>`;
    }
    const legendItem = l => typeof l === 'string' ? `<span>${esc(l)}</span>` : `<span>${l.key === 'diode' ? '<i class="ag-diode-key"></i>' : ''}${esc(l.text)}</span>`;
    function renderBoard() {
      const s = steps[state.step], c = s.connections[state.wire], all = steps.flatMap(x => x.connections);
      const atEnd = state.step === steps.length - 1 && state.wire === s.connections.length - 1;
      const nextPage = pages.find(p => p.id === board.next);
      const first = state.step === 0 && state.wire === 0, last = atEnd && !nextPage;
      const next = atEnd && nextPage ? `Open ${esc(nextPage.title.toLowerCase())} →` : state.wire === s.connections.length - 1 ? 'Next step →' : 'Next connection →';
      const listed = board.listAll ? all : s.connections;
      return `<section class="ag-workspace"><div class="ag-page-heading"><h1>${esc(page.title)}</h1><span class="ag-progress">${count(all, connKey)} / ${all.length} checked</span></div>${stepNavigation()}<div class="ag-work"><div class="ag-work-heading"><h2>${esc(s.title)}</h2></div>
      <div class="ag-panel ag-full-board"><div class="ag-board-canvas" tabindex="0" role="region" aria-label="${esc(board.label || page.title)}"><span class="ag-board-loading">Loading board…</span></div><div class="ag-board-legend">${(board.legend || []).map(legendItem).join('')}</div></div>
      ${toolbar()}
      ${connectionSummary(c)}
      <div class="ag-wire-navigation">${button('← Previous', 'prev-wire', `class="ag-quiet" ${first ? 'disabled' : ''}`)}<span>${state.wire + 1} / ${s.connections.length}</span>${button(last ? 'Last connection' : next, 'next-wire', `class="ag-primary" ${last ? 'disabled' : ''}`)}</div>
      <div class="ag-list-heading"><h3>${board.listAll ? `All ${esc(page.title.toLowerCase())} connections` : 'Connections in this step'}</h3></div><div class="ag-wire-list">${listed.map(v => connectionRow(v, v === c, s.connections.indexOf(v))).join('')}</div>
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
      return `<section><div class="ag-page-heading"><div><h1>${esc(page.title)}</h1>${bom.note ? `<p>${esc(bom.note)}</p>` : ''}</div><div class="ag-bom-actions"><span class="ag-progress">${count(items, bomKey)} / ${items.length} checked</span>${button('↓ Export CSV', 'export', 'class="ag-primary"')}</div></div><div class="ag-bom-tools"><label class="ag-search"><input type="search" id="ag-search" placeholder="Find a component…" aria-label="Search BOM" value="${esc(state.search)}"></label></div><div id="ag-bom-results">${bomRows()}</div></section>`;
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
      return `<div class="ag-bom-table"><table><caption class="ag-sr">Bill of materials</caption><thead><tr><th scope="col">Qty</th><th scope="col">Component</th><th scope="col">Specification</th></tr></thead><tbody>${parts.map(row).join('')}</tbody></table></div><p class="ag-result-count">${parts.length} / ${items.length} components</p>`;
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
      if (i >= steps.length) { const target = pages.find(p => p.id === board.next); return target && navigate(target); }
      navigate(page, i, j);
    }
    function updateScreenButton() { root.querySelectorAll('[data-action=fullscreen]').forEach(b => { b.textContent = state.expanded ? '⤢ Exit fullscreen' : '⛶ Fullscreen'; b.setAttribute('aria-pressed', String(state.expanded)); }); document.body.classList.toggle('ag-no-scroll', state.expanded); }
    async function toggleScreen() {
      if (state.expanded) { if (document.fullscreenElement === root) await document.exitFullscreen(); state.expanded = false; }
      else { state.expanded = true; root.classList.add('ag-expanded'); try { await root.requestFullscreen(); } catch {} }
      root.classList.toggle('ag-expanded', state.expanded); updateScreenButton();
    }
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { state.expanded = false; root.classList.remove('ag-expanded'); updateScreenButton(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.expanded && !document.fullscreenElement) toggleScreen(); });
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
      const scope = root.querySelector('#ag-wire-scope'); if (scope) scope.onchange = () => { state.scope = scope.value; render(); };
      for (const b of root.querySelectorAll('[data-step]')) b.onclick = () => navigate(page, Number(b.dataset.step));
      for (const b of root.querySelectorAll('[data-wire]')) b.onclick = () => navigate(page, state.step, Number(b.dataset.wire));
      for (const b of root.querySelectorAll('[data-goto]')) b.onclick = () => { const i = steps.findIndex(s => s.connections.some(c => c.no === b.dataset.goto)); navigate(page, i, steps[i].connections.findIndex(c => c.no === b.dataset.goto)); };
      bindChecks(root);
      const search = root.querySelector('#ag-search'); if (search) search.oninput = () => { state.search = search.value; const results = root.querySelector('#ag-bom-results'); results.innerHTML = bomRows(); bindChecks(results); };
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
    window.addEventListener('hashchange', () => { readHash(); render(); });
    readHash(); render();
  }

  window.BuildGuide = {mount};
  const root = document.getElementById('assembly-guide');
  if (!root) return;
  const inline = document.getElementById('guide-data');
  const data = root.dataset.src ? fetch(new URL(root.dataset.src, location.href)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }) : Promise.resolve().then(() => inline && JSON.parse(inline.textContent));
  data.then(D => D && mount(root, D)).catch(() => { root.textContent = 'Guide data unavailable.'; });
})();
