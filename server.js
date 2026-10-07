const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");

const app = express();
const server = http.createServer(app);

app.use(helmet({
  // lets map tile servers see which site is asking (OpenStreetMap blocks requests without it)
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://cdnjs.cloudflare.com", "'wasm-unsafe-eval'"],   // wasm = camera AI
      "script-src-attr": ["'unsafe-inline'"],
      "img-src": [
        "'self'",
        "data:",
        "blob:",                                                          // camera photo preview
        "https://res.cloudinary.com",
        "https://*.tile.openstreetmap.org",
        "https://cdnjs.cloudflare.com"
      ],
      "media-src": ["'self'", "blob:", "https://res.cloudinary.com"],       // blob: = camera video preview
      "worker-src": ["'self'", "blob:"],
    },
  },
}));
app.use(mongoSanitize());

const allowedOrigins = [
  "http://localhost:4000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://loveamon.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.options('*', cors());

app.use(express.json({ limit: "5mb" }));
// camera AI (person cut-out) files, served from the installed npm package
app.use("/vendor/selfie", express.static(
  path.join(__dirname, "node_modules", "@mediapipe", "selfie_segmentation"),
  { maxAge: "7d" }
));
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const profileRoutes = require("./routes/profile");
const messageRoutes = require("./routes/message");
const adminRoutes = require("./routes/admin");
const videoRoutes = require("./routes/video");
const followRoutes = require("./routes/follow");

app.use("/api/auth", authRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/match", authMiddleware, matchRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/videos", authMiddleware, videoRoutes);
app.use("/api/follow", authMiddleware, followRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Unknown /api routes answer with JSON instead of Express's HTML "Cannot GET" page
app.use("/api", (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS error: Access denied" });
  }
  res.status(500).json({ message: err.message || "Something went wrong" });
});

// ==================== WORLD (socket.io) — kept intentionally lightweight ====================
// Live positions live only in memory. The DB is touched ONCE per player when they leave a room /
// leave the world / disconnect (to remember where they were standing) and once when they join.
// There are no DB writes while people are walking around.

const WORLD_W = 600;
const WORLD_H = 600;
const WORLD_PAD = 24;                              // must match the client
const WORLD_ROOMS = ["park", "cafe", "beach"];     // must match the client
const WORLD_EMOTES = ["heart", "wave", "dance"];   // must match the client
const CHAT_RANGE = 300;                            // chat bubbles are only sent to people this close

const worldPositionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  room: { type: String, default: "park" },
  x: Number,
  y: Number,
  updatedAt: { type: Date, default: Date.now }
});
const WorldPosition = mongoose.model("WorldPosition", worldPositionSchema);

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

const worldUsers = new Map(); // socket.id -> { userId, name, profilePicture, room, x, y, lastChat, lastEmote }

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const roomKey = (room) => "world:" + room;
const randomSpawn = () => ({
  x: 250 + Math.floor(Math.random() * 100),
  y: 250 + Math.floor(Math.random() * 100)
});

function roomState(room) {
  return Array.from(worldUsers.values())
    .filter(u => u.room === room)
    .map(({ userId, name, profilePicture, x, y }) => ({ userId, name, profilePicture, x, y }));
}

function broadcastRoomState(room) {
  io.to(roomKey(room)).emit("world:state", { room, users: roomState(room) });
}

async function savePosition(user) {
  try {
    await WorldPosition.updateOne(
      { userId: user.userId },
      { $set: { room: user.room, x: user.x, y: user.y, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error("Could not save world position:", err.message);
  }
}

function removeFromWorld(socketId, save = true) {
  const user = worldUsers.get(socketId);
  if (!user) return;
  worldUsers.delete(socketId);

  const sock = io.sockets.sockets.get(socketId);
  if (sock) sock.leave(roomKey(user.room));

  io.to(roomKey(user.room)).emit("world:userLeft", { userId: user.userId });
  if (save) savePosition(user);
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.on("world:join", async ({ name, profilePicture } = {}) => {
    // same account open in another tab? drop the old avatar so there's only one of you
    for (const [sid, u] of worldUsers) {
      if (u.userId === socket.userId && sid !== socket.id) removeFromWorld(sid, false);
    }

    if (worldUsers.has(socket.id)) {
      socket.emit("world:state", {
        room: worldUsers.get(socket.id).room,
        users: roomState(worldUsers.get(socket.id).room)
      });
      return;
    }

    // remember where they were last standing
    let saved = null;
    try {
      saved = await WorldPosition.findOne({ userId: socket.userId }).lean();
    } catch (err) {
      console.error("Could not load world position:", err.message);
    }
    if (!socket.connected || worldUsers.has(socket.id)) return; // left/duplicated while we were loading

    const room = saved && WORLD_ROOMS.includes(saved.room) ? saved.room : "park";
    const spawn = randomSpawn();
    const hasSpot = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y);

    worldUsers.set(socket.id, {
      userId: socket.userId,
      name: String(name || "Someone").slice(0, 40),
      profilePicture: typeof profilePicture === "string" ? profilePicture.slice(0, 500) : "",
      room,
      x: hasSpot ? clamp(saved.x, WORLD_PAD, WORLD_W - WORLD_PAD) : spawn.x,
      y: hasSpot ? clamp(saved.y, WORLD_PAD, WORLD_H - WORLD_PAD) : spawn.y,
      lastChat: 0,
      lastEmote: 0
    });

    socket.join(roomKey(room));
    broadcastRoomState(room);
  });

  socket.on("world:move", ({ x, y } = {}) => {
    const user = worldUsers.get(socket.id);
    if (!user || !Number.isFinite(x) || !Number.isFinite(y)) return;

    // boundary walls are enforced here too, so a modified client can't leave the map
    user.x = clamp(x, WORLD_PAD, WORLD_W - WORLD_PAD);
    user.y = clamp(y, WORLD_PAD, WORLD_H - WORLD_PAD);

    socket.to(roomKey(user.room)).emit("world:userMoved", {
      userId: user.userId,
      x: user.x,
      y: user.y
    });
  });

  socket.on("world:switchRoom", ({ room } = {}) => {
    const user = worldUsers.get(socket.id);
    if (!user || !WORLD_ROOMS.includes(room) || room === user.room) return;

    const oldRoom = user.room;
    socket.leave(roomKey(oldRoom));
    io.to(roomKey(oldRoom)).emit("world:userLeft", { userId: user.userId });

    const spawn = randomSpawn();
    user.room = room;
    user.x = spawn.x;
    user.y = spawn.y;

    socket.join(roomKey(room));
    broadcastRoomState(room);
    savePosition(user);
  });

  socket.on("world:emote", ({ emote } = {}) => {
    const user = worldUsers.get(socket.id);
    if (!user || !WORLD_EMOTES.includes(emote)) return;

    const now = Date.now();
    if (now - user.lastEmote < 400) return; // simple spam guard
    user.lastEmote = now;

    io.to(roomKey(user.room)).emit("world:emote", { userId: user.userId, emote });
  });

  socket.on("world:chat", ({ text } = {}) => {
    const user = worldUsers.get(socket.id);
    if (!user || typeof text !== "string") return;

    const now = Date.now();
    if (now - user.lastChat < 700) return; // simple spam guard
    user.lastChat = now;

    const clean = text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
    if (!clean) return;

    // only people in the same room AND close enough (plus the sender) see the bubble
    for (const [sid, u] of worldUsers) {
      if (u.room !== user.room) continue;
      if (sid !== socket.id && Math.hypot(u.x - user.x, u.y - user.y) > CHAT_RANGE) continue;
      io.to(sid).emit("world:chat", { userId: user.userId, text: clean });
    }
  });

  // player closed the world screen but is still logged in
  socket.on("world:leave", () => removeFromWorld(socket.id));

  socket.on("disconnect", () => removeFromWorld(socket.id));
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 API endpoints:`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /health`);
});