const mongoose = require("mongoose");

// Direct (one-to-one) messages. Now also supports photos, videos, documents and shared locations.
const messageSchema = new mongoose.Schema({
  sender:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:     { type: String, default: "" },                 // message text, or the caption of a photo/video/document
  kind:     { type: String, enum: ["text", "image", "video", "audio", "document", "location", "call"], default: "text" },
  attachment: {
    url: String, name: String, size: Number, mime: String, duration: Number
  },
  location: { lat: Number, lng: Number },
  read:     { type: Boolean, default: false },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedForEveryone: { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
