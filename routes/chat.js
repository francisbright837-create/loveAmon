const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const User = require("../models/User");
const { uploadChatFile, kindOfFile, fixName } = require("../config/chatUpload");

const router = express.Router();
const MAX_GROUP_MEMBERS = 50;

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id)) && String(id).length === 24;
const cleanCaption = (t) => (typeof t === "string" ? t.trim().slice(0, 1000) : "");
const cleanName = (t) => (typeof t === "string" ? t.replace(/[<>]/g, "").trim().slice(0, 40) : "");

function readLocation(body) {
  const ok = (v) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));
  if (!body || !ok(body.lat) || !ok(body.lng)) return null;
  const lat = Number(body.lat), lng = Number(body.lng);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

// Cloudinary result -> what we store on the message
function attachmentFrom(file, body) {
  const secs = Math.round(Number(body && body.duration));
  return {
    url: file.path,
    name: fixName(file.originalname).slice(0, 120),
    size: file.size || 0,
    mime: (file.mimetype || "").split(";")[0],
    duration: Number.isFinite(secs) ? Math.min(600, Math.max(0, secs)) : 0    // voice message length in seconds
  };
}

// runs the upload and answers with a clear JSON error (never an HTML page) if it fails
function handleUpload(req, res, next) {
  uploadChatFile.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 50 MB)" : (err.message || "Upload failed");
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file received" });
    next();
  });
}

// hides the contents of messages that were deleted for everyone
function shape(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  if (obj.deletedForEveryone) {
    obj.text = "🚫 This message was deleted";
    obj.kind = "text";
    delete obj.attachment;
    delete obj.location;
  }
  return obj;
}

function previewOf(msg) {
  if (!msg) return "";
  if (msg.deletedForEveryone) return "🚫 This message was deleted";
  if (msg.kind === "image") return "📷 Photo";
  if (msg.kind === "video") return "🎥 Video";
  if (msg.kind === "audio") return "🎤 Voice message";
  if (msg.kind === "call") return msg.text || "📞 Call";
  if (msg.kind === "document") return "📄 " + ((msg.attachment && msg.attachment.name) || "Document");
  if (msg.kind === "location") return "📍 Location";
  return msg.text || "";
}

// ======================= DIRECT CHAT: files + location =======================

async function checkDirectTarget(req, res) {
  const { userId } = req.params;
  if (!isId(userId)) { res.status(400).json({ message: "Invalid user" }); return null; }
  if (userId === req.userId) { res.status(400).json({ message: "You cannot message yourself" }); return null; }
  const target = await User.findById(userId).select("_id");
  if (!target) { res.status(404).json({ message: "User not found" }); return null; }
  return target;
}

router.post("/direct/:userId/attachment", handleUpload, async (req, res) => {
  try {
    if (!(await checkDirectTarget(req, res))) return;
    const message = new Message({
      sender: req.userId,
      receiver: req.params.userId,
      kind: kindOfFile(req.file),
      text: cleanCaption(req.body.text),
      attachment: attachmentFrom(req.file, req.body)
    });
    await message.save();
    await message.populate("sender", "name profilePicture");
    res.status(201).json(shape(message));
  } catch (err) {
    console.error("Direct attachment error:", err);
    res.status(500).json({ message: "Could not send file" });
  }
});

router.post("/direct/:userId/location", async (req, res) => {
  try {
    const location = readLocation(req.body);
    if (!location) return res.status(400).json({ message: "Invalid location" });
    if (!(await checkDirectTarget(req, res))) return;
    const message = new Message({ sender: req.userId, receiver: req.params.userId, kind: "location", location });
    await message.save();
    await message.populate("sender", "name profilePicture");
    res.status(201).json(shape(message));
  } catch (err) {
    console.error("Direct location error:", err);
    res.status(500).json({ message: "Could not share location" });
  }
});

// ======================= GROUPS =======================

// loads the group and makes sure the logged-in user is a member (otherwise answers with an error)
async function myGroup(req, res) {
  if (!isId(req.params.id)) { res.status(400).json({ message: "Invalid group" }); return null; }
  const group = await Group.findById(req.params.id);
  if (!group) { res.status(404).json({ message: "Group not found" }); return null; }
  if (!group.members.some((m) => m.toString() === req.userId)) {
    res.status(403).json({ message: "You are not in this group" });
    return null;
  }
  return group;
}

// validates a list of user ids and returns the ones that really exist
async function existingUserIds(list) {
  const ids = [...new Set((Array.isArray(list) ? list : []).map(String).filter(isId))];
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } }).select("_id").lean();
  return users.map((u) => u._id.toString());
}

// create a group
router.post("/groups", async (req, res) => {
  try {
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ message: "Give the group a name" });

    const others = (await existingUserIds(req.body.members)).filter((id) => id !== req.userId);
    if (!others.length) return res.status(400).json({ message: "Pick at least one friend to add" });
    if (others.length + 1 > MAX_GROUP_MEMBERS) {
      return res.status(400).json({ message: "A group can have up to " + MAX_GROUP_MEMBERS + " people" });
    }

    const group = await Group.create({ name, admin: req.userId, members: [req.userId, ...others] });
    res.status(201).json({ _id: group._id, name: group.name, membersCount: group.members.length });
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ message: "Could not create the group" });
  }
});

