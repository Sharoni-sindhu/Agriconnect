// models/Product.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  description: String,
  phone: String,
  contactEmail: String,
  image: String,
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  category: String
}, { timestamps: true }); // ✅ adds createdAt and updatedAt automatically

module.exports = mongoose.model("Product", ProductSchema);