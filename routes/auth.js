const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

function isValidPassword(password) {
  return password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str) {
  return str ? str.replace(/[<>]/g, "") : "";
}

// Register
router.post("/register", async (req, res) => {
  try {
    let { name, email, password, gender, interest } = req.body;

    name = sanitize(name?.trim());
    email = email?.trim().toLowerCase();
    interest = sanitize(interest);

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

    let user = await User.findOne({ email });
    if (user) return res.status(409).json({ message: "User already exists" });

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

// Login — ✅ FIXED: now returns bio + profilePicture so frontend knows if setup is done
router.post("/login", async (req, res) => {
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

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        gender: user.gender,
        interest: user.interest,
        bio: user.bio || "",
        profilePicture: user.profilePicture || ""
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;