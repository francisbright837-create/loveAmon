// ==================== WORLD (socket.io) ====================
// Live positions live only in memory. The DB is touched when a player joins, leaves, buys something or saves their look.
// There are NO database writes while people are walking around.
//
// Rooms: "town" (the big outdoor map) plus interiors you walk into: homes, the mall, the cinema and the café.
// Cars: each parked car has seats. Seat 0 = the driver (the only one who steers). Everyone else is a passenger and must be
// invited by the driver (or take the wheel when the driver gets out).

const catalog = require("./world-catalog");
const Appearance = require("../models/Appearance");   // the boy/girl + clothes + pet style saved by PUT /api/appearance

const WORLD_PAD = 24;                              // must match the client
const WORLD_EMOTES = ["heart", "wave", "dance"];   // must match the client
const CHAT_RANGE = 500;                            // chat bubbles are only sent to people this close
const START_COINS = 200;
const COINS_PER_MINUTE = 5;
const TICKET_PRICE = 8;
const TICKET_MS = 2 * 60 * 60 * 1000;
const INVITE_MS = 60 * 1000;
const CAR_ENTER_RANGE = 200;
const CAR_INVITE_RANGE = 300;

// ---- rooms (sizes are in the same pixel-like units as the town; must match world3d.js) ----
const ROOMS = {
  town:   { w: 3600, h: 1600 },
  mall:   { w: 900, h: 600 },
  cinema: { w: 800, h: 560 },
  cafe:   { w: 520, h: 380 }
};
for (let i = 1; i <= 12; i++) ROOMS["home" + i] = { w: 560, h: 420 };
Object.entries(ROOMS).forEach(([id, r]) => { if (id !== "town") r.spawn = { x: r.w / 2, y: r.h - 110 }; });

// ---- parked cars (order = id). The first six match the ones that were already in the town. ----
const CAR_DEFS = [
  { e: "🚗", x: 1500, y: 1235 }, { e: "🚙", x: 1780, y: 1235 }, { e: "🚕", x: 2060, y: 1235 },
  { e: "🚓", x: 1480, y: 716 },  { e: "🏎️", x: 1900, y: 716 },  { e: "🚌", x: 760, y: 716 },
  { e: "🚙", x: 2550, y: 1235 }, { e: "🚕", x: 2850, y: 1235 }, { e: "🚗", x: 3150, y: 1235 }
];
const seatsFor = e => (e === "🚌" ? 8 : e === "🏎️" ? 2 : 4);

module.exports = function registerWorld(io, mongoose) {
  const worldPositionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    room: { type: String, default: "town" },
    x: Number,
    y: Number,
    updatedAt: { type: Date, default: Date.now }
  });
  const WorldPosition = mongoose.models.WorldPosition || mongoose.model("WorldPosition", worldPositionSchema);

  const worldProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    appearance: { type: mongoose.Schema.Types.Mixed, default: {} },
    coins: { type: Number, default: START_COINS },
    owned: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  });
  const WorldProfile = mongoose.models.WorldProfile || mongoose.model("WorldProfile", worldProfileSchema);

  const worldUsers = new Map(); // socket.id -> user
  const cars = CAR_DEFS.map((c, i) => ({ id: i, e: c.e, x: c.x, y: c.y, riders: new Array(seatsFor(c.e)).fill(null) }));

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const roomKey = room => "world:" + room;
  const randomSpawn = () => ({ x: 1100 + Math.floor(Math.random() * 200), y: 690 + Math.floor(Math.random() * 40) });
  const clampIn = (room, x, y) => ({
    x: clamp(x, WORLD_PAD, ROOMS[room].w - WORLD_PAD),
    y: clamp(y, WORLD_PAD, ROOMS[room].h - WORLD_PAD)
  });
  const carsPayload = () => cars.map(c => ({ id: c.id, e: c.e, x: c.x, y: c.y, riders: c.riders.slice() }));
  const findUser = userId => { for (const [sid, u] of worldUsers) if (u.userId === userId) return [sid, u]; return [null, null]; };
  const notice = (sid, text) => io.to(sid).emit("world:notice", { text });
  const publicCatalog = () => ({ skins: catalog.SKINS, hairColors: catalog.HAIR_COLORS, hairStyles: catalog.HAIR_STYLES, items: catalog.ITEMS });

  function roomState(room) {
    return Array.from(worldUsers.values())
      .filter(u => u.room === room)
      .map(u => ({
        userId: u.userId, name: u.name, profilePicture: u.profilePicture, x: u.x, y: u.y,
        vehicle: u.carId !== null ? cars[u.carId].e : null, carId: u.carId, appearance: u.appearance, look: u.look || null
      }));
  }
  const broadcastRoomState = room => io.to(roomKey(room)).emit("world:state", { room, users: roomState(room) });
  const broadcastCars = () => io.to(roomKey("town")).emit("world:cars", carsPayload());

  async function savePosition(user) {
    // inside a building we remember the spot in the TOWN where they walked in, so they come back outside
    const spot = user.room === "town" ? { x: user.x, y: user.y } : user.returnPos;
    if (!spot) return;
    try {
      await WorldPosition.updateOne(
        { userId: user.userId },
        { $set: { room: "town", x: spot.x, y: spot.y, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err) { console.error("Could not save world position:", err.message); }
  }

  async function saveProfile(user) {
    try {
      await WorldProfile.updateOne(
        { userId: user.userId },
        { $set: { appearance: user.appearance, coins: user.coins, owned: user.owned, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err) { console.error("Could not save world profile:", err.message); }
  }

  // ---- cars ----
  function leaveCar(user, sid) {
    if (user.carId === null) return;
    const car = cars[user.carId];
    const idx = car.riders.indexOf(user.userId);
    if (idx >= 0) car.riders[idx] = null;
    user.carId = null;
    const p = clampIn("town", car.x + 70, car.y + 30);   // step out beside the car
    user.x = p.x; user.y = p.y;
    broadcastCars();
    broadcastRoomState("town");
  }

  function joinCar(user, car, seat) {
    car.riders[seat] = user.userId;
    user.carId = car.id;
    user.invite = null;
    user.x = car.x; user.y = car.y;
    broadcastCars();
    broadcastRoomState("town");
  }

  function removeFromWorld(socketId, save = true) {
    const user = worldUsers.get(socketId);
    if (!user) return;
    if (user.carId !== null) leaveCar(user, socketId);
    worldUsers.delete(socketId);
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.leave(roomKey(user.room));
    io.to(roomKey(user.room)).emit("world:userLeft", { userId: user.userId });
    if (save) { savePosition(user); saveProfile(user); }
  }

  // everybody earns a few coins for every minute they spend in the world
  const earner = setInterval(() => {
    for (const [sid, u] of worldUsers) {
      u.coins += COINS_PER_MINUTE;
      io.to(sid).emit("world:coins", { coins: u.coins });
    }
  }, 60 * 1000);
  if (earner.unref) earner.unref();

  io.on("connection", socket => {
    socket.on("world:join", async ({ name, profilePicture } = {}) => {
      for (const [sid, u] of worldUsers) {
        if (u.userId === socket.userId && sid !== socket.id) removeFromWorld(sid, false);
      }
      if (worldUsers.has(socket.id)) {
        const u = worldUsers.get(socket.id);
        socket.emit("world:state", { room: u.room, users: roomState(u.room) });
        return;
      }

      let saved = null, prof = null, ap = null;
      try {
        [saved, prof, ap] = await Promise.all([
          WorldPosition.findOne({ userId: socket.userId }).lean(),
          WorldProfile.findOne({ userId: socket.userId }).lean(),
          Appearance.findOne({ user: socket.userId }).lean()
        ]);
      } catch (err) { console.error("Could not load world data:", err.message); }
      if (!socket.connected || worldUsers.has(socket.id)) return;

      const owned = prof && Array.isArray(prof.owned) ? prof.owned.filter(id => catalog.BY_ID[id]) : [];
      const spawn = randomSpawn();
      const hasSpot = saved && saved.room === "town" && Number.isFinite(saved.x) && Number.isFinite(saved.y);

      const user = {
        userId: socket.userId,
        name: String(name || "Someone").slice(0, 40),
        profilePicture: typeof profilePicture === "string" ? profilePicture.slice(0, 500) : "",
        room: "town",
        x: hasSpot ? clamp(saved.x, WORLD_PAD, ROOMS.town.w - WORLD_PAD) : spawn.x,
        y: hasSpot ? clamp(saved.y, WORLD_PAD, ROOMS.town.h - WORLD_PAD) : spawn.y,
        appearance: catalog.cleanAppearance(prof && prof.appearance, owned),
        look: ap && ap.look ? ap.look : null,
        coins: prof && Number.isFinite(prof.coins) ? prof.coins : START_COINS,
        owned,
        ticketUntil: 0,
        carId: null,
        invite: null,
        returnPos: null,
        lastChat: 0,
        lastEmote: 0
      };
      worldUsers.set(socket.id, user);
      socket.join(roomKey("town"));
      broadcastRoomState("town");
      socket.emit("world:profile", {
        catalog: publicCatalog(), appearance: user.appearance, coins: user.coins,
        owned: user.owned, isNew: !prof, ticketUntil: user.ticketUntil, ticketPrice: TICKET_PRICE
      });
      socket.emit("world:cars", carsPayload());
    });

    socket.on("world:move", ({ x, y } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || !Number.isFinite(x) || !Number.isFinite(y)) return;

      if (user.carId !== null) {
        const car = cars[user.carId];
        if (car.riders[0] !== user.userId) return;        // passengers can't steer
        const p = clampIn("town", x, y);
        user.x = car.x = p.x; user.y = car.y = p.y;
        car.riders.forEach(uid => { if (uid && uid !== user.userId) { const [, o] = findUser(uid); if (o) { o.x = car.x; o.y = car.y; } } });
        socket.to(roomKey("town")).emit("world:userMoved", { userId: user.userId, x: user.x, y: user.y });
        socket.to(roomKey("town")).emit("world:carMoved", { id: car.id, x: car.x, y: car.y });
        return;
      }

      const p = clampIn(user.room, x, y);                 // walls are enforced here too
      user.x = p.x; user.y = p.y;
      socket.to(roomKey(user.room)).emit("world:userMoved", { userId: user.userId, x: user.x, y: user.y });
    });

    // walk into / out of a building. room = "town" to go outside (optionally to a given spot).
    socket.on("world:switchRoom", ({ room, x, y } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || typeof room !== "string" || !ROOMS[room] || room === user.room) return;
      if (user.carId !== null) return notice(socket.id, "🚗 Get out of the car first");
      const old = user.room;
      if (room !== "town" && old !== "town") return;      // you always go out the front door first

      let pos;
      if (room === "town") {
        pos = Number.isFinite(x) && Number.isFinite(y) ? clampIn("town", x, y) : (user.returnPos || randomSpawn());
        user.returnPos = null;
      } else {
        user.returnPos = { x: user.x, y: user.y };
        pos = ROOMS[room].spawn;
      }

      socket.leave(roomKey(old));
      io.to(roomKey(old)).emit("world:userLeft", { userId: user.userId });
      user.room = room; user.x = pos.x; user.y = pos.y;
      socket.join(roomKey(room));
      broadcastRoomState(room);
      if (room === "town") socket.emit("world:cars", carsPayload());
      savePosition(user);
    });

    socket.on("world:emote", ({ emote } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || !WORLD_EMOTES.includes(emote)) return;
      const now = Date.now();
      if (now - user.lastEmote < 400) return;
      user.lastEmote = now;
      io.to(roomKey(user.room)).emit("world:emote", { userId: user.userId, emote });
    });

    socket.on("world:chat", ({ text } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || typeof text !== "string") return;
      const now = Date.now();
      if (now - user.lastChat < 700) return;
      user.lastChat = now;
      const clean = text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
      if (!clean) return;
      for (const [sid, u] of worldUsers) {
        if (u.room !== user.room) continue;
        if (sid !== socket.id && Math.hypot(u.x - user.x, u.y - user.y) > CHAT_RANGE) continue;
        io.to(sid).emit("world:chat", { userId: user.userId, text: clean });
      }
    });

    // ---------- look, wallet, shop ----------
    // the client saved a new style with PUT /api/appearance and now tells us: reload it and show it to everyone in the room
    socket.on("world:look", async () => {
      const user = worldUsers.get(socket.id);
      if (!user) return;
      try {
        const a = await Appearance.findOne({ user: user.userId }).lean();
        user.look = a && a.look ? a.look : null;
      } catch (err) { console.error("Could not reload look:", err.message); return; }
      broadcastRoomState(user.room);
    });

    socket.on("world:saveAppearance", ({ appearance } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user) return;
      user.appearance = catalog.cleanAppearance(appearance, user.owned, user.appearance);
      saveProfile(user);
      io.to(roomKey(user.room)).emit("world:appearance", { userId: user.userId, appearance: user.appearance });
    });

    socket.on("world:buy", ({ itemId } = {}) => {
      const user = worldUsers.get(socket.id);
      const item = catalog.BY_ID[itemId];
      if (!user || !item) return;
      if (user.room !== "mall") return notice(socket.id, "🛍️ Shopping is done inside the mall");
      if (item.price === 0 || user.owned.includes(itemId)) return notice(socket.id, "You already have that");
      if (user.coins < item.price) return notice(socket.id, "🪙 Not enough coins for " + item.name);
      user.coins -= item.price;
      user.owned.push(itemId);
      saveProfile(user);
      socket.emit("world:bought", { itemId, coins: user.coins, owned: user.owned });
    });

    socket.on("world:buyTicket", () => {
      const user = worldUsers.get(socket.id);
      if (!user || user.room !== "cinema") return;
      const now = Date.now();
      if (user.ticketUntil > now) return notice(socket.id, "🎟️ You already have a ticket");
      if (user.coins < TICKET_PRICE) return notice(socket.id, "🪙 A ticket costs " + TICKET_PRICE + " coins");
      user.coins -= TICKET_PRICE;
      user.ticketUntil = now + TICKET_MS;
      saveProfile(user);
      socket.emit("world:ticket", { until: user.ticketUntil, coins: user.coins });
    });

    // ---------- cars: driver + invited passengers ----------
    socket.on("world:carEnter", ({ carId } = {}) => {
      const user = worldUsers.get(socket.id);
      const car = cars[carId];
      if (!user || !car || user.room !== "town" || user.carId !== null) return;
      if (Math.hypot(user.x - car.x, user.y - car.y) > CAR_ENTER_RANGE) return notice(socket.id, "🚗 Walk closer to the car first");

      if (car.riders[0] === null) return joinCar(user, car, 0);           // free car → you drive

      const inv = user.invite;
      if (inv && inv.carId === car.id && inv.until > Date.now()) {
        const seat = car.riders.findIndex((r, i) => i > 0 && r === null);
        if (seat > 0) return joinCar(user, car, seat);
        return notice(socket.id, "🚗 The car is full");
      }
      const [, driver] = findUser(car.riders[0]);
      notice(socket.id, "🚗 " + (driver ? driver.name : "Someone") + " is driving. Ask them to invite you!");
    });

    socket.on("world:carInvite", ({ userId } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || user.carId === null) return;
      const car = cars[user.carId];
      if (car.riders[0] !== user.userId) return notice(socket.id, "Only the driver can invite people");
      const [tsid, target] = findUser(userId);
      if (!target || target.room !== "town" || target.carId !== null) return;
      if (Math.hypot(target.x - car.x, target.y - car.y) > CAR_INVITE_RANGE) return notice(socket.id, "That player is too far away");
      if (!car.riders.some((r, i) => i > 0 && r === null)) return notice(socket.id, "🚗 Your car is full");
      target.invite = { carId: car.id, from: user.userId, until: Date.now() + INVITE_MS };
      io.to(tsid).emit("world:carInvited", { carId: car.id, fromName: user.name, e: car.e });
      notice(socket.id, "📨 Invite sent to " + target.name);
    });

    socket.on("world:carAccept", () => {
      const user = worldUsers.get(socket.id);
      const inv = user && user.invite;
      if (!user || !inv || inv.until < Date.now() || user.carId !== null || user.room !== "town") return;
      const car = cars[inv.carId];
      user.invite = null;
      if (!car || car.riders[0] !== inv.from) return notice(socket.id, "That ride is no longer available");
      if (Math.hypot(user.x - car.x, user.y - car.y) > CAR_INVITE_RANGE + 100) return notice(socket.id, "🚗 Walk closer to the car");
      const seat = car.riders.findIndex((r, i) => i > 0 && r === null);
      if (seat < 1) return notice(socket.id, "🚗 The car is full");
      const [dsid] = findUser(inv.from);
      joinCar(user, car, seat);
      if (dsid) notice(dsid, "🎉 " + user.name + " joined your car");
    });

    socket.on("world:carDecline", () => {
      const user = worldUsers.get(socket.id);
      const inv = user && user.invite;
      if (!inv) return;
      user.invite = null;
      const [dsid] = findUser(inv.from);
      if (dsid) notice(dsid, user.name + " can't ride right now");
    });

    socket.on("world:carWheel", () => {      // a passenger takes the wheel when the driver has gotten out
      const user = worldUsers.get(socket.id);
      if (!user || user.carId === null) return;
      const car = cars[user.carId];
      if (car.riders[0] !== null) return;
      const idx = car.riders.indexOf(user.userId);
      if (idx > 0) { car.riders[idx] = null; car.riders[0] = user.userId; }
      broadcastCars();
    });

    socket.on("world:carExit", () => {
      const user = worldUsers.get(socket.id);
      if (user) leaveCar(user, socket.id);
    });

    socket.on("world:carKick", ({ userId } = {}) => {
      const user = worldUsers.get(socket.id);
      if (!user || user.carId === null) return;
      const car = cars[user.carId];
      if (car.riders[0] !== user.userId || userId === user.userId) return;
      const [ksid, target] = findUser(userId);
      if (!target || target.carId !== car.id) return;
      leaveCar(target, ksid);
      notice(ksid, "You were asked to get out of the car");
    });

    socket.on("world:leave", () => removeFromWorld(socket.id));
    socket.on("disconnect", () => removeFromWorld(socket.id));
  });
};
module.exports.ROOMS = ROOMS;
