const express = require("express");
const Video = require("../models/Video");
const User = require("../models/User");
const { upload } = require("../config/cloudinary");

const router = express.Router();

// Upload video
router.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const { caption } = req.body;
    
    const video = new Video({
      user: req.userId,
      url: req.file.path,
      thumbnail: req.file.path.replace('.mp4', '.jpg'), // Cloudinary auto-generates
      caption: caption || ""
    });

    await video.save();
    res.json({ success: true, video });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Get video feed (all videos except user's own)
router.get("/feed", async (req, res) => {
  try {
    const videos = await Video.find({ user: { $ne: req.userId } })
      .populate("user", "name profilePicture")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get user's own videos
router.get("/my-videos", async (req, res) => {
  try {
    const videos = await Video.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Like/unlike video
router.post("/like/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

    const alreadyLiked = video.likes.includes(req.userId);
    
    if (alreadyLiked) {
      video.likes.pull(req.userId);
    } else {
      video.likes.push(req.userId);
    }

    await video.save();
    res.json({ liked: !alreadyLiked, totalLikes: video.likes.length });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Increment view count
router.post("/view/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

    // Only count view if user hasn't viewed before
    if (!video.viewedBy.includes(req.userId)) {
      video.views += 1;
      video.viewedBy.push(req.userId);
      await video.save();
    }

    res.json({ views: video.views });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get single video
router.get("/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId)
      .populate("user", "name profilePicture")
      .lean();

    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(video);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;