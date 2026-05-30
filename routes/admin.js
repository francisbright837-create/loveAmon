const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Admin = require("../models/Admin");

const router = express.Router();

// Admin login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });
    
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
    
    const token = jwt.sign(
      { id: admin._id, role: 'admin' }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1d" }
    );
    
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Middleware to verify admin
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }
  
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.adminId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Get all users
router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get user by ID with messages
router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    const messages = await Message.find({
      $or: [{ sender: req.params.id }, { receiver: req.params.id }]
    })
    .populate('sender', 'name email')
    .populate('receiver', 'name email')
    .sort({ createdAt: -1 });
    
    res.json({ user, messages });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all messages
router.get("/messages", adminAuth, async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get statistics
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    const maleUsers = await User.countDocuments({ gender: 'Male' });
    const femaleUsers = await User.countDocuments({ gender: 'Female' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({ createdAt: { $gte: today } });
    
    res.json({ totalUsers, totalMessages, maleUsers, femaleUsers, newToday });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete user
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Message.deleteMany({
      $or: [{ sender: req.params.id }, { receiver: req.params.id }]
    });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;