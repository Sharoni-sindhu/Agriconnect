const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  location: String,
  summary: String,
  products: String,
  fpo: String,
  cert: String,
  payment: String,
  languages: String,
  contact: { type: String, required: true },
  image: String // we can store base64 or file path
});

module.exports = mongoose.model("Profile", profileSchema);