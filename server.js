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

const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src-attr": ["'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
      "media-src": ["'self'", "https://res.cloudinary.com"],
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

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS error: Access denied" });
  }
  res.status(500).json({ message: err.message || "Something went wrong" });
});

// ==================== WORLD (socket.io) — kept intentionally lightweight ====================
// Positions live only in memory (not the database) to avoid extra DB load.
// Single shared room. If memory issues return on Render's free tier, this is the first thing to scale back.

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

const worldUsers = new Map(); // socket.id -> { userId, name, profilePicture, x, y }

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
  socket.on("world:join", ({ name, profilePicture }) => {
    worldUsers.set(socket.id, {
      userId: socket.userId,
      name: name || "Someone",
      profilePicture: profilePicture || "",
      x: 300 + Math.floor(Math.random() * 100),
      y: 200 + Math.floor(Math.random() * 100)
    });
    io.emit("world:state", Array.from(worldUsers.values()));
  });

  socket.on("world:move", ({ x, y }) => {
    const user = worldUsers.get(socket.id);
    if (!user) return;
    user.x = x;
    user.y = y;
    socket.broadcast.emit("world:userMoved", {
      userId: user.userId,
      x: user.x,
      y: user.y
    });
  });

  socket.on("disconnect", () => {
    const user = worldUsers.get(socket.id);
    worldUsers.delete(socket.id);
    if (user) {
      io.emit("world:userLeft", { userId: user.userId });
    }
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 API endpoints:`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /health`);
});