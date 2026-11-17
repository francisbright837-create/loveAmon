/* world-server-snippet.js — merge into your socket.io world handler (e.g. sockets/world.js).
   Room sizes MUST match world3d.js specFor() exactly, or walls/doors won't line up. */
module.exports = function (io, socket, ctx) {
  // ctx = whatever your file already uses to reach users/sockets, e.g. { users, getUser }
  const u = () => ctx.getUser(socket.id);            // the DB/app user for this socket

  // ---- rooms you can walk into (sizes identical to world3d.js!) ----
  const ROOMS = { town: { w: WORLD_W || 3560, h: WORLD_H || 1600 } };
  ['cafe'].forEach(r => ROOMS[r] = { w: 520, h: 380 });
  ROOMS.mall = { w: 900, h: 600 };
  ROOMS.cinema = { w: 800, h: 560 };
  for (let i = 1; i <= 12; i++) ROOMS['home' + i] = { w: 560, h: 420 };

  const roomOf = id => { const x = u(); return (x && x.worldRoom) || 'town'; };
  const joinRoom = r => { const x = u(); if (!x) return; socket.leave('w:' + roomOf(socket.id)); x.worldRoom = r; socket.join('w:' + r); };
  const spawn = r => r === 'town' ? { x: 500, y: 500 } : { x: ROOMS[r].w / 2, y: ROOMS[r].h - 60 };
  const emitUsers = r => io.to('w:' + r).emit('world:users', ctx.usersInRoom(r));   // reuse your existing payload, MUST include appearance

  // ---- catalog, coins, inventory, appearance ----
  let CATALOG = { items: [] };
  const coins = {}, inv = {};
  const myCoins = id => coins[id] = coins[id] ?? 100;
  const myInv = id => inv[id] = inv[id] || ['tee_blue', 'long_black', 'sneak_black'];
  const item = id => CATALOG.items.find(i => i.id === id);

  socket.on('world:catalog', cat => { CATALOG = cat; io.emit('world:catalog', cat); });
  socket.on('world:appearance', a => { const x = u(); if (!x) return; x.appearance = a; io.to('w:' + roomOf(socket.id)).emit('world:appearance', { id: x.id, appearance: a }); });
  socket.on('world:inv', () => socket.emit('world:inv', { items: myInv((u() || {}).id) }));
  socket.on('world:buy', ({ id }) => {
    const x = u(); if (!x) return;
    const it = item(id); if (!it) return;
    if (myInv(x.id).includes(id)) return socket.emit('world:bought', { ok: 0, why: 'Already owned' });
    if (id === 'ticket_cinema') { if (myCoins(x.id) < 5) return socket.emit('world:bought', { ok: 0, why: 'Not enough coins' }); myCoins(x.id) -= 5; }
    else { if (myCoins(x.id) < it.price) return socket.emit('world:bought', { ok: 0, why: 'Not enough coins' }); myCoins(x.id) -= it.price; myInv(x.id).push(id); }
    socket.emit('world:bought', { ok: 1, id, items: myInv(x.id), coins: myCoins(x.id) });
    socket.emit('world:inv', { items: myInv(x.id) });
  });

  // ---- enter / exit buildings ----
  socket.on('world:enter', ({ room }) => {
    if (!ROOMS[room]) return;
    joinRoom(room);
    const s = spawn(room);
    const x = u(); if (x) { x.x = s.x; x.y = s.y; }
    socket.emit('world:room', { room, x: s.x, y: s.y });
    emitUsers(room); emitUsers('town');
  });
  socket.on('world:exit', ({ x, y }) => {
    joinRoom('town');
    const xx = u(); if (xx) { xx.x = x; xx.y = y; }
    socket.emit('world:room', { room: 'town', x, y });
    emitUsers(roomOf(socket.id)); 
  });

  // ---- movement: relay ONLY to people in the same room ----
  socket.on('world:move', d => {
    const x = u(); if (!x) return;
    x.x = d.x; x.y = d.y;
    socket.to('w:' + roomOf(socket.id)).emit('world:move', { id: x.id, x: d.x, y: d.y });
  });

  // ---- cars: seat 0 = the only driver, everyone else is a passenger ----
  const carSeats = {};                 // carIndex -> [userId]
  const broadcastCars = () => io.emit('world:cars', Object.entries(carSeats).map(([i, riders]) => ({ i: +i, riders })));
  socket.on('world:ride', ({ car }) => {          // sit in first free seat (driver if empty)
    const x = u(); if (!x || carSeats[car] && carSeats[car].length >= 4) return;
    for (const r in carSeats) { const s = carSeats[r].indexOf(x.id); if (s >= 0) carSeats[r].splice(s, 1); }
    (carSeats[car] = carSeats[car] || []).push(x.id);
    broadcastCars();
  });
  socket.on('world:ride:ask', ({ car }) => {      // passenger asks the driver
    const x = u(), d = carSeats[car] && carSeats[car][0];
    if (x && d) io.to(ctx.socketOf(d)).emit('world:ride:ask', { car, from: x.id });
  });
  socket.on('world:ride:accept', ({ car, from }) => {
    const x = u(); if (!x || carSeats[car] && carSeats[car][0] !== x.id) return;   // only the driver accepts
    (carSeats[car] = carSeats[car] || []).push(from);
    broadcastCars();
  });
  socket.on('world:ride:exit', () => {
    const x = u(); if (!x) return;
    for (const r in carSeats) { const s = carSeats[r].indexOf(x.id); if (s >= 0) { carSeats[r].splice(s, 1); if (s === 0) carSeats[r] = []; } }
    broadcastCars();
  });
  socket.on('disconnect', () => {
    const x = u(); if (!x) return;
    for (const r in carSeats) { const s = carSeats[r].indexOf(x.id); if (s >= 0) { carSeats[r].splice(s, 1); if (s === 0) carSeats[r] = []; } }
    broadcastCars();
  });
  socket.emit('world:cars', Object.entries(carSeats).map(([i, riders]) => ({ i: +i, riders })));
};
