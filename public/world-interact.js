/* world-interact.js — walk into buildings, sit on chairs, buy things in shops, get into cars.
   Load order in index.html:  script.js -> look-catalog.js -> world3d.js -> world-look.js -> world-interact.js
   It does NOT touch how characters look. It plugs into the hooks that world3d.js exposes (window.W3D.hooks).

   What it adds
   - every building has a door: stand in front of it and tap "Enter". Inside you walk around a furnished room.
   - chairs, sofas, benches and cinema seats: walk up and tap "Sit down" (tap again, or just walk, to stand up).
     Chairs in the town work too, and other players see you sitting.
   - Shopping Mall (Boutique, Shoes & Hats, Pet Shop): try things on, then buy them with coins. Bought items are saved
     to your character with the same /appearance call the Style editor uses, so friends see them.
   - Cinema: buy a ticket, then sit and watch the show.
   - Cars: drivers are now visible inside the car (see world3d.js). "Get in" appears next to a parked car if your
     script.js has a drive function (driveWorldCar / enterWorldCar).                                                  */
(function () {
  const W = window.W3D;
  if (!W || !W.api || !W.hooks) { console.warn('world-interact.js: load it after the patched world3d.js'); return; }

  /* ---------------- settings you may want to change ---------------- */
  const OX = 600, OZ = 600;                 // rooms are built far away from the town (3D units), so the two never overlap
  const START_COINS = 60, DAILY_BONUS = 20; // local wallet (see "Wallet" below to plug in a real coin system)
  const TICKET_PRICE = 5;
  const PRICE = {                            // what costs coins; everything else is free from the start
    top: { hoodie: 8, dress: 12 }, bottom: { skirt: 8 }, shoes: { boots: 8, sandals: 6 },
    hat: { cap: 5, beanie: 5, sunhat: 8, crown: 25 }, pet: { dog: 15, cat: 15, rabbit: 18, chick: 12 }
  };
  const NAMES = {
    top: { tee: 'T-shirt', hoodie: 'Hoodie', tank: 'Tank top', dress: 'Dress' }, bottom: { jeans: 'Jeans', shorts: 'Shorts', skirt: 'Skirt' },
    shoes: { sneakers: 'Sneakers', boots: 'Boots', sandals: 'Sandals' }, hat: { none: 'No hat', cap: 'Cap', beanie: 'Beanie', crown: 'Crown 👑', sunhat: 'Sun hat' },
    pet: { none: 'No pet', dog: '🐶 Dog', cat: '🐱 Cat', rabbit: '🐰 Rabbit', chick: '🐥 Chick' }
  };
  const SLOT_TITLE = { top: '👕 Tops', bottom: '👖 Bottoms', shoes: '👟 Shoes', hat: '🎩 Hats', pet: '🐾 Pets' };
  const carEnterFn = () => window.driveWorldCar || window.enterWorldCar || null;

  const A = () => W.api(), $ = id => document.getElementById(id);
  const hooks = W.hooks;
  const myId = () => (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
  const meUser = () => (typeof worldUsers !== 'undefined' && myId() != null) ? worldUsers[myId()] : null;
  const fwd = h => ({ x: -Math.sin(h), y: -Math.cos(h) });          // the direction a heading faces, in (x, y) pixels

  /* ---------------- tiny helpers (same style as world3d.js) ---------------- */
  let T, S, GEO, add, box, M, textSprite, scene;
  const cyl = (p, r, h, c, x, y, z, o) => { const m = add(p, GEO.cyl, M(c, o), x, y, z); m.scale.set(r, h, r); return m; };
  const sph = (p, rx, ry, rz, c, x, y, z, o) => { const m = add(p, GEO.sph, M(c, o), x, y, z); m.scale.set(rx, ry, rz); return m; };
  const lighten = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) + k), g = Math.min(255, ((c >> 8) & 255) + k), b = Math.min(255, (c & 255) + k); return (r << 16) | (g << 8) | b; };
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  /* ================= FURNITURE ================= */
  // sol = blocking rectangle [x, y, w, h] around the centre, seats = [x, y, seatHeight] relative to the centre, build = 3D model facing +z
  const FURN = {
    sofa: { sol: [-45, -20, 90, 10], seats: [[-20, 3, .56], [20, 3, .56]], c: 0x6c8ebf, build: (g, c) => { box(g, 2.25, .35, 1, c, 0, .28, 0); box(g, .95, .15, .7, lighten(c, 25), -.5, .5, .1); box(g, .95, .15, .7, lighten(c, 25), .5, .5, .1); box(g, 2.25, .65, .22, c, 0, .7, -.38); box(g, .22, .5, 1, c, -1, .5, 0); box(g, .22, .5, 1, c, 1, .5, 0); } },
    armchair: { sol: [-18, -18, 36, 8], seats: [[0, 2, .56]], c: 0xc97b5a, build: (g, c) => { box(g, .9, .3, .9, c, 0, .28, 0); box(g, .8, .14, .7, lighten(c, 25), 0, .5, .08); box(g, .9, .6, .2, c, 0, .65, -.35); box(g, .18, .45, .9, c, -.4, .5, 0); box(g, .18, .45, .9, c, .4, .5, 0); } },
    bed: { sol: [-40, -50, 80, 100], c: 0x8ec5ff, build: (g, c) => { box(g, 2, .3, 2.5, 0x8a5a33, 0, .25, 0); box(g, 1.9, .25, 2.3, 0xffffff, 0, .5, 0); box(g, 1.9, .28, 1.4, c, 0, .52, .45); box(g, .75, .18, .4, 0xffffff, -.45, .7, -.9); box(g, .75, .18, .4, 0xffffff, .45, .7, -.9); box(g, 2, .9, .1, 0x6f4526, 0, .7, -1.22); } },
    table: { sol: [-35, -22, 70, 44], c: 0x9a6a3a, build: (g, c) => { box(g, 1.75, .08, 1.1, c, 0, .75, 0); [[-.8, -.45], [.8, -.45], [-.8, .45], [.8, .45]].forEach(p => box(g, .08, .72, .08, 0x6f4526, p[0], .36, p[1])); box(g, .4, .08, .4, 0xffffff, 0, .83, 0); box(g, .1, .2, .1, 0xff6f91, 0, .95, 0); } },
    tvunit: { sol: [-35, -8, 70, 16], c: 0x4a3b32, build: (g, c) => { box(g, 1.75, .5, .4, c, 0, .25, 0); box(g, 1.4, .8, .08, 0x111111, 0, .95, 0); box(g, 1.3, .7, .02, 0x2a6fd6, 0, .95, .05, { emissive: 0x2a6fd6, emissiveIntensity: .6 }); } },
    kitchen: { sol: [-60, -15, 120, 30], c: 0xe8e0d0, build: (g, c) => { box(g, 3, .9, .75, c, 0, .45, 0); box(g, 3, .06, .8, 0x555a60, 0, .93, 0); box(g, .75, 1.9, .7, 0xd0d4da, 1.1, .95, 0); [-.6, -.2].forEach(x => cyl(g, .12, .03, 0x222222, x, .97, 0)); box(g, 1.2, .5, .3, 0xd9c7a0, -.9, 1.7, -.2); } },
    shelf: { sol: [-30, -8, 60, 16], c: 0x8a5a33, build: (g, c) => { box(g, 1.5, 1.8, .4, c, 0, .9, 0); [.3, .75, 1.2, 1.65].forEach((y, i) => { box(g, 1.4, .05, .38, 0x6f4526, 0, y, .01); for (let k = 0; k < 6; k++) box(g, .16, .3, .22, [0xe57373, 0x64b5f6, 0x81c784, 0xffd54f, 0xba68c8, 0x4db6ac][(k + i) % 6], -.55 + k * .22, y + .18, 0); }); } },
    plant: { sol: [-10, -10, 20, 20], c: 0x3da35a, build: (g, c) => { cyl(g, .22, .4, 0xc0683a, 0, .2, 0); sph(g, .35, .3, .35, c, 0, .7, 0); sph(g, .25, .25, .25, lighten(c, 20), .15, 1, 0); sph(g, .22, .22, .22, c, -.15, 1.1, .05); } },
    rug: { c: 0xc9a0dc, build: (g, c, o) => { const w = (o.w || 140) / S, d = (o.d || 100) / S; const m = add(g, new T.BoxGeometry(w, .04, d), M(c), 0, .03, 0, false); m.receiveShadow = true; add(g, new T.BoxGeometry(w * .8, .05, d * .8), M(lighten(c, 30)), 0, .035, 0, false); } },
    counter: { sol: [-65, -15, 130, 30], c: 0x8a5a33, build: (g, c) => { box(g, 3.25, 1, .75, c, 0, .5, 0); box(g, 3.4, .08, .9, 0xf5f5f5, 0, 1.04, 0); box(g, .45, .3, .35, 0x333333, .9, 1.23, 0); box(g, .5, .02, .3, 0x6cf2a6, .9, 1.4, -.05, { emissive: 0x6cf2a6, emissiveIntensity: .8 }); } },
    rack: { sol: [-30, -8, 60, 16], c: 0xd0d4da, build: (g, c) => { box(g, .05, 1.6, .05, c, -.7, .8, 0); box(g, .05, 1.6, .05, c, .7, .8, 0); box(g, 1.45, .04, .04, c, 0, 1.55, 0); [0xff6f91, 0x64b5f6, 0xffd54f, 0x81c784, 0xba68c8, 0xffffff, 0xff8a65].forEach((col, i) => box(g, .12, .6, .3, col, -.6 + i * .2, 1.2, 0)); } },
    bench: { seats: [[-18, 0, .46], [18, 0, .46]], c: 0x8a5a33, build: (g, c) => { box(g, 1.75, .1, .5, c, 0, .4, 0); [-.75, .75].forEach(x => box(g, .1, .4, .45, 0x333333, x, .2, 0)); } },
    petpen: { sol: [-45, -22, 90, 44], c: 0xffffff, build: (g, c) => { box(g, 2.25, .45, 1.1, c, 0, .22, 0); [0xffb74d, 0xf5f5f5, 0x8d6e63, 0xffd54f].forEach((col, i) => { const x = -.85 + i * .57; sph(g, .17, .15, .2, col, x, .62, 0); sph(g, .1, .1, .1, col, x, .82, -.08); box(g, .02, .5, .02, 0xcccccc, x - .27, .7, .5); }); box(g, 2.2, .03, .03, 0xcccccc, 0, .95, .5); } },
    fountain: { sol: [-35, -35, 70, 70], c: 0xb8bcc6, build: (g, c) => { cyl(g, .95, .45, c, 0, .22, 0); cyl(g, .82, .46, 0x4fc3f7, 0, .24, 0, { transparent: true, opacity: .85, roughness: .2 }); cyl(g, .13, 1, c, 0, .75, 0); sph(g, .26, .12, .26, 0x4fc3f7, 0, 1.3, 0, { transparent: true, opacity: .8 }); } },
    popcorn: { sol: [-25, -15, 50, 30], c: 0xd32f2f, build: (g, c) => { box(g, 1.25, .9, .75, c, 0, .45, 0); box(g, 1.2, .55, .7, 0xffffff, 0, 1.15, 0, { transparent: true, opacity: .35 }); for (let i = 0; i < 14; i++) sph(g, .09, .09, .09, 0xfff2b0, -.45 + (i % 5) * .22, 1.05 + Math.floor(i / 5) * .14, -.15 + (i % 3) * .15); box(g, 1.4, .1, .9, 0xffffff, 0, 1.55, 0); } },
    rtable: { sol: [-18, -18, 36, 36], c: 0x9a6a3a, build: (g, c) => { cyl(g, .55, .06, c, 0, .75, 0); cyl(g, .07, .72, 0x6f4526, 0, .36, 0); cyl(g, .28, .05, 0x6f4526, 0, .03, 0); cyl(g, .12, .22, 0xffffff, .1, .88, 0); } },
    chair: { seats: [[0, 0, .47]], c: 0xc9854a, build: (g, c) => { box(g, .5, .08, .5, c, 0, .42, 0); box(g, .5, .5, .06, c, 0, .7, -.22); [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(p => box(g, .05, .4, .05, 0x6f4526, p[0], .2, p[1])); } },
    cseat: { seats: [[0, 0, .56]], c: 0xa11629, build: (g, c) => { box(g, .7, .12, .7, 0x6a0f1c, 0, .35, 0); box(g, .62, .12, .6, c, 0, .46, .02); box(g, .7, .5, .14, 0x85111f, 0, .65, -.32); box(g, .08, .4, .6, 0x7a1020, -.36, .55, 0); box(g, .08, .4, .6, 0x7a1020, .36, .55, 0); } },
    lamp: { sol: [-6, -6, 12, 12], c: 0xfff1b8, build: (g, c) => { cyl(g, .05, 1.5, 0x555555, 0, .75, 0); add(g, GEO.cone, M(c, { emissive: c, emissiveIntensity: .7 }), 0, 1.6, 0).scale.set(.3, .35, .3); } }
  };
  const rotRect = (r, rot) => rot ? [-(r[0] + r[2]), -(r[1] + r[3]), r[2], r[3]] : r;

  /* ================= THE ROOMS ================= */
  const HOME_WALLS = [0xf3e5d0, 0xe6eef7, 0xf5e1e8, 0xe3f1e0, 0xf7ecd2, 0xe9e1f3];
  function specFor(id, label) {
    if (id === 'cafe') return { label: '☕ ' + (label || 'Café'), w: 520, h: 380, wallH: 3.4, floor: 'wood', wall: 0xf1dcc0, items: [
      { t: 'counter', x: 260, y: 50, c: 0x8a5a33 }, { t: 'shelf', x: 400, y: 20 }, { t: 'shelf', x: 120, y: 20 },
      ...[[100, 160], [260, 190], [420, 160], [100, 280], [420, 280]].flatMap(([x, y]) => [{ t: 'rtable', x, y }, { t: 'chair', x, y: y - 34 }, { t: 'chair', x, y: y + 34, rot: Math.PI }]),
      { t: 'plant', x: 30, y: 340 }, { t: 'plant', x: 490, y: 340 }, { t: 'lamp', x: 30, y: 60 }, { t: 'lamp', x: 490, y: 60 }], windows: [90, 430] };
    if (id === 'mall') return { label: '🛍️ ' + (label || 'Shopping Mall'), w: 900, h: 600, wallH: 5, floor: 'tile', wall: 0xf4eee6, items: [
      { t: 'counter', x: 170, y: 130, c: 0xd96a8a }, { t: 'rack', x: 120, y: 48 }, { t: 'rack', x: 220, y: 48 },
      { t: 'counter', x: 450, y: 130, c: 0x4a78c2 }, { t: 'shelf', x: 400, y: 24 }, { t: 'shelf', x: 500, y: 24 },
      { t: 'counter', x: 730, y: 130, c: 0x4caf7a }, { t: 'petpen', x: 730, y: 64 },
      { t: 'fountain', x: 450, y: 330 }, { t: 'bench', x: 450, y: 272 }, { t: 'bench', x: 450, y: 388, rot: Math.PI },
      { t: 'plant', x: 40, y: 300 }, { t: 'plant', x: 860, y: 300 }, { t: 'plant', x: 40, y: 560 }, { t: 'plant', x: 860, y: 560 },
      { t: 'lamp', x: 300, y: 260 }, { t: 'lamp', x: 600, y: 260 }, { t: 'bench', x: 150, y: 440 }, { t: 'bench', x: 750, y: 440 }],
      signs: [[170, '👗 Boutique'], [450, '👟 Shoes & Hats'], [730, '🐾 Pet Shop']],
      zones: [{ kind: 'shop', x: 170, y: 176, r: 70, label: '👗 Boutique', tabs: ['top', 'bottom'] },
              { kind: 'shop', x: 450, y: 176, r: 70, label: '👟 Shoes & Hats', tabs: ['shoes', 'hat'] },
              { kind: 'shop', x: 730, y: 176, r: 70, label: '🐾 Pet Shop', tabs: ['pet'] }] };
    if (id === 'cinema') {
      const items = [{ t: 'counter', x: 170, y: 430, c: 0x7a1020 }, { t: 'popcorn', x: 630, y: 430 }, { t: 'plant', x: 40, y: 520 }, { t: 'plant', x: 760, y: 520 }, { t: 'lamp', x: 60, y: 380 }, { t: 'lamp', x: 740, y: 380 }];
      [200, 240, 280].forEach(y => { for (let i = 0; i < 10; i++) items.push({ t: 'cseat', x: 400 + (i - 4.5) * 40, y, rot: Math.PI }); });
      return { label: '🎬 ' + (label || 'Cinema'), w: 800, h: 560, wallH: 6.5, floor: 'carpet', wall: 0x2a2433, items, screen: true, signs: [[170, '🎟️ Tickets']], seatsNeedTicket: true,
        zones: [{ kind: 'ticket', x: 170, y: 466, r: 80, label: '🎟️ Cinema ticket' }] };
    }
    const n = +String(id).replace('home', '') || 1;   // every other building is a home
    return { label: '🏠 ' + (label || 'Home ' + n), w: 560, h: 420, wallH: 3.4, floor: 'wood', wall: HOME_WALLS[n % HOME_WALLS.length], items: [
      { t: 'rug', x: 280, y: 250, c: [0xc9a0dc, 0x9ad0c2, 0xf2b880][n % 3] }, { t: 'tvunit', x: 280, y: 28 }, { t: 'sofa', x: 280, y: 215, rot: Math.PI, c: [0x6c8ebf, 0xd98a9e, 0x7fbf8e][n % 3] },
      { t: 'bed', x: 70, y: 82, c: [0x8ec5ff, 0xffb3c7, 0xb8e0a8][n % 3] }, { t: 'kitchen', x: 430, y: 22 }, { t: 'shelf', x: 190, y: 20 },
      { t: 'table', x: 440, y: 150 }, { t: 'chair', x: 425, y: 118 }, { t: 'chair', x: 455, y: 118 }, { t: 'chair', x: 425, y: 182, rot: Math.PI }, { t: 'chair', x: 455, y: 182, rot: Math.PI },
      { t: 'armchair', x: 90, y: 300 }, { t: 'plant', x: 30, y: 390 }, { t: 'plant', x: 530, y: 390 }, { t: 'lamp', x: 150, y: 215 }], windows: [140, 420] };
  }

  const roomData = {}, roomMesh = {};
  function getRoom(id, label) {
    if (roomData[id]) return roomData[id];
    const sp = specFor(id, label), solids = [], seats = [], zones = (sp.zones || []).slice();
    sp.items.forEach(it => {
      const f = FURN[it.t], rot = it.rot || 0;
      if (f.sol) { const r = rotRect(f.sol, rot); solids.push({ x: it.x + r[0], y: it.y + r[1], w: r[2], h: r[3] }); }
      (f.seats || []).forEach(s => seats.push({ x: it.x + (rot ? -s[0] : s[0]), y: it.y + (rot ? -s[1] : s[1]), h: rot ? 0 : Math.PI, sy: s[2] }));
    });
    zones.push({ kind: 'exit', x: sp.w / 2, y: sp.h - 24, r: 55, label: '🚪 Exit' });
    return (roomData[id] = { id, label: sp.label, w: sp.w, h: sp.h, solids, seats, zones, spec: sp });
  }
  const roomBlocked = (r, x, y) => {
    if (x < 34 || x > r.w - 34 || y < 44 || y > r.h - 12) return true;
    for (const s of r.solids) if (x > s.x - 12 && x < s.x + s.w + 12 && y > s.y - 8 && y < s.y + s.h + 14) return true;
    return false;
  };

  const texCache = {};
  function floorTex(kind, w, h) {
    const k = kind + w + h; if (texCache[k]) return texCache[k];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    if (kind === 'tile') { g.fillStyle = '#e9dfd1'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#cfc0ab'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }
    else if (kind === 'carpet') { g.fillStyle = '#4a1220'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#521525'; for (let i = 0; i < 128; i += 32) g.fillRect(0, i, 128, 16); }
    else { g.fillStyle = '#c99a62'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a97c48'; g.lineWidth = 2; for (let i = 0; i < 128; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / S / 3.2, h / S / 3.2); t.encoding = T.sRGBEncoding;
    return (texCache[k] = t);
  }

  // the cinema screen: a little animated show that everyone in the cinema sees at the same moment
  let screenTex = null, lastScreen = 0;
  function drawFilm(g, Wd, Ht, t) {
    const slot = 60, show = Math.floor(t / slot) % 3, tt = t % slot, names = ['Starlight Voyage', 'Ocean Dreams', 'Heart Rain'];
    if (tt < 5) { g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Ht); g.fillStyle = '#ffd54f'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('NOW SHOWING', Wd / 2, Ht / 2 - 20); g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.fillText(names[show], Wd / 2, Ht / 2 + 28); return; }
    const cols = [['#05051a', '#2a1a5a'], ['#ffb26b', '#ff6f91'], ['#ff9ac1', '#8e6bd8']][show];
    const bg = g.createLinearGradient(0, 0, 0, Ht); bg.addColorStop(0, cols[0]); bg.addColorStop(1, cols[1]); g.fillStyle = bg; g.fillRect(0, 0, Wd, Ht);
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 60; i++) { const sp = 20 + (i % 5) * 14, x = ((i * 97 - tt * sp) % Wd + Wd) % Wd, y = (i * 53 + show * 17) % Ht; g.fillRect(x, y, 1 + (i % 3), 1 + (i % 2)); }
    g.fillStyle = show === 1 ? '#fff3b0' : '#ff7a9c'; g.beginPath(); g.arc(Wd * (.2 + .6 * ((tt / slot) % 1)), Ht * (.35 + Math.sin(tt) * .08), 34, 0, 7); g.fill();
  }
  function makeScreen() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    screenTex = { c, g: c.getContext('2d'), tex: new T.CanvasTexture(c) }; screenTex.tex.encoding = T.sRGBEncoding; return screenTex;
  }

  function buildRoomMeshes(id) {
    const rd = getRoom(id), sp = rd.spec, g = new T.Group(), Wd = rd.w / S, Hd = rd.h / S, wh = sp.wallH;
    g.position.set(OX, 0, OZ);
    const ground = new T.Mesh(new T.PlaneGeometry(Wd + 40, Hd + 40), M(0x6f8f6a)); ground.rotation.x = -Math.PI / 2; ground.position.set(Wd / 2, -.02, Hd / 2); ground.receiveShadow = true; g.add(ground);
    const fl = new T.Mesh(new T.PlaneGeometry(Wd, Hd), new T.MeshStandardMaterial({ map: floorTex(sp.floor, rd.w, rd.h), roughness: .9 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(Wd / 2, .01, Hd / 2); fl.receiveShadow = true; g.add(fl);
    box(g, Wd + .6, wh, .3, sp.wall, Wd / 2, wh / 2, -.15); box(g, .3, wh, Hd, sp.wall, -.15, wh / 2, Hd / 2); box(g, .3, wh, Hd, sp.wall, Wd + .15, wh / 2, Hd / 2);
    box(g, Wd, .22, .1, 0xffffff, Wd / 2, .11, .02); box(g, Wd, .12, .12, lighten(sp.wall, -30), Wd / 2, wh - .06, .02);
    (sp.windows || []).forEach(x => { box(g, 2.6, 1.5, .08, 0xcfe8ff, x / S, 2, .03, { emissive: 0x9ad0ff, emissiveIntensity: .5 }); box(g, 2.8, .1, .1, 0xffffff, x / S, 2.8, .05); box(g, 2.8, .1, .1, 0xffffff, x / S, 1.2, .05); box(g, .08, 1.6, .1, 0xffffff, x / S, 2, .05); });
    const dx = Wd / 2;   // front door frame + mat
    box(g, .15, 2.1, .15, 0x6b3f20, dx - 1.1, 1.05, Hd); box(g, .15, 2.1, .15, 0x6b3f20, dx + 1.1, 1.05, Hd); box(g, 2.35, .15, .15, 0x6b3f20, dx, 2.1, Hd);
    box(g, 1.9, .03, .8, 0x2e9e6a, dx, .04, Hd - .5, { emissive: 0x2e9e6a, emissiveIntensity: .35 }); const ex = textSprite('EXIT', .5); ex.position.set(dx, 2.6, Hd); g.add(ex);
    sp.items.forEach(it => { const f = FURN[it.t], m = new T.Group(); f.build(m, it.c !== undefined ? it.c : f.c, it); m.position.set(it.x / S, 0, it.y / S); m.rotation.y = it.rot || 0; g.add(m); });
    (sp.signs || []).forEach(([x, txt]) => { const l = textSprite(txt, .7); l.position.set(x / S, wh - 1.7, .4); g.add(l); });
    (rd.zones || []).filter(z => z.kind === 'shop').forEach(z => box(g, 1.9, .03, .8, 0xff4d8d, z.x / S, .04, z.y / S, { emissive: 0xff4d8d, emissiveIntensity: .3 }));   // pink "browse here" mats
    if (sp.screen) {
      const sc = screenTex || makeScreen();
      const m = new T.Mesh(new T.PlaneGeometry(11, 5.5), new T.MeshBasicMaterial({ map: sc.tex })); m.position.set(Wd / 2, 3.7, .02); g.add(m);
      box(g, 11.4, 5.9, .1, 0x111111, Wd / 2, 3.7, -.03);
    }
    const pl = new T.PointLight(0xfff0d0, .25, 30); pl.position.set(Wd / 2, wh - .4, Hd / 2); g.add(pl);
    g.visible = false; scene.add(g); return g;
  }

  /* ================= STATE ================= */
  let cur = null;          // null = in town. Otherwise { id, rd, pos:{x,y}, heading, moving, phase, seat, target, sitOnArrive, last }
  let snap = 0;            // frames during which the camera jumps (instead of flying) after entering / leaving
  let doors = [], townSeats = [], inited = false;

  function initWorld() {   // runs once, on the first frame after the 3D world exists
    const a = A(); T = a.T; S = a.S; GEO = a.GEO; add = a.add; box = a.box; M = a.M; textSprite = a.textSprite; scene = a.scene;
    doors = (typeof WORLD_BUILDINGS !== 'undefined' ? WORLD_BUILDINGS : []).map((b, i) => {
      const lbl = String(b.label || ''); let room;
      if (/caf[eé]|coffee/i.test(lbl)) room = 'cafe'; else if (/mall|shop|store|market/i.test(lbl)) room = 'mall'; else if (/cinema|movie|theat/i.test(lbl)) room = 'cinema';
      else { const m = lbl.match(/(\d+)/); room = 'home' + (m ? m[1] : 50 + i); }   // unlabeled buildings get their own home too
      return { room, label: lbl || ('Home ' + (i + 1)), sign: b.sign || '🏠', x: b.x + b.w / 2, y: b.y + b.h + 22, r: 75 };
    });
    townSeats = (typeof WORLD_DECOR !== 'undefined' ? WORLD_DECOR : []).filter(d => d.e === '🪑').map(d => ({ x: d.x, y: d.y, h: 0, sy: .47 }));
    inited = true;
  }

  const nearestSeat = (seats, x, y, r) => { let best = null, bd = r; seats.forEach(s => { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }); return best; };
  const roomSeats = () => cur ? cur.rd.seats : [];
  const mySeatedInTown = () => { const u = meUser(); return u && !cur && !u.vehicle && !u.moving ? nearestSeat(townSeats, u.x, u.y, 16) : null; };

  /* ---------------- hooks used by world3d.js ---------------- */
  hooks.place = function (u) {
    if (!inited) return null;
    const mine = u.userId === myId();
    if (cur) {
      if (!mine) return null;
      const p = cur.pos;
      return { x: OX + (cur.seat ? cur.seat.x : p.x) / S, z: OZ + (cur.seat ? cur.seat.y : p.y) / S, heading: cur.seat ? cur.seat.h : cur.heading, moving: !cur.seat && cur.moving, phase: cur.phase, sit: cur.seat ? { y: cur.seat.sy } : null };
    }
    if (u.vehicle || u.moving || !townSeats.length) return null;
    const s = nearestSeat(townSeats, u.x, u.y, 16);     // everyone can work out who is sitting: standing still on a chair = sitting
    return s ? { x: s.x / S, z: s.y / S, heading: s.h, moving: false, phase: 0, sit: { y: s.sy } } : null;
  };
  hooks.camTarget = function () {
    if (cur) { const p = cur.seat || cur.pos, k = snap > 0; if (k) snap--; return { x: OX + p.x / S, z: OZ + p.y / S, maxYaw: 1, snap: k }; }
    if (snap > 0) { snap--; const u = meUser(); if (u) return { x: u.dx / S, z: u.dy / S, snap: true }; }
    return null;
  };

  /* ---------------- walking inside a room (replaces script.js movement only while inside) ---------------- */
  function roomTick(now) {
    const r = cur.rd, dt = Math.min(50, now - (cur.last || now)); cur.last = now;
    try { worldTarget = null; } catch (e) { /* script.js target is not used inside rooms */ }
    const k = W.keys(); let dx = 0, dy = 0, keyed = false;
    if (k.w || k.s || k.a || k.d) {
      const yaw = W.yaw(), f = (k.w ? 1 : 0) - (k.s ? 1 : 0), rt = (k.d ? 1 : 0) - (k.a ? 1 : 0);
      dx = -Math.sin(yaw) * f + Math.cos(yaw) * rt; dy = -Math.cos(yaw) * f - Math.sin(yaw) * rt; keyed = true;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len; cur.target = null; cur.sitOnArrive = null;
    }
    if (cur.seat) { if (keyed || cur.target) standUp(); else { cur.moving = false; return; } }
    if (!keyed && cur.target) {
      const tx = cur.target.x - cur.pos.x, ty = cur.target.y - cur.pos.y, d = Math.hypot(tx, ty);
      if (cur.sitOnArrive && d < 40) { sitOn(cur.sitOnArrive); return; }
      if (d < 4) { cur.target = null; } else { dx = tx / d; dy = ty / d; }
    }
    if (!dx && !dy) { cur.moving = false; return; }
    const step = dt * .18, nx = cur.pos.x + dx * step, ny = cur.pos.y + dy * step;
    let moved = false;
    if (!roomBlocked(r, nx, cur.pos.y)) { cur.pos.x = nx; moved = true; }
    if (!roomBlocked(r, cur.pos.x, ny)) { cur.pos.y = ny; moved = true; }
    cur.moving = moved; if (!moved) cur.target = null;
    if (moved) { cur.phase += .4; cur.heading = Math.atan2(-dx, -dy); }
  }
  function sitOn(seat) {
    if (!seat) return;
    if (cur.rd.spec.seatsNeedTicket && !hasTicket()) { toast('🎟️ Buy a ticket at the counter first'); cur.sitOnArrive = null; cur.target = null; return; }
    cur.seat = seat; cur.target = null; cur.sitOnArrive = null; cur.moving = false;
  }
  function standUp() {
    if (!cur || !cur.seat) return;
    const s = cur.seat, f = fwd(s.h), c = [[f.x, f.y], [f.y, -f.x], [-f.y, f.x], [-f.x, -f.y]];
    let pos = { x: s.x, y: s.y };
    for (const [ax, ay] of c) { const nx = s.x + ax * 38, ny = s.y + ay * 38; if (!roomBlocked(cur.rd, nx, ny)) { pos = { x: nx, y: ny }; break; } }
    cur.pos = pos; cur.heading = s.h; cur.seat = null;
  }
  const origMove = window.updateWorldMovement;
  window.updateWorldMovement = function (now) {
    if (cur) { roomTick(now); return; }
    const f = origMove || window.__origUpdateWorldMovement; if (f) return f.apply(this, arguments);
  };
  window.__origUpdateWorldMovement = origMove;

  // taps inside a room are handled here (script.js knows nothing about rooms)
  const swallow = ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'touchmove', 'dblclick'];
  swallow.forEach(type => window.addEventListener(type, e => {
    if (!cur || !W.canvas || e.target !== W.canvas()) return;
    e.stopImmediatePropagation();
    if (type !== 'pointerdown' || (e.pointerType === 'mouse' && e.button > 0)) return;
    const a = A(), c2 = W.canvas(), r = c2.getBoundingClientRect(), ray = new a.T.Raycaster(), p = new a.T.Vector3();
    ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, a.cam);
    if (!ray.ray.intersectPlane(new a.T.Plane(new a.T.Vector3(0, 1, 0), 0), p)) return;
    const x = (p.x - OX) * S, y = (p.z - OZ) * S, seat = nearestSeat(roomSeats(), x, y, 34);
    if (cur.seat) standUp();
    cur.target = seat ? { x: seat.x, y: seat.y } : { x: Math.max(40, Math.min(cur.rd.w - 40, x)), y: Math.max(50, Math.min(cur.rd.h - 20, y)) };
    cur.sitOnArrive = seat || null;
  }, true));

  /* ================= ENTER / EXIT ================= */
  let fadeEl = null;
  function fade(mid) {
    const stage = $('world-stage'); if (!stage) { mid(); return; }
    if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .22s;z-index:8'; stage.appendChild(fadeEl); }
    fadeEl.style.pointerEvents = 'auto'; fadeEl.style.opacity = '1';
    setTimeout(() => { try { mid(); } catch (e) { console.warn('room switch failed:', e); } fadeEl.style.opacity = '0'; setTimeout(() => { fadeEl.style.pointerEvents = 'none'; }, 240); }, 240);
  }
  function enterRoom(door) {
    fade(() => {
      closeShop();
      const rd = getRoom(door.room, door.label);
      if (!roomMesh[door.room]) roomMesh[door.room] = buildRoomMeshes(door.room);
      Object.keys(roomMesh).forEach(k => { roomMesh[k].visible = k === door.room; });
      cur = { id: door.room, rd, pos: { x: rd.w / 2, y: rd.h - 60 }, heading: 0, moving: false, phase: 0, seat: null, target: null, sitOnArrive: null, last: 0, oldDist: W.getDist() };
      W.setDist(11); snap = 3; try { worldTarget = null; } catch (e) { /* ignore */ }
    });
  }
  function exitRoom() {
    if (!cur) return;
    fade(() => {
      closeShop(); const d = cur.oldDist;
      Object.keys(roomMesh).forEach(k => { roomMesh[k].visible = false; });
      cur = null; W.setDist(d || 15); snap = 3; try { worldTarget = null; } catch (e) { /* ignore */ }
    });
  }

  /* ================= WALLET + SHOP ================= */
  const Wallet = {
    s: null, key: '',
    load() {
      if (this.s || myId() == null) return !!this.s;
      this.key = 'w3shop:' + myId(); let s = {};
      try { s = JSON.parse(localStorage.getItem(this.key) || '{}') || {}; } catch (e) { s = {}; }
      if (typeof s.coins !== 'number') s.coins = START_COINS;
      const day = new Date().toISOString().slice(0, 10); if (s.day !== day) { if (s.day) s.coins += DAILY_BONUS; s.day = day; }
      s.own = s.own || {}; this.s = s; this.save(); return true;
    },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.s)); } catch (e) { /* storage may be blocked */ } },
    // To use your own coin system, define window.W3_COINS = { get: () => number, spend: n => boolean } before this file loads.
    get coins() { return window.W3_COINS ? window.W3_COINS.get() : (this.s ? this.s.coins : 0); },
    spend(n) { if (this.coins < n) return false; if (window.W3_COINS) return !!window.W3_COINS.spend(n); this.s.coins -= n; this.save(); return true; },
    add(n) { if (this.s) { this.s.coins += n; this.save(); } }
  };
  const priceOf = (slot, opt) => (PRICE[slot] && PRICE[slot][opt]) || 0;
  const owned = (slot, opt) => !priceOf(slot, opt) || !Wallet.load() || !!Wallet.s.own[slot + ':' + opt];
  const hasTicket = () => !!(Wallet.load() && Wallet.s.ticket === new Date().toISOString().slice(0, 10));
  window.W3Shop = { owned, price: priceOf, get coins() { return Wallet.coins; }, addCoins: n => Wallet.add(n) };   // world-look.js uses this to lock items you have not bought

  function grandfather() {   // things you already wear stay yours
    const u = meUser(), LK = window.LOOK; if (!Wallet.load() || Wallet.s.gf || !u || !u.look || !LK) return;
    const l = LK.cleanLook(u.look); Object.keys(PRICE).forEach(slot => { if (priceOf(slot, l[slot])) Wallet.s.own[slot + ':' + l[slot]] = 1; });
    Wallet.s.gf = 1; Wallet.save();
  }

  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    const stage = $('world-stage'); if (!stage) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.style.cssText = 'position:absolute;top:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.78);color:#fff;padding:9px 16px;border-radius:14px;font:600 14px Arial;z-index:9;pointer-events:none;max-width:90vw;text-align:center'; stage.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 2600);
  }

  let shopEl = null, shopBase = null;
  function closeShop() {
    if (shopEl) { shopEl.remove(); shopEl = null; }
    if (shopBase) { window.__lookPreview = null; shopBase = null; }
  }
  const baseLook = () => { const u = meUser(), LK = window.LOOK; return LK ? LK.cleanLook((u && u.look) || LK.defaultFor(myId(), true)) : null; };
  async function saveLook(look) {
    const res = await fetch(API_URL + '/appearance', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ look }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Could not save');
    const u = meUser(); if (u) u.look = data.look || look;
    try { if (typeof worldSocket !== 'undefined' && worldSocket && worldSocket.connected) worldSocket.emit('world:look'); } catch (e) { /* friends will see it on their next refresh */ }
  }
  function openShop(zone) {
    const LK = window.LOOK, stage = $('world-stage'); if (!LK || !stage || !Wallet.load()) return;
    closeShop(); grandfather(); shopBase = baseLook();
    const d = document.createElement('div'); shopEl = d;
    d.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);width:min(94vw,460px);max-height:68vh;overflow-y:auto;background:#fff;color:#222;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:7;text-align:left;font-family:Arial,sans-serif';
    stage.appendChild(d);
    const draw = () => {
      d.textContent = '';
      const head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#ff4d8d;color:#fff;font-weight:700;border-radius:16px 16px 0 0;position:sticky;top:0';
      head.textContent = zone.label + '  ·  🪙 ' + Wallet.coins;
      const x = document.createElement('button'); x.textContent = '✕'; x.style.cssText = 'width:auto;margin:0;padding:2px 10px;background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer'; x.onclick = closeShop; head.appendChild(x); d.appendChild(head);
      const body = document.createElement('div'); body.style.padding = '10px 16px 14px'; d.appendChild(body);
      zone.tabs.forEach(slot => {
        const t = document.createElement('div'); t.textContent = SLOT_TITLE[slot] || slot; t.style.cssText = 'font-weight:700;margin:12px 0 6px'; body.appendChild(t);
        const worn = (window.__lookPreview || shopBase)[slot];
        LK.OPTIONS[slot].forEach(opt => {
          const price = priceOf(slot, opt), have = owned(slot, opt), row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f0f0f0';
          const nm = document.createElement('div'); nm.style.cssText = 'flex:1;font-size:14px'; nm.textContent = (NAMES[slot] && NAMES[slot][opt]) || opt; row.appendChild(nm);
          const tag = document.createElement('div'); tag.style.cssText = 'font-size:13px;color:#777;min-width:54px;text-align:right'; tag.textContent = have ? (price ? '✓ owned' : 'free') : '🪙 ' + price; row.appendChild(tag);
          const btn = (txt, bg, fn) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'width:auto;margin:0;padding:6px 10px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;background:' + bg; b.onclick = fn; row.appendChild(b); };
          const tryOn = () => { window.__lookPreview = LK.cleanLook(Object.assign({}, shopBase, { [slot]: opt })); draw(); };
          if (worn === opt && !have) btn('Trying…', '#999', () => {});
          else btn('Try', '#4d7cff', tryOn);
          if (have) btn(worn === opt && window.__lookPreview ? 'Wear ✔' : 'Wear', '#25d366', async () => {
            const look = LK.cleanLook(Object.assign({}, shopBase, { [slot]: opt }));
            try { await saveLook(look); shopBase = look; window.__lookPreview = null; toast('✅ Saved'); } catch (e) { toast('❌ ' + e.message); } draw();
          });
          else btn('Buy', '#ff4d8d', async () => {
            if (!Wallet.spend(price)) { toast('Not enough coins 🪙'); return; }
            const look = LK.cleanLook(Object.assign({}, shopBase, { [slot]: opt }));
            try { await saveLook(look); Wallet.s.own[slot + ':' + opt] = 1; Wallet.save(); shopBase = look; window.__lookPreview = null; toast('🎉 You bought it!'); }
            catch (e) { Wallet.add(price); toast('❌ ' + e.message + ' (coins returned)'); }
            draw();
          });
          body.appendChild(row);
        });
      });
      const note = document.createElement('div'); note.style.cssText = 'margin-top:12px;color:#888;font-size:12px'; note.textContent = 'Tap Try to see it on your character first. Colours stay free in 👗 Style.'; body.appendChild(note);
    };
    draw();
  }
  function buyTicket() {
    if (!Wallet.load()) return;
    if (hasTicket()) { toast('🎟️ You already have a ticket today'); return; }
    if (!Wallet.spend(TICKET_PRICE)) { toast('Not enough coins 🪙'); return; }
    Wallet.s.ticket = new Date().toISOString().slice(0, 10); Wallet.save(); toast('🎟️ Ticket bought! Pick a seat');
  }

  /* ================= PROMPTS (the button that appears near doors, seats, shops, cars) ================= */
  let promptEl = null, promptKey = '';
  function setPrompt(key, text, fn) {
    const stage = $('world-stage'); if (!stage) return;
    if (!promptEl) {
      promptEl = document.createElement('button');
      promptEl.style.cssText = 'position:absolute;bottom:150px;left:50%;transform:translateX(-50%);z-index:6;width:auto;max-width:90vw;margin:0;padding:11px 18px;border:none;border-radius:18px;background:linear-gradient(135deg,#ff4d8d,#ff7bac);color:#fff;font:700 15px Arial;box-shadow:0 4px 16px rgba(0,0,0,.4);white-space:nowrap;cursor:pointer;display:none';
      stage.appendChild(promptEl);
    }
    if (key === null) { promptEl.style.display = 'none'; promptKey = ''; return; }
    if (key !== promptKey) { promptKey = key; promptEl.textContent = text; }
    promptEl.onclick = e => { e.stopPropagation(); fn(); };
    promptEl.style.display = 'block';
  }

  function updatePrompts() {
    const u = meUser(); if (!u || shopEl) { setPrompt(null); return; }
    if (cur) {
      if (cur.seat) return setPrompt('stand', '🧍 Stand up', standUp);
      const p = cur.pos, rd = cur.rd;
      const z = rd.zones.find(z => Math.hypot(z.x - p.x, z.y - p.y) < z.r);
      if (z) {
        if (z.kind === 'exit') return setPrompt('exit', '🚪 Exit ' + rd.label, exitRoom);
        if (z.kind === 'shop') return setPrompt('shop' + z.label, z.label + ' — Browse', () => openShop(z));
        if (z.kind === 'ticket') return setPrompt('ticket' + hasTicket(), hasTicket() ? '🎟️ You have a ticket' : '🎟️ Buy a ticket · 🪙' + TICKET_PRICE, buyTicket);
      }
      const s = nearestSeat(rd.seats, p.x, p.y, 46);
      if (s) return setPrompt('sit', '🪑 Sit down', () => sitOn(s));
      return setPrompt(null);
    }
    if (u.vehicle) return setPrompt(null);
    const seated = mySeatedInTown();
    if (seated) { const f = fwd(seated.h); return setPrompt('stand', '🧍 Stand up', () => { worldTarget = { x: seated.x + f.x * 50, y: seated.y + f.y * 50 }; }); }
    const door = doors.find(d => Math.hypot(d.x - u.x, d.y - u.y) < d.r);
    if (door) return setPrompt('door' + door.room + door.label, door.sign + ' Enter ' + door.label, () => enterRoom(door));
    const carFn = carEnterFn();
    if (carFn && typeof WORLD_PARKED_CARS !== 'undefined') {
      let bi = -1, bd = 70; WORLD_PARKED_CARS.forEach((c, i) => { const d = Math.hypot((c.cx || c.x) - u.x, (c.cy || c.y) - u.y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) return setPrompt('car' + bi, '🚗 Get in the ' + (WORLD_PARKED_CARS[bi].e || 'car'), () => { carFn(bi); setPrompt(null); });
    }
    const s = nearestSeat(townSeats, u.x, u.y, 60);
    if (s) return setPrompt('tsit', '🪑 Sit down', () => { worldTarget = { x: s.x, y: s.y }; });
    setPrompt(null);
  }

  hooks.frame = function (now) {
    if (!inited) { if (!A().ready) return; initWorld(); }
    grandfather();
    if (cur && cur.rd.spec.screen && screenTex && now - lastScreen > 80) { lastScreen = now; drawFilm(screenTex.g, 512, 256, Date.now() / 1000); screenTex.tex.needsUpdate = true; }
    updatePrompts();
  };

  // leaving the world while inside a room puts you back in the town
  setInterval(() => { const ws = $('world-screen'); if (cur && (!ws || ws.style.display === 'none')) { cur = null; closeShop(); W.setDist(15); snap = 3; } }, 700);

  window.W3Rooms = { enter: enterRoom, exit: exitRoom, doors: () => doors, current: () => cur && cur.id };
})();
