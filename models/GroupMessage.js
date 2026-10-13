const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({
  group:  { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:   { type: String, default: "" },
  kind:   { type: String, enum: ["text", "image", "video", "audio", "document", "location"], default: "text" },
  attachment: {
    url: String, name: String, size: Number, mime: String, duration: Number
  },
  location: { lat: Number, lng: Number },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedForEveryone: { type: Boolean, default: false }
}, { timestamps: true });

groupMessageSchema.index({ group: 1, createdAt: 1 });

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
