/* 3D town (v2, future-city skin). Draws your existing World with three.js and adds:
   - a bigger town (new east district with a shopping mall and a movie theater, 6 more homes)
   - rooms you can walk into (homes, café, mall, cinema) - each one is a server "room"
   - customisable characters (boy / girl, hair, clothes, hat) and pets that follow you
   - cars with a driver and invited passengers
   All game logic (walking, chat, emotes, portals, multiplayer) is still in script.js and the server.
   The menus (style, shop, invites, prompts) live in world-ui.js. If WebGL is not available, the flat 2D town keeps working. */
(function () {
  if (typeof THREE === 'undefined' || typeof window.drawWorld !== 'function') return;
  const T = THREE, S = 40;                          // 1 unit in 3D = 40 pixels of the old 2D map
  const origDraw = window.drawWorld, origPoint = window.worldEventPoint;
  let ON = false, started = false, R, scene, cam, sun, hemi, town, c3, c2;
  let yaw = 0, dist = 15, camPos = new T.Vector3(30, 14, 30), camLook = new T.Vector3(30, 1, 20);
  const avatars = {}, pickables = [], keys = {}, portals = {}, parked = [], traffic = [], interiors = {};
  let keyDriven = false, sea = null, seaBase = null, curRoom = 'town', lastNow = 0, screenTex = null, lastScreen = 0;
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const adiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const heading = (dx, dz) => Math.atan2(-dx, -dz);        // characters and cars face -z
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  // shared with world-ui.js
  const W3 = window.W3 = { items: {}, skins: [0xf1c9a5, 0xd9a577, 0xa8714a, 0x7a4a2c], hairColors: [0x1b1410, 0x3b2314, 0x6b4423, 0xc9a24b, 0x2a2a35], catVer: 0,
    rooms: {}, doors: [], seats: { town: [{ x: 380, y: 450, h: 0 }, { x: 620, y: 450, h: 0 }, { x: 500, y: 200, h: 0 }] },
    onFrame: null, uiOpen: false, ready: () => ON, room: () => curRoom };
  W3.setCatalog = function (cat) {
    W3.items = {}; (cat.items || []).forEach(i => { W3.items[i.id] = i; });
    if (cat.skins) W3.skins = cat.skins; if (cat.hairColors) W3.hairColors = cat.hairColors; W3.catVer++;
  };

  const mats = {};
  const M = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o || {}))); };
  function add(parent, geo, mat, x, y, z, shadow) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; }
  const box = (p, w, h, d, c, x, y, z, o) => add(p, new T.BoxGeometry(w, h, d), M(c, o), x, y, z);
  const GEO = { sph: new T.SphereGeometry(1, 14, 10), cyl: new T.CylinderGeometry(1, 1, 1, 10), cone: new T.ConeGeometry(1, 1, 8),
    dome: new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skirt: new T.CylinderGeometry(.62, 1, 1, 14, 1, true) };
  const cyl = (p, r, h, c, x, y, z, o) => { const m = add(p, GEO.cyl, M(c, o), x, y, z); m.scale.set(r, h, r); return m; };
  const sph = (p, rx, ry, rz, c, x, y, z, o) => { const m = add(p, GEO.sph, M(c, o), x, y, z); m.scale.set(rx, ry, rz); return m; };

  function textSprite(text, size) {
    const c = document.createElement('canvas'), m = c.getContext('2d'); m.font = 'bold 40px Arial';
    const cw = Math.max(320, Math.ceil(m.measureText(text).width) + 40); c.width = cw; c.height = 80;     // wide enough for long names
    const g = c.getContext('2d'); g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.65)'; g.strokeText(text, cw / 2, 42); g.fillStyle = '#fff'; g.fillText(text, cw / 2, 42);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true }));
    s.scale.set(size * 4 * cw / 320, size, 1); return s;
  }
  function glowSprite(color, size) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, color); r.addColorStop(1, 'rgba(170,80,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }

  /* ================= EXPAND THE TOWN DATA (script.js keeps using these same arrays) ================= */
  // new east district: 6 more homes, the cinema, the mall, a fountain, trees
  ['#f4a6a6', '#a6c8f4', '#f4e0a6', '#b6e3b0', '#d9b6f0', '#f4c8a6'].forEach((color, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    WORLD_BUILDINGS.push({ x: 2480 + col * 280, y: row ? 1340 : 1060, w: 200, h: 140, color, roof: 'tri', roofH: 70,
      roofColor: ['#3a5ca8', '#8a6d2f', '#a8453a'][col], label: 'Home ' + (7 + i) });
  });
  WORLD_BUILDINGS.push(
    { x: 2470, y: 510, w: 300, h: 190, color: '#3b3f5c', roof: 'flat', roofH: 0, roofColor: '#c0392b', sign: '🎬', label: 'Cinema', wh: 4.6 },
    { x: 2880, y: 400, w: 560, h: 300, color: '#f0e6d8', roof: 'flat', roofH: 0, roofColor: '#8e44ad', sign: '🛍️', label: 'Shopping Mall', wh: 5.6 }
  );
  WORLD_BUILDINGS.slice(-8).forEach(b => WORLD_SOLIDS.push({ x: b.x, y: b.y - b.roofH, w: b.w, h: b.h + b.roofH }));
  WORLD_SOLIDS.push({ x: 2610, y: 895, w: 80, h: 80 });                      // fountain
  [{ e: '🚙', x: 2550, y: 1235 }, { e: '🚕', x: 2850, y: 1235 }, { e: '🚗', x: 3150, y: 1235 }].forEach(c => WORLD_PARKED_CARS.push(c));
  (function () {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const put = (e, x0, y0, x1, y1, n, s) => { for (let i = 0; i < n; i++) WORLD_DECOR.push({ e, x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), s }); };
    put('🌳', 2420, 940, 3560, 990, 9, 56); put('🌳', 3440, 100, 3560, 700, 6, 56); put('🌲', 3440, 960, 3560, 1540, 7, 56);
    put('🌷', 2400, 720, 3560, 750, 16, 26); put('🌼', 2400, 1210, 3560, 1260, 14, 24); put('🌳', 2400, 1530, 3560, 1560, 8, 56);
    [['🪴', 2800, 735], ['🪴', 3520, 735], ['🪴', 2440, 735], ['🪑', 2800, 800]].forEach(([e, x, y]) => WORLD_DECOR.push({ e, x, y, s: 36 }));
    WORLD_DECOR.push({ e: '⛲', x: 2650, y: 935, s: 90 });
  })();
  Object.assign(WORLD_PLACES, { mall: { x: 3160, y: 740 }, cinema: { x: 2620, y: 740 } });

  // doors: stand in front of one to get the "Enter" button
  WORLD_BUILDINGS.forEach(b => {
    let room = null, sign = b.sign || '🏠';
    if (/^Home (\d+)$/.test(b.label || '')) room = 'home' + RegExp.$1;
    else if (b.label === 'Café') room = 'cafe';
    else if (b.label === 'Cinema') room = 'cinema';
    else if (b.label === 'Shopping Mall') room = 'mall';
    if (room) W3.doors.push({ room, label: b.label, sign, x: b.x + b.w / 2, y: b.y + b.h + 22, r: 70 });
  });

  /* ================= CHARACTERS ================= */
  const DEF_ITEM = { top: { style: 'tee', color: 0x4d7cff }, bottom: { style: 'long', color: 0x2b3350 }, shoes: { style: 'sneakers', color: 0x222222 } };
  // what a player looks like when the server has not told us yet
  function lookOf(app, seed, isMe) {
    const a = app || {}, h = hash(seed);
    const item = (slot, id) => (id && W3.items[id]) || (slot === 'hat' || slot === 'pet' ? null : (slot === 'top' ? { style: 'tee', color: isMe ? 0xff4d8d : 0x4d7cff } : DEF_ITEM[slot]));
    return {
      gender: a.gender === 'girl' ? 'girl' : 'boy',
      skin: W3.skins[Number.isInteger(a.skin) ? a.skin : h % W3.skins.length] || W3.skins[0],
      hairStyle: a.hair || 'short',
      hairCol: W3.hairColors[Number.isInteger(a.hairColor) ? a.hairColor : (h >> 3) % W3.hairColors.length] || 0x1b1410,
      top: item('top', a.top), bottom: item('bottom', a.bottom), shoes: item('shoes', a.shoes), hat: item('hat', a.hat), pet: item('pet', a.pet)
    };
  }
  const lookSig = (app, seed, isMe) => W3.catVer + '|' + (app ? JSON.stringify(app) : seed + (isMe ? 'm' : ''));

  function buildAvatar(app, seed, isMe) {
    const A = lookOf(app, seed, isMe), girl = A.gender === 'girl', skin = A.skin;
    const R = {}, g = new T.Group(), body = new T.Group(); g.add(body); R.g = g; R.body = body;
    const hips = new T.Group(); hips.position.y = .85; body.add(hips); R.hips = hips;
    const hw = girl ? .115 : .13, lr = girl ? .095 : .105, bs = A.bottom.style, ss = A.shoes.style;
    [[-1, 'l'], [1, 'r']].forEach(([s, n]) => {
      const th = new T.Group(); th.position.set(s * hw, 0, 0); hips.add(th);
      const sh = new T.Group(); sh.position.y = -.38; th.add(sh);
      cyl(th, lr, .38, skin, 0, -.19, 0); cyl(sh, lr * .85, .38, skin, 0, -.19, 0);
      if (bs === 'long') { cyl(th, lr + .012, .38, A.bottom.color, 0, -.19, 0); cyl(sh, lr * .85 + .012, .38, A.bottom.color, 0, -.19, 0); }
      else if (bs === 'short') cyl(th, lr + .014, .26, A.bottom.color, 0, -.13, 0);
      if (ss === 'boots') cyl(sh, lr * .85 + .02, .22, A.shoes.color, 0, -.27, 0);
      if (ss === 'sandals') box(sh, .15, .04, .26, A.shoes.color, 0, -.385, -.04); else box(sh, .16, .09, .27, A.shoes.color, 0, -.35, -.04);
      R[n + 'L'] = th; R[n + 'S'] = sh;
    });
    if (bs === 'skirt') add(hips, GEO.skirt, M(A.bottom.color, { side: T.DoubleSide }), 0, -.06, 0).scale.set(.33, .38, .33);
    // torso
    const ts = A.top.style, tc = A.top.color, tw = girl ? .42 : .48, td = girl ? .25 : .27;
    box(hips, tw, .55, td, tc, 0, .42, 0);
    if (ts === 'dress') add(hips, GEO.skirt, M(tc, { side: T.DoubleSide }), 0, -.1, 0).scale.set(.37, .5, .37);
    if (ts === 'jacket') box(hips, .03, .55, .01, 0xd8d8d8, 0, .42, -td / 2 - .006);
    if (ts === 'hoodie') { sph(hips, .17, .11, .11, tc, 0, .72, td / 2 - .02); box(hips, .3, .12, .02, tc, 0, .2, -td / 2 - .008, { emissive: 0x000000 }); }
    if (ts === 'sweater') box(hips, .22, .05, td + .02, 0xffffff, 0, .7, 0, { opacity: .9, transparent: true });
    cyl(hips, .06, .12, skin, 0, .76, 0);
    // arms
    [[-1, 'lA'], [1, 'rA']].forEach(([s, n]) => {
      const a = new T.Group(); a.position.set(s * (girl ? .27 : .3), .62, 0); hips.add(a);
      cyl(a, .065, .5, skin, 0, -.22, 0); sph(a, .07, .07, .07, skin, 0, -.5, 0);
      if (ts === 'tee') cyl(a, .082, .2, tc, 0, -.1, 0);
      else if (ts === 'hoodie' || ts === 'jacket' || ts === 'sweater') cyl(a, .082, .44, tc, 0, -.23, 0);
      else if (ts === 'dress') cyl(a, .078, .1, tc, 0, -.05, 0);
      R[n] = a;
    });
    // head, face, hair
    sph(hips, .2, .22, .2, skin, 0, 1.02, 0);
    box(hips, .05, .05, .02, 0x222222, -.07, 1.04, -.2); box(hips, .05, .05, .02, 0x222222, .07, 1.04, -.2);
    box(hips, girl ? .06 : .05, .015, .02, 0xb5524a, 0, .965, -.2);
    if (girl) { box(hips, .07, .012, .02, 0x222222, -.07, 1.08, -.2); box(hips, .07, .012, .02, 0x222222, .07, 1.08, -.2); sph(hips, .03, .02, .01, 0xff9aa2, -.12, .985, -.185); sph(hips, .03, .02, .01, 0xff9aa2, .12, .985, -.185); }
    const hc = A.hairCol, hs = A.hairStyle;
    add(hips, GEO.dome, M(hc), 0, 1.04, .01).scale.set(hs === 'curly' ? .24 : .215, hs === 'curly' ? .23 : .2, hs === 'curly' ? .24 : .215);
    if (hs === 'long') { box(hips, .38, .55, .12, hc, 0, .82, .14); box(hips, .06, .4, .2, hc, -.18, .85, .02); box(hips, .06, .4, .2, hc, .18, .85, .02); }
    else if (hs === 'ponytail') { sph(hips, .1, .1, .1, hc, 0, 1.06, .2); cyl(hips, .05, .34, hc, 0, .86, .26).rotation.x = -.25; }
    else if (hs === 'bun') sph(hips, .1, .1, .1, hc, 0, 1.28, .02);
    else if (hs === 'curly') for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2; sph(hips, .09, .09, .09, hc, Math.cos(an) * .21, 1.08 + (i % 2) * .06, Math.sin(an) * .21); }
    if (A.hat) {
      const hc2 = A.hat.color, st = A.hat.style;
      if (st === 'cap') { add(hips, GEO.dome, M(hc2), 0, 1.08, 0).scale.set(.23, .2, .23); box(hips, .22, .02, .15, hc2, 0, 1.09, -.22); }
      else if (st === 'beanie') { add(hips, GEO.dome, M(hc2), 0, 1.05, 0).scale.set(.235, .27, .235); sph(hips, .05, .05, .05, 0xffffff, 0, 1.33, 0); }
      else if (st === 'sunhat') { cyl(hips, .42, .03, hc2, 0, 1.1, 0); add(hips, GEO.dome, M(hc2), 0, 1.1, 0).scale.set(.24, .17, .24); cyl(hips, .245, .04, 0xd9534f, 0, 1.13, 0); }
      else if (st === 'crown') { cyl(hips, .17, .1, hc2, 0, 1.27, 0, { metalness: .6, roughness: .3 }); for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2; add(hips, GEO.cone, M(hc2, { metalness: .6, roughness: .3 }), Math.cos(an) * .15, 1.37, Math.sin(an) * .15).scale.set(.035, .1, .035); } }
      else if (st === 'bow') { const a1 = add(hips, GEO.cone, M(hc2), .17, 1.2, -.06); a1.scale.set(.06, .1, .06); a1.rotation.z = -1.57; const a2 = add(hips, GEO.cone, M(hc2), .07, 1.2, -.06); a2.scale.set(.06, .1, .06); a2.rotation.z = 1.57; sph(hips, .035, .035, .035, hc2, .12, 1.2, -.06); }
    }
    R.cars = null; R.look = A; R.sitY = .5;
    g.userData.anchor = { x: 0, y: 0 }; g.traverse(o => { if (o.isMesh) o.userData.pick = true; });
    R.heading = 0; return R;
  }
  W3.buildAvatar = buildAvatar; W3.lookOf = lookOf;

  /* ================= PETS ================= */
  const PET = {
    dog:   { bl: .30, bw: .14, bh: .15, lh: .20, hr: .12, ear: 'floppy', earC: 0x6b4423, tail: 'up', snout: 1 },
    cat:   { bl: .24, bw: .10, bh: .10, lh: .17, hr: .10, ear: 'point', tail: 'long' },
    bunny: { bl: .17, bw: .11, bh: .12, lh: .09, hr: .09, ear: 'tall', tail: 'pom', tailC: 0xffffff },
    fox:   { bl: .27, bw: .10, bh: .10, lh: .19, hr: .10, ear: 'point', tail: 'bushy', tailC: 0xe2682b, tip: 0xffffff, belly: 0xffffff, snout: 1 },
    panda: { bl: .24, bw: .15, bh: .15, lh: .14, hr: .12, ear: 'round', earC: 0x1a1a1a, tail: 'pom', tailC: 0xf5f5f5, legC: 0x1a1a1a, patch: 1 }
  };
  function makePet(item) {
    const k = item.style, col = item.color, g = new T.Group(), P = { g, legs: [], kind: k, phase: 0 };
    const inner = new T.Group(); inner.scale.setScalar(1.5); g.add(inner); P.inner = inner;
    if (k === 'penguin') {
      sph(inner, .13, .19, .11, 0x23262d, 0, .24, 0); sph(inner, .1, .15, .07, 0xffffff, 0, .22, -.05); sph(inner, .09, .09, .09, 0x23262d, 0, .46, -.01);
      { const bk = add(inner, GEO.cone, M(0xff9f1c), 0, .45, -.1); bk.scale.set(.03, .06, .03); bk.rotation.x = -1.57; }
      sph(inner, .015, .015, .01, 0xffffff, -.04, .48, -.08); sph(inner, .015, .015, .01, 0xffffff, .04, .48, -.08);
      box(inner, .03, .22, .1, 0x23262d, -.14, .26, 0); box(inner, .03, .22, .1, 0x23262d, .14, .26, 0);
      P.legs = [box(inner, .09, .03, .12, 0xff9f1c, -.05, .02, -.03), box(inner, .09, .03, .12, 0xff9f1c, .05, .02, -.03)]; P.waddle = true;
      return P;
    }
    const c = PET[k] || PET.dog, y0 = c.lh + c.bh;
    sph(inner, c.bw, c.bh, c.bl, col, 0, y0, 0);
    if (c.belly) sph(inner, c.bw * .8, c.bh * .7, c.bl * .7, c.belly, 0, y0 - .03, -.02);
    const head = new T.Group(); head.position.set(0, y0 + c.bh * .5, -c.bl - .02); inner.add(head); P.head = head;
    sph(head, c.hr, c.hr * .95, c.hr, col, 0, 0, 0);
    sph(head, .02, .02, .015, 0x111111, -c.hr * .45, c.hr * .2, -c.hr * .85); sph(head, .02, .02, .015, 0x111111, c.hr * .45, c.hr * .2, -c.hr * .85);
    sph(head, .022, .018, .02, 0x222222, 0, -.01, -c.hr);
    if (c.snout) sph(head, c.hr * .5, c.hr * .4, c.hr * .5, k === 'fox' ? 0xffffff : 0xd9b48a, 0, -c.hr * .3, -c.hr * .75);
    if (c.patch) { sph(head, .035, .045, .015, 0x1a1a1a, -c.hr * .42, c.hr * .15, -c.hr * .82); sph(head, .035, .045, .015, 0x1a1a1a, c.hr * .42, c.hr * .15, -c.hr * .82); }
    [-1, 1].forEach(s => {
      if (c.ear === 'floppy') { const e = box(head, .05, .12, .03, c.earC, s * c.hr * .9, c.hr * .1, 0); e.rotation.z = s * .4; }
      else if (c.ear === 'point') add(head, GEO.cone, M(k === 'fox' ? 0x2a2a2a : col), s * c.hr * .6, c.hr * .95, 0).scale.set(.04, .09, .04);
      else if (c.ear === 'tall') { const e = cyl(head, .03, .2, col, s * c.hr * .4, c.hr * 1.4, 0); e.rotation.z = s * .15; }
      else if (c.ear === 'round') sph(head, .045, .045, .03, c.earC, s * c.hr * .8, c.hr * .85, 0);
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const top = c.lh + c.bh * .45, p = new T.Group(); p.position.set(sx * c.bw * .7, top, sz * c.bl * .6); inner.add(p);   // legs start inside the body
      cyl(p, .035, top, c.legC || col, 0, -top / 2, 0); P.legs.push(p);
    });
    if (c.tail === 'up') { const tl = add(inner, GEO.cone, M(col), 0, y0 + .05, c.bl + .06); tl.scale.set(.03, .14, .03); tl.rotation.x = -.7; }
    else if (c.tail === 'long') cyl(inner, .018, .28, col, 0, y0 + .1, c.bl + .1).rotation.x = -.9;
    else if (c.tail === 'pom') sph(inner, .04, .04, .04, c.tailC || col, 0, y0, c.bl + .03);
    else if (c.tail === 'bushy') { sph(inner, .07, .07, .16, c.tailC, 0, y0, c.bl + .14); sph(inner, .05, .05, .06, c.tip, 0, y0, c.bl + .3); }
    return P;
  }
  W3.makePet = makePet;

  /* ================= CARS ================= */
  const CARS = {
    '🚗': { c: 0xe53935, len: 2.5, h: .55, cab: .8 }, '🚙': { c: 0x1e88e5, len: 2.7, h: .75, cab: .75 }, '🚕': { c: 0xfdd835, len: 2.5, h: .55, cab: .8, sign: 1 },
    '🚓': { c: 0xf4f4f4, len: 2.6, h: .6, cab: .8, lights: 1 }, '🏎️': { c: 0xd32f2f, len: 2.7, h: .42, cab: .38, wide: 1, open: 1 }, '🚌': { c: 0xffb300, len: 5, h: .6, cab: .8, bus: 1 }
  };
  function makeCar(e) {
    const d = CARS[e] || CARS['🚗'], g = new T.Group(), w = d.wide ? 1.4 : 1.2, glass = { emissive: 0x5a8db8, emissiveIntensity: .25, transparent: true, opacity: .35 };
    box(g, w, d.h, d.len, d.c, 0, .3 + d.h / 2, 0);
    // open-top, glass-sided cabin so you can see who is riding from the top-down camera
    if (d.bus) { box(g, w * 1.02, .95, d.len * .96, 0xbfe3ff, 0, 1.38, 0, glass); }
    else if (d.open) box(g, w * .9, d.cab, d.len * .5, d.c, 0, .3 + d.h + d.cab / 2, d.len * .06);
    else { box(g, w * .9, d.cab, d.len * .5, 0xbfe3ff, 0, .3 + d.h + d.cab / 2, d.len * .06, glass); }
    if (d.sign) box(g, .5, .16, .25, 0xffffff, 0, .3 + d.h + d.cab + .1, 0);
    if (d.lights) { box(g, .3, .12, .12, 0xff3b30, -.2, .3 + d.h + d.cab + .08, 0, { emissive: 0xff3b30, emissiveIntensity: 1 }); box(g, .3, .12, .12, 0x2f7bff, .2, .3 + d.h + d.cab + .08, 0, { emissive: 0x2f7bff, emissiveIntensity: 1 }); }
    if (d.wide) box(g, w, .08, .3, 0x222222, 0, .3 + d.h + .35, d.len / 2 - .1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => { const wl = add(g, GEO.cyl, M(0x1b1b22), p[0] * (w / 2 + .02), .3, p[1] * d.len * .33); wl.rotation.z = Math.PI / 2; wl.scale.set(.3, .2, .3); });
    box(g, w * .7, .12, .06, 0xfff2a8, 0, .55, -d.len / 2, { emissive: 0xfff2a8, emissiveIntensity: .8 });
    box(g, w * .7, .1, .06, 0xff3b30, 0, .55, d.len / 2, { emissive: 0xff3b30, emissiveIntensity: .6 });
    return g;
  }
  // where each seat is, in car space (x right, z back). seat 0 = driver.
  function seatOffset(e, seat) {
    if (e === '🚌') return { x: seat % 2 ? .3 : -.3, z: -1.9 + Math.floor(seat / 2) };
    return { x: seat % 2 ? .3 : -.3, z: seat < 2 ? 0 : .62 };
  }

  /* ================= ROOMS YOU CAN WALK INTO ================= */
  // sizes are in the same pixel-like units as the town and MUST match ROOMS in sockets/world.js
  const lighten = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) + k), g = Math.min(255, ((c >> 8) & 255) + k), b = Math.min(255, (c & 255) + k); return (r << 16) | (g << 8) | b; };
  // furniture: w,d in px (for layout), sol = blocking rectangle (relative to the centre, rot 0), seats = sit spots (relative), build = 3D model facing +z
  const FURN = {
    sofa: { sol: [-45, -20, 90, 10], seats: [[-20, 3], [20, 3]], c: 0x6c8ebf, build: (g, c) => { box(g, 2.25, .35, 1, c, 0, .28, 0); box(g, .95, .15, .7, lighten(c, 25), -.5, .5, .1); box(g, .95, .15, .7, lighten(c, 25), .5, .5, .1); box(g, 2.25, .65, .22, c, 0, .7, -.38); box(g, .22, .5, 1, c, -1, .5, 0); box(g, .22, .5, 1, c, 1, .5, 0); } },
    armchair: { sol: [-18, -18, 36, 8], seats: [[0, 2]], c: 0xc97b5a, build: (g, c) => { box(g, .9, .3, .9, c, 0, .28, 0); box(g, .8, .14, .7, lighten(c, 25), 0, .5, .08); box(g, .9, .6, .2, c, 0, .65, -.35); box(g, .18, .45, .9, c, -.4, .5, 0); box(g, .18, .45, .9, c, .4, .5, 0); } },
    bed: { sol: [-40, -50, 80, 100], c: 0x8ec5ff, build: (g, c) => { box(g, 2, .3, 2.5, 0x8a5a33, 0, .25, 0); box(g, 1.9, .25, 2.3, 0xffffff, 0, .5, 0); box(g, 1.9, .28, 1.4, c, 0, .52, .45); box(g, .75, .18, .4, 0xffffff, -.45, .7, -.9); box(g, .75, .18, .4, 0xffffff, .45, .7, -.9); box(g, 2, .9, .1, 0x6f4526, 0, .7, -1.22); } },
    table: { sol: [-35, -22, 70, 44], c: 0x9a6a3a, build: (g, c) => { box(g, 1.75, .08, 1.1, c, 0, .75, 0); [[-.8, -.45], [.8, -.45], [-.8, .45], [.8, .45]].forEach(p => box(g, .08, .72, .08, 0x6f4526, p[0], .36, p[1])); box(g, .4, .08, .4, 0xffffff, 0, .83, 0); box(g, .1, .2, .1, 0xff6f91, 0, .95, 0); } },
    tvunit: { sol: [-35, -8, 70, 16], c: 0x4a3b32, build: (g, c) => { box(g, 1.75, .5, .4, c, 0, .25, 0); box(g, 1.4, .8, .08, 0x111111, 0, .95, 0); box(g, 1.3, .7, .02, 0x2a6fd6, 0, .95, .05, { emissive: 0x2a6fd6, emissiveIntensity: .6 }); } },
    kitchen: { sol: [-60, -15, 120, 30], c: 0xe8e0d0, build: (g, c) => { box(g, 3, .9, .75, c, 0, .45, 0); box(g, 3, .06, .8, 0x555a60, 0, .93, 0); box(g, .75, 1.9, .7, 0xd0d4da, 1.1, .95, 0); [-.6, -.2].forEach(x => { cyl(g, .12, .03, 0x222222, x, .97, 0); }); box(g, 1.2, .5, .3, 0xd9c7a0, -.9, 1.7, -.2); } },
    shelf: { sol: [-30, -8, 60, 16], c: 0x8a5a33, build: (g, c) => { box(g, 1.5, 1.8, .4, c, 0, .9, 0); [.3, .75, 1.2, 1.65].forEach((y, i) => { box(g, 1.4, .05, .38, 0x6f4526, 0, y, .01); for (let k = 0; k < 6; k++) box(g, .16, .3, .22, [0xe57373, 0x64b5f6, 0x81c784, 0xffd54f, 0xba68c8, 0x4db6ac][(k + i) % 6], -.55 + k * .22, y + .18, 0); }); } },
    plant: { sol: [-10, -10, 20, 20], c: 0x3da35a, build: (g, c) => { cyl(g, .22, .4, 0xc0683a, 0, .2, 0); sph(g, .35, .3, .35, c, 0, .7, 0); sph(g, .25, .25, .25, lighten(c, 20), .15, 1, 0); sph(g, .22, .22, .22, c, -.15, 1.1, .05); } },
    rug: { c: 0xc9a0dc, w: 140, d: 100, build: (g, c, o) => { const w = (o.w || 140) / S, d = (o.d || 100) / S; const m = add(g, new T.BoxGeometry(w, .04, d), M(c), 0, .03, 0, false); m.receiveShadow = true; add(g, new T.BoxGeometry(w * .8, .05, d * .8), M(lighten(c, 30)), 0, .035, 0, false); } },
    counter: { sol: [-65, -15, 130, 30], c: 0x8a5a33, build: (g, c) => { box(g, 3.25, 1, .75, c, 0, .5, 0); box(g, 3.4, .08, .9, 0xf5f5f5, 0, 1.04, 0); box(g, .45, .3, .35, 0x333333, .9, 1.23, 0); box(g, .5, .02, .3, 0x6cf2a6, .9, 1.4, -.05, { emissive: 0x6cf2a6, emissiveIntensity: .8 }); } },
    rack: { sol: [-30, -8, 60, 16], c: 0xd0d4da, build: (g, c) => { box(g, .05, 1.6, .05, c, -.7, .8, 0); box(g, .05, 1.6, .05, c, .7, .8, 0); box(g, 1.45, .04, .04, c, 0, 1.55, 0); [0xff6f91, 0x64b5f6, 0xffd54f, 0x81c784, 0xba68c8, 0xffffff, 0xff8a65].forEach((col, i) => box(g, .12, .6, .3, col, -.6 + i * .2, 1.2, 0)); } },
    bench: { seats: [[-18, 0], [18, 0]], c: 0x8a5a33, build: (g, c) => { box(g, 1.75, .1, .5, c, 0, .4, 0); [-.75, .75].forEach(x => box(g, .1, .4, .45, 0x333333, x, .2, 0)); } },
    petpen: { sol: [-45, -22, 90, 44], c: 0xffffff, build: (g, c) => { box(g, 2.25, .45, 1.1, c, 0, .22, 0); [0xffb74d, 0xf5f5f5, 0x8d6e63, 0xffd54f].forEach((col, i) => { const x = -.85 + i * .57; sph(g, .17, .15, .2, col, x, .62, 0); sph(g, .1, .1, .1, col, x, .82, -.08); box(g, .02, .5, .02, 0xcccccc, x - .27, .7, .5); }); box(g, 2.2, .03, .03, 0xcccccc, 0, .95, .5); } },
    fountain: { sol: [-35, -35, 70, 70], c: 0xb8bcc6, build: (g, c) => { cyl(g, .95, .45, c, 0, .22, 0); cyl(g, .82, .46, 0x4fc3f7, 0, .24, 0, { transparent: true, opacity: .85, roughness: .2 }); cyl(g, .13, 1, c, 0, .75, 0); sph(g, .26, .12, .26, 0x4fc3f7, 0, 1.3, 0, { transparent: true, opacity: .8 }); } },
    popcorn: { sol: [-25, -15, 50, 30], c: 0xd32f2f, build: (g, c) => { box(g, 1.25, .9, .75, c, 0, .45, 0); box(g, 1.2, .55, .7, 0xffffff, 0, 1.15, 0, { transparent: true, opacity: .35 }); for (let i = 0; i < 14; i++) sph(g, .09, .09, .09, 0xfff2b0, -.45 + (i % 5) * .22, 1.05 + Math.floor(i / 5) * .14, -.15 + (i % 3) * .15); box(g, 1.4, .1, .9, 0xffffff, 0, 1.55, 0); } },
    rtable: { sol: [-18, -18, 36, 36], c: 0x9a6a3a, build: (g, c) => { cyl(g, .55, .06, c, 0, .75, 0); cyl(g, .07, .72, 0x6f4526, 0, .36, 0); cyl(g, .28, .05, 0x6f4526, 0, .03, 0); cyl(g, .12, .22, 0xffffff, .1, .88, 0); } },
    chair: { seats: [[0, 0]], c: 0xc9854a, build: (g, c) => { box(g, .5, .08, .5, c, 0, .42, 0); box(g, .5, .5, .06, c, 0, .7, -.22); [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(p => box(g, .05, .4, .05, 0x6f4526, p[0], .2, p[1])); } },
    cseat: { seats: [[0, 0]], c: 0xa11629, build: (g, c) => { box(g, .7, .12, .7, 0x6a0f1c, 0, .35, 0); box(g, .62, .12, .6, c, 0, .46, .02); box(g, .7, .5, .14, 0x85111f, 0, .65, -.32); box(g, .08, .4, .6, 0x7a1020, -.36, .55, 0); box(g, .08, .4, .6, 0x7a1020, .36, .55, 0); } },
    lamp: { sol: [-6, -6, 12, 12], c: 0xfff1b8, build: (g, c) => { cyl(g, .05, 1.5, 0x555555, 0, .75, 0); add(g, GEO.cone, M(c, { emissive: c, emissiveIntensity: .7 }), 0, 1.6, 0).scale.set(.3, .35, .3); } }
  };
  const rotRect = (r, rot) => rot ? [-(r[0] + r[2]), -(r[1] + r[3]), r[2], r[3]] : r;

  const HOME_WALLS = [0xf3e5d0, 0xe6eef7, 0xf5e1e8, 0xe3f1e0, 0xf7ecd2, 0xe9e1f3];
  function specFor(id) {
    if (id === 'cafe') return { label: '☕ Café', w: 520, h: 380, wallH: 3.4, floor: 'wood', wall: 0xf1dcc0, items: [
      { t: 'counter', x: 260, y: 50, c: 0x8a5a33 }, { t: 'shelf', x: 400, y: 20 }, { t: 'shelf', x: 120, y: 20 },
      ...[[100, 160], [260, 190], [420, 160], [100, 280], [420, 280]].flatMap(([x, y]) => [{ t: 'rtable', x, y }, { t: 'chair', x, y: y - 34 }, { t: 'chair', x, y: y + 34, rot: Math.PI }]),
      { t: 'plant', x: 30, y: 340 }, { t: 'plant', x: 490, y: 340 }, { t: 'lamp', x: 30, y: 60 }, { t: 'lamp', x: 490, y: 60 }], windows: [90, 430] };
    if (id === 'mall') return { label: '🛍️ Shopping Mall', w: 900, h: 600, wallH: 5, floor: 'tile', wall: 0xf4eee6, items: [
      { t: 'counter', x: 170, y: 130, c: 0xd96a8a }, { t: 'rack', x: 120, y: 48 }, { t: 'rack', x: 220, y: 48 },
      { t: 'counter', x: 450, y: 130, c: 0x4a78c2 }, { t: 'shelf', x: 400, y: 24 }, { t: 'shelf', x: 500, y: 24 },
      { t: 'counter', x: 730, y: 130, c: 0x4caf7a }, { t: 'petpen', x: 730, y: 64 },
      { t: 'fountain', x: 450, y: 330 }, { t: 'bench', x: 450, y: 272 }, { t: 'bench', x: 450, y: 388, rot: Math.PI },
      { t: 'plant', x: 40, y: 300 }, { t: 'plant', x: 860, y: 300 }, { t: 'plant', x: 40, y: 560 }, { t: 'plant', x: 860, y: 560 },
      { t: 'lamp', x: 300, y: 260 }, { t: 'lamp', x: 600, y: 260 }, { t: 'bench', x: 150, y: 440 }, { t: 'bench', x: 750, y: 440 }],
      signs: [[170, '👗 Boutique'], [450, '👟 Shoes & Hats'], [730, '🐾 Pet Shop']],
      zones: [{ kind: 'shop', id: 'boutique', x: 170, y: 176, r: 70, label: '👗 Boutique', tabs: ['top', 'bottom'] },
              { kind: 'shop', id: 'shoes', x: 450, y: 176, r: 70, label: '👟 Shoes & Hats', tabs: ['shoes', 'hat'] },
              { kind: 'shop', id: 'pets', x: 730, y: 176, r: 70, label: '🐾 Pet Shop', tabs: ['pet'] }] };
    if (id === 'cinema') {
      const items = [{ t: 'counter', x: 170, y: 430, c: 0x7a1020 }, { t: 'popcorn', x: 630, y: 430 }, { t: 'plant', x: 40, y: 520 }, { t: 'plant', x: 760, y: 520 }, { t: 'lamp', x: 60, y: 380 }, { t: 'lamp', x: 740, y: 380 }];
      [200, 240, 280].forEach(y => { for (let i = 0; i < 10; i++) items.push({ t: 'cseat', x: 400 + (i - 4.5) * 40, y, rot: Math.PI }); });
      return { label: '🎬 Cinema', w: 800, h: 560, wallH: 6.5, floor: 'carpet', wall: 0x2a2433, items, screen: true, signs: [[170, '🎟️ Tickets']],
        zones: [{ kind: 'ticket', x: 170, y: 466, r: 80, label: '🎟️ Cinema ticket' }] };
    }
    const n = +String(id).replace('home', '') || 1;   // homes
    return { label: '🏠 Home ' + n, w: 560, h: 420, wallH: 3.4, floor: 'wood', wall: HOME_WALLS[(n - 1) % HOME_WALLS.length], items: [
      { t: 'rug', x: 280, y: 250, c: [0xc9a0dc, 0x9ad0c2, 0xf2b880][n % 3] }, { t: 'tvunit', x: 280, y: 28 }, { t: 'sofa', x: 280, y: 215, rot: Math.PI, c: [0x6c8ebf, 0xd98a9e, 0x7fbf8e][n % 3] },
      { t: 'bed', x: 70, y: 82, c: [0x8ec5ff, 0xffb3c7, 0xb8e0a8][n % 3] }, { t: 'kitchen', x: 430, y: 22 }, { t: 'shelf', x: 190, y: 20 },
      { t: 'table', x: 440, y: 150 }, { t: 'chair', x: 425, y: 118 }, { t: 'chair', x: 455, y: 118 }, { t: 'chair', x: 425, y: 182, rot: Math.PI }, { t: 'chair', x: 455, y: 182, rot: Math.PI },
      { t: 'armchair', x: 90, y: 300, }, { t: 'plant', x: 30, y: 390 }, { t: 'plant', x: 530, y: 390 }, { t: 'lamp', x: 150, y: 215 }], windows: [140, 420] };
  }

  const roomData = {};
  function getRoom(id) {
    if (roomData[id]) return roomData[id];
    const sp = specFor(id), solids = [], seats = [], zones = (sp.zones || []).slice();
    sp.items.forEach(it => {
      const f = FURN[it.t], rot = it.rot || 0;
      if (f.sol) { const r = rotRect(f.sol, rot); solids.push({ x: it.x + r[0], y: it.y + r[1], w: r[2], h: r[3] }); }
      (f.seats || []).forEach(s => seats.push({ x: it.x + (rot ? -s[0] : s[0]), y: it.y + (rot ? -s[1] : s[1]), h: rot ? 0 : Math.PI }));
    });
    zones.push({ kind: 'exit', x: sp.w / 2, y: sp.h - 24, r: 55, label: '🚪 Exit' });
    return (roomData[id] = { id, label: sp.label, w: sp.w, h: sp.h, solids, seats, zones, spec: sp });
  }
  W3.getRoom = getRoom;
  // the same "can't walk through" test script.js uses in town, for the room you are in
  window.worldRoomBlocked = function (x, y) {
    const r = getRoom(worldRoom);
    if (x < 34 || x > r.w - 34 || y < 44 || y > r.h - 12) return true;
    for (const s of r.solids) if (s.w && x > s.x - 12 && x < s.x + s.w + 12 && y > s.y - 8 && y < s.y + s.h + 14) return true;
    return false;
  };
  W3.bounds = () => curRoom === 'town' ? { w: WORLD_W, h: WORLD_H } : getRoom(curRoom);
  W3.seatAt = (room, x, y) => (room === 'town' ? W3.seats.town : getRoom(room).seats).find(s => Math.hypot(s.x - x, s.y - y) < 14) || null;

  const texCache = {};
  function floorTex(kind, w, h) {
    const k = kind + w + h; if (texCache[k]) return texCache[k];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    if (kind === 'tile') { g.fillStyle = '#e9dfd1'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#cfc0ab'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }
    else if (kind === 'carpet') { g.fillStyle = '#4a1220'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#521525'; for (let i = 0; i < 128; i += 32) g.fillRect(0, i, 128, 16); }
    else { g.fillStyle = '#c99a62'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a97c48'; g.lineWidth = 2; for (let i = 0; i < 128; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } g.beginPath(); g.moveTo(40, 0); g.lineTo(40, 32); g.moveTo(90, 32); g.lineTo(90, 64); g.moveTo(20, 64); g.lineTo(20, 96); g.moveTo(70, 96); g.lineTo(70, 128); g.stroke(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / S / 3.2, h / S / 3.2); t.encoding = T.sRGBEncoding;
    return (texCache[k] = t);
  }

  // ---- the movie screen: original little "reels" drawn from the clock so everybody in the room sees the same thing ----
  function drawFilm(g, W, H, t) {
    const slot = 100, show = Math.floor(t / slot) % 3, tt = t % slot, names = ['Starlight Voyage', 'Ocean Dreams', 'Heart Rain'];
    if (tt < 6) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd54f'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('NOW SHOWING', W / 2, H / 2 - 20); g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.fillText(names[show], W / 2, H / 2 + 28); return; }
    const hearts = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * .3); g.bezierCurveTo(x, y - s * .2, x - s, y - s * .2, x - s, y + s * .35); g.bezierCurveTo(x - s, y + s * .8, x, y + s, x, y + s * 1.2); g.bezierCurveTo(x, y + s, x + s, y + s * .8, x + s, y + s * .35); g.bezierCurveTo(x + s, y - s * .2, x, y - s * .2, x, y + s * .3); g.fill(); };
    if (show === 0) {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05051a'); bg.addColorStop(1, '#2a1a5a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { const sp = 20 + (i % 5) * 14, x = ((i * 97 - tt * sp) % W + W) % W, y = (i * 53) % H; g.fillRect(x, y, 1 + (i % 3), 1 + (i % 2)); }
      g.fillStyle = '#e57373'; g.beginPath(); g.arc(W * .78, H * .35, 46, 0, 7); g.fill(); g.strokeStyle = '#ffcc80'; g.lineWidth = 5; g.beginPath(); g.ellipse(W * .78, H * .35, 74, 14, -.4, 0, 7); g.stroke();
      const sy = H * .6 + Math.sin(tt * 2) * 12; g.fillStyle = '#eceff1'; g.beginPath(); g.moveTo(W * .25, sy); g.lineTo(W * .17, sy + 16); g.lineTo(W * .17, sy - 16); g.fill(); g.fillStyle = '#ff9800'; g.beginPath(); g.moveTo(W * .17, sy); g.lineTo(W * .1 - Math.random() * 10, sy + 6); g.lineTo(W * .1 - Math.random() * 10, sy - 6); g.fill();
    } else if (show === 1) {
      const p = Math.min(1, (tt - 6) / 90), bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffb26b'); bg.addColorStop(1, '#ff6f91'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(W / 2, H * (.45 + p * .25), 40, 0, 7); g.fill();
      for (let l = 0; l < 4; l++) { g.fillStyle = ['#4fc3f7', '#29a8e0', '#1e88c9', '#14679c'][l]; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (.6 + l * .1) + Math.sin(x / 30 + tt * (1 + l * .4)) * 6); g.lineTo(W, H); g.fill(); }
      const bx2 = (tt * 12) % (W + 80) - 40; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx2, H * .6); g.lineTo(bx2, H * .4); g.lineTo(bx2 + 26, H * .6); g.fill(); g.fillStyle = '#6d4c41'; g.fillRect(bx2 - 12, H * .6, 44, 6);
    } else {
      const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#ff9ac1'); bg.addColorStop(1, '#8e6bd8'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,255,' + (.3 + (i % 4) * .15) + ')'; hearts((i * 61) % W, ((i * 37 + tt * (30 + (i % 5) * 12)) % (H + 40)) - 20, 8 + (i % 4) * 4); }
      g.fillStyle = '#ff2d6f'; hearts(W / 2, H * .3, 50 + Math.sin(tt * 4) * 6);
    }
  }
  function makeScreen() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    screenTex = { c, g, tex: new T.CanvasTexture(c), video: null };
    screenTex.tex.encoding = T.sRGBEncoding;
    const url = window.CINEMA_VIDEO_URL;    // optional: set this (same-origin file) to play your own licensed video in sync
    if (url) { const v = document.createElement('video'); v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; screenTex.video = v; screenTex.vtex = new T.VideoTexture(v); screenTex.vtex.encoding = T.sRGBEncoding; }
    return screenTex;
  }
  function tickScreen(now) {
    if (!screenTex || curRoom !== 'cinema' || now - lastScreen < 66) return; lastScreen = now;
    const v = screenTex.video;
    if (v && v.duration) { const want = (Date.now() / 1000) % v.duration; if (v.paused) v.play().catch(() => {}); if (Math.abs(v.currentTime - want) > 1.5) v.currentTime = want; return; }
    drawFilm(screenTex.g, 512, 256, Date.now() / 1000); screenTex.tex.needsUpdate = true;
  }

  function buildRoomMeshes(id) {
    const rd = getRoom(id), sp = rd.spec, g = new T.Group(), W = rd.w / S, H = rd.h / S, wh = sp.wallH;
    const fl = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ map: floorTex(sp.floor, rd.w, rd.h), roughness: .9 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(W / 2, .01, H / 2); fl.receiveShadow = true; g.add(fl);
    box(g, W + .6, wh, .3, sp.wall, W / 2, wh / 2, -.15); box(g, .3, wh, H, sp.wall, -.15, wh / 2, H / 2); box(g, .3, wh, H, sp.wall, W + .15, wh / 2, H / 2);
    box(g, W, .22, .1, 0xffffff, W / 2, .11, .02); box(g, W, .12, .12, lighten(sp.wall, -30), W / 2, wh - .06, .02);
    (sp.windows || []).forEach(x => { box(g, 2.6, 1.5, .08, 0xcfe8ff, x / S, 2, .03, { emissive: 0x9ad0ff, emissiveIntensity: .5 }); box(g, 2.8, .1, .1, 0xffffff, x / S, 2.8, .05); box(g, 2.8, .1, .1, 0xffffff, x / S, 1.2, .05); box(g, .08, 1.6, .1, 0xffffff, x / S, 2, .05); });
    // front door frame + mat (you leave through it)
    const dx = W / 2; box(g, .15, 2.1, .15, 0x6b3f20, dx - 1.1, 1.05, H); box(g, .15, 2.1, .15, 0x6b3f20, dx + 1.1, 1.05, H); box(g, 2.35, .15, .15, 0x6b3f20, dx, 2.1, H);
    box(g, 1.9, .03, .8, 0x2e9e6a, dx, .04, H - .5, { emissive: 0x2e9e6a, emissiveIntensity: .35 }); const ex = textSprite('EXIT', .5); ex.position.set(dx, 2.6, H); g.add(ex);
    sp.items.forEach(it => { const f = FURN[it.t], m = new T.Group(); f.build(m, it.c !== undefined ? it.c : f.c, it); m.position.set(it.x / S, 0, it.y / S); m.rotation.y = it.rot || 0; g.add(m); });
    (sp.signs || []).forEach(([x, txt]) => { const l = textSprite(txt, .7); l.position.set(x / S, wh - 1.7, .4); g.add(l); });
    if (sp.screen) {
      const sc = screenTex || makeScreen();
      const m = new T.Mesh(new T.PlaneGeometry(11, 5.5), new T.MeshBasicMaterial({ map: sc.vtex || sc.tex })); m.position.set(W / 2, 3.7, .02); g.add(m);
      box(g, 11.4, 5.9, .1, 0x111111, W / 2, 3.7, -.03);
    }
    // warm light inside
    const pl = new T.PointLight(0xfff0d0, .25, 30); pl.position.set(W / 2, wh - .4, H / 2); g.add(pl);
    g.visible = false; scene.add(g); return g;
  }

  /* ================= THE TOWN ================= */
  const addT = o => town.add(o);
  function flat(x, y, w, h, color, lift, o) {
    const m = new T.Mesh(new T.PlaneGeometry(w / S, h / S), M(color, o)); m.rotation.x = -Math.PI / 2;
    m.position.set((x + w / 2) / S, lift, (y + h / 2) / S); m.receiveShadow = true; addT(m); return m;
  }
  function tree(x, z, k, kind) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const hue = kind === 'pine' ? 0x3f9a63 : [0x4fae6b, 0x5cbb78, 0x459e5f][hash(x + ':' + z) % 3];
    box(g, 1.1 * k, .3 * k, 1.1 * k, 0xf2f5f7, 0, .15 * k, 0);            // white planter
    add(g, GEO.cyl, M(0xd8d3c8), 0, .7 * k, 0, true).scale.set(.18 * k, 1.4 * k, .18 * k);
    if (kind === 'pine') { add(g, GEO.cone, M(hue), 0, 1.7 * k, 0).scale.set(.85 * k, 1.5 * k, .85 * k); add(g, GEO.cone, M(hue), 0, 2.5 * k, 0).scale.set(.6 * k, 1.2 * k, .6 * k); }
    else add(g, GEO.sph, M(hue), 0, 2 * k, 0).scale.set(.95 * k, .85 * k, .95 * k);
    addT(g);
  }
  function palm(x, z, k) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const t = add(g, GEO.cyl, M(0x9c7a4d), 0, 1.3 * k, 0); t.scale.set(.14 * k, 2.6 * k, .14 * k); t.rotation.z = .12;
    for (let i = 0; i < 6; i++) { const f = add(g, GEO.cone, M(0x3da35a), Math.cos(i) * .45 * k, 2.65 * k, Math.sin(i) * .45 * k); f.scale.set(.12 * k, .9 * k, .4 * k); f.rotation.set(0, -i, Math.PI / 2.4); }
    addT(g);
  }
  function smallThing(e, x, z, s) {
    const g = new T.Group(); g.position.set(x, 0, z);
    if (e === '🌷' || e === '🌼') { const c = e === '🌷' ? [0xe5368f, 0xff6fb5][hash(x + z) % 2] : 0xffd23f;
      for (let i = 0; i < 3; i++) { add(g, GEO.cyl, M(0x3d9a4a), i * .15 - .15, .15, 0, false).scale.set(.02, .3, .02); add(g, GEO.sph, M(c), i * .15 - .15, .34, 0, false).scale.set(.1, .1, .1); } }
    else if (e === '⛱️') { add(g, GEO.cyl, M(0xffffff), 0, .8, 0).scale.set(.04, 1.6, .04); add(g, GEO.cone, M([0xe53935, 0x1e88e5, 0xfdd835][hash(x) % 3]), 0, 1.65, 0).scale.set(.9, .45, .9); }
    else if (e === '🐚') add(g, GEO.sph, M(0xffb7c5), 0, .06, 0, false).scale.set(.14, .08, .14);
    else if (e === '🪴') { add(g, GEO.cyl, M(0xc0683a), 0, .22, 0).scale.set(.28, .44, .28); add(g, GEO.sph, M(0x3da35a), 0, .62, 0).scale.set(.3, .3, .3); }
    else if (e === '🪑') { box(g, .6, .1, .6, 0x8a5a33, 0, .45, 0); box(g, .6, .55, .08, 0x8a5a33, 0, .75, .26); [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]].forEach(p => box(g, .07, .45, .07, 0x6f4526, p[0], .22, p[1])); }
    else if (e === '⛲') { cyl(g, 1.1, .5, 0xb8bcc6, 0, .25, 0); cyl(g, .95, .52, 0x4fc3f7, 0, .27, 0, { transparent: true, opacity: .85, roughness: .2 }); cyl(g, .14, 1.3, 0xb8bcc6, 0, .8, 0); sph(g, .3, .14, .3, 0x4fc3f7, 0, 1.5, 0, { transparent: true, opacity: .8 }); }
    addT(g);
  }
  function building(b) {
    // future-city skin: pale curved shaft + glass band + garden terraces + crown
    const fw = b.w / S, cx = (b.x + b.w / 2) / S, cz = (b.y + b.h / 2) / S;
    const g = new T.Group(); addT(g);
    const tall = b.label === 'Shopping Mall' || b.label === 'Cinema';
    const H = tall ? 10 + fw * 2 : 4 + fw * 1.2;
    const white = { roughness: .35, metalness: .15 };
    const shaft = add(g, GEO.cyl, M(0xf4f7f9, white), cx, H / 2, cz); shaft.scale.set(fw * .45, H, fw * .45);
    const band = add(g, GEO.cyl, M(0xbfe0ee, { roughness: .1, metalness: .4, transparent: true, opacity: .85, emissive: 0x7fc4de, emissiveIntensity: .15 }), cx, H * .62, cz);
    band.scale.set(fw * .47, H * .5, fw * .47);
    for (let i = 1; i <= 3; i++) {
      const t = add(g, GEO.cyl, M(0x6fbf82, { roughness: .9 }), cx, H * .25 * i, cz);
      t.scale.set(fw * (.62 - i * .06), .18, fw * (.62 - i * .06));
    }
    const crown = add(g, GEO.dome, M(0xe8f4f8, white), cx, H, cz); crown.scale.set(fw * .4, fw * .3, fw * .4);
    if (tall) [-1, 1].forEach(s => {
      const arc = add(g, GEO.cyl, M(0xf4f7f9, white), cx + s * fw * .7, H * .4, cz + fw * .3);
      arc.scale.set(fw * .18, H * .8, fw * .18); arc.rotation.z = s * .12;
    });
    // glass door (the door mat logic in world-ui.js stays exactly the same)
    const fz = cz + fw * .45 + .04;
    box(g, 1, 1.8, .1, 0x9fd4e8, cx, .9, fz, { emissive: 0x6fc0dd, emissiveIntensity: .3, transparent: true, opacity: .9 });
    box(g, 1.6, .03, .9, 0x2e9e6a, cx, .04, fz + .5, { emissive: 0x2e9e6a, emissiveIntensity: .35 });
    if (b.label) { const l = textSprite((b.sign ? b.sign + ' ' : '') + b.label, .55); l.position.set(cx, H + fw * .35 + .6, cz + fw * .4); g.add(l); }
  }

  function init() {
    c3 = document.createElement('canvas'); c3.id = 'world-3d';
    c3.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none';
    const stage = document.getElementById('world-stage'); c2 = document.getElementById('world-canvas');
    stage.insertBefore(c3, c2); c2.style.cssText += ';position:absolute;left:0;top:0;z-index:1';
    R = new T.WebGLRenderer({ canvas: c3, antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    scene = new T.Scene(); scene.background = new T.Color(0xdcebf4); scene.fog = new T.Fog(0xdcebf4, 45, 115);
    cam = new T.PerspectiveCamera(52, 1, .1, 200);
    hemi = new T.HemisphereLight(0xf6fbff, 0xc4d9c6, .85); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, .9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 120; scene.add(sun, sun.target);
    town = new T.Group(); scene.add(town);

    const base = new T.Mesh(new T.PlaneGeometry(WORLD_W / S + 40, WORLD_H / S + 40), M(0xcfe0cf)); base.rotation.x = -Math.PI / 2; base.position.set(WORLD_W / S / 2, -.01, WORLD_H / S / 2); base.receiveShadow = true; addT(base);
    flat(0, 0, WORLD_W, WORLD_H, 0xcfe0cf, 0); flat(60, 60, 980, 620, 0xdcebe0, .01); flat(1340, 60, 1000, 620, 0xe8ecef, .01); flat(1340, 960, 1000, 580, 0xdcebe0, .01);
    flat(60, 960, 980, 385, 0xefe6cf, .01); flat(1040, 680, 320, 280, 0xdfe3e8, .02);
    flat(2340, 60, 1200, 620, 0xe8ecef, .01); flat(2340, 960, 1200, 580, 0xdcebe0, .01); flat(2440, 700, 1060, 60, 0xdfe3e8, .02); flat(2540, 860, 220, 140, 0xdfe3e8, .02);
    flat(0, 760, WORLD_W, 120, 0xd9dee4, .03); flat(1140, 0, 120, WORLD_H, 0xd9dee4, .03);
    const lane = { emissive: 0x9fe8ff, emissiveIntensity: .8 };
    for (let x = 0; x < WORLD_W; x += 56) { if (x > 1100 && x < 1280) continue; flat(x, 818, 30, 4, 0xf2f2f2, .04, lane); }
    for (let y = 0; y < WORLD_H; y += 56) { if (y > 730 && y < 900) continue; flat(1198, y, 4, 30, 0xf2f2f2, .04, lane); }
    const sg = new T.PlaneGeometry(1140 / S, 260 / S, 28, 7); sea = new T.Mesh(sg, M(0x5fb6e8, { transparent: true, opacity: .9, roughness: .15, metalness: .15 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(570 / S, .03, 1470 / S); addT(sea); seaBase = Float32Array.from(sg.attributes.position.array);
    [[150, 0x9adcf5, .035], [126, 0x74c9ef, .04]].forEach(([r, c, y]) => { const p = new T.Mesh(new T.CircleGeometry(1, 40), M(c)); p.rotation.x = -Math.PI / 2; p.scale.set(r / S, 72 / 125 * r / S, 1); p.position.set(500 / S, y, 330 / S); addT(p); });
    WORLD_BUILDINGS.forEach(building);
    WORLD_DECOR.forEach(d => {
      const x = d.x / S, z = d.y / S, k = d.s / 56;
      if (d.e === '🌳') tree(x, z, k * 1.1, 'oak'); else if (d.e === '🌲') tree(x, z, k * 1.1, 'pine'); else if (d.e === '🌴') palm(x, z, k * 1.1); else smallThing(d.e, x, z, d.s);
    });
    WORLD_TRAFFIC.forEach(c => { const m = makeCar(c.e); addT(m); traffic.push({ c, m }); });
    const mk = (txt, left, f) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'position:absolute;bottom:84px;' + left + ';z-index:4;width:44px;height:44px;margin:0;padding:0;border-radius:50%;border:0;background:rgba(0,0,0,.45);color:#fff;font-size:22px;max-width:none'; b.onclick = f; stage.appendChild(b); };
    mk('⟲', 'left:12px', () => { yaw -= .5; }); mk('⟳', 'left:62px', () => { yaw += .5; });
    c2.addEventListener('wheel', e => { dist = clamp(dist + e.deltaY * .01, 7, 24); e.preventDefault(); }, { passive: false });
    const typing = e => /INPUT|TEXTAREA/.test((e.target.tagName || '')) || W3.uiOpen;
    addEventListener('keydown', e => { if (typing(e)) return; const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = 1; else if (e.key === 'ArrowUp') keys.w = 1; else if (e.key === 'ArrowDown') keys.s = 1; else if (e.key === 'ArrowLeft') keys.a = 1; else if (e.key === 'ArrowRight') keys.d = 1; else if (k === 'q') yaw -= .4; else if (k === 'e') yaw += .4; });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = 0; else if (e.key === 'ArrowUp') keys.w = 0; else if (e.key === 'ArrowDown') keys.s = 0; else if (e.key === 'ArrowLeft') keys.a = 0; else if (e.key === 'ArrowRight') keys.d = 0; });
  }

  function applyRoom(id) {
    if (id !== 'town') { if (!interiors[id]) interiors[id] = buildRoomMeshes(id); }
    town.visible = id === 'town';
    Object.keys(interiors).forEach(k => { interiors[k].visible = k === id; });
    if (id === 'town') { scene.background.setHex(0xdcebf4); scene.fog.color.setHex(0xdcebf4); scene.fog.near = 45; scene.fog.far = 115; hemi.intensity = .85; sun.intensity = .9; }
    else { scene.background.setHex(0x17141d); scene.fog.color.setHex(0x17141d); scene.fog.near = 60; scene.fog.far = 200; hemi.intensity = .68; sun.intensity = .5; }
    curRoom = id; camSnap = true; yaw = 0;
    Object.values(avatars).forEach(A => { if (A.pet) A.pet.pos = null; });
  }
  let camSnap = true;
  const validRoom = id => id === 'town' || id === 'cafe' || id === 'mall' || id === 'cinema' || /^home([1-9]|1[0-2])$/.test(id);

  // keep one 3D car for every entry in WORLD_PARKED_CARS (the server replaces that list with the real seats/positions)
  function syncCars() {
    while (parked.length > WORLD_PARKED_CARS.length) { const p = parked.pop(); town.remove(p.m); pickables.splice(pickables.indexOf(p.m), 1); }
    WORLD_PARKED_CARS.forEach((c, i) => {
      let p = parked[i];
      if (p && p.e !== c.e) { town.remove(p.m); pickables.splice(pickables.indexOf(p.m), 1); p = parked[i] = null; }
      if (!p) { const m = makeCar(c.e); m.userData.anchor = { x: c.x, y: c.y }; m.traverse(o => { if (o.isMesh) o.userData.pick = true; }); town.add(m); pickables.push(m); p = parked[i] = { m, e: c.e, hd: -Math.PI / 2 }; }
    });
  }

  function disposeAvatar(A) { scene.remove(A.g); const i = pickables.indexOf(A.g); if (i >= 0) pickables.splice(i, 1); if (A.pet) scene.remove(A.pet.g); }

  /* ---------- per-frame ---------- */
  function updateScene(users, t, now) {
    const dt = Math.min(.1, (now - (lastNow || now)) / 1000); lastNow = now;
    const wantRoom = validRoom(worldRoom) ? worldRoom : 'town';
    if (wantRoom !== curRoom) applyRoom(wantRoom);
    const inTown = curRoom === 'town', me = worldUsers[currentUser.id];

    const ride = {};
    if (inTown) { syncCars(); WORLD_PARKED_CARS.forEach((c, ci) => (c.riders || []).forEach((uid, si) => { if (uid) ride[uid] = { ci, si }; })); }

    // 1) make / rebuild avatars and turn them to face where they walk
    users.forEach(u => {
      const isMe = u.userId === currentUser.id, sig = lookSig(u.appearance, u.userId, isMe);
      let A = avatars[u.userId];
      if (!A || A.sig !== sig) {
        const old = A; if (old) disposeAvatar(old);
        A = avatars[u.userId] = buildAvatar(u.appearance, u.userId, isMe); A.sig = sig; if (old) A.heading = old.heading;
        scene.add(A.g); pickables.push(A.g); A.pet = null;
      }
      A.seen = true;
      if (A.look.pet && !A.pet) { A.pet = makePet(A.look.pet); A.pet.pos = null; A.pet.hd = A.heading; scene.add(A.pet.g); }
      if (!ride[u.userId] || ride[u.userId].si === 0) { const mx = u.x - u.dx, mz = u.y - u.dy; if (Math.hypot(mx, mz) > .4) A.heading += adiff(A.heading, heading(mx, mz)) * .25; }
    });

    // 2) cars follow their driver (or sit where they were parked)
    if (inTown) WORLD_PARKED_CARS.forEach((c, i) => {
      const p = parked[i]; if (!p) return;
      const du = c.riders && c.riders[0] && worldUsers[c.riders[0]], dA = du && avatars[du.userId];
      let cx = c.x, cy = c.y; if (du && dA) { cx = du.dx; cy = du.dy; p.hd = dA.heading; }
      p.m.position.set(cx / S, 0, cy / S); p.m.rotation.y = p.hd; p.m.userData.anchor.x = cx; p.m.userData.anchor.y = cy; c.cx = cx; c.cy = cy;
    });

    // 3) pose everybody
    users.forEach(u => {
      const A = avatars[u.userId], g = A.g, rd = ride[u.userId], dancing = u.emote && u.emote.type === 'dance';
      const ph = (u.phase || 0) * .55, sw = u.moving ? Math.sin(ph) : 0;
      g.userData.anchor.x = u.dx; g.userData.anchor.y = u.dy;
      let sitting = false;
      A.body.scale.setScalar(1); A.body.position.set(0, 0, 0); g.position.y = 0; A.body.rotation.y = 0;
      if (rd) {
        const c = WORLD_PARKED_CARS[rd.ci], p = parked[rd.ci], so = seatOffset(c.e, rd.si), th = p.hd;
        g.position.set(c.cx / S + so.x * Math.cos(th) + so.z * Math.sin(th), .3, c.cy / S - so.x * Math.sin(th) + so.z * Math.cos(th));
        if (rd.si > 0) A.heading = th; g.rotation.y = A.heading;
        A.body.scale.setScalar(.8); A.hips.position.y = .62; sitting = true;
        A.lA.rotation.x = A.rA.rotation.x = rd.si === 0 ? 1.25 : .6; A.lA.rotation.z = A.rA.rotation.z = 0;
        if (A.pet) { A.pet.g.visible = false; A.pet.pos = null; }
      } else {
        g.position.set(u.dx / S, 0, u.dy / S);
        const seat = !u.moving && W3.seatAt(curRoom, u.x, u.y);
        if (seat) { A.heading += adiff(A.heading, seat.h) * .3; sitting = true; A.hips.position.y = A.sitY; A.lA.rotation.x = A.rA.rotation.x = .7; A.lA.rotation.z = A.rA.rotation.z = 0; }
        g.rotation.y = A.heading;
        if (!sitting) {
          A.hips.position.y = .85 + (u.moving ? -Math.abs(Math.sin(ph)) * .06 : 0) + (dancing ? Math.abs(Math.sin(now / 130)) * .2 : 0);
          A.lA.rotation.x = dancing ? 2.6 + Math.sin(now / 110) * .5 : -sw * .7; A.rA.rotation.x = dancing ? 2.6 - Math.sin(now / 110) * .5 : sw * .7;
          A.lA.rotation.z = dancing ? .4 : -.05; A.rA.rotation.z = dancing ? -.4 : .05;
          A.body.rotation.y = dancing ? Math.sin(now / 160) * .6 : 0;
        }
        if (A.pet) A.pet.g.visible = true;
      }
      if (sitting) { A.lL.rotation.x = A.rL.rotation.x = Math.PI / 2; A.lS.rotation.x = A.rS.rotation.x = -Math.PI / 2; }
      else { const swing = sw * .8; A.lL.rotation.x = swing; A.rL.rotation.x = -swing; A.lS.rotation.x = -Math.max(0, -swing) * .9; A.rS.rotation.x = -Math.max(0, swing) * .9; }
      // the pet trots after its owner
      const P = A.pet;
      if (P && !rd) {
        const th = A.heading, tx = g.position.x + Math.sin(th) * 1.1 + Math.cos(th) * .7, tz = g.position.z + Math.cos(th) * 1.1 - Math.sin(th) * .7;
        if (!P.pos) P.pos = new T.Vector3(tx, 0, tz);
        let spd = 0;
        if (Math.hypot(tx - P.pos.x, tz - P.pos.z) > 8) { P.pos.set(tx, 0, tz); }
        else { const k = 1 - Math.exp(-dt * 4), mx = (tx - P.pos.x) * k, mz = (tz - P.pos.z) * k; P.pos.x += mx; P.pos.z += mz; spd = dt > 0 ? Math.hypot(mx, mz) / dt : 0; if (spd > .25) P.hd += adiff(P.hd, heading(mx, mz)) * .2; else P.hd += adiff(P.hd, th) * .05; }
        const run = Math.min(1, spd / 1.5); P.phase += dt * Math.min(spd, 8) * 3;
        P.g.position.set(P.pos.x, 0, P.pos.z); P.g.rotation.y = P.hd; P.inner.position.y = Math.abs(Math.sin(P.phase)) * .03 * run;
        if (P.waddle) { P.inner.rotation.z = Math.sin(P.phase * 1.2) * .16 * run; P.legs.forEach((l, i) => { l.position.z = -.03 + Math.sin(P.phase + i * Math.PI) * .04 * run; }); }
        else P.legs.forEach((l, i) => { l.rotation.x = Math.sin(P.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * .7 * run; });
        if (P.head) P.head.rotation.x = Math.sin(now / 700) * .05;
      }
    });
    Object.keys(avatars).forEach(id => { const A = avatars[id]; if (!A.seen) { disposeAvatar(A); delete avatars[id]; } else A.seen = false; });

    if (inTown) {
      traffic.forEach(({ c, m }) => { const p = worldTrafficPos(c, t); m.position.set(p.x / S, 0, p.y / S); m.rotation.y = { E: -Math.PI / 2, W: Math.PI / 2, S: Math.PI, N: 0 }[c.lane]; });
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
          town.add(g); pickables.push(g); P = portals[p.id] = { g, ring, ring2, glow, p };
        }
        const used = worldUsedPortals.has(p.id);
        P.ring.material.color.setHex(used ? 0x888888 : 0xd27bff); P.ring2.material.color.setHex(used ? 0x666666 : 0x6df2ff); P.glow.material.opacity = used ? .25 : .9;
        P.ring.rotation.z = t * 1.5; P.ring2.rotation.z = -t * 2.2; P.g.scale.setScalar(1 + Math.sin(t * 4) * .04); P.p = p;
      });
      Object.keys(portals).forEach(id => { if (!ids[id]) { town.remove(portals[id].g); pickables.splice(pickables.indexOf(portals[id].g), 1); delete portals[id]; } });
      if (sea) { const a = sea.geometry.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(t * 1.6 + seaBase[i * 3] * 1.1 + seaBase[i * 3 + 1] * .8) * .07); a.needsUpdate = true; }
    } else tickScreen(now);

    // camera follows me
    const fx = me ? me.dx / S : 30, fz = me ? me.dy / S : 19, pitch = .95;
    if (!inTown) yaw = clamp(yaw, -.9, .9);
    const d = inTown ? dist : Math.min(dist, 9.5);
    const want = new T.Vector3(fx + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d + 1, fz + Math.cos(yaw) * Math.cos(pitch) * d);
    if (camSnap) { camPos.copy(want); camLook.set(fx, 1, fz); camSnap = false; } else { camPos.lerp(want, .12); camLook.lerp(new T.Vector3(fx, 1, fz), .2); }
    cam.position.copy(camPos); cam.lookAt(camLook);
    if (inTown) sun.position.set(fx - 18, 34, fz - 10); else sun.position.set(fx + 6, 26, fz + 14);
    sun.target.position.set(fx, 0, fz);
  }

  function overlay(ctx, users, now, t) {
    ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0); ctx.clearRect(0, 0, worldCssW, worldCssH);
    const proj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return v.z > 1 ? null : { x: (v.x * .5 + .5) * worldCssW, y: (-v.y * .5 + .5) * worldCssH }; };
    users.forEach(u => {
      const A = avatars[u.userId], p = proj(u.dx / S, u.carId != null || u.vehicle ? 2.7 : (A && A.g.position.y > 0 ? 2.1 : 2.1), u.dy / S); if (!p) return;
      const isMe = u.userId === currentUser.id, img = u.profilePicture ? getWorldImage(u.profilePicture) : null;
      ctx.save(); ctx.setTransform(worldDpr, 0, 0, worldDpr, 0, 0);
      ctx.beginPath(); ctx.arc(p.x, p.y - 24, 15, 0, Math.PI * 2); ctx.fillStyle = isMe ? '#ff4d8d' : '#4d7cff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (img) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y - 24, 13, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, p.x - 13, p.y - 37, 26, 26); ctx.restore(); }
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#222';
      ctx.strokeText(u.name, p.x, p.y - 2); ctx.fillText(u.name, p.x, p.y - 2); ctx.restore();
      if (u.bubble || u.emote) {
        ctx.save(); ctx.setTransform(worldDpr, 0, 0, worldDpr, (p.x - u.dx) * worldDpr, (p.y - 52 - u.dy) * worldDpr);
        if (u.bubble) drawWorldBubble(ctx, u, now); if (u.emote) drawWorldEmote(ctx, u, now); ctx.restore();
      }
    });
    if (curRoom === 'town') {
      worldActivePortals().forEach(pp => {
        const p = proj(pp.x / S, 3.3, pp.y / S); if (!p) return;
        const s = Math.ceil(Math.max(0, pp.endsAt - Date.now()) / 1000), txt = worldUsedPortals.has(pp.id) ? '🔒 Sealed' : '🌀 Portal ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#fff'; ctx.strokeText(txt, p.x, p.y); ctx.fillText(txt, p.x, p.y);
      });
      drawWorldMinimap(ctx);
    } else {
      ctx.font = 'bold 16px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#fff';
      ctx.strokeText(getRoom(curRoom).label, 12, worldMiniY); ctx.fillText(getRoom(curRoom).label, 12, worldMiniY);
    }
  }

  window.drawWorld = function () {
    if (failed()) return origDraw();
    if (!started) { try { init(); ON = true; } catch (e) { console.warn('3D town unavailable, using the flat town:', e); window.__w3dFail = true; return origDraw(); } started = true; }
    if (!worldCtx || !worldCssW) return;
    const now = performance.now(), t = Date.now() / 1000, users = Object.values(worldUsers), me = worldUsers[currentUser.id];
    // keyboard walking: aim a point ahead of me in the direction of the keys (relative to the camera)
    if (me && !W3.uiOpen && (keys.w || keys.s || keys.a || keys.d)) {
      const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), B = W3.bounds();
      const dx = -Math.sin(yaw) * f + Math.cos(yaw) * r, dz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
      worldTarget = { x: clamp(me.x + dx * 160, WORLD_PAD, B.w - WORLD_PAD), y: clamp(me.y + dz * 160, WORLD_PAD, B.h - WORLD_PAD) }; keyDriven = true;
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
    if (W3.onFrame) W3.onFrame(now);
  };
  const failed = () => !!window.__w3dFail;

  // a tap on the screen becomes a spot on the ground (or the person / car / portal that was tapped)
  const shown = o => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
  window.worldEventPoint = function (e) {
    if (!ON) return origPoint(e);
    const r = c2.getBoundingClientRect();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, cam);
    const hit = ray.intersectObjects(pickables, true).find(h => shown(h.object));
    if (hit) { let o = hit.object; while (o && !(o.userData && o.userData.anchor)) o = o.parent; if (o) return { x: o.userData.anchor.x, y: o.userData.anchor.y }; }
    const p = new T.Vector3();
    if (ray.ray.intersectPlane(plane, p)) return { x: p.x * S, y: p.z * S };
    return origPoint(e);
  };
})();
