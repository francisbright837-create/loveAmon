// ===== DNS FIX FOR MONGODB ATLAS (Windows) =====
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require("dotenv").config(); // Load environment variables

// ===== DEBUG LOGS =====
console.log("=== ENV DEBUG ===");
console.log("MONGO_URI loaded:", process.env.MONGO_URI ? "✅ YES" : "❌ UNDEFINED");
console.log("JWT_SECRET loaded:", process.env.JWT_SECRET ? "✅ YES" : "❌ UNDEFINED");
console.log("PORT:", process.env.PORT || 4000);
console.log("====================\n");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const matchRoutes = require("./routes/match");
const profileRoutes = require("./routes/profile");
const messageRoutes = require("./routes/message");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("Full Error:", err);
  });

// Auth Middleware
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});