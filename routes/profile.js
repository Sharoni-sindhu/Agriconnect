const express = require("express");
const router = express.Router();
const Profile = require("./models/Profile");

// GET profile
router.get("/", async (req, res) => {
  try {
    const profile = await Profile.findOne();
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST profile
router.post("/", async (req, res) => {
  try {
    let profile = await Profile.findOne();
    if (profile) {
      await Profile.updateOne({}, req.body);
    } else {
      profile = new Profile(req.body);
      await profile.save();
    }
    res.json({ success: true, message: "Profile saved!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;