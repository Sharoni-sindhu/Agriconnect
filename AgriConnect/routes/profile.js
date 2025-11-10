const express = require("express");
const router = express.Router();
const Profile = require("../models/Profile");

// 🟢 Save or update profile
router.post("/", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { username },
      { $set: req.body },
      { new: true, upsert: true } // create if not found
    );

    res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    console.error("❌ Error saving profile:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// 🟢 Get user profile
router.get("/:username", async (req, res) => {
  try {
    const profile = await Profile.findOne({ username: req.params.username });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);  // ✅ Always send JSON
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
