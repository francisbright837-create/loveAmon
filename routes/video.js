const express = require("express");
const Video = require("../models/Video");
const User = require("../models/User");
const { upload, cloudinary } = require("../config/cloudinary");

const router = express.Router();

// Upload video
router.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const { caption } = req.body;

    const video = new Video({
      user: req.userId,
      url: req.file.path,
      thumbnail: req.file.path.replace('.mp4', '.jpg'),
      caption: caption || ""
    });

    await video.save();
    res.json({ success: true, video });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Get video feed (all videos except user's own), with follow status per author
router.get("/feed", async (req, res) => {
  try {
    const videos = await Video.find({ user: { $ne: req.userId } })
      .populate("user", "name profilePicture")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const me = await User.findById(req.userId).select("following").lean();
    const followingIds = (me?.following || []).map(id => id.toString());

    const shaped = videos.map(v => ({
      ...v,
      isFollowingAuthor: v.user ? followingIds.includes(v.user._id.toString()) : false
    }));

    res.json(shaped);
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

// Get videos for a specific user (public profile)
router.get("/user/:userId", async (req, res) => {
  try {
    const videos = await Video.find({ user: req.params.userId })
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

// Add a comment to a video
router.post("/comment/:videoId", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text required" });

    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

    video.comments.push({ user: req.userId, text: text.trim() });
    await video.save();
    await video.populate("comments.user", "name profilePicture");

    res.status(201).json(video.comments[video.comments.length - 1]);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Increment view count
router.post("/view/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

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

// Delete a video (owner only) — also attempts to remove it from Cloudinary
router.delete("/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

    if (video.user.toString() !== req.userId) {
      return res.status(403).json({ message: "You can only delete your own videos" });
    }

    try {
      const match = video.url.match(/\/video\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
      if (match && match[1]) {
        await cloudinary.uploader.destroy(match[1], { resource_type: "video" });
      }
    } catch (cloudErr) {
      console.error("Cloudinary delete warning:", cloudErr.message);
    }

    await Video.findByIdAndDelete(req.params.videoId);

    res.json({ message: "Video deleted" });
  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single video (with populated user and comments)
router.get("/:videoId", async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId)
      .populate("user", "name profilePicture")
      .populate("comments.user", "name profilePicture")
      .lean();

    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(video);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;