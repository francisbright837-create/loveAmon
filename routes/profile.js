const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Get current user profile
router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-password -likes -matches -__v");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Profile /me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update profile
router.put("/", async (req, res) => {
  try {
    const { profilePicture, bio } = req.body;

    const update = {};
    if (bio !== undefined) update.bio = bio;
    if (profilePicture) update.profilePicture = profilePicture;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true }
    ).select("-password -likes -matches -__v");

    res.json(updated);
  } catch (err) {
    console.error("Profile PUT error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;