const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Get potential matches (excluding already liked/matched)
router.get("/profiles", async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    const profiles = await User.find({
      _id: { 
        $ne: req.userId,
        $nin: [...currentUser.likes, ...currentUser.matches]
      },
      gender: currentUser.interest === "both" ? { $exists: true } : currentUser.interest
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

module.exports = router;