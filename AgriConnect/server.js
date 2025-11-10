// server.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const User = require("./models/User.js");
const Product = require("./models/Product.js");
const http = require("http");
const { Server } = require("socket.io");
const Profile = require("./models/Profile");
const dotenv = require("dotenv");
dotenv.config();
const Order = require("./models/Order");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// Initialize app
const app = express();
const PORT = 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins for now
    methods: ["GET", "POST"]
  }
});

const cropRoutes = require("./routes/cropRoutes");
app.use("/api", cropRoutes);


// Store online users
let users = {};

io.on("connection", (socket) => {
  socket.on("register", (username) => {
    users[socket.id] = username;
    io.emit("userList", Object.values(users)); // send updated list to all
  });

  socket.on("sendMessage", ({ from, to, message }) => {
    for (let id in users) {
      if (users[id] === to) {
        io.to(id).emit("receiveMessage", { from, message });
      }
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});


// --------- Ensure uploads folder exists ----------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📂 Created uploads folder");
}

// --------- Multer Setup (Image Upload) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const cors = require("cors");
app.use(cors({
  origin: "*", // or 3000 if your frontend runs there
  credentials: true,
}));


// --------- Middleware ----------
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));
app.use(express.json());

// --------- Session Setup ----------
app.use(
  session({
    secret: "mySecretKey123",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: "mongodb://127.0.0.1:27017/greenfields",
    }),
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);

// --------- MongoDB Connection ----------
mongoose
  .connect("mongodb://127.0.0.1:27017/greenfields", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

app.post("/signup", async (req, res) => {
  try {
    const { username, password, role, securityQuestion, securityAnswer } = req.body;

    if (!username || !password || !role || !securityQuestion || !securityAnswer) {
      return res.json({ success: false, message: "⚠️ All fields are required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: "⚠️ Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
      role,
      securityQuestion,
      securityAnswer
    });

    await newUser.save();
    console.log("✅ User registered:", username);

    res.json({ success: true, message: "Signup successful!" });
  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Save Order
app.post("/orders", isAuthenticated, async (req, res) => {
  try {
    const { productName, sellerName, sellerEmail, sellerPhone, action } = req.body;

    const order = new Order({
      buyer: req.session.userId,   // ✅ store logged-in buyer’s ID
      productName,
      sellerName,
      sellerEmail,
      sellerPhone,
      action
    });

    await order.save();
    res.status(201).json({ success: true, message: "Order saved!", order });
  } catch (err) {
    console.error("❌ Error saving order:", err);
    res.status(500).json({ success: false, error: "Failed to save order" });
  }
});

//const Order = require("./models/Order");

//const Order = mongoose.model("Order", orderSchema);

// ---------- LOGIN ----------
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "❌ User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "❌ Invalid password" });

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role ? user.role.toLowerCase() : "";  // ✅ Normalize
    await req.session.save();

    console.log("✅ Logged in:", user.username, "| Role:", req.session.role);
    res.json({ success: true, role: req.session.role });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Login error" });
  }
});


// ---------- AUTH MIDDLEWARE ----------
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
}


// ---------- GET SESSION USER ----------
app.get("/session-user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName, role: req.session.role });
  } else {
    res.json({ loggedIn: false });
  }
});

// Get all orders
app.get("/orders", isAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.session.userId })
      .populate("productId", "name price")
      .populate("sellerId", "username email phone")
      .sort({ createdAt: -1 });

    const formatted = orders.map(o => ({
      _id: o._id,
      productName: o.productId?.name || o.productName || "Unnamed Product",
      productPrice: o.productId?.price || o.productPrice || "N/A",
      sellerName: o.sellerId?.username || o.sellerName || "Unknown",
      sellerEmail: o.sellerId?.email || o.sellerEmail || "Not Provided",
      sellerPhone: o.sellerId?.phone || o.sellerPhone || "Not Provided",
      status: o.status || "Confirmed",
      createdAt: o.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});



app.post("/products", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      sellerId: req.session.userId ,
      farmer: req.session.userId   // ✅ logged-in farmer
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("❌ Error saving product:", err);
    res.status(500).json({ error: "Failed to save product" });
  }
});

// Example: backend/server.js
// ✅ FIXED: Return actual logged-in user info
app.get("/api/user", (req, res) => {
  if (req.session.userId) {
    res.json({
      success: true,
      username: req.session.userName,
      role: req.session.role,
    });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});
app.post("/recover-password", async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.securityAnswer !== securityAnswer) {
      return res.json({ success: false, message: "Incorrect security answer" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "✅ Password reset successful!" });
  } catch (err) {
    console.error("❌ Password recovery error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.get("/recover-question", async (req, res) => {
  const { username } = req.query;
  const user = await User.findOne({ username });

  if (!user) return res.json({ success: false, message: "User not found" });

  res.json({ success: true, question: getQuestionText(user.securityQuestion) });
});

function getQuestionText(key) {
  const questions = {
    pet: "What is your pet's name?",
    school: "What was your first school name?",
    mother: "What is your mother's maiden name?",
  };
  return questions[key] || "Security question";
}


// ---------- LOGOUT ----------
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});



// Get all farmers (role: "Farmer" or "Both")
app.get("/api/farmers", async (req, res) => {
  try {
    const farmers = await Profile.find({ role: { $in: ["Farmer", "Both"] } });
    const users = await User.find({}, "username email phone");
    const merged = farmers.map(f => {
      const user = users.find(u => u.username === f.username);
      return {
        ...f.toObject(),
        email: user?.email,
        phone: user?.phone
      };
    });
    res.json(merged);
  } catch (err) {
    console.error("Error fetching farmers:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// Get single farmer by ID
app.get("/api/farmers/:id", async (req, res) => {
  try {
    const farmer = await Profile.findById(req.params.id);
    if (!farmer) return res.status(404).json({ error: "Farmer not found" });
    res.json(farmer);
  } catch (err) {
    console.error("Error fetching farmer:", err);
    res.status(500).json({ error: "Server error while fetching farmer" });
  }
});




app.get("/my-products", isAuthenticated, async (req, res) => {
  try {
    const products = await Product.find({ farmer: req.session.userId })
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Error fetching farmer products:", err);
    res.status(500).json({ error: "Failed to fetch farmer products" });
  }
});

// Save or update a profile
app.post("/api/profile", async (req, res) => {
  try {
    const {
      username,
      role,
      name,
      location,
      summary,
      products,
      fpo,
      cert,
      payment,
      languages,
      contact,
      image,
    } = req.body;

    if (!username || !role) {
      return res.status(400).json({ error: "Username and role are required" });
    }

    let profile = await Profile.findOne({ username });

    if (profile) {
      Object.assign(profile, {
        role,
        name,
        location,
        summary,
        products,
        fpo,
        cert,
        payment,
        languages,
        contact,
        image,
      });
      await profile.save();
    } else {
      profile = new Profile({
        username,
        role,
        name,
        location,
        summary,
        products,
        fpo,
        cert,
        payment,
        languages,
        contact,
        image,
      });
      await profile.save();
    }

    console.log("✅ Profile saved:", profile.username);
    res.json({ message: "Profile saved successfully", profile });
  } catch (err) {
    console.error("❌ Error saving profile:", err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/place-order", isAuthenticated, async (req, res) => {
  try {
    const { productId, quantity, address, buyerName, buyerEmail, buyerPhone, paymentMode } = req.body;

    // Find product and its seller (farmer)
    const product = await Product.findById(productId).populate("farmer", "username email phone");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Create a new order
    const order = new Order({
      productId: product._id,
      productName: product.name,
      productPrice: product.price,
      sellerId: product.farmer?._id,
      sellerName: product.farmer?.username || "Unknown",
      sellerEmail: product.farmer?.email || "Not Provided",
      sellerPhone: product.farmer?.phone || "Not Provided",
      buyer: req.session.userId,
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerAddress: address,
      quantity,
      paymentMode,
      status: "Pending",
      createdAt: new Date(),
    });

    await order.save();

    console.log("✅ Order placed successfully:", order);
    res.json({ success: true, message: "Order placed successfully!" });
  } catch (error) {
    console.error("❌ Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ================== FETCH FARMER’S RECEIVED ORDERS ==================
// ✅ Fetch all orders belonging to the logged-in farmer
// ✅ Fetch orders for logged-in farmer
app.get("/api/farmer/orders", async (req, res) => {
  try {
    // Check session first
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
    }

    // Make role comparison case-insensitive
    const role = (req.session.role || "").toLowerCase();
    console.log("SESSION DEBUG:", req.session);

    if (!["farmer","seller", "both"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only farmers can view orders",
        role: req.session.role,
      });
    }

    // Now fetch orders
    const farmerId = req.session.userId;
    const orders = await Order.find({ sellerId: farmerId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders: orders.map(o => ({
        id: o._id,
        productName: o.productName,
        productPrice: o.productPrice,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        buyerPhone: o.buyerPhone,
        buyerAddress: o.buyerAddress,
        quantity: o.quantity,
        paymentMode: o.paymentMode,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error("❌ Error fetching farmer orders:", err);
    res.status(500).json({ success: false, message: "Failed to fetch farmer orders" });
  }
});


// Get profile for a specific user
app.get("/api/profile/:username", async (req, res) => {
  try {
    const profile = await Profile.findOne({ username: req.params.username });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/order", isAuthenticated, async (req, res) => {
  try {
    const { productId, buyerName, buyerEmail, buyerPhone, buyerAddress } = req.body;

    // Get product and its farmer (seller)
    const product = await Product.findById(productId).populate("farmer", "username email phone");
    if (!product) return res.status(404).json({ error: "Product not found" });

    const order = new Order({
      productId: product._id,
      productName: product.name,
      productPrice: product.price,
      sellerId: product.farmer?._id,
      sellerName: product.farmer?.username,
      sellerEmail: product.farmer?.email,
      sellerPhone: product.farmer?.phone,
      buyer: req.session.userId,
      buyerName,
      buyerEmail,
      buyerPhone,
      buyerAddress,
      status: "Pending",
    });

    await order.save();
    console.log("✅ Order saved:", order);
    res.json({ success: true, message: "✅ Order placed successfully!", order });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});


// ---------- ADD PRODUCT ----------
app.post("/add-product", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    const { name, price, quantity, description, phone, contactEmail } = req.body;

    if (!name || !price || !quantity || !phone || !contactEmail) {
      return res.status(400).json({ success: false, message: "⚠️ All required fields must be filled" });
    }

    const newProduct = new Product({
      name,
      price,
      quantity,
      description,
      phone,
      contactEmail,
      image: req.file ? "/uploads/" + req.file.filename : null,
      farmer: req.session.userId,
    });

    await newProduct.save();
    console.log("✅ New product added:", newProduct);
    res.json({ success: true, message: "✅ Product added successfully!" });
  } catch (err) {
    console.error("❌ Error saving product:", err);
    res.status(500).json({ success: false, message: "Error saving product" });
  }
});
app.get("/test", (req, res) => {
  res.json({ message: "Server is working ✅" });
});

// ---------- GET PRODUCTS ----------
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("farmer", "username role");
    const formatted = products.map(p => ({
      id: p._id,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      description: p.description,
      image: p.image,
      sellerName: p.farmer?.username || "Unknown",
      sellerEmail: p.contactEmail || "Not Provided",
      sellerPhone: p.phone || "Not Provided"
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
app.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/recommend-crops", async (req, res) => {
  const { soilType, season, region } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Recommend the best 3 crops for a farmer based on:
      - Soil type: ${soilType}
      - Season: ${season}
      - Region: ${region}
      Give short explanations for each crop.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ recommendations: text });
  } catch (error) {
    console.error("Gemini recommendation error:", error);
    res.status(500).json({ error: "Failed to fetch crop recommendations" });
  }
});

const recommendRoutes = require("./routes/recommendRoutes");
app.use("/api", recommendRoutes);


// ✅ Update order status to "Confirmed"
app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status: status || "Confirmed" },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ---------- START SERVER ----------
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});  