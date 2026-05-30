const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Get all users (lightweight - no images)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("name email gender interest createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      total: users.length,
      users
    });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get full user details by ID
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get stats (very lightweight)
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalLikes] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $project: { likeCount: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$likeCount" } } }
      ])
    ]);

    const matches = await User.aggregate([
      { $project: { matchCount: { $size: "$matches" } } },
      { $group: { _id: null, total: { $sum: "$matchCount" } } }
    ]);

    res.json({
      totalUsers,
      totalLikes: totalLikes[0]?.total || 0,
      totalMatches: matches[0]?.total || 0
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a user
router.delete("/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;