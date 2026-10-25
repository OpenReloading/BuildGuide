// BuildGuide board renderer: JointJS parts with terminals and libavoid orthogonal routes, for wiring and tubing alike.
// The component around it owns navigation and saved progress; this renderer owns only its drawing.
(() => {
  let library;
  const cachedRoutes = new Map();
  function ready(base) {
    if (!library) library = import(base + 'index.js').then(async ({AvoidLib}) => {
      await AvoidLib.load(base + 'libavoid.wasm');
      return AvoidLib.getInstance();
    }).catch(error => { library = null; throw error; });
    return library;
  }
  const FONT = 'system-ui, Segoe UI, Helvetica, Arial, sans-serif';
  const PIN_TEXT = {'-': '−'};
  const DEFAULT_KIND = {fill: '#f1f5f9', stroke: '#17202a'};
  const DIR = {top: 1, bottom: 2, left: 4, right: 8};   // libavoid ConnDirFlags
  // text on a dark part: light ink (hex fills only, anything else keeps the dark ink)
  const inkOn = fill => { const n = /^#[0-9a-f]{6}$/i.test(fill) ? Number.parseInt(fill.slice(1), 16) : 0xffffff; return .299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255) < 128 ? {fill: '#e2e8f0'} : {}; };
  const end = e => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)]; };

  window.BuildGuideBoard = (root, B, options) => {
    if (!window.joint) { root.textContent = 'Board renderer unavailable. Use the connection list below.'; return {destroy() {}, zoom() {}, fit() {}, highlight() {}}; }
    let disposed = false;
    const {dia, shapes} = joint;
    const [W, H] = B.size;
    const kinds = B.kinds || {}, colors = B.colors || {}, parts = B.parts || {}, areas = B.areas || {};
    const kindOf = p => ({...DEFAULT_KIND, ...kinds[p.kind]});
    const colorOf = c => ({line: '#64748b', outline: '#1f2937', ...colors[c.color]});

    const Area = dia.Element.define('buildguide.Area', {
      attrs: {body: {width: 'calc(w)', height: 'calc(h)', rx: 12, fill: '#f8fafc', strokeWidth: 1.5, strokeDasharray: '6 5'}},
    }, {markup: [{tagName: 'rect', selector: 'body'}]});
    // area titles are their own elements, so the router keeps connections off them
    const Caption = dia.Element.define('buildguide.Caption', {
      attrs: {label: {x: 0, y: 14, fontSize: 14, fontWeight: 700, fontFamily: FONT, stroke: '#ffffff', strokeWidth: 4, paintOrder: 'stroke'}},
    }, {markup: [{tagName: 'text', selector: 'label'}]});
    const Part = dia.Element.define('buildguide.Part', {
      attrs: {
        body: {width: 'calc(w)', height: 'calc(h)', rx: 6, strokeWidth: 1.5},
        title: {x: 'calc(0.5*w)', y: -10, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fill: '#17202a', fontFamily: FONT},
        sub: {x: 'calc(0.5*w)', y: 'calc(h+17)', textAnchor: 'middle', fontSize: 11.5, fontWeight: 600, fill: '#5b6672', fontFamily: FONT},
      },
    }, {markup: [{tagName: 'rect', selector: 'body'}, {tagName: 'rect', selector: 'band'},
                 {tagName: 'text', selector: 'title'}, {tagName: 'text', selector: 'sub'}]});

    const ns = {...shapes, buildguide: {Area, Part, Caption}};
    const graph = new dia.Graph({}, {cellNamespace: ns});
    const holder = document.createElement('div');
    const paper = new dia.Paper({
      el: holder, model: graph, width: W, height: H, cellViewNamespace: ns, interactive: false,
      background: {color: 'transparent'}, async: false,   // the canvas behind it carries the surface colour
      labelsLayer: true,   // connection numbers above the parts, never hidden under a terminal
    });

    // areas (frame: false = a zone title inside another area), decorative props, parts with their terminals
    for (const [key, a] of Object.entries(areas)) {
      const frame = a.frame !== false;
      // z below the connections (5.5): frames and titles never cover them
      if (frame) graph.addCell(new Area({id: 'area-' + key, z: 1, position: {x: a.at[0], y: a.at[1]}, size: {width: a.size[0], height: a.size[1]},
        attrs: {body: {stroke: a.color}}}));
      graph.addCell(new Caption({id: 'caption-' + key, z: 2, position: {x: a.at[0] + (frame ? 14 : 0), y: a.at[1] + (frame ? 10 : 0)},
        size: {width: a.title.length * 8, height: 18}, attrs: {label: {text: a.title, fill: a.color}}}));
      for (const [x, name] of a.glands || []) graph.addCell(new Caption({id: 'gland-' + name, z: 2, position: {x: x + 26, y: a.at[1] - 9},
        size: {width: 22, height: 18}, attrs: {label: {text: name, fill: a.color, fontSize: 12}}}));
    }
    for (const [i, p] of (B.props || []).entries()) graph.addCell(new shapes.standard.Rectangle({
      id: 'prop-' + i, position: {x: p.at[0], y: p.at[1]}, size: {width: p.size[0], height: p.size[1]},
      attrs: {body: {fill: '#e5e7eb', stroke: '#475569', rx: 4}, label: {text: p.name, fontSize: 12, fontWeight: 600, fill: '#475569', fontFamily: FONT}},
    }));

    for (const [id, p] of Object.entries(parts)) {
      const k = kindOf(p), inset = k.inset || 0, offset = k.offset || {};
      const groups = {}, items = [];
      for (const [side, pins] of Object.entries(p.ports || {})) {
        const args = {left: {dx: inset}, right: {dx: -inset}, top: {dy: offset.top || 0}, bottom: {dy: offset.bottom || 0}}[side];
        groups[side] = {position: {name: side, args}};
        for (const pin of pins) {
          const core = k.pins?.[pin];
          items.push({
            id: pin, group: side,
            markup: [{tagName: 'circle', selector: 'pb'}, {tagName: 'text', selector: 'pt'}],
            attrs: {
              pb: core ? {r: 6, fill: core, stroke: core} : {r: 9.5, fill: '#e5e7eb', stroke: '#9ca3af', strokeWidth: 1},
              pt: {text: core ? '' : (PIN_TEXT[pin] || pin), textAnchor: 'middle', y: 3.6, fontSize: pin.length > 2 ? 8.5 : 10,
                   fontWeight: 700, fill: '#475569', fontFamily: FONT, pointerEvents: 'none'},
            },
          });
        }
      }
      const body = k.round ? {fill: p.color || k.fill, stroke: k.stroke, rx: p.size[0] / 2} : {fill: k.fill, stroke: k.stroke, ...(k.rx != null && {rx: k.rx})};
      graph.addCell(new Part({
        id, position: {x: p.at[0], y: p.at[1]}, size: {width: p.size[0], height: p.size[1]},
        ports: {groups, items},
        // a title or label on a side with terminals is drawn inside the part, so no connection has to cross it
        attrs: {body, title: {text: p.name || '', y: p.ports?.top ? 24 : -10, ...(p.ports?.top && inkOn(body.fill))},
                sub: {text: p.sub || '', y: p.ports?.bottom ? 'calc(h-14)' : 'calc(h+17)', ...(p.ports?.bottom && inkOn(body.fill))},
                // a band on the right edge, e.g. the silver ring of a diode
                band: k.band ? {x: 'calc(w-14)', y: 0, width: 7, height: 'calc(h)', fill: k.band === true ? '#d1d5db' : k.band} : {display: 'none'}},
      }));
    }

    // routing with libavoid: orthogonal connections around the parts, parallel ones nudged apart.
    // Every part is a rectangle with its terminals as pins. A title or label on a side without terminals lies outside the part
    // and is part of the rectangle; terminal circles sit on the part edge, so a side with terminals is padded instead.
    const obstacles = graph.getElements().filter(el => el.get('type') !== 'buildguide.Area').map(el => {
      const b = el.getBBox(), part = parts[el.id] || {}, k = part.kind ? kindOf(part) : {};
      const pad = side => (part.ports?.[side] && !k.inset ? 14 : 0);
      const y0 = b.y - Math.max(part.name && !part.ports?.top ? 22 : 0, pad('top')), y1 = b.y + b.height + Math.max(part.sub && !part.ports?.bottom ? 22 : 0, pad('bottom'));
      const x0 = b.x - pad('left'), x1 = b.x + b.width + pad('right');
      const pins = [];   // at the terminals themselves: the last leg of a connection runs straight into its terminal
      for (const [side, names] of Object.entries(part.ports || {})) {
        const pos = el.getPortsPositions(side);
        for (const pin of names) pins.push({key: el.id + ':' + pin, ox: b.x - x0 + pos[pin].x, oy: b.y + pos[pin].y - y0, dir: DIR[side]});
      }
      return {id: el.id, x0, y0, x1, y1, pins};
    });
    // the walls of a box with glands: connections leave it only through the gaps, and
    // tall fences between the glands outside keep each cable in its own gland's channel
    for (const [key, a] of Object.entries(areas)) {
      if (!a.glands) continue;
      const [x0, y0] = a.at, x1 = x0 + a.size[0], y1 = y0 + a.size[1], t = 4, gap = 36;
      const wall = (xa, ya, xb, yb) => obstacles.push({id: 'wall-' + key + obstacles.length, x0: xa, y0: ya, x1: xb, y1: yb, pins: []});
      const gx = a.glands.map(g => g[0]).sort((p, q) => p - q);
      let x = x0 - t;
      for (const g of gx) { wall(x, y0 - t, g - gap, y0 + t); x = g + gap; }
      wall(x, y0 - t, x1 + t, y0 + t); wall(x0 - t, y1 - t, x1 + t, y1 + t); wall(x0 - t, y0 - t, x0 + t, y1 + t); wall(x1 - t, y0 - t, x1 + t, y1 + t);
      for (let i = 1; i < gx.length; i++) { const m = (gx[i - 1] + gx[i]) / 2; wall(m - 2, -5000, m + 2, y0); }
    }

    // libavoid returns a straight line between the terminals when it finds no way round: such a route is not orthogonal
    const orthogonal = pts => pts.every((p, i) => !i || Math.abs(p.x - pts[i - 1].x) < .5 || Math.abs(p.y - pts[i - 1].y) < .5);
    // the room between parts shrinks with the buffer around them: the widest that finds a route for every connection wins
    function route(Avoid, list) {
      let routes;
      for (const buffer of [14, 8, 4, 0]) { routes = attempt(Avoid, list, buffer); if (routes.every((pts, i) => colorOf(list[i]).diode || orthogonal(pts))) break; }
      return routes.map(pts => pts.slice(1, -1));   // the terminals are the connection's ends: the vertices are the bends between
    }
    function attempt(Avoid, list, buffer) {
      const param = n => Avoid.RoutingParameter[n], option = n => Avoid.RoutingOption[n];
      const r = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value);
      r.setRoutingParameter(param('shapeBufferDistance'), buffer);
      r.setRoutingParameter(param('idealNudgingDistance'), 14);
      r.setRoutingParameter(param('segmentPenalty'), 40);
      r.setRoutingParameter(param('crossingPenalty'), 200);
      r.setRoutingOption(option('nudgeOrthogonalSegmentsConnectedToShapes'), false);   // the leg into a terminal stays on it
      r.setRoutingOption(option('nudgeSharedPathsWithCommonEndPoint'), true);
      r.setRoutingOption(option('performUnifyingNudgingPreprocessingStep'), true);
      const shapeOf = {}, pinOf = {};
      let cls = 1;
      for (const o of obstacles) {
        const shape = new Avoid.ShapeRef(r, new Avoid.Rectangle(new Avoid.Point(o.x0, o.y0), new Avoid.Point(o.x1, o.y1)));
        shapeOf[o.id] = shape;
        for (const p of o.pins) {
          const pin = new Avoid.ShapeConnectionPin(shape, cls, p.ox / (o.x1 - o.x0), p.oy / (o.y1 - o.y0), true, 0, p.dir);
          pin.setExclusive(false);   // a terminal may take two connections
          pinOf[p.key] = cls++;
        }
      }
      const ref = e => new Avoid.ConnEnd(shapeOf[end(e)[0]], pinOf[e]);
      const conns = list.map(c => new Avoid.ConnRef(r, ref(c.a), ref(c.b)));
      r.processTransaction();
      const routes = conns.map(c => {
        const pl = c.displayRoute(), pts = [];
        for (let i = 0; i < pl.size(); i++) pts.push({x: pl.at(i).x, y: pl.at(i).y});
        return pts;
      });
      r.delete();
      return routes;
    }

    // a diode drawn as a part across two terminals: it loops around a part whose kind says so, else it hangs above or below
    function diodeVertices(id, sourcePin, targetPin) {
      const part = parts[id], el = graph.getCell(id), k = kindOf(part);
      const sideOf = pin => Object.keys(part.ports).find(side => part.ports[side].includes(pin));
      const pos = pin => { const p = el.getPortsPositions(sideOf(pin))[pin]; return {x: part.at[0] + p.x, y: part.at[1] + p.y}; };
      const source = pos(sourcePin), target = pos(targetPin);
      const top = part.at[1] - (k.diodeLoop === 'around' ? 34 : 45);
      if (k.diodeLoop === 'around') return [{x: part.at[0] + part.size[0] + 14, y: source.y}, {x: part.at[0] + part.size[0] + 14, y: top}, {x: part.at[0] - 14, y: top}, {x: part.at[0] - 14, y: target.y}];
      // pins facing down: the diode hangs just below the part, across its two pins
      const y = sideOf(sourcePin) === 'bottom' ? part.at[1] + part.size[1] + 36 : top;
      return [{x: source.x, y}, {x: target.x, y}];
    }
    function link(c, i, vertices) {
      const [pa, a] = end(c.a), [pb, b] = end(c.b), col = colorOf(c), diode = col.diode;
      const l = new shapes.standard.DoubleLink({
        id: 'c' + c.no, source: {id: pa, port: a}, target: {id: pb, port: b},
        z: 5.5,   // above the area frames, below the parts: terminal numbers stay readable
        vertices: diode ? diodeVertices(pa, a, b) : vertices,
        connector: {name: 'rounded', args: {radius: 8}},
        attrs: {line: {stroke: col.line, strokeWidth: col.width || 4, targetMarker: {type: 'path', d: ''}},
                outline: {stroke: col.outline, strokeWidth: (col.width || 4) + 3}},
        labels: [{
          position: [0.5, 0.35, 0.65][i % 3],
          markup: [{tagName: 'rect', selector: 'pill'}, {tagName: 'text', selector: 'num'}],
          attrs: {
            num: {text: c.no, fontSize: 12, fontWeight: 800, fill: '#17202a', fontFamily: FONT, textAnchor: 'middle', textVerticalAnchor: 'middle'},
            pill: {ref: 'num', x: 'calc(x-7)', y: 'calc(y-3)', width: 'calc(w+14)', height: 'calc(h+6)', rx: 9, ry: 9,
                   fill: '#ffffff', stroke: col.outline, strokeWidth: 1.5},
          },
        }],
      });
      if (diode) {   // draw the part itself: dark body, ring towards the source end
        l.attr({line: {stroke: '#9ca3af', strokeWidth: 3}, outline: {stroke: '#4b5563', strokeWidth: 5}});
        l.labels([{
          position: {distance: 0.5, args: {keepGradient: true, ensureLegibility: false}},
          markup: [{tagName: 'rect', selector: 'body'}, {tagName: 'rect', selector: 'ring'}],
          attrs: {
            body: {x: -17, y: -8, width: 34, height: 16, rx: 4, fill: '#111827'},
            ring: {x: -13, y: -8, width: 6, height: 16, fill: '#d1d5db'},
          },
        }, {   // the name stays upright, just beside the body (above it when the diode hangs below a part)
          position: {distance: 0.5, offset: parts[pa].ports.bottom?.includes(a) ? -18 : 18},
          markup: [{tagName: 'text', selector: 'name'}],
          attrs: {name: {text: c.no, fontSize: 13, fontWeight: 800, fill: '#17202a', fontFamily: FONT, textAnchor: 'middle', textVerticalAnchor: 'middle'}},
        }]);
      }
      l.set({outlineColor: col.outline, outlineWidth: diode ? 5 : (col.width || 4) + 3});
      return l;
    }

    root.appendChild(holder);
    root.setAttribute('aria-label', options.name + '. Select a numbered connection to inspect it.');
    const steps = B.steps, all = steps.flatMap(s => s.connections);
    const step = steps[options.step];
    const selected = step.connections[options.wire];
    const visible = options.scope === 'all' ? all : options.scope === 'single' ? [selected] : step.connections;
    const used = new Set(visible.flatMap(c => [end(c.a)[0], end(c.b)[0]]));
    const terms = new Set([selected.a, selected.b]);
    for (const id of Object.keys(parts)) {
      const el = graph.getCell(id);
      el.attr('root/opacity', used.has(id) ? 1 : .65);
      for (const port of el.getPorts()) {
        if (terms.has(id + ':' + port.id)) {
          el.portProp(port.id, 'attrs/pb', {fill: '#e1f7df', stroke: '#237b33', strokeWidth: 3});
          el.portProp(port.id, 'attrs/pt/fill', '#173d23');
        }
      }
    }
    const links = {};
    function highlight(no, hot) {
      const l = links[no];
      if (!l) return;
      l.attr('outline/strokeWidth', hot ? 11 : l.get('outlineWidth'));
      l.attr('outline/stroke', hot ? '#198b47' : l.get('outlineColor'));
    }
    const label = options.label;
    const key = options.key + ':' + visible.map(c => c.no).join(',');
    ready(options.base).then(Avoid => {
      if (disposed) return;
      if (!cachedRoutes.has(key)) cachedRoutes.set(key, route(Avoid, visible));
      const routes = cachedRoutes.get(key);
      const views = visible.map((c, i) => {
        const l = link(c, i, routes[i]), diode = colorOf(c).diode;
        links[c.no] = l;
        graph.addCell(l);
        const view = paper.findViewByModel(l);
        view.el.dataset.connection = c.no;
        view.el.setAttribute('role', 'button');
        view.el.setAttribute('tabindex', '0');
        view.el.setAttribute('aria-label', c.no + ': ' + label(c, 'a') + ' to ' + label(c, 'b') + (diode ? '; ring at ' + label(c, 'a') : ''));
        view.el.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.select(c.no); }
        });
        if (options.focus === c.no) view.el.focus({preventScroll: true});
        return view;
      });
      // a number goes on a straight stretch, clear of bends, parts, labels, other numbers and other connections;
      // the longest stretches first, then a spot nearer the ends, then one beside another connection
      const lines = views.map(v => [v.sourcePoint, ...v.route, v.targetPoint]);
      const stretches = (line, grow) => line.slice(1).map((q, k) => ({x0: Math.min(line[k].x, q.x) - grow, y0: Math.min(line[k].y, q.y) - grow, x1: Math.max(line[k].x, q.x) + grow, y1: Math.max(line[k].y, q.y) + grow}));
      const free = (box, others) => !others.some(o => box.x0 < o.x1 && o.x0 < box.x1 && box.y0 < o.y1 && o.y0 < box.y1);
      const placed = [];
      visible.forEach((c, i) => {
        if (colorOf(c).diode) return;
        const fixed = [...obstacles, ...placed], near = lines.flatMap((line, j) => j === i ? [] : stretches(line, 5));
        const spots = lines[i].slice(1).flatMap((q, k) => {
          const p = lines[i][k], long = Math.hypot(q.x - p.x, q.y - p.y);
          return [.5, .35, .65, .2, .8].map(t => ({x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, long, room: long * Math.min(t, 1 - t)}));
        }).sort((u, v) => v.long - u.long);
        // shortcut: the box of a number is a fixed 30 x 24 px, enough for two digits
        const spot = [[20, [...fixed, ...near]], [20, fixed], [10, fixed]].reduce((found, [room, others]) =>
          found ?? spots.find(s => s.room >= room && free({x0: s.x - 15, y0: s.y - 12, x1: s.x + 15, y1: s.y + 12}, others)), null);
        const view = views[i], at = spot ?? view.getPointAtRatio(.5);
        links[c.no].label(0, {position: spot ? view.getClosestPointLength(at) / view.getConnectionLength() : .5});
        placed.push({x0: at.x - 17, y0: at.y - 14, x1: at.x + 17, y1: at.y + 14});
      });
      highlight(selected.no, true);
      root.dataset.ready = 'true';
    }).catch(() => {
      if (disposed) return;
      const note = document.createElement('p'); note.className = 'ag-board-error';
      note.textContent = 'Router unavailable. Use the labelled connection list below.'; root.appendChild(note);
      root.dataset.ready = 'error';
    });
    paper.on('link:mouseenter', view => highlight(view.model.id.slice(1), true));
    paper.on('link:mouseleave', view => highlight(view.model.id.slice(1), view.model.id === 'c' + selected.no));
    paper.on('link:pointerclick', view => options.select(view.model.id.slice(1)));
    let zoomFactor = options.zoom || 1;
    function fit() {
      if (disposed) return;
      const scale = Math.min(root.clientWidth / W, root.clientHeight / H) * zoomFactor;
      paper.setDimensions(W * scale, H * scale);
      paper.scale(scale);
    }
    const observer = new ResizeObserver(fit); observer.observe(root); fit();
    // printing: the whole board at page width
    const beforePrint = () => { const s = Math.min(700 / W, 700 / H); paper.setDimensions(W * s, H * s); paper.scale(s); };
    addEventListener('beforeprint', beforePrint); addEventListener('afterprint', fit);
    // mouse and pen dragging pans the zoomed canvas, touch scrolling stays native
    let drag;
    root.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.target.closest('.joint-link')) return;   // connections and their numbers stay clickable
      drag = {x: event.clientX, y: event.clientY, left: root.scrollLeft, top: root.scrollTop};
      root.setPointerCapture(event.pointerId);
    });
    root.addEventListener('pointermove', event => {
      if (!drag) return;
      root.scrollLeft = drag.left + drag.x - event.clientX; root.scrollTop = drag.top + drag.y - event.clientY;
    });
    root.addEventListener('pointerup', () => { drag = null; });
    root.addEventListener('pointercancel', () => { drag = null; });
    return {
      destroy() { disposed = true; observer.disconnect(); removeEventListener('beforeprint', beforePrint); removeEventListener('afterprint', fit); paper.remove(); graph.clear(); },
      zoom(value) { zoomFactor = value; fit(); },
      fit() { zoomFactor = 1; fit(); root.scrollTo(0, 0); },
      highlight,
    };
  };
})();
