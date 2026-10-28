/* BuildGuide assembly renderer (prototype): draws the parts of an assembly with WebGL, one step at a time, each part moving into place.
   Loaded by buildguide.js for <div data-buildguide="assembly"></div>; adds window.BuildGuideAssembly(root, assembly, {base}) and returns a stop function. */
(() => {
  'use strict';
  const VERT = 'attribute vec3 p,n;uniform mat4 m,v;varying vec3 q;void main(){q=mat3(m)*n;gl_Position=v*m*vec4(p,1.);}';
  const FRAG = 'precision mediump float;uniform vec3 c;varying vec3 q;void main(){vec3 n=normalize(q);gl_FragColor=vec4(c*(.4+.15*n.z+.5*max(dot(n,normalize(vec3(.4,.5,.8))),0.)),1.);}';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt()};`);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mul = (a, b) => Array.from({length: 16}, (_, i) => { const c = i >> 2 << 2, r = i & 3; return a[r] * b[c] + a[r + 4] * b[c + 1] + a[r + 8] * b[c + 2] + a[r + 12] * b[c + 3]; });
  const shift = (m, d, k) => { const o = [...m]; for (let i = 0; i < 3; i++) o[12 + i] += d[i] * k; return o; };
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const norm = a => a.map(x => x / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // view matrix of a camera at eye looking at c, z up
  const look = (eye, c) => {
    const z = norm(sub(eye, c)), x = norm(cross([0, 0, 1], z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  };
  const persp = (aspect, near, far) => { const t = 1 / Math.tan(0.31); return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]; };
  const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rgb = hex => { const n = parseInt(String(hex).replace('#', ''), 16) || 0x888888; return [n >> 16 & 255, n >> 8 & 255, n & 255].map(x => x / 255); };

  // binary STL to interleaved position and normal floats; an ASCII file is refused
  function parse(buffer) {
    const view = new DataView(buffer), count = buffer.byteLength > 84 ? view.getUint32(80, true) : 0;
    if (buffer.byteLength !== 84 + 50 * count) throw new Error('not a binary STL');
    const out = new Float32Array(count * 18);
    for (let i = 0; i < count; i++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
      out[i * 18 + v * 6 + k] = view.getFloat32(84 + i * 50 + 12 + v * 12 + k * 4, true);
      out[i * 18 + v * 6 + 3 + k] = view.getFloat32(84 + i * 50 + k * 4, true);
    }
    return out;
  }

  window.BuildGuideAssembly = (root, assembly, {base}) => {
    const steps = assembly.steps || [], reduced = matchMedia('(prefers-reduced-motion: reduce)');
    root.innerHTML = `<div class="ag-guide ag-assembly"><canvas class="ag-assembly-canvas" tabindex="0" role="img" width="640" height="400"></canvas>
      <div class="ag-assembly-bar"><button type="button" data-action="prev-step">Previous step</button><span class="ag-assembly-count" role="status"></span><button type="button" data-action="next-step">Next step</button><button type="button" data-action="replay">Replay</button><button type="button" data-action="reset-view">Reset view</button></div>
      <ol class="ag-assembly-steps">${steps.map((s, i) => `<li><button type="button" data-step="${i}"><b>${esc(s.title)}</b><small>${esc(s.text)}</small></button></li>`).join('')}</ol></div>`;
    const canvas = root.querySelector('canvas'), count = root.querySelector('.ag-assembly-count');
    const gl = canvas.getContext('webgl');
    if (!gl) { canvas.replaceWith(Object.assign(document.createElement('p'), {textContent: '3D view unavailable. The steps below describe the assembly.'})); return () => {}; }
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); gl.attachShader(program, s); }
    gl.linkProgram(program); gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
    const attrib = (name, offset) => { const at = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(at); return () => { gl.vertexAttribPointer(at, 3, gl.FLOAT, false, 24, offset); }; };
    const bindings = [attrib('p', 0), attrib('n', 12)], uniform = name => gl.getUniformLocation(program, name);

    // one draw item per part and per fastener instance: model buffer, placement, colour, step, vector it travels from
    const items = [];
    let dead = false, frame = 0, start = 0, step = 0;
    const view = {az: -0.9, el: 0.5, dist: 1, centre: [0, 0, 0], radius: 1}, home = {};
    const draw = () => {
      frame = 0;
      const w = canvas.clientWidth * devicePixelRatio | 0, h = canvas.clientHeight * devicePixelRatio | 0;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const c = view.centre, e = [c[0] + view.dist * Math.cos(view.el) * Math.cos(view.az), c[1] + view.dist * Math.cos(view.el) * Math.sin(view.az), c[2] + view.dist * Math.sin(view.el)];
      gl.uniformMatrix4fv(uniform('v'), false, mul(persp(w / h, view.radius * 0.1, view.dist + view.radius * 4), look(e, c)));
      const t = reduced.matches ? 1 : clamp((performance.now() - start) / 900, 0, 1);
      const here = items.filter(i => i.step === step);
      for (const item of items) {
        if (item.step > step) continue;
        // later items of the step start later; the motion eases out
        const k = item.step < step ? 1 : clamp((t * (1 + 0.3 * (here.length - 1)) - 0.3 * here.indexOf(item)), 0, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, item.model.buffer); for (const bind of bindings) bind();
        gl.uniformMatrix4fv(uniform('m'), false, shift(item.place, item.from, (1 - k) ** 3));
        gl.uniform3fv(uniform('c'), item.color);
        gl.drawArrays(gl.TRIANGLES, 0, item.model.count);
      }
      if (t < 1) schedule();
    };
    const schedule = () => { if (!frame && !dead) frame = requestAnimationFrame(draw); };
    const show = (i, animate = true) => {
      step = clamp(i, 0, Math.max(steps.length - 1, 0)); start = performance.now() - (animate ? 0 : 1000);
      count.textContent = `Step ${step + 1} of ${steps.length}: ${steps[step]?.title ?? ''}`;
      canvas.setAttribute('aria-label', `3D view of the assembly. ${count.textContent}. ${steps[step]?.text ?? ''} Arrow keys turn the view, plus and minus zoom, Home resets.`);
      root.querySelectorAll('.ag-assembly-steps button').forEach((b, k) => { if (k === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      root.querySelector('[data-action="prev-step"]').disabled = step === 0;
      root.querySelector('[data-action="next-step"]').disabled = step === steps.length - 1;
      schedule();
    };
    const reset = () => { Object.assign(view, home); schedule(); };
    root.onclick = ({target}) => {
      const b = target.closest('button'); if (!b) return;
      if (b.dataset.step) show(Number(b.dataset.step));
      else if (b.dataset.action === 'prev-step') show(step - 1);
      else if (b.dataset.action === 'next-step') show(step + 1);
      else if (b.dataset.action === 'replay') show(step);
      else if (b.dataset.action === 'reset-view') reset();
    };
    // keyboard and pointer both move the camera, so the view is usable without a mouse
    canvas.onkeydown = e => {
      const turn = {ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1]}[e.key];
      if (turn) { view.az += turn[0]; view.el = clamp(view.el + turn[1], -1.5, 1.5); }
      else if (e.key === '+' || e.key === '=') view.dist *= 0.9;
      else if (e.key === '-') view.dist /= 0.9;
      else if (e.key === 'Home') Object.assign(view, home);
      else return;
      e.preventDefault(); schedule();
    };
    let drag;
    canvas.onpointerdown = e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointerup = () => { drag = null; };
    canvas.onpointermove = e => { if (!drag) return; view.az -= (e.clientX - drag[0]) * 0.008; view.el = clamp(view.el + (e.clientY - drag[1]) * 0.008, -1.5, 1.5); drag = [e.clientX, e.clientY]; schedule(); };
    canvas.onwheel = e => { e.preventDefault(); view.dist *= e.deltaY > 0 ? 1.1 : 0.9; schedule(); };
    const resize = new ResizeObserver(schedule); resize.observe(canvas);

    const files = {};
    const model = id => files[id] ||= fetch(new URL(assembly.models[id], base)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(buffer => {
      const data = parse(buffer), buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return {buffer: buf, count: data.length / 6, data};
    });
    const list = [...(assembly.parts || []).map(p => ({...p, instances: [p.place || IDENTITY]})), ...(assembly.fasteners || [])];
    Promise.all(list.map(o => model(o.model))).then(models => {
      if (dead) return;
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const [n, o] of list.entries()) for (const place of o.instances) {
        items.push({model: models[n], place, color: rgb(o.color), step: o.step, from: o.explode || [0, 0, 0]});
        for (let i = 0; i < models[n].data.length; i += 6) for (let k = 0; k < 3; k++) { const x = models[n].data[i] * place[k] + models[n].data[i + 1] * place[k + 4] + models[n].data[i + 2] * place[k + 8] + place[12 + k]; lo[k] = Math.min(lo[k], x); hi[k] = Math.max(hi[k], x); }
      }
      view.centre = lo.map((x, k) => (x + hi[k]) / 2); view.radius = Math.hypot(...sub(hi, lo)) / 2; view.dist = view.radius * 3.2;
      Object.assign(home, view);
      canvas.dataset.ready = 'true'; show(0);
    }).catch(error => { console.error(error); canvas.dataset.ready = 'error'; });
    show(0, false);
    return () => { dead = true; cancelAnimationFrame(frame); resize.disconnect(); root.onclick = null; root.replaceChildren(); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  };
})();
