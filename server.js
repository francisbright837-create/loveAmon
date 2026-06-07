const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const profileRoutes = require("./routes/profile");
const messageRoutes = require("./routes/message");
const adminRoutes = require("./routes/admin");
const videoRoutes = require("./routes/video");

const app = express();

app.use(helmet());
app.use(mongoSanitize());

// ✅ FIXED: Added all common frontend origins
const allowedOrigins = [
  "http://localhost:4000",
  "http://localhost:5500",        // Live Server
  "http://127.0.0.1:5500",        // Live Server (127.0.0.1)
  "http://localhost:3000",        // React/Vite dev server
  "https://loveamon.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (file://, mobile apps, Postman)
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

// ✅ Handle preflight (OPTIONS) requests for all routes
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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/match", authMiddleware, matchRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/videos", authMiddleware, videoRoutes);

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
    return res.status(403).json({ message: "CORS error: Access denied from this origin" });
  }
  res.status(500).json({ message: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Frontend: http://localhost:${PORT}`);
});