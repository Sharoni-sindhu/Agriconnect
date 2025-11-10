const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// 🛒 Consumer places order
router.post("/place-order", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "consumer") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { productId, quantity } = req.body;
    const buyer = await User.findById(req.session.user.id);
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalAmount = product.price * quantity;

    // ✅ Save order
    const order = new Order({
      buyerId: buyer._id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone || "N/A",
      buyerAddress: buyer.address || "N/A",

      productId: product._id,
      productName: product.name,
      quantity,
      totalAmount,
      farmerEmail: product.farmerEmail, // link to seller
    });

    await order.save();

    // Reduce product quantity
    product.quantity -= quantity;
    if (product.quantity < 0) product.quantity = 0;
    await product.save();

    res.status(201).json({ message: "Order placed successfully!", order });
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
