/* world-glue.js — makes script.js + the server understand the 3D features world3d.js draws:
   enterable rooms (homes/café/mall/cinema), car driver + passengers, catalog & appearance.
   Load order in index.html: script.js  ->  world3d.js  ->  world-ui.js  ->  world-glue.js  (last!) */
var worldRoom = 'town';   // world3d.js reads this global every frame

(function () {
  const socket = window.socket;   // the socket.io connection script.js already made
  const me = () => worldUsers[currentUser.id];

  /* ---------- catalog: every wearable / pet the shop sells ---------- */
  const C = (id, slot, style, color, name, price) => ({ id, slot, style, color, name, price });
  const CATALOG = {
    skins: [0xf1c9a5, 0xd9a577, 0xa8714a, 0x7a4a2c],
    hairColors: [0x1b1410, 0x3b2314, 0x6b4423, 0xc9a24b, 0x2a2a35],
    items: [
      C('tee_blue', 'top', 'tee', 0x4d7cff, 'Blue tee', 0), C('tee_pink', 'top', 'tee', 0xff4d8d, 'Pink tee', 5),
      C('tee_mint', 'top', 'tee', 0x3ec98e, 'Mint tee', 5), C('dress_red', 'top', 'dress', 0xd33a55, 'Red dress', 12),
      C('dress_purple', 'top', 'dress', 0x8e5bd0, 'Purple dress', 12), C('hoodie_gray', 'top', 'hoodie', 0x8a8f99, 'Hoodie', 10),
      C('jacket_brown', 'top', 'jacket', 0x7a5230, 'Jacket', 10), C('sweater_cream', 'top', 'sweater', 0xf0e2c8, 'Sweater', 8),
      C('long_black', 'bottom', 'long', 0x2b3350, 'Black pants', 0), C('long_white', 'bottom', 'long', 0xe8e8e8, 'White pants', 5),
      C('short_blue', 'bottom', 'short', 0x3a66c9, 'Shorts', 5), C('skirt_red', 'bottom', 'skirt', 0xc94455, 'Skirt', 8),
      C('skirt_plaid', 'bottom', 'skirt', 0x4a3b5c, 'Plaid skirt', 8),
      C('sneak_black', 'shoes', 'sneakers', 0x222222, 'Black sneakers', 0), C('sneak_white', 'shoes', 'sneakers', 0xf2f2f2, 'White sneakers', 4),
      C('boots_brown', 'shoes', 'boots', 0x6b4423, 'Boots', 8), C('sandals_gold', 'shoes', 'sandals', 0xd9a24b, 'Sandals', 6),
      C('cap_red', 'hat', 'cap', 0xd33a3a, 'Red cap', 6), C('cap_blue', 'hat', 'cap', 0x3a66c9, 'Blue cap', 6),
      C('beanie_gray', 'hat', 'beanie', 0x777d88, 'Beanie', 6), C('sunhat_straw', 'hat', 'sunhat', 0xe8d089, 'Sun hat', 8),
      C('crown_gold', 'hat', 'crown', 0xf0c040, 'Crown', 25), C('bow_pink', 'hat', 'bow', 0xff7bac, 'Hair bow', 6),
      C('dog_brown', 'pet', 'dog', 0x6b4423, 'Dog', 15), C('dog_gray', 'pet', 'dog', 0x9aa0a8, 'Gray dog', 15),
      C('cat_orange', 'pet', 'cat', 0xe07b39, 'Cat', 15), C('cat_black', 'pet', 'cat', 0x2a2a30, 'Black cat', 15),
      C('bunny_white', 'pet', 'bunny', 0xf2f2f2, 'Bunny', 18), C('fox_orange', 'pet', 'fox', 0xe2682b, 'Fox', 25),
      C('panda', 'pet', 'panda', 0xf5f5f5, 'Panda', 30), C('penguin', 'pet', 'penguin', 0x23262d, 'Penguin', 30)
    ]
  };
  W3.setCatalog(CATALOG);
  if (socket) socket.emit('world:catalog', CATALOG);

  /* ---------- movement that understands rooms ---------- */
  // point this at your town collision test if it has a different name (worldBlocked / isWorldBlocked / worldCollides …)
  const townBlocked = (x, y) => {
    const f = window.worldBlocked || window.isWorldBlocked || window.worldCollides;
    return f ? f(x, y) : (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20);
  };
  const blockedAt = (x, y) => worldRoom !== 'town' ? window.worldRoomBlocked(x, y) : townBlocked(x, y);
  const mySeat = () => {   // {car, seat} if I am in a car (seat 0 = driver)
    for (let i = 0; i < WORLD_PARKED_CARS.length; i++) {
      const r = WORLD_PARKED_CARS[i].riders || [], s = r.indexOf(currentUser.id);
      if (s >= 0) return { car: i, seat: s };
    } return null;
  };
  let lastMove = 0;
  window.updateWorldMovement = function (now) {   // replaces the town-only version from script.js
    const u = me(); if (!u) return;
    if (u.dx === undefined) { u.dx = u.x; u.dy = u.y; }
    const ride = mySeat();
    if (ride && ride.seat > 0) { u.moving = false; return; }   // passengers just sit
    if (!worldTarget) { u.moving = false; return; }
    const dx = worldTarget.x - u.x, dy = worldTarget.y - u.y, d = Math.hypot(dx, dy);
    if (d < 4) { worldTarget = null; u.moving = false; return; }
    const sp = Math.min(d, (now - (window.__lmt || now)) * .18);
    window.__lmt = now;
    const nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
    if (!blockedAt(nx, u.y)) u.x = nx;
    if (!blockedAt(u.x, ny)) u.y = ny;
    u.moving = true;
    if (socket && now - lastMove > 100) { lastMove = now; socket.emit('world:move', { x: Math.round(u.x), y: Math.round(u.y), room: worldRoom }); }
  };

  /* ---------- rooms: enter / exit (positions are spawned at the exit mat) ---------- */
  window.enterWorldRoom = function (room) {
    const r = W3.getRoom(room);
    if (socket) socket.emit('world:enter', { room });
    worldRoom = room;
    const u = me(); if (u) { u.x = u.dx = r.spec.w / 2; u.y = u.dy = r.spec.h - 60; worldTarget = null; }
  };
  window.exitWorldRoom = function () {
    const door = W3.doors.find(d => d.room === worldRoom) || { x: WORLD_W / 2, y: WORLD_H / 2 };
    if (socket) socket.emit('world:exit', { x: Math.round(door.x), y: Math.round(door.y) });
    worldRoom = 'town';
    const u = me(); if (u) { u.x = u.dx = door.x; u.y = u.dy = door.y; worldTarget = null; }
  };
  if (socket) socket.on('world:room', function (d) { worldRoom = d.room; const u = me(); if (u) { u.x = u.dx = d.x; u.y = u.dy = d.y; worldTarget = null; } });

  /* ---------- cars: first one in = driver, the rest are passengers ---------- */
  window.driveWorldCar = function (i) { if (socket) socket.emit('world:ride', { car: i }); };         // sit in first free seat
  window.exitWorldCar = function () { if (socket) socket.emit('world:ride:exit', {}); };              // topbar "Get out" calls this
  window.askWorldDriver = function (i) { if (socket) socket.emit('world:ride:ask', { car: i }); };    // request a ride
  if (socket) {
    socket.on('world:cars', function (list) {   // server -> [{i, riders:[uid,...]}]
      (list || []).forEach(s => { if (WORLD_PARKED_CARS[s.i]) WORLD_PARKED_CARS[s.i].riders = s.riders; });
    });
    socket.on('world:ride:ask', function (d) {   // someone wants a ride in my car
      const u = worldUsers[d.from];
      if (confirm((u ? u.name : 'Someone') + ' wants to ride with you. Let them in?')) socket.emit('world:ride:accept', d);
    });
  }
  // show / hide the topbar "Get out" button while I'm in a car
  setInterval(() => {
    const b = document.getElementById('world-exit-car'); if (!b) return;
    b.style.display = mySeat() ? '' : 'none';
  }, 300);

  /* ---------- appearance ---------- */
  window.setMyLook = function (patch) {
    const u = me(); if (!u) return;
    u.appearance = Object.assign({}, u.appearance, patch);
    if (socket) socket.emit('world:appearance', u.appearance);
  };

  /* ---------- shopping ---------- */
  window.buyWorldItem = function (id) {
    if (socket) socket.emit('world:buy', { id });
    else { const it = W3.items[id]; if (it) { (window.myItems = window.myItems || []).push(id); } }   // offline fallback
  };
  if (socket) {
    socket.on('world:inv', function (d) { window.myItems = d.items || []; });
    socket.on('world:bought', function (d) { if (d.ok) { window.myItems = d.items; showMsg && showMsg('Bought ' + (W3.items[d.id] ? W3.items[d.id].name : d.id) + '! 🎉', 'success'); } else showMsg && showMsg(d.why || 'Not enough coins', 'error'); });
  }

  /* ---------- goToPlace: also cover the new district ---------- */
  const oldGo = window.goToPlace;
  window.goToPlace = function (p) {
    const near = (lbl, ox, oy) => { const d = W3.doors.find(x => x.label === lbl); const u = me(); if (d && u) { u.x = u.dx = d.x + (ox || 0); u.y = u.dy = d.y + (oy || 40); worldTarget = null; } };
    if (p === 'mall') return near('Shopping Mall');
    if (p === 'cinema') return near('Cinema');
    if (p === 'houses') return near('Home 7');
    if (p === 'cafe') return near('Café');
    return oldGo ? oldGo(p) : undefined;
  };
})();
