const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

// Get chat history with a specific user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate("sender", "name profilePicture");

    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Send a message
router.post("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { text } = req.body;
    const senderId = req.userId;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Message text required" });
    }

    const message = new Message({
      sender: senderId,
      receiver: userId,
      text: text.trim()
    });

    await message.save();

    // Populate sender info before sending back
    await message.populate("sender", "name profilePicture");

    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark messages as read
router.put("/read/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, read: false },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;