const express = require("express");
const User = require("../models/User");
const Video = require("../models/Video");

const router = express.Router();

// Search users by name
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const users = await User.find({
      _id: { $ne: req.userId },
      name: { $regex: q, $options: "i" }
    })
      .select("name profilePicture bio")
      .limit(20)
      .lean();

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a public profile (with follow status, followers/following counts, videos)
router.get("/:userId", async (req, res) => {
  try {
    const targetId = req.params.userId;

    const [target, me, videos] = await Promise.all([
      User.findById(targetId).select("name profilePicture bio followers following").lean(),
      User.findById(req.userId).select("following").lean(),
      Video.find({ user: targetId }).sort({ createdAt: -1 }).lean()
    ]);

    if (!target) return res.status(404).json({ message: "User not found" });

    const isFollowing = me.following.some(id => id.toString() === targetId);

    res.json({
      _id: target._id,
      name: target.name,
      profilePicture: target.profilePicture,
      bio: target.bio,
      followersCount: target.followers.length,
      followingCount: target.following.length,
      isFollowing,
      isSelf: targetId === req.userId,
      videos
    });
  } catch (err) {
    console.error("Get public profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Follow a user
router.post("/:userId", async (req, res) => {
  try {
    const targetId = req.params.userId;
    const myId = req.userId;

    if (targetId === myId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const [me, target] = await Promise.all([
      User.findById(myId),
      User.findById(targetId)
    ]);

    if (!target) return res.status(404).json({ message: "User not found" });

    if (!me.following.includes(targetId)) {
      me.following.push(targetId);
      target.followers.push(myId);
      await Promise.all([me.save(), target.save()]);
    }

    res.json({ following: true });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Unfollow a user
router.delete("/:userId", async (req, res) => {
  try {
    const targetId = req.params.userId;
    const myId = req.userId;

    const [me, target] = await Promise.all([
      User.findById(myId),
      User.findById(targetId)
    ]);

    if (!target) return res.status(404).json({ message: "User not found" });

    me.following.pull(targetId);
    target.followers.pull(myId);
    await Promise.all([me.save(), target.save()]);

    res.json({ following: false });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;