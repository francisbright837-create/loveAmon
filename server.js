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

// Extra allowed addresses from .env, e.g. EXTRA_ORIGINS=https://yourname.trycloudflare.com
(process.env.EXTRA_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)
  .forEach(o => allowedOrigins.push(o));

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
const chatRoutes = require("./routes/chat");
const callRoutes = require("./routes/calls");
const aiRoutes = require("./routes/ai");
const appearanceRoutes = require("./routes/appearance");

app.use("/api/auth", authRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/match", authMiddleware, matchRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/videos", authMiddleware, videoRoutes);
app.use("/api/follow", authMiddleware, followRoutes);
app.use("/api/chat", authMiddleware, chatRoutes);
app.use("/api/calls", authMiddleware, callRoutes);
app.use("/api/ai", authMiddleware, aiRoutes);
app.use("/api/appearance", authMiddleware, appearanceRoutes);   // saves a player's character style (boy/girl, clothes, pet ...)

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

// ==================== WORLD (socket.io) ====================
// All the world logic (rooms, buildings, looks, shop, cars) lives in sockets/world.js
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

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

// voice and video call signalling
require("./sockets/calls")(io);

// the town, buildings, outfits, shop and shared cars
require("./sockets/world")(io, mongoose);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 API endpoints:`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /health`);
});