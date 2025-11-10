const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ not unique
  username: { type: String, required: true, unique: true },
  name: String,
  role: { type: String, required: true },
  location: String,
  summary: String,
  products: String,
  fpo: String,
  cert: String,
  payment: String,
  languages: String,
  contact: String,
  image: String,
}, { timestamps: true });

module.exports = mongoose.model("Profile", profileSchema);
