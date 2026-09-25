const express = require("express");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

// Get unread message count
router.get("/unread/count", async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.userId,
      read: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get list of all conversations
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
      deletedFor: { $ne: userId }
    }).sort({ createdAt: -1 }).lean();

    const conversationsMap = {};

    messages.forEach(msg => {
      const senderId = msg.sender.toString();
      const receiverId = msg.receiver.toString();
      const otherId = senderId === userId ? receiverId : senderId;

      if (!conversationsMap[otherId]) {
        conversationsMap[otherId] = {
          userId: otherId,
          lastMessage: msg.deletedForEveryone ? "🚫 This message was deleted" : msg.text,
          lastMessageAt: msg.createdAt,
          unreadCount: 0
        };
      }

      if (receiverId === userId && !msg.read) {
        conversationsMap[otherId].unreadCount++;
      }
    });

    const otherIds = Object.keys(conversationsMap);
    const users = await User.find({ _id: { $in: otherIds } })
      .select("name profilePicture")
      .lean();

    users.forEach(u => {
      const entry = conversationsMap[u._id.toString()];
      if (entry) {
        entry.name = u.name;
        entry.profilePicture = u.profilePicture;
      }
    });

    const conversations = Object.values(conversationsMap)
      .filter(c => c.name)
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.json(conversations);
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get chat history with a specific user
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      deletedFor: { $ne: currentUserId }
    })
    .sort({ createdAt: 1 })
    .populate("sender", "name profilePicture");

    const shaped = messages.map(m => {
      const obj = m.toObject();
      if (obj.deletedForEveryone) obj.text = "🚫 This message was deleted";
      return obj;
    });

    res.json(shaped);
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

// Delete a message — mode: "me" (only your view) or "everyone" (hides it for both, sender only)
router.delete("/:messageId", async (req, res) => {
  try {
    const { mode } = req.query;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ message: "You can only delete messages you sent" });
    }

    if (mode === "everyone") {
      message.deletedForEveryone = true;
      message.text = "";
    } else {
      if (!message.deletedFor.includes(req.userId)) {
        message.deletedFor.push(req.userId);
      }
    }

    await message.save();

    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;