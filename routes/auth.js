const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");

const router = express.Router();

// Rate limiting: max 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password validation: min 6 chars, at least 1 letter and 1 number
function isValidPassword(password) {
  return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// Email validation regex
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Sanitize input to prevent XSS
function sanitize(str) {
  return str.replace(/[<>]/g, "");
}

// Register
router.post("/register", authLimiter, async (req, res) => {
  try {
    let { name, email, password, gender, interest } = req.body;

    // Sanitize inputs
    name = sanitize(name?.trim());
    email = email?.trim().toLowerCase();
    interest = sanitize(interest);

    // Validate inputs
    if (!name || !email || !password || !gender || !interest) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters with letters and numbers" 
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(409).json({ message: "User already exists" });

    // Hash password with salt rounds 12
    const hashedPassword = await bcrypt.hash(password, 12);

    user = new User({
      name,
      email,
      password: hashedPassword,
      gender,
      interest
    });

    await user.save();

    res.status(201).json({ message: "Account created successfully" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Use environment variable for JWT secret
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;