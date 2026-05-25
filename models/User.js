const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  gender:      { type: String, index: true },
  interest:    { type: String, index: true },
  profilePicture: { type: String },
  bio:         { type: String, maxlength: 500 },
  likes:       [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  matches:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

// Compound index for faster matching queries
userSchema.index({ gender: 1, interest: 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);