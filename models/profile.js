const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: String,
  role: String,
  location: String,
  summary: String,
  products: String,
  fpo: String,
  cert: String,
  payment: String,
  languages: String,
  contact: String,
  image: String
});

module.exports = mongoose.model("Profile", ProfileSchema);