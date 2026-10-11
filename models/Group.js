const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 40 },
  admin:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

groupSchema.index({ members: 1, updatedAt: -1 });

module.exports = mongoose.model("Group", groupSchema);
