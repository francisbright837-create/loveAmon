/* 3D town. Draws your existing World with three.js. All the game logic (walking, chat, emotes, cars, portals,
   multiplayer) stays in script.js and the server; this file only changes how the town LOOKS and how a tap is turned
   into a spot on the ground. If WebGL is not available, the original 2D town keeps working. */
(function () {
  if (typeof THREE === 'undefined' || typeof window.drawWorld !== 'function') return;
  const T = THREE, S = 40;                          // 1 unit in 3D = 40 pixels of the old 2D map
  const origDraw = window.drawWorld, origPoint = window.worldEventPoint;
  let ON = false, started = false, R, scene, cam, sun, c3, c2;
  let yaw = 0, dist = 15, camPos = new T.Vector3(30, 14, 30), camLook = new T.Vector3(30, 1, 20);
  const avatars = {}, parked = [], traffic = [], portals = {}, pickables = [], keys = {};
  let keyDriven = false, sea = null, seaBase = null;
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const adiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const heading = (dx, dz) => Math.atan2(-dx, -dz);        // characters and cars face -z
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  const mats = {};
  const M = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o || {}))); };
  function add(parent, geo, mat, x, y, z, shadow) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; }
  const box = (p, w, h, d, c, x, y, z, o) => add(p, new T.BoxGeometry(w, h, d), M(c, o), x, y, z);
  const GEO = { sph: new T.SphereGeometry(1, 14, 10), cyl: new T.CylinderGeometry(1, 1, 1, 10), cone: new T.ConeGeometry(1, 1, 8) };

  function textSprite(text, size) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 80;
    const g = c.getContext('2d'); g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.65)'; g.strokeText(text, 160, 42); g.fillStyle = '#fff'; g.fillText(text, 160, 42);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true }));
    s.scale.set(size * 4, size, 1); return s;
  }
  function glowSprite(color, size) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, color); r.addColorStop(1, 'rgba(170,80,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }

  /* ---------- the town ---------- */
  function flat(x, y, w, h, color, lift) {
    const m = new T.Mesh(new T.PlaneGeometry(w / S, h / S), M(color)); m.rotation.x = -Math.PI / 2;
    m.position.set((x + w / 2) / S, lift, (y + h / 2) / S); m.receiveShadow = true; scene.add(m); return m;
  }
  function tree(x, z, k, kind) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const hue = kind === 'pine' ? 0x2f7d46 : [0x3f9b4d, 0x4aa957, 0x35893f][hash(x + ':' + z) % 3];
    add(g, GEO.cyl, M(0x7a5233), 0, .7 * k, 0, true).scale.set(.18 * k, 1.4 * k, .18 * k);
    if (kind === 'pine') { add(g, GEO.cone, M(hue), 0, 1.7 * k, 0).scale.set(.85 * k, 1.5 * k, .85 * k); add(g, GEO.cone, M(hue), 0, 2.5 * k, 0).scale.set(.6 * k, 1.2 * k, .6 * k); }
    else add(g, GEO.sph, M(hue), 0, 2 * k, 0).scale.set(.95 * k, .85 * k, .95 * k);
    scene.add(g);
  }
  function palm(x, z, k) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const t = add(g, GEO.cyl, M(0x9c7a4d), 0, 1.3 * k, 0); t.scale.set(.14 * k, 2.6 * k, .14 * k); t.rotation.z = .12;
    for (let i = 0; i < 6; i++) { const f = add(g, GEO.cone, M(0x3da35a), Math.cos(i) * .45 * k, 2.65 * k, Math.sin(i) * .45 * k); f.scale.set(.12 * k, .9 * k, .4 * k); f.rotation.set(0, -i, Math.PI / 2.4); }
    scene.add(g);
  }
  function smallThing(e, x, z, s) {
    const k = s / 36, g = new T.Group(); g.position.set(x, 0, z);
    if (e === '🌷' || e === '🌼') { const c = e === '🌷' ? [0xe5368f, 0xff6fb5][hash(x + z) % 2] : 0xffd23f;
      for (let i = 0; i < 3; i++) { add(g, GEO.cyl, M(0x3d9a4a), i * .15 - .15, .15, 0, false).scale.set(.02, .3, .02); add(g, GEO.sph, M(c), i * .15 - .15, .34, 0, false).scale.set(.1, .1, .1); } }
    else if (e === '⛱️') { add(g, GEO.cyl, M(0xffffff), 0, .8, 0).scale.set(.04, 1.6, .04); add(g, GEO.cone, M([0xe53935, 0x1e88e5, 0xfdd835][hash(x) % 3]), 0, 1.65, 0).scale.set(.9, .45, .9); }
    else if (e === '🐚') add(g, GEO.sph, M(0xffb7c5), 0, .06, 0, false).scale.set(.14, .08, .14);
    else if (e === '🪴') { add(g, GEO.cyl, M(0xc0683a), 0, .22, 0).scale.set(.28, .44, .28); add(g, GEO.sph, M(0x3da35a), 0, .62, 0).scale.set(.3, .3, .3); }
    else if (e === '🪑') { box(g, .6, .1, .6, 0x8a5a33, 0, .45, 0); box(g, .6, .55, .08, 0x8a5a33, 0, .75, .26); [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]].forEach(p => box(g, .07, .45, .07, 0x6f4526, p[0], .22, p[1])); }
    scene.add(g);
  }
  function building(b) {
    const fw = b.w / S, fd = (b.h + b.roofH) / S, cx = (b.x + b.w / 2) / S, cz = (b.y - b.roofH + (b.h + b.roofH) / 2) / S;
    const wh = b.roof === 'tri' ? 2.7 : 3.5, g = new T.Group(); scene.add(g);
    box(g, fw, wh, fd, b.color, cx, wh / 2, cz);
    if (b.roof === 'tri') { const r = add(g, GEO.cone, M(b.roofColor), cx, wh + .85, cz); r.geometry = new T.ConeGeometry(1, 1.7, 4); r.rotation.y = Math.PI / 4; r.scale.set(fw / 1.4142 * 1.08, 1, fd / 1.4142 * 1.08); }
    else { box(g, fw + .3, .3, fd + .3, b.roofColor, cx, wh + .15, cz); box(g, fw, .5, .12, b.roofColor, cx, wh + .5, cz + fd / 2); }
    const fz = cz + fd / 2 + .04;
    box(g, .8, 1.5, .1, 0x6b3f20, cx, .75, fz); box(g, .08, .08, .06, 0xffd23f, cx + .26, .75, fz + .06);
    const glass = { emissive: 0x6aa6d8, emissiveIntensity: .35 };
    if (b.roof === 'tri') [-1, 1].forEach(s => box(g, .7, .7, .08, 0xcfe8ff, cx + s * fw * .3, 1.7, fz, glass));
    else box(g, fw * .7, .9, .08, 0xcfe8ff, cx, 1.5, fz + .02, glass);
    if (b.label) { const l = textSprite((b.sign ? b.sign + ' ' : '') + b.label, .55); l.position.set(cx, wh + (b.roof === 'tri' ? 2.6 : 1.25), cz + fd / 2); g.add(l); }
  }
  const CARS = {
    '🚗': { c: 0xe53935, len: 2.5, h: .55, cab: .55 }, '🚙': { c: 0x1e88e5, len: 2.7, h: .75, cab: .7 }, '🚕': { c: 0xfdd835, len: 2.5, h: .55, cab: .55, sign: 1 },
    '🚓': { c: 0xf4f4f4, len: 2.6, h: .6, cab: .55, lights: 1 }, '🏎️': { c: 0xd32f2f, len: 2.7, h: .42, cab: .38, wide: 1 }, '🚌': { c: 0xffb300, len: 5, h: 1.3, cab: .8, bus: 1 }
  };
  function makeCar(e) {
    const d = CARS[e] || CARS['🚗'], g = new T.Group(), w = d.wide ? 1.4 : 1.2;
    box(g, w, d.h, d.len, d.c, 0, .3 + d.h / 2, 0);
    if (d.bus) { box(g, w * 1.02, .55, d.len * .86, 0xbfe3ff, 0, 1.2, 0, { emissive: 0x5a8db8, emissiveIntensity: .25 }); }
    else { box(g, w * .9, d.cab, d.len * .5, d.c, 0, .3 + d.h + d.cab / 2, d.len * .06); box(g, w * .92, d.cab * .7, d.len * .36, 0xbfe3ff, 0, .3 + d.h + d.cab / 2, d.len * .06, { emissive: 0x5a8db8, emissiveIntensity: .25 }); }
    if (d.sign) box(g, .5, .16, .25, 0xffffff, 0, .3 + d.h + d.cab + .1, 0);
    if (d.lights) { box(g, .3, .12, .12, 0xff3b30, -.2, .3 + d.h + d.cab + .08, 0, { emissive: 0xff3b30, emissiveIntensity: 1 }); box(g, .3, .12, .12, 0x2f7bff, .2, .3 + d.h + d.cab + .08, 0, { emissive: 0x2f7bff, emissiveIntensity: 1 }); }
    if (d.wide) box(g, w, .08, .3, 0x222222, 0, .3 + d.h + .35, d.len / 2 - .1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => { const wl = add(g, GEO.cyl, M(0x1b1b22), p[0] * (w / 2 + .02), .3, p[1] * d.len * .33); wl.rotation.z = Math.PI / 2; wl.scale.set(.3, .2, .3); });
    box(g, w * .7, .12, .06, 0xfff2a8, 0, .55, -d.len / 2, { emissive: 0xfff2a8, emissiveIntensity: .8 });
    box(g, w * .7, .1, .06, 0xff3b30, 0, .55, d.len / 2, { emissive: 0xff3b30, emissiveIntensity: .6 });
    return g;
  }
  function person(isMe, id) {
    const R = {}, g = new T.Group(), body = new T.Group(); g.add(body); R.g = g; R.body = body;
    const skin = [0xf1c9a5, 0xd9a577, 0xa8714a, 0x7a4a2c][hash(id) % 4], hair = [0x1b1410, 0x3b2314, 0x6b4423, 0xc9a24b, 0x2a2a35][(hash(id) >> 3) % 5];
    const shirt = isMe ? 0xff4d8d : 0x4d7cff, pants = 0x2b3350;
    const hips = new T.Group(); hips.position.y = .85; body.add(hips); R.hips = hips;
    [[-1, 'lL'], [1, 'rL']].forEach(([s, n]) => { const l = new T.Group(); l.position.set(s * .13, 0, 0); hips.add(l); add(l, GEO.cyl, M(pants), 0, -.38, 0).scale.set(.1, .76, .1); box(l, .16, .08, .26, 0x222222, 0, -.78, -.04); R[n] = l; });
    box(hips, .46, .55, .26, shirt, 0, .42, 0);
    [[-1, 'lA'], [1, 'rA']].forEach(([s, n]) => { const a = new T.Group(); a.position.set(s * .3, .62, 0); hips.add(a); add(a, GEO.cyl, M(shirt), 0, -.22, 0).scale.set(.07, .5, .07); add(a, GEO.sph, M(skin), 0, -.5, 0).scale.set(.07, .07, .07); R[n] = a; });
    const head = add(hips, GEO.sph, M(skin), 0, 1.02, 0); head.scale.set(.2, .22, .2);
    const cap = add(hips, new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(hair), 0, 1.04, .01); cap.scale.set(.215, .2, .215);
    box(hips, .05, .05, .02, 0x222222, -.07, 1.04, -.2, { }); box(hips, .05, .05, .02, 0x222222, .07, 1.04, -.2, { });
    R.cars = {}; g.userData.anchor = { x: 0, y: 0 }; g.traverse(o => { if (o.isMesh) o.userData.pick = true; });
    scene.add(g); pickables.push(g); R.heading = 0; return R;
  }

  function init() {
    c3 = document.createElement('canvas'); c3.id = 'world-3d';
    c3.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none';
    const stage = document.getElementById('world-stage'); c2 = document.getElementById('world-canvas');
    stage.insertBefore(c3, c2); c2.style.cssText += ';position:absolute;left:0;top:0;z-index:1';
    R = new T.WebGLRenderer({ canvas: c3, antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = .95;
    scene = new T.Scene(); scene.background = new T.Color(0xa6dcff); scene.fog = new T.Fog(0xcdeaff, 38, 95);
    cam = new T.PerspectiveCamera(52, 1, .1, 160);
    scene.add(new T.HemisphereLight(0xe8f4ff, 0x6f8a5a, .62));
    sun = new T.DirectionalLight(0xfff1d0, .8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 120; scene.add(sun, sun.target);

    const base = new T.Mesh(new T.PlaneGeometry(WORLD_W / S + 40, WORLD_H / S + 40), M(0x8fd18a)); base.rotation.x = -Math.PI / 2; base.position.set(WORLD_W / S / 2, -.01, WORLD_H / S / 2); base.receiveShadow = true; scene.add(base);
    flat(0, 0, WORLD_W, WORLD_H, 0x8fd18a, 0); flat(60, 60, 980, 620, 0xa3e29a, .01); flat(1340, 60, 1000, 620, 0xe9d9bf, .01); flat(1340, 960, 1000, 580, 0xa6e29a, .01);
    flat(60, 960, 980, 385, 0xf3e2b3, .01); flat(1040, 680, 320, 280, 0xd9d4c7, .02);
    flat(0, 760, WORLD_W, 120, 0x4a4a55, .03); flat(1140, 0, 120, WORLD_H, 0x4a4a55, .03);
    for (let x = 0; x < WORLD_W; x += 56) { if (x > 1100 && x < 1280) continue; flat(x, 818, 30, 4, 0xf2f2f2, .04); }
    for (let y = 0; y < WORLD_H; y += 56) { if (y > 730 && y < 900) continue; flat(1198, y, 4, 30, 0xf2f2f2, .04); }
    // sea with moving waves, and the pond
    const sg = new T.PlaneGeometry(1140 / S, 260 / S, 28, 7); sea = new T.Mesh(sg, M(0x3fa9dc, { transparent: true, opacity: .93, roughness: .25, metalness: .1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(570 / S, .03, 1470 / S); scene.add(sea); seaBase = Float32Array.from(sg.attributes.position.array);
    [[130, 0x7ec8ef, .035], [112, 0x58b9ea, .04]].forEach(([r, c, y]) => { const p = new T.Mesh(new T.CircleGeometry(1, 40), M(c)); p.rotation.x = -Math.PI / 2; p.scale.set(r / S, 72 / 125 * r / S, 1); p.position.set(500 / S, y, 330 / S); scene.add(p); });
    WORLD_BUILDINGS.forEach(building);
    WORLD_DECOR.forEach(d => {
      const x = d.x / S, z = d.y / S, k = d.s / 56;
      if (d.e === '🌳') tree(x, z, k * 1.1, 'oak'); else if (d.e === '🌲') tree(x, z, k * 1.1, 'pine'); else if (d.e === '🌴') palm(x, z, k * 1.1); else smallThing(d.e, x, z, d.s);
    });
    WORLD_PARKED_CARS.forEach(c => { const m = makeCar(c.e); m.position.set(c.x / S, 0, c.y / S); m.rotation.y = -Math.PI / 2; m.userData.anchor = { x: c.x, y: c.y }; scene.add(m); pickables.push(m); parked.push(m); });
    WORLD_TRAFFIC.forEach(c => { const m = makeCar(c.e); scene.add(m); traffic.push({ c, m }); });
    // camera controls: Q/E or the two buttons turn the view, mouse wheel zooms, WASD / arrows walk
    const mk = (txt, left, f) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'position:absolute;bottom:84px;' + left + ';z-index:4;width:44px;height:44px;margin:0;padding:0;border-radius:50%;border:0;background:rgba(0,0,0,.45);color:#fff;font-size:22px;max-width:none'; b.onclick = f; stage.appendChild(b); };
    mk('⟲', 'left:12px', () => { yaw -= .5; }); mk('⟳', 'left:62px', () => { yaw += .5; });
    c2.addEventListener('wheel', e => { dist = clamp(dist + e.deltaY * .01, 7, 24); e.preventDefault(); }, { passive: false });
    const typing = e => /INPUT|TEXTAREA/.test((e.target.tagName || ''));
    addEventListener('keydown', e => { if (typing(e)) return; const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = 1; else if (e.key === 'ArrowUp') keys.w = 1; else if (e.key === 'ArrowDown') keys.s = 1; else if (e.key === 'ArrowLeft') keys.a = 1; else if (e.key === 'ArrowRight') keys.d = 1; else if (k === 'q') yaw -= .4; else if (k === 'e') yaw += .4; });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = 0; else if (e.key === 'ArrowUp') keys.w = 0; else if (e.key === 'ArrowDown') keys.s = 0; else if (e.key === 'ArrowLeft') keys.a = 0; else if (e.key === 'ArrowRight') keys.d = 0; });
  }

  /* ---------- per-frame ---------- */
  function updateScene(users, t, now) {
    const me = worldUsers[currentUser.id];
    // people
    users.forEach(u => {
      let R = avatars[u.userId]; if (!R) R = avatars[u.userId] = person(u.userId === currentUser.id, u.userId);
      R.seen = true; const g = R.g;
      g.position.set(u.dx / S, 0, u.dy / S); g.userData.anchor.x = u.dx; g.userData.anchor.y = u.dy;
      const mx = u.x - u.dx, mz = u.y - u.dy;
      if (Math.hypot(mx, mz) > .4) R.heading += adiff(R.heading, heading(mx, mz)) * .25;
      g.rotation.y = R.heading;
      const dancing = u.emote && u.emote.type === 'dance', ph = (u.phase || 0) * .55, sw = u.moving ? Math.sin(ph) : 0;
      if (u.vehicle) {
        R.cars[u.vehicle] = R.cars[u.vehicle] || makeCar(u.vehicle);
        Object.entries(R.cars).forEach(([e, c]) => { c.visible = e === u.vehicle; if (!c.parent) g.add(c); });
        R.hips.position.y = 1.05; R.lL.visible = R.rL.visible = false; R.body.scale.setScalar(.8); R.body.position.set(0, 0, .1); R.lA.rotation.x = R.rA.rotation.x = 1.3;
      } else {
        Object.values(R.cars).forEach(c => { c.visible = false; });
        R.lL.visible = R.rL.visible = true; R.body.scale.setScalar(1); R.body.position.set(0, 0, 0);
        R.hips.position.y = .85 + (u.moving ? -Math.abs(Math.sin(ph)) * .06 : 0) + (dancing ? Math.abs(Math.sin(now / 130)) * .2 : 0);
        R.lL.rotation.x = sw * .8; R.rL.rotation.x = -sw * .8;
        R.lA.rotation.x = dancing ? 2.6 + Math.sin(now / 110) * .5 : -sw * .7; R.rA.rotation.x = dancing ? 2.6 - Math.sin(now / 110) * .5 : sw * .7;
        R.lA.rotation.z = dancing ? .4 : -.05; R.rA.rotation.z = dancing ? -.4 : .05;
        R.body.rotation.y = dancing ? Math.sin(now / 160) * .6 : 0;
      }
    });
    Object.keys(avatars).forEach(id => { const R = avatars[id]; if (!R.seen) { scene.remove(R.g); pickables.splice(pickables.indexOf(R.g), 1); delete avatars[id]; } else R.seen = false; });
    // traffic follows the clock, exactly like the 2D town
    traffic.forEach(({ c, m }) => { const p = worldTrafficPos(c, t); m.position.set(p.x / S, 0, p.y / S); m.rotation.y = { E: -Math.PI / 2, W: Math.PI / 2, S: Math.PI, N: 0 }[c.lane]; });
    // portals
    const live = worldActivePortals(), ids = {};
    live.forEach(p => {
      ids[p.id] = 1; let P = portals[p.id];
      if (!P) {
        const g = new T.Group(); g.position.set(p.x / S, 1.5, p.y / S);
        const ring = add(g, new T.TorusGeometry(1, .1, 10, 40), new T.MeshBasicMaterial({ color: 0xd27bff }), 0, 0, 0, false); ring.scale.set(.8, 1.2, 1);
        const ring2 = add(g, new T.TorusGeometry(.8, .06, 10, 40), new T.MeshBasicMaterial({ color: 0x6df2ff }), 0, 0, .02, false); ring2.scale.set(.8, 1.2, 1);
        const disc = add(g, new T.CircleGeometry(.95, 32), new T.MeshBasicMaterial({ color: 0x12052a }), 0, 0, -.02, false); disc.scale.set(.8, 1.2, 1);
        const glow = glowSprite('rgba(170,80,255,.9)', 6); g.add(glow);
        g.userData.anchor = { x: p.x, y: p.y }; g.traverse(o => { if (o.isMesh) o.userData.pick = true; });
        scene.add(g); pickables.push(g); P = portals[p.id] = { g, ring, ring2, glow, p };
      }
      const used = worldUsedPortals.has(p.id);
      P.ring.material.color.setHex(used ? 0x888888 : 0xd27bff); P.ring2.material.color.setHex(used ? 0x666666 : 0x6df2ff); P.glow.material.opacity = used ? .25 : .9;
      P.ring.rotation.z = t * 1.5; P.ring2.rotation.z = -t * 2.2; P.g.scale.setScalar(1 + Math.sin(t * 4) * .04); P.p = p;
    });
    Object.keys(portals).forEach(id => { if (!ids[id]) { scene.remove(portals[id].g); pickables.splice(pickables.indexOf(portals[id].g), 1); delete portals[id]; } });
    // sea waves
    if (sea) { const a = sea.geometry.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(t * 1.6 + seaBase[i * 3] * 1.1 + seaBase[i * 3 + 1] * .8) * .07); a.needsUpdate = true; }
    // camera follows me
    const fx = me ? me.dx / S : 30, fz = me ? me.dy / S : 19, pitch = .95;
    const want = new T.Vector3(fx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 1, fz + Math.cos(yaw) * Math.cos(pitch) * dist);
    camPos.lerp(want, .12); camLook.lerp(new T.Vector3(fx, 1, fz), .2);
    cam.position.copy(camPos); cam.lookAt(camLook);
    sun.position.set(fx - 18, 34, fz - 10); sun.target.position.set(fx, 0, fz);
  }

  function overlay(ctx, users, now, t) {
    ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0); ctx.clearRect(0, 0, worldCssW, worldCssH);
    const proj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return v.z > 1 ? null : { x: (v.x * .5 + .5) * worldCssW, y: (-v.y * .5 + .5) * worldCssH }; };
    users.forEach(u => {
      const p = proj(u.dx / S, u.vehicle ? 2.6 : 2.1, u.dy / S); if (!p) return;
      const isMe = u.userId === currentUser.id, img = u.profilePicture ? getWorldImage(u.profilePicture) : null;
      ctx.save(); ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0);
      ctx.beginPath(); ctx.arc(p.x, p.y - 24, 15, 0, Math.PI * 2); ctx.fillStyle = isMe ? '#ff4d8d' : '#4d7cff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (img) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y - 24, 13, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, p.x - 13, p.y - 37, 26, 26); ctx.restore(); }
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#222';
      ctx.strokeText(u.name, p.x, p.y - 2); ctx.fillText(u.name, p.x, p.y - 2); ctx.restore();
      // speech bubbles and emotes use the existing drawing code, anchored above the name badge
      if (u.bubble || u.emote) {
        ctx.save(); ctx.setTransform(worldDpr, 0, 0, worldDpr, (p.x - u.dx) * worldDpr, (p.y - 52 - u.dy) * worldDpr);
        if (u.bubble) drawWorldBubble(ctx, u, now); if (u.emote) drawWorldEmote(ctx, u, now); ctx.restore();
      }
    });
    worldActivePortals().forEach(pp => {
      const p = proj(pp.x / S, 3.3, pp.y / S); if (!p) return;
      const s = Math.ceil(Math.max(0, pp.endsAt - Date.now()) / 1000), txt = worldUsedPortals.has(pp.id) ? '🔒 Sealed' : '🌀 Portal ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#fff'; ctx.strokeText(txt, p.x, p.y); ctx.fillText(txt, p.x, p.y);
    });
    drawWorldMinimap(ctx);
  }

  window.drawWorld = function () {
    if (failed()) return origDraw();
    if (!started) { try { init(); ON = true; } catch (e) { console.warn('3D town unavailable, using the flat town:', e); window.__w3dFail = true; return origDraw(); } started = true; }
    if (!worldCtx || !worldCssW) return;
    const now = performance.now(), t = Date.now() / 1000, users = Object.values(worldUsers), me = worldUsers[currentUser.id];
    // keyboard walking: aim a point ahead of me in the direction of the keys (relative to the camera)
    if (me && (keys.w || keys.s || keys.a || keys.d)) {
      const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      const dx = -Math.sin(yaw) * f + Math.cos(yaw) * r, dz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
      worldTarget = { x: clamp(me.x + dx * 160, WORLD_PAD, WORLD_W - WORLD_PAD), y: clamp(me.y + dz * 160, WORLD_PAD, WORLD_H - WORLD_PAD) }; keyDriven = true;
    } else if (keyDriven) { worldTarget = null; keyDriven = false; }
    updateWorldMovement(now); worldPortalTick();
    users.forEach(u => {
      if (u.dx === undefined) { u.dx = u.x; u.dy = u.y; }
      if (Math.abs(u.x - u.dx) > .5) u.face = u.x > u.dx ? 1 : -1;
      u.dx += (u.x - u.dx) * .35; u.dy += (u.y - u.dy) * .35;
      u.moving = Math.hypot(u.x - u.dx, u.y - u.dy) > .6; if (u.moving) u.phase = (u.phase || 0) + .4;
    });
    const w = worldCssW, h = worldCssH;
    if (c3.width !== Math.floor(w * R.getPixelRatio()) || c3.height !== Math.floor(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    updateScene(users, t, now); R.render(scene, cam);
    overlay(worldCtx, users, now, t);
  };
  const failed = () => !!window.__w3dFail;

  // a tap on the screen becomes a spot on the ground (or the person / car / portal that was tapped)
  window.worldEventPoint = function (e) {
    if (!ON) return origPoint(e);
    const r = c2.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, cam);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (hit) { let o = hit.object; while (o && !(o.userData && o.userData.anchor)) o = o.parent; if (o) return { x: o.userData.anchor.x, y: o.userData.anchor.y }; }
    const p = new T.Vector3();
    if (ray.ray.intersectPlane(plane, p)) return { x: p.x * S, y: p.z * S };
    return origPoint(e);
  };
})();
