const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Get potential matches (excluding already liked/matched)
router.get("/profiles", async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build list of IDs to exclude
    const excludeIds = [req.userId, ...currentUser.likes, ...currentUser.matches];
    
    // Gender filter: only filter if interest is set and not "both"
    let genderFilter = {};
    if (currentUser.interest && currentUser.interest !== "both") {
      genderFilter = { gender: currentUser.interest };
    }

    const profiles = await User.find({
      _id: { $nin: excludeIds },
      ...genderFilter
    })
    .select("-password -likes -matches -__v")
    .limit(20);

    res.json(profiles);
  } catch (err) {
    console.error("Fetch profiles error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Like a user
router.post("/like/:targetId", async (req, res) => {
  try {
    const { targetId } = req.params;
    const userId = req.userId;

    if (targetId === userId) {
      return res.status(400).json({ message: "Cannot like yourself" });
    }

    const user = await User.findById(userId);
    const target = await User.findById(targetId);

    if (!target) return res.status(404).json({ message: "User not found" });
    if (user.likes.includes(targetId)) {
      return res.status(400).json({ message: "Already liked" });
    }

    user.likes.push(targetId);
    await user.save();

    // Check for mutual match
    const isMatch = target.likes.includes(userId);
    if (isMatch) {
      user.matches.push(targetId);
      target.matches.push(userId);
      await user.save();
      await target.save();
      return res.json({ match: true, message: "It's a match! 🎉", user: target });
    }

    res.json({ match: false, message: "Liked! 💕" });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get my matches (for chat)
router.get("/matches", async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("matches", "name profilePicture bio");
    
    res.json(user.matches);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Temporary debug: see all users count
router.get("/debug-count", async (req, res) => {
  try {
    const total = await User.countDocuments();
    const currentUser = await User.findById(req.userId);
    const excludeIds = [req.userId, ...currentUser.likes, ...currentUser.matches];
    const available = await User.countDocuments({ _id: { $nin: excludeIds } });
    
    res.json({
      totalUsers: total,
      excluded: excludeIds.length,
      availableToShow: available,
      yourInterest: currentUser.interest,
      yourGender: currentUser.gender
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;