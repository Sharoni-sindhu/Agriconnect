const express = require("express");
const Product = require("../models/Product"); // adjust path to your Product model
const router = express.Router();

// Delete product
router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "✅ Product deleted successfully", deleted });
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).json({ error: "Server error while deleting product" });
  }
});



app.get("/api/products/:lang", async (req, res) => {
  const lang = req.params.lang || 'en';
  const products = await Product.find();

  const translatedProducts = products.map(p => ({
    name: p.name[lang] || p.name.en,
    description: p.description[lang] || p.description.en,
    price: p.price
  }));
    
  res.json(translatedProducts);
});


module.exports = router;