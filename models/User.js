const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  gender:      String,
  interest:    String,
  profilePicture: { type: String },          // base64 for now
  bio:         { type: String, maxlength: 500 },
  likes:       [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  matches:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);