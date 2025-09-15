// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true // prevent duplicate usernames
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["buyer", "seller","both"], // allowed roles
    required: true
  },
});

module.exports = mongoose.model("User", userSchema);
