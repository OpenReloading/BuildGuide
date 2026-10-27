// Prototype of the BuildGuide board renderer without third-party code: plain SVG parts and an orthogonal A* router with a nudging pass.
// Same entry point (window.BuildGuideBoard(root, board, options)), same options, same DOM hooks as src/buildguide-board.js,
// so the component and the browser tests run against it as they are. See README.md for how to try it.
(() => {
  const FONT = 'inherit';   // the drawing's text follows --ag-font through the canvas
  const PIN_TEXT = {'-': '−'};
  const DEFAULT_KIND = {fill: '#f1f5f9', stroke: '#17202a'};
  const SMALLEST = 8.5, PHONE = 560;   // px: smallest font size drawn below, canvas width of a phone
  const NS = 'http://www.w3.org/2000/svg';
  // guide colors reach fill and stroke: only a hex value or a color name passes, so url(...) never makes a request
  const paint = (v, fallback) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(v) ? v : fallback;
  const inkOn = fill => { const n = /^#[0-9a-f]{6}$/i.test(fill) ? Number.parseInt(fill.slice(1), 16) : 0xffffff; return .299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255) < 128 ? {fill: '#e2e8f0'} : {}; };
  const end = e => { const at = e.indexOf(':'); return [e.slice(0, at), e.slice(at + 1)]; };
  const wheelPx = (delta, mode) => delta * [1, 16, 400][mode || 0];
  const wheelFactor = (delta, mode) => Math.exp(-Math.max(-30, Math.min(30, wheelPx(delta, mode))) * .01);

  // ---- router: obstacles in, one polyline per wire out -------------------------------------------------------------
  // obstacles: {id, x0, y0, x1, y1, pins: [{key, x, y, side}]}; a wire leaves its terminal towards `side`, a rectangle each part
  // wires: [{a: pin key, b: pin key}]; result: [[{x, y}, ...]] from terminal to terminal, every leg horizontal or vertical
  const SIDE = {top: 0, bottom: 1, left: 2, right: 3};
  const STEP = [[0, -1], [0, 1], [-1, 0], [1, 0]];   // per heading; heading ^ 1 is the opposite one
  const q3 = v => Math.round(v * 1000);

  const heap = () => {
    const f = [], s = [];
    return {
      get size() { return f.length; },
      push(cost, state) {
        let i = f.push(cost) - 1; s.push(state);
        while (i) { const p = (i - 1) >> 1; if (f[p] <= cost) break; f[i] = f[p]; s[i] = s[p]; i = p; }
        f[i] = cost; s[i] = state;
      },
      pop() {
        const top = [f[0], s[0]], cost = f.pop(), state = s.pop();
        if (f.length) {
          let i = 0;
          for (;;) {
            let k = 2 * i + 1;
            if (k >= f.length) break;
            if (k + 1 < f.length && f[k + 1] < f[k]) k++;
            if (f[k] >= cost) break;
            f[i] = f[k]; s[i] = s[k]; i = k;
          }
          f[i] = cost; s[i] = state;
        }
        return top;
      },
    };
  };

  // drop repeated points and the middle one of three on a line
  const simplify = pts => {
    const out = [];
    for (const p of pts) {
      const last = out.at(-1);
      if (last && Math.abs(last.x - p.x) < .01 && Math.abs(last.y - p.y) < .01) continue;
      out.push({x: p.x, y: p.y});
      const n = out.length;
      if (n > 2) {
        const [a, b, c] = out.slice(-3);
        if ((Math.abs(a.x - b.x) < .01 && Math.abs(b.x - c.x) < .01) || (Math.abs(a.y - b.y) < .01 && Math.abs(b.y - c.y) < .01)) out.splice(n - 2, 1);
      }
    }
    return out;
  };

  // the grid of the free space: the edges of every box (grown by `buffer`), the points where wires leave the terminals, the middle of wide gaps
  function attempt(obstacles, pins, wires, buffer, o) {
    // inside the board: the fences of the glands reach far above it, and a wire must not go round their tops
    const [W, H] = o.bounds ?? [Infinity, Infinity], inset = o.bounds ? 6 : -Infinity;
    const boxes = obstacles.map(b => ({x0: Math.max(b.x0 - buffer, inset), y0: Math.max(b.y0 - buffer, inset), x1: Math.min(b.x1 + buffer, W - inset), y1: Math.min(b.y1 + buffer, H - inset)})).filter(b => b.x1 > b.x0 && b.y1 > b.y0);
    const stubOf = pin => {
      const b = pin.box;
      return [{x: pin.x, y: b.y0 - buffer}, {x: pin.x, y: b.y1 + buffer}, {x: b.x0 - buffer, y: pin.y}, {x: b.x1 + buffer, y: pin.y}][pin.dir];
    };
    const ends = wires.map(w => [pins[w.a], pins[w.b]]), stubs = ends.map(e => e.map(stubOf));
    const axis = (list, lo, hi) => {
      const u = [...new Set([...list, lo, hi].map(q3))].sort((p, q) => p - q).map(v => v / 1000), out = [];
      u.forEach((v, i) => { if (i && v - u[i - 1] >= 16) out.push((v + u[i - 1]) / 2); out.push(v); });
      return out;
    };
    const xs = axis([...boxes.flatMap(b => [b.x0, b.x1]), ...stubs.flat().map(p => p.x)], o.bounds ? inset : Math.min(...boxes.map(b => b.x0)) - 24, o.bounds ? W - inset : Math.max(...boxes.map(b => b.x1)) + 24);
    const ys = axis([...boxes.flatMap(b => [b.y0, b.y1]), ...stubs.flat().map(p => p.y)], o.bounds ? inset : Math.min(...boxes.map(b => b.y0)) - 24, o.bounds ? H - inset : Math.max(...boxes.map(b => b.y1)) + 24);
    const ix = new Map(xs.map((v, i) => [q3(v), i])), iy = new Map(ys.map((v, i) => [q3(v), i]));
    const nx = xs.length, ny = ys.length, cw = nx - 1, N = nx * ny;
    const cell = new Uint8Array(cw * (ny - 1));   // 1: inside some box
    for (const b of boxes) for (let j = iy.get(q3(b.y0)); j < iy.get(q3(b.y1)); j++) for (let i = ix.get(q3(b.x0)); i < ix.get(q3(b.x1)); i++) cell[j * cw + i] = 1;
    // an edge is shut when both its sides are inside boxes; along the border of a box it is free
    const shut = (i, j, d) => d < 2
      ? i > 0 && i < cw && cell[(d ? j : j - 1) * cw + i - 1] && cell[(d ? j : j - 1) * cw + i]
      : j > 0 && j < ny - 1 && cell[(j - 1) * cw + (d === 3 ? i : i - 1)] && cell[j * cw + (d === 3 ? i : i - 1)];
    const useH = new Uint16Array(N), useV = new Uint16Array(N), pass = new Uint16Array(N * 2);   // wires per edge, and straight through a node (horizontal, vertical)
    const edge = (n, d) => d < 2 ? [useV, d ? n : n - nx] : [useH, d === 3 ? n : n - 1];
    const result = [];
    const length2 = w => Math.abs(ends[w][0].x - ends[w][1].x) + Math.abs(ends[w][0].y - ends[w][1].y);
    const order = wires.map((_, w) => w).sort((a, b) => o.order === 'short' ? length2(a) - length2(b) : o.order === 'long' ? length2(b) - length2(a) : a - b);
    order.forEach(w => {
      const [pa, pb] = ends[w], [sa, sb] = stubs[w], start = iy.get(q3(sa.y)) * nx + ix.get(q3(sa.x)), goal = iy.get(q3(sb.y)) * nx + ix.get(q3(sb.x)), want = pb.dir ^ 1;
      const gx = xs[goal % nx], gy = ys[Math.trunc(goal / nx)], h = n => Math.abs(xs[n % nx] - gx) + Math.abs(ys[Math.trunc(n / nx)] - gy);
      const dist = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), open = heap();
      const s0 = start * 4 + pa.dir;
      dist[s0] = 0; open.push(h(start), s0);
      let best = Infinity, last = -1;
      while (open.size) {
        const [f, s] = open.pop(), n = s >> 2, hd = s & 3, g = dist[s];
        if (f >= best) break;
        if (f > g + h(n) + 1e-9) continue;   // a state that was improved after it was queued
        if (n === goal) { const total = g + (hd === want ? 0 : o.bend); if (total < best) { best = total; last = s; } continue; }
        const i = n % nx, j = Math.trunc(n / nx);
        for (let d = 0; d < 4; d++) {
          if (d === (hd ^ 1)) continue;
          const i2 = i + STEP[d][0], j2 = j + STEP[d][1];
          if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny || shut(i, j, d)) continue;
          const n2 = j2 * nx + i2, len = Math.abs(xs[i2] - xs[i]) + Math.abs(ys[j2] - ys[j]), [use, at] = edge(n, d);
          let c = g + len;
          if (d !== hd) c += o.bend;
          else if (n !== start && pass[n * 2 + (d < 2 ? 0 : 1)]) c += o.cross;
          if (use[at]) c += o.share + len / 2;
          const s2 = n2 * 4 + d;
          if (c < dist[s2]) { dist[s2] = c; prev[s2] = s; open.push(c + h(n2), s2); }
        }
      }
      if (last < 0) { result[w] = null; return; }
      const states = [];
      for (let s = last; s >= 0; s = prev[s]) states.unshift(s);
      states.forEach((s, k) => {
        if (!k) return;
        const [use, at] = edge(states[k - 1] >> 2, s & 3);
        use[at]++;
        if (k < states.length - 1 && (states[k + 1] & 3) === (s & 3)) pass[(s >> 2) * 2 + ((s & 3) < 2 ? 1 : 0)]++;
      });
      result[w] = simplify([pa, ...states.map(s => ({x: xs[(s >> 2) % nx], y: ys[Math.trunc((s >> 2) / nx)]})), pb]);
    });
    return result;
  }

  // Parallel legs that run side by side are spread over the room between the parts. The legs at the terminals stay where they are
  // and the others keep clear of them.
  // shortcut: one pass, horizontal legs then vertical ones; the legs of a group keep to the room between the parts and do not look at each other's bends, upgrade to a nudging graph if crossings between groups show
  function nudge(paths, obstacles, o) {
    for (const perp of ['y', 'x']) {
      const along = perp === 'y' ? 'x' : 'y', lo = `${perp}0`, hi = `${perp}1`, alo = `${along}0`, ahi = `${along}1`;
      const segs = [];
      for (const [w, pts] of paths.entries()) for (const [k, p] of pts.entries()) {
        const q = pts[k + 1];
        if (q && Math.abs(p[perp] - q[perp]) < .01 && Math.abs(p[along] - q[along]) > .01) segs.push({w, k, fixed: !k || k === pts.length - 2, c: p[perp], lo: Math.min(p[along], q[along]), hi: Math.max(p[along], q[along])});
      }
      const parent = segs.map((_, i) => i), find = i => { while (parent[i] !== i) i = parent[i]; return i; };
      for (const [i, a] of segs.entries()) for (const [j, b] of segs.entries()) {
        if (j > i && Math.abs(a.c - b.c) < o.gap - .5 && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > 1) parent[find(i)] = find(j);
      }
      const groups = new Map();
      for (const [i, s] of segs.entries()) groups.set(find(i), [...(groups.get(find(i)) ?? []), s]);
      for (const members of groups.values()) {
        const g = members.filter(s => !s.fixed), pinned = members.filter(s => s.fixed).map(s => s.c);
        if (!g.length || members.length < 2) continue;
        const cs = members.map(s => s.c), cMin = Math.min(...cs), cMax = Math.max(...cs), from = Math.min(...members.map(s => s.lo)), to = Math.max(...members.map(s => s.hi));
        let low = -Infinity, high = Infinity;
        for (const b of obstacles) {
          if (!(b[alo] < to && b[ahi] > from)) continue;
          if (b[hi] <= cMin + .5) low = Math.max(low, b[hi]); else if (b[lo] >= cMax - .5) high = Math.min(high, b[lo]);
        }
        const m = 4, room = high - low - 2 * m;
        if (room < 0) continue;
        const step = Math.min(o.gap, room / (members.length - 1)), span = step * (members.length - 1), mean = cs.reduce((t, c) => t + c, 0) / cs.length;
        let at = Math.min(Math.max(mean - span / 2, low + m), high - m - span);
        // a leg that came from and goes to the lower side lies below the others: fewer crossings
        const side = s => { const pts = paths[s.w]; return Math.sign(pts[s.k - 1][perp] - s.c) + Math.sign(pts[s.k + 2][perp] - s.c); };
        for (const s of g.sort((a, b) => side(a) - side(b) || a.c - b.c || a.w - b.w)) {
          for (const f of pinned) if (Math.abs(at - f) < step - .5) at = f + step;
          paths[s.w][s.k][perp] = paths[s.w][s.k + 1][perp] = at;
          at += step;
        }
      }
    }
    // a jog of a few pixels between two parallel legs, left by two nudges, is straightened
    for (const pts of paths) for (let i = 1; i < pts.length - 3; i++) {
      const [p, q, r] = [pts[i], pts[i + 1], pts[i + 2]], axis = Math.abs(p.y - q.y) < .01 ? 'x' : 'y', other = axis === 'x' ? 'y' : 'x';
      if (Math.abs(p[other] - q[other]) < .01 && Math.abs(p[axis] - q[axis]) < 3 && Math.abs(q[axis] - r[axis]) < .01) { q[axis] = r[axis] = p[axis]; }
    }
    return paths.map(simplify);
  }

  function route(obstacles, wires, options = {}) {
    // shortest wires first: they take the direct ways, the long ones go round
    const o = {levels: [14, 8, 4, 0], gap: 14, bend: 80, cross: 500, share: 50, order: 'short', ...options};
    const pins = {};
    for (const b of obstacles) for (const p of b.pins) pins[p.key] = {...p, dir: SIDE[p.side], box: b};
    let paths = [];
    // the room between parts shrinks with the buffer around them: the widest that finds a route for every wire wins
    if (wires.length) for (const buffer of o.levels) { paths = attempt(obstacles, pins, wires, buffer, o); if (paths.every(Boolean)) break; }
    // no way round: the straight line, which is not orthogonal and shows
    paths = paths.map((p, i) => p ?? [pins[wires[i].a], pins[wires[i].b]].map(q => ({x: q.x, y: q.y})));
    return nudge(paths, obstacles, o);
  }

  // ---- renderer ------------------------------------------------------------------------------------------------------
  const cachedRoutes = new Map();
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    parent?.appendChild(e);
    return e;
  };
  const sel = (tag, selector, attrs, parent) => svg(tag, {'joint-selector': selector, ...attrs}, parent);
  const text = (selector, content, attrs, parent) => { const t = sel('text', selector, {'font-family': FONT, ...attrs}, parent); t.textContent = content; return t; };
  const length = pts => pts.slice(1).reduce((t, p, i) => t + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
  // the point at arc length `at` of a polyline, with the heading of its leg
  function along(pts, at) {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], len = Math.hypot(q.x - p.x, q.y - p.y);
      if (at <= len || i === pts.length - 1) { const t = len ? Math.min(at, len) / len : 0; return {x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, angle: Math.atan2(q.y - p.y, q.x - p.x)}; }
      at -= len;
    }
  }
  // a polyline with its corners rounded: the line to the start of each curve, a curve around the corner
  function rounded(pts, radius) {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]], toward = (p, r) => { const len = Math.hypot(p.x - b.x, p.y - b.y) || 1; return {x: b.x + (p.x - b.x) / len * r, y: b.y + (p.y - b.y) / len * r}; };
      const p1 = toward(a, Math.min(radius, Math.hypot(a.x - b.x, a.y - b.y) / 2)), p2 = toward(c, Math.min(radius, Math.hypot(c.x - b.x, c.y - b.y) / 2));
      d += ` L ${p1.x} ${p1.y} C ${b.x} ${b.y} ${b.x} ${b.y} ${p2.x} ${p2.y}`;
    }
    return `${d} L ${pts.at(-1).x} ${pts.at(-1).y}`;
  }

  window.BuildGuideBoard = (root, B, options) => {
    let disposed = false;
    const [W, H] = B.size;
    const kinds = B.kinds || {}, colors = B.colors || {}, parts = B.parts || {}, areas = B.areas || {};
    const kindOf = p => {
      const k = {...DEFAULT_KIND, ...kinds[p.kind]};
      return {...k, fill: paint(k.fill, DEFAULT_KIND.fill), stroke: paint(k.stroke, DEFAULT_KIND.stroke), band: k.band === true || paint(k.band)};
    };
    const colorOf = c => { const k = colors[c.color]; return {...k, line: paint(k?.line, '#64748b'), outline: paint(k?.outline, '#1f2937')}; };

    const holder = document.createElement('div');
    holder.className = 'joint-paper';
    holder.style.userSelect = 'none';   // a drag pans the board, it selects no text
    const canvas = svg('svg', {width: W, height: H}, holder), layers = svg('g', {class: 'joint-layers'}, canvas);
    const cells = svg('g', {class: 'joint-cells-layer'}, layers), labelsLayer = svg('g', {class: 'joint-labels-layer'}, layers);
    const cell = (type, id, x, y, parent) => svg('g', {class: 'joint-cell joint-element', 'model-id': id, 'data-type': type, transform: `translate(${x},${y})`}, parent);
    const boxes = [];   // what the router keeps wires off: {id, x0, y0, x1, y1, pins}

    // areas (frame: false = a zone title inside another area), decorative props, parts with their terminals
    const caption = (id, x, y, w, content, fill, size) => {
      const g = cell('buildguide.Caption', id, x, y, cells);
      text('label', content, {x: 0, y: 14, 'font-size': size || 14, 'font-weight': 700, fill, stroke: '#ffffff', 'stroke-width': 4, 'paint-order': 'stroke'}, g);
      boxes.push({id, x0: x, y0: y, x1: x + w, y1: y + 18, pins: []});
    };
    for (const [key, a] of Object.entries(areas)) {
      const frame = a.frame !== false, tone = paint(a.color, '#64748b');
      if (frame) sel('rect', 'body', {width: a.size[0], height: a.size[1], rx: 12, fill: '#f8fafc', stroke: tone, 'stroke-width': 1.5, 'stroke-dasharray': '6 5'}, cell('buildguide.Area', 'area-' + key, a.at[0], a.at[1], cells));
      caption('caption-' + key, a.at[0] + (frame ? 14 : 0), a.at[1] + (frame ? 10 : 0), a.title.length * 8, a.title, tone);
      for (const [x, name] of a.glands || []) caption('gland-' + name, x + 26, a.at[1] - 9, 22, name, tone, 12);
    }
    for (const [i, p] of (B.props || []).entries()) {
      const g = cell('standard.Rectangle', 'prop-' + i, p.at[0], p.at[1], cells);
      sel('rect', 'body', {width: p.size[0], height: p.size[1], rx: 4, fill: '#e5e7eb', stroke: '#475569', 'stroke-width': 2}, g);
      text('label', p.name, {x: p.size[0] / 2, y: p.size[1] / 2, 'text-anchor': 'middle', dy: '.35em', 'font-size': 12, 'font-weight': 600, fill: '#475569'}, g);
      boxes.push({id: 'prop-' + i, x0: p.at[0], y0: p.at[1], x1: p.at[0] + p.size[0], y1: p.at[1] + p.size[1], pins: []});
    }

    const wires = svg('g', {class: 'joint-wires-layer'}, cells);   // above the frames, titles and props, below the parts: terminal numbers stay readable

    // where a terminal sits, in board coordinates: spread evenly along its side, the kind may move it in
    const portAt = (id, pin) => {
      const p = parts[id], k = kindOf(p), inset = k.inset || 0, offset = k.offset || {}, [w, h] = p.size;
      const side = Object.keys(p.ports).find(s => p.ports[s].includes(pin)), list = p.ports[side], t = (list.indexOf(pin) + .5) / list.length;
      const [x, y] = {left: [inset, t * h], right: [w - inset, t * h], top: [t * w, offset.top || 0], bottom: [t * w, h + (offset.bottom || 0)]}[side];
      return {x: p.at[0] + x, y: p.at[1] + y, side};
    };
    const portEls = {};
    const partEls = {};
    for (const [id, p] of Object.entries(parts)) {
      const k = kindOf(p), [w, h] = p.size;
      const g = cell('buildguide.Part', id, p.at[0], p.at[1], cells);
      partEls[id] = g;
      const body = k.round ? {fill: paint(p.color, k.fill), stroke: k.stroke, rx: w / 2} : {fill: k.fill, stroke: k.stroke, ...(k.rx != null && {rx: k.rx})};
      sel('rect', 'body', {width: w, height: h, rx: 6, 'stroke-width': 1.5, ...body}, g);
      sel('rect', 'band', k.band ? {x: w - 14, y: 0, width: 7, height: h, fill: k.band === true ? '#d1d5db' : k.band} : {display: 'none'}, g);
      text('title', p.name || '', {x: w / 2, y: p.ports?.top ? 24 : -10, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#17202a', ...(p.ports?.top && inkOn(body.fill))}, g);
      text('sub', p.sub || '', {x: w / 2, y: p.ports?.bottom ? h - 14 : h + 17, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600, fill: '#5b6672', ...(p.ports?.bottom && inkOn(body.fill))}, g);
      const pins = [];
      for (const [side, names] of Object.entries(p.ports || {})) for (const pin of names) {
        const at = portAt(id, pin), core = paint(k.pins?.[pin]), port = svg('g', {class: 'joint-port', transform: `translate(${at.x - p.at[0]},${at.y - p.at[1]})`}, g);
        portEls[id + ':' + pin] = [
          sel('circle', 'pb', core ? {r: 6, fill: core, stroke: core} : {r: 9.5, fill: '#e5e7eb', stroke: '#9ca3af', 'stroke-width': 1}, port),
          text('pt', core ? '' : (PIN_TEXT[pin] || pin), {'text-anchor': 'middle', y: 3.6, 'font-size': pin.length > 2 ? 8.5 : 10, 'font-weight': 700, fill: '#475569', 'pointer-events': 'none'}, port),
        ];
        pins.push({key: id + ':' + pin, x: at.x, y: at.y, side});
      }
      // a title or label on a side without terminals lies outside the part and belongs to its rectangle; terminal circles sit on the edge, so a side with terminals is padded
      const pad = side => (p.ports?.[side] && !k.inset ? 14 : 0);
      boxes.push({id, x0: p.at[0] - pad('left'), y0: p.at[1] - Math.max(p.name && !p.ports?.top ? 22 : 0, pad('top')),
        x1: p.at[0] + w + pad('right'), y1: p.at[1] + h + Math.max(p.sub && !p.ports?.bottom ? 22 : 0, pad('bottom')), pins});
    }
    // the walls of a box with glands: connections leave it only through the gaps, tall fences between the glands outside keep each cable in its own channel
    for (const [key, a] of Object.entries(areas)) {
      if (!a.glands) continue;
      const [x0, y0] = a.at, x1 = x0 + a.size[0], y1 = y0 + a.size[1], t = 4, gap = 36;
      const wall = (xa, ya, xb, yb) => boxes.push({id: 'wall-' + key + boxes.length, x0: xa, y0: ya, x1: xb, y1: yb, pins: []});
      const gx = a.glands.map(g => g[0]).sort((p, q) => p - q);
      let x = x0 - t;
      for (const g of gx) { wall(x, y0 - t, g - gap, y0 + t); x = g + gap; }
      wall(x, y0 - t, x1 + t, y0 + t); wall(x0 - t, y1 - t, x1 + t, y1 + t); wall(x0 - t, y0 - t, x0 + t, y1 + t); wall(x1 - t, y0 - t, x1 + t, y1 + t);
      for (let i = 1; i < gx.length; i++) { const m = (gx[i - 1] + gx[i]) / 2; wall(m - 2, -5000, m + 2, y0); }
    }

    // a diode drawn as a part across two terminals: it loops around a part whose kind says so, else it hangs above or below
    function diodeVertices(id, sourcePin, targetPin) {
      const part = parts[id], k = kindOf(part), source = portAt(id, sourcePin), target = portAt(id, targetPin);
      const top = part.at[1] - (k.diodeLoop === 'around' ? 34 : 45);
      if (k.diodeLoop === 'around') return [{x: part.at[0] + part.size[0] + 14, y: source.y}, {x: part.at[0] + part.size[0] + 14, y: top}, {x: part.at[0] - 14, y: top}, {x: part.at[0] - 14, y: target.y}];
      const y = source.side === 'bottom' ? part.at[1] + part.size[1] + 36 : top;
      return [{x: source.x, y}, {x: target.x, y}];
    }

    root.appendChild(holder);
    root.setAttribute('aria-label', options.name + '. Select a numbered connection to inspect it.');
    const steps = B.steps, all = steps.flatMap(s => s.connections);
    const step = steps[options.step];
    const selected = step.connections[options.wire];
    const visible = options.scope === 'all' ? all : options.scope === 'single' ? [selected] : step.connections;
    const used = new Set(visible.flatMap(c => [end(c.a)[0], end(c.b)[0]]));
    const terms = new Set([selected.a, selected.b]);
    for (const id of Object.keys(parts)) partEls[id].setAttribute('opacity', used.has(id) ? 1 : .65);
    for (const t of terms) {
      const [pb, pt] = portEls[t];
      for (const [k, v] of Object.entries({fill: '#e1f7df', stroke: '#237b33', 'stroke-width': 3})) pb.setAttribute(k, v);
      pt.setAttribute('fill', '#173d23');
    }

    const label = options.label, links = {}, labelOf = {};
    const widthOf = c => colorOf(c).diode ? 5 : (colorOf(c).width || 4) + 3;
    function highlight(no, hot) {
      const l = links[no];
      if (!l) return;
      l.outline.setAttribute('stroke-width', hot ? 11 : widthOf(l.c));
      l.outline.setAttribute('stroke', hot ? '#198b47' : (colorOf(l.c).diode ? '#4b5563' : colorOf(l.c).outline));
    }
    function link(c, pts) {
      const col = colorOf(c), diode = col.diode, done = options.done?.(c.no), mark = done ? '✓ ' : '', [pa, a] = end(c.a);
      const g = svg('g', {class: 'joint-cell joint-link', 'model-id': 'c' + c.no, 'data-type': 'standard.DoubleLink', 'data-connection': c.no, role: 'button', tabindex: 0,
        'aria-label': c.no + ': ' + label(c, 'a') + ' to ' + label(c, 'b') + (diode ? '; ring at ' + label(c, 'a') : '') + (done ? '; checked' : '')}, wires);
      const d = rounded(pts, 8), common = {d, fill: 'none', 'stroke-linejoin': 'round'};
      sel('path', 'wrapper', {...common, stroke: 'transparent', 'stroke-width': 12}, g);
      const outline = sel('path', 'outline', {...common, stroke: diode ? '#4b5563' : col.outline, 'stroke-width': widthOf(c)}, g);
      sel('path', 'line', {...common, stroke: diode ? '#9ca3af' : col.line, 'stroke-width': diode ? 3 : (col.width || 4)}, g);
      links[c.no] = {c, g, outline};
      g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.select(c.no); } });
      // the labels sit in their own layer above the parts, so a number is never hidden under a terminal
      const wrap = svg('g', {class: 'joint-link', 'model-id': 'c' + c.no}, labelsLayer);
      labelOf[c.no] = wrap;
      for (const e of [g, wrap]) {
        e.addEventListener('click', () => options.select(c.no));
        e.addEventListener('mouseenter', () => highlight(c.no, true));
        e.addEventListener('mouseleave', () => highlight(c.no, c.no === selected.no));
      }
      if (diode) {   // draw the part itself: dark body, ring towards the source end; the name stays upright, just beside the body
        const m = along(pts, length(pts) / 2), body = svg('g', {class: 'label', transform: `translate(${m.x},${m.y}) rotate(${m.angle * 180 / Math.PI})`}, wrap);
        sel('rect', 'body', {x: -17, y: -8, width: 34, height: 16, rx: 4, fill: '#111827'}, body);
        sel('rect', 'ring', {x: -13, y: -8, width: 6, height: 16, fill: '#d1d5db'}, body);
        const lift = parts[pa].ports.bottom?.includes(a) ? -18 : 18, name = svg('g', {class: 'label', transform: `translate(${m.x + Math.sin(m.angle) * -lift},${m.y + Math.cos(m.angle) * lift})`}, wrap);
        text('name', mark + c.no, {'font-size': 13, 'font-weight': 800, fill: '#17202a', 'text-anchor': 'middle', dy: '.35em'}, name);
      }
      return g;
    }
    function badge(c, at) {
      const done = options.done?.(c.no), g = svg('g', {class: 'label', transform: `translate(${at.x},${at.y})`}, labelOf[c.no]);
      const pill = sel('rect', 'pill', {rx: 9, ry: 9, fill: done ? '#e1f7df' : '#ffffff', stroke: colorOf(c).outline, 'stroke-width': 1.5}, g);
      const t = text('num', (done ? '✓ ' : '') + c.no, {'font-size': 12, 'font-weight': 800, fill: '#17202a', 'text-anchor': 'middle', dy: '.35em'}, g), b = t.getBBox();
      for (const [k, v] of Object.entries({x: b.x - 7, y: b.y - 3, width: b.width + 14, height: b.height + 6})) pill.setAttribute(k, v);
    }

    // the drawing's scale: zoomFactor 0 = below PHONE px the drawing is wide enough for its smallest text (SMALLEST) to show at the canvas font size (--ag-text-small) and pans, else it fits
    let scale = 1, zoomFactor = options.zoom, shown = 1, readable = 1;
    const setScale = s => {
      scale = s;
      holder.style.width = W * s + 'px'; holder.style.height = H * s + 'px';
      canvas.setAttribute('width', W * s); canvas.setAttribute('height', H * s);
      layers.setAttribute('transform', `matrix(${s},0,0,${s},0,0)`);
    };
    function fit() {
      if (disposed) return;
      const whole = Math.min(root.clientWidth / W, root.clientHeight / H);
      if (!(whole > 0)) return;   // hidden: the resize on showing draws it
      readable = root.clientWidth < PHONE ? Math.max(1, Number.parseFloat(getComputedStyle(root).fontSize) / SMALLEST / whole) : 1;
      shown = zoomFactor || readable;
      setScale(whole * shown);
    }
    // zoom to `next` (1, the whole board, up to the maximum of the buttons), the board point under the page point (x, y) moves to (toX, toY)
    function zoomTo(next, x, y, toX = x, toY = y) {
      const {left, top} = holder.getBoundingClientRect(), before = scale;
      zoomFactor = Math.min(Math.max(1, next), Math.max(3, readable * 1.5)); fit();
      const r = holder.getBoundingClientRect(), grow = scale / before;
      root.scrollLeft += r.left + (x - left) * grow - toX; root.scrollTop += r.top + (y - top) * grow - toY;
      options.zoomed?.(zoomFactor);
      return zoomFactor;
    }
    const observer = new ResizeObserver(fit); observer.observe(root); fit();

    try {
      const key = options.key + ':' + visible.map(c => c.no).join(','), t0 = performance.now();
      const diodes = visible.map(c => colorOf(c).diode), plain = visible.filter((_, i) => !diodes[i]);
      if (!cachedRoutes.has(key)) cachedRoutes.set(key, route(boxes, plain.map(c => ({a: c.a, b: c.b})), {bounds: [W, H]}));
      window.BuildGuideBoard.routeMs = performance.now() - t0;
      const routed = cachedRoutes.get(key);
      let next = 0;
      const lines = visible.map((c, i) => {
        if (!diodes[i]) return routed[next++];
        const [pa, a] = end(c.a), [pb, b] = end(c.b);
        return [portAt(pa, a), ...diodeVertices(pa, a, b), portAt(pb, b)];
      });
      for (const [i, c] of visible.entries()) link(c, lines[i]);
      // a number goes on a straight stretch, clear of bends, parts, labels, other numbers and other connections;
      // the longest stretches first, then a spot nearer the ends, then one beside another connection
      const stretches = (line, grow) => line.slice(1).map((q, k) => ({x0: Math.min(line[k].x, q.x) - grow, y0: Math.min(line[k].y, q.y) - grow, x1: Math.max(line[k].x, q.x) + grow, y1: Math.max(line[k].y, q.y) + grow}));
      const free = (box, others) => !others.some(o => box.x0 < o.x1 && o.x0 < box.x1 && box.y0 < o.y1 && o.y0 < box.y1);
      const placed = [];
      visible.forEach((c, i) => {
        if (diodes[i]) return;
        const hw = options.done?.(c.no) ? 24 : 15, bends = lines.flatMap(line => line.slice(1, -1).map(p => ({x0: p.x - 1, y0: p.y - 1, x1: p.x + 1, y1: p.y + 1}))), fixed = [...boxes, ...placed, ...bends], near = lines.flatMap((line, j) => j === i ? [] : stretches(line, 5));
        const spots = lines[i].slice(1).flatMap((q, k) => {
          const p = lines[i][k], long = Math.hypot(q.x - p.x, q.y - p.y);
          return [.5, .35, .65, .2, .8].map(t => ({x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, long, room: long * Math.min(t, 1 - t)}));
        }).sort((u, v) => v.long - u.long);
        // shortcut: the box of a number is a fixed 30 x 24 px (48 wide with a check mark), enough for two digits
        const spot = [[20, [...fixed, ...near]], [20, fixed], [10, fixed]].reduce((found, [room, others]) =>
          found ?? spots.find(s => s.room >= room && free({x0: s.x - hw, y0: s.y - 12, x1: s.x + hw, y1: s.y + 12}, others)), null);
        const at = spot ?? along(lines[i], length(lines[i]) / 2);
        badge(c, at);
        placed.push({x0: at.x - hw - 2, y0: at.y - 14, x1: at.x + hw + 2, y1: at.y + 14});
      });
      links[options.focus]?.g.focus({preventScroll: true});
      highlight(selected.no, true);
      // a drawing wider than the canvas opens on the selected connection
      const sel0 = lines[visible.indexOf(selected)], from = sel0[0], to = sel0.at(-1);
      root.scrollLeft = (from.x + to.x) / 2 * scale - root.clientWidth / 2; root.scrollTop = (from.y + to.y) / 2 * scale - root.clientHeight / 2;
      root.dataset.ready = 'true';
    } catch (error) {
      console.error(error);
      const note = document.createElement('p'); note.className = 'ag-board-error';
      note.textContent = 'Router unavailable. Use the labelled connection list below.'; root.appendChild(note);
      root.dataset.ready = 'error';
    }
    // printing: the whole board at page width
    const beforePrint = () => setScale(Math.min(700 / W, 700 / H));
    addEventListener('beforeprint', beforePrint); addEventListener('afterprint', fit);
    // mouse and pen dragging pans the zoomed canvas; one finger scrolls it natively and the page takes over at its edge; two fingers pinch and pan
    let drag, pinch;
    const touches = new Map(), mid = () => { const [a, b] = [...touches.values()]; return [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1]; };
    root.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') { touches.set(event.pointerId, event); pinch = touches.size === 2 ? mid() : null; return; }
      if (event.target.closest('.joint-link')) return;   // connections and their numbers stay clickable
      drag = {x: event.clientX, y: event.clientY, left: root.scrollLeft, top: root.scrollTop};
      root.setPointerCapture(event.pointerId);
    });
    root.addEventListener('pointermove', event => {
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId, event);
        if (pinch) { const now = mid(); zoomTo(shown * now[2] / pinch[2], pinch[0], pinch[1], now[0], now[1]); pinch = now; }
      }
      if (!drag) return;
      root.scrollLeft = drag.left + drag.x - event.clientX; root.scrollTop = drag.top + drag.y - event.clientY;
    });
    const release = event => { drag = null; touches.delete(event.pointerId); pinch = null; };
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', release);
    // ctrl or cmd with the wheel (and a trackpad pinch) zooms around the pointer; a plain vertical wheel scrolls the nearest ancestor that can move that way, the page last, and keeps the board still
    root.addEventListener('wheel', event => {
      const {deltaX, deltaY, clientX, clientY} = event, dy = wheelPx(deltaY, event.deltaMode);
      if (event.ctrlKey || event.metaKey) zoomTo(shown * wheelFactor(deltaY, event.deltaMode), clientX, clientY);
      else if (Math.abs(deltaY) < Math.abs(deltaX) || root.scrollHeight <= root.clientHeight) return;
      else for (let e = root.parentElement; e; e = e.parentElement) {
        const {overflowY} = getComputedStyle(e), body = e === document.body;
        if (body && overflowY === 'hidden') return;   // the page behind a fullscreen board stays locked
        const to = body ? document.scrollingElement : e;
        if ((body || /auto|scroll/.test(overflowY)) && (dy < 0 ? to.scrollTop > 0 : to.scrollTop + to.clientHeight + 1 < to.scrollHeight)) { to.scrollBy(0, dy); break; }
        if (!e.parentElement) return;
      }
      event.preventDefault();
    }, {passive: false});
    return {
      destroy() { disposed = true; observer.disconnect(); removeEventListener('beforeprint', beforePrint); removeEventListener('afterprint', fit); holder.remove(); },
      zoomBy(step) { const r = root.getBoundingClientRect(); return zoomTo(shown + step, r.left + r.width / 2, r.top + r.height / 2); },
      fit() { zoomFactor = 1; fit(); root.scrollTo(0, 0); },
      highlight,
    };
  };
  window.BuildGuideBoard.wheelFactor = wheelFactor;   // for the unit tests
  window.BuildGuideBoard.route = route;
})();