// my groups, with the last message of each
router.get("/groups", async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId }).sort({ updatedAt: -1 }).limit(50).lean();
    const result = await Promise.all(groups.map(async (g) => {
      const last = await GroupMessage.findOne({ group: g._id, deletedFor: { $ne: req.userId } })
        .sort({ createdAt: -1 }).populate("sender", "name").lean();
      return {
        _id: g._id,
        name: g.name,
        membersCount: g.members.length,
        lastMessage: last ? ((last.sender && last.sender.name ? last.sender.name + ": " : "") + previewOf(last)) : "No messages yet",
        lastMessageAt: last ? last.createdAt : g.createdAt
      };
    }));
    result.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    res.json(result);
  } catch (err) {
    console.error("List groups error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// group details + members
router.get("/groups/:id", async (req, res) => {
  try {
    const group = await myGroup(req, res);
    if (!group) return;
    await group.populate("members", "name profilePicture");
    res.json({
      _id: group._id,
      name: group.name,
      admin: group.admin,
      members: group.members.map((m) => ({ _id: m._id, name: m.name, profilePicture: m.profilePicture }))
    });
  } catch (err) {
    console.error("Group details error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// group messages
router.get("/groups/:id/messages", async (req, res) => {
  try {
    const group = await myGroup(req, res);
    if (!group) return;
    const messages = await GroupMessage.find({ group: group._id, deletedFor: { $ne: req.userId } })
      .sort({ createdAt: -1 })
      .limit(300)
      .populate("sender", "name profilePicture");
    res.json(messages.reverse().map(shape));
  } catch (err) {
    console.error("Group messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

async function saveGroupMessage(req, res, fields) {
  const group = await myGroup(req, res);
  if (!group) return;
  const message = new GroupMessage({ group: group._id, sender: req.userId, ...fields });
  await message.save();
  await message.populate("sender", "name profilePicture");
  Group.updateOne({ _id: group._id }, { $set: { updatedAt: new Date() } }).catch(() => {});
  res.status(201).json(shape(message));
}

router.post("/groups/:id/messages", async (req, res) => {
  try {
    const text = cleanCaption(req.body.text);
    if (!text) return res.status(400).json({ message: "Message text required" });
    await saveGroupMessage(req, res, { kind: "text", text });
  } catch (err) {
    console.error("Group send error:", err);
    res.status(500).json({ message: "Could not send message" });
  }
});

router.post("/groups/:id/attachment", handleUpload, async (req, res) => {
  try {
    await saveGroupMessage(req, res, {
      kind: kindOfFile(req.file), text: cleanCaption(req.body.text), attachment: attachmentFrom(req.file, req.body)
    });
  } catch (err) {
    console.error("Group attachment error:", err);
    res.status(500).json({ message: "Could not send file" });
  }
});

router.post("/groups/:id/location", async (req, res) => {
  try {
    const location = readLocation(req.body);
    if (!location) return res.status(400).json({ message: "Invalid location" });
    await saveGroupMessage(req, res, { kind: "location", location });
  } catch (err) {
    console.error("Group location error:", err);
    res.status(500).json({ message: "Could not share location" });
  }
});

// delete a group message: mode "me" (only my view) or "everyone" (sender only)
router.delete("/groups/:id/messages/:messageId", async (req, res) => {
  try {
    const group = await myGroup(req, res);
    if (!group) return;
    if (!isId(req.params.messageId)) return res.status(400).json({ message: "Invalid message" });
    const msg = await GroupMessage.findOne({ _id: req.params.messageId, group: group._id });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (req.query.mode === "everyone") {
      if (msg.sender.toString() !== req.userId) {
        return res.status(403).json({ message: "You can only delete messages you sent" });
      }
      msg.deletedForEveryone = true;
    } else if (!msg.deletedFor.some((id) => id.toString() === req.userId)) {
      msg.deletedFor.push(req.userId);
    }
    await msg.save();
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("Delete group message error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// add people to a group (any member can)
router.post("/groups/:id/members", async (req, res) => {
  try {
    const group = await myGroup(req, res);
    if (!group) return;
    const current = new Set(group.members.map((m) => m.toString()));
    const toAdd = (await existingUserIds(req.body.members)).filter((id) => !current.has(id));
    if (!toAdd.length) return res.status(400).json({ message: "Nobody new to add" });
    if (current.size + toAdd.length > MAX_GROUP_MEMBERS) {
      return res.status(400).json({ message: "A group can have up to " + MAX_GROUP_MEMBERS + " people" });
    }
    group.members.push(...toAdd);
    await group.save();
    res.json({ membersCount: group.members.length });
  } catch (err) {
    console.error("Add members error:", err);
    res.status(500).json({ message: "Could not add people" });
  }
});

// leave a group (if the admin leaves, the next member becomes admin; an empty group is deleted)
router.delete("/groups/:id/leave", async (req, res) => {
  try {
    const group = await myGroup(req, res);
    if (!group) return;
    group.members = group.members.filter((m) => m.toString() !== req.userId);
    if (!group.members.length) {
      await GroupMessage.deleteMany({ group: group._id });
      await Group.deleteOne({ _id: group._id });
      return res.json({ message: "You left the group" });
    }
    if (group.admin.toString() === req.userId) group.admin = group.members[0];
    await group.save();
    res.json({ message: "You left the group" });
  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ message: "Could not leave the group" });
  }
});

module.exports = router;
