const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

router.post("/recommend-crop", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:5001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Check for missing or invalid data
    if (!data.recommended_crop) {
      console.error("Flask response error:", data);
      return res.status(400).json({
        success: false,
        message: "Flask API did not return recommended_crop",
      });
    }

    res.json({ success: true, recommended_crop: data.recommended_crop });
  } catch (error) {
    console.error("Error communicating with Flask API:", error);
    res.status(500).json({
      success: false,
      message: "Error connecting to ML model",
      error: error.message,
    });
  }
});

module.exports = router;
