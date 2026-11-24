const express = require("express");
const Appearance = require("../models/Appearance");
const { cleanLook } = require("../public/look-catalog.js");

const router = express.Router();

// my saved look (null if I never chose one)
router.get("/", async (req, res) => {
  try {
    const a = await Appearance.findOne({ user: req.userId }).lean();
    res.json({ look: a ? cleanLook(a.look) : null });
  } catch (err) {
    console.error("Get appearance error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// save my look. Whatever is sent is checked against the list of real options first.
router.put("/", async (req, res) => {
  try {
    const look = cleanLook(req.body && req.body.look);
    await Appearance.findOneAndUpdate({ user: req.userId }, { $set: { look } }, { upsert: true, new: true });
    res.json({ look });
  } catch (err) {
    console.error("Save appearance error:", err);
    res.status(500).json({ message: "Could not save your style" });
  }
});

module.exports = router;
