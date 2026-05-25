const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Get potential matches (paginated, optimized)
router.get("/profiles", async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).lean();
    
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const excludeIds = [req.userId, ...currentUser.likes, ...currentUser.matches];
    
    let genderFilter = {};
    if (currentUser.interest && currentUser.interest !== "both") {
      genderFilter = { gender: currentUser.interest };
    }

    const [profiles, total] = await Promise.all([
      User.find({
        _id: { $nin: excludeIds },
        ...genderFilter
      })
      .select("-password -likes -matches -__v")
      .skip(skip)
      .limit(limit)
      .lean(),
      
      User.countDocuments({
        _id: { $nin: excludeIds },
        ...genderFilter
      })
    ]);

    res.json({
      profiles,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProfiles: total
    });
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

    const [user, target] = await Promise.all([
      User.findById(userId),
      User.findById(targetId)
    ]);

    if (!target) return res.status(404).json({ message: "User not found" });
    if (user.likes.includes(targetId)) {
      return res.status(400).json({ message: "Already liked" });
    }

    user.likes.push(targetId);
    await user.save();

    const isMatch = target.likes.includes(userId);
    if (isMatch) {
      user.matches.push(targetId);
      target.matches.push(userId);
      await Promise.all([user.save(), target.save()]);
      return res.json({ match: true, message: "It's a match! 🎉", user: target });
    }

    res.json({ match: false, message: "Liked! 💕" });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get my matches
router.get("/matches", async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("matches", "name profilePicture bio")
      .lean();
    
    res.json(user.matches);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;