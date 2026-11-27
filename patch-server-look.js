// Adds the character (style) feature to your server.js. Safe to run twice.
// Usage (in the project folder):  node patch-server-look.js
const fs = require("fs");
const file = process.argv[2] || "server.js";
if (!fs.existsSync(file)) { console.log("Could not find " + file + ". Run this in your project folder."); process.exit(1); }

let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

if (s.includes("appearanceRoutes")) { console.log("server.js already has the character feature. Nothing to do."); process.exit(0); }

const steps = [
  {
    name: "load the new files",
    find: 'const followRoutes = require("./routes/follow");',
    add: 'const followRoutes = require("./routes/follow");\nconst appearanceRoutes = require("./routes/appearance");\nconst Appearance = require("./models/Appearance");\nconst LOOK = require("./public/look-catalog.js");'
  },
  {
    name: "add the /api/appearance route",
    find: 'app.use("/api/follow", authMiddleware, followRoutes);',
    add: 'app.use("/api/follow", authMiddleware, followRoutes);\napp.use("/api/appearance", authMiddleware, appearanceRoutes);'
  },
  {
    name: "send each player's look to everyone in the world",
    find: ".map(({ userId, name, profilePicture, x, y, vehicle }) => ({ userId, name, profilePicture, x, y, vehicle: vehicle || null }));",
    add: ".map(({ userId, name, profilePicture, x, y, vehicle, look }) => ({ userId, name, profilePicture, x, y, vehicle: vehicle || null, look: look || null }));"
  },
  {
    name: "load the saved look when a player joins the world",
    find: "    if (!socket.connected || worldUsers.has(socket.id)) return; // left/duplicated while we were loading",
    add: `    if (!socket.connected || worldUsers.has(socket.id)) return; // left/duplicated while we were loading

    // the character they chose in the style editor
    let look = null;
    try {
      const savedLook = await Appearance.findOne({ user: socket.userId }).lean();
      look = savedLook ? LOOK.cleanLook(savedLook.look) : null;
    } catch (err) {
      console.error("Could not load appearance:", err.message);
    }
    if (!socket.connected || worldUsers.has(socket.id)) return;`
  },
  {
    name: "remember the look for each player in the world",
    find: "      vehicle: null,\n      lastChat: 0,",
    add: "      vehicle: null,\n      look,\n      lastChat: 0,"
  },
  {
    name: "refresh a player's look when they save a new style",
    find: '  socket.on("world:chat", ({ text } = {}) => {',
    add: `  // the player saved a new style (it was already stored and checked by /api/appearance)
  socket.on("world:look", async () => {
    const user = worldUsers.get(socket.id);
    if (!user) return;
    const now = Date.now();
    if (now - (user.lastLook || 0) < 1000) return;        // simple spam guard
    user.lastLook = now;
    try {
      const saved = await Appearance.findOne({ user: socket.userId }).lean();
      user.look = saved ? LOOK.cleanLook(saved.look) : null;
      broadcastRoomState(user.room);
    } catch (err) {
      console.error("Could not refresh appearance:", err.message);
    }
  });

  socket.on("world:chat", ({ text } = {}) => {`
  }
];

const missing = steps.filter(st => !s.includes(st.find)).map(st => st.name);
if (missing.length) {
  console.log("server.js was NOT changed, because I could not find the place to edit for:");
  missing.forEach(m => console.log("  - " + m));
  console.log("Your server.js is different from the one I expected. Send it to me and I will adjust the patch.");
  process.exit(1);
}

fs.writeFileSync(file + ".bak-before-look", crlf ? fs.readFileSync(file) : fs.readFileSync(file));   // backup of the original
steps.forEach(st => { s = s.replace(st.find, () => st.add); });
fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done. server.js now supports the character (style) feature. A backup was saved as " + file + ".bak-before-look");
