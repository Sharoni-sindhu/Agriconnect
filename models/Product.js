// models/Product.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  description: { type: String },
  phone: { type: String },
  contactEmail: { type: String },
  image: { type: String },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // ✅ Add this
});

module.exports = mongoose.model("Product", ProductSchema);
