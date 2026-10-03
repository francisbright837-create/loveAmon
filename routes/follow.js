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

// ✅ NEW: users shown on the map (this route was missing, which caused the HTML "Cannot GET" page)
const MAP_CENTER = { lat: -15.7861, lng: 35.0058 }; // Blantyre

// Until real locations are saved, give each user a stable spot near the centre
function spreadAroundCenter(id) {
  const n = parseInt(id.toString().slice(-8), 16);
  const angle = (n % 360) * Math.PI / 180;
  const dist = 0.005 + (Math.floor(n / 8) % 100) / 100 * 0.04; // roughly 0.5-4.5 km
  return {
    lat: MAP_CENTER.lat + Math.sin(angle) * dist,
    lng: MAP_CENTER.lng + Math.cos(angle) * dist
  };
}

router.get("/map/users", async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select("name profilePicture location")
      .limit(100)
      .lean();

    res.json(users.map(u => {
      const hasReal = Number.isFinite(u.location?.lat) && Number.isFinite(u.location?.lng);
      const pos = hasReal ? u.location : spreadAroundCenter(u._id);
      return {
        _id: u._id,
        name: u.name,
        profilePicture: u.profilePicture || "",
        lat: pos.lat,
        lng: pos.lng
      };
    }));
  } catch (err) {
    console.error("Map users error:", err);
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