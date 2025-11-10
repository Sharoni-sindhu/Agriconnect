const express = require("express");
const router = express.Router();
const fetch = require("node-fetch"); // Correct import

router.post("/recommend-crop", async (req, res) => {
  try {
    const { soil_type, season, place } = req.body;

    if (!soil_type || !season || !place) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const response = await fetch("http://127.0.0.1:5001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soil_type, season, place }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Flask API Error:", data.error);
      return res.status(500).json({ success: false, message: data.error });
    }

    res.json({ success: true, recommended_crop: data.recommended_crop });
  } catch (error) {
    console.error("Error communicating with Flask API:", error.message);
    res.status(500).json({ success: false, message: "Error connecting to Flask API", error: error.message });
  }
});

module.exports = router;
