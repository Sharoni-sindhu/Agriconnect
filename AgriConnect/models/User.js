const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["buyer", "seller"], required: true },
  securityQuestion: { type: String, required: true },
  securityAnswer: { type: String, required: true },
});

module.exports = mongoose.model("User", userSchema);
