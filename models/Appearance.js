const mongoose = require("mongoose");

// How a player's character looks (boy/girl, clothes, pet ...). One document per user.
const appearanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  look: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model("Appearance", appearanceSchema);
