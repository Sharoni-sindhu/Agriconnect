const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: String,
  description: String,
  phone: String,          // ✅ Added
  contactEmail: String,   // ✅ Added
  image: String,
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Product", productSchema);
