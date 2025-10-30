// server.js (merged, runs on port 3001)
// Combined from both versions provided. All routes/features preserved.

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Models
const User = require("./models/User.js");
const Product = require("./models/Product.js");
console.log("✅ Product model loaded:", typeof Product.find); // debug to confirm model loaded

// ---------- APP / SERVER SETUP ----------
const app = express();
const PORT = 3001; // confirmed by you
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ---------- SOCKET.IO CHAT ----------
let users = {};

io.on("connection", (socket) => {
  socket.on("register", (username) => {
    users[socket.id] = username;
    io.emit("userList", Object.values(users));
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

// ---------- UPLOADS FOLDER ----------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📂 Created uploads folder");
}

// ---------- MULTER ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ---------- MIDDLEWARE ----------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));
app.use(express.json());

// CORS - include one configuration (both your versions included similar)
app.use(cors({
  origin: "http://localhost:3001", // frontend origin you used
  credentials: true
}));

// ---------- SESSION SETUP ----------
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

// ---------- MONGODB ----------
mongoose
  .connect("mongodb://127.0.0.1:27017/greenfields", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error:", err));

// ---------- AUTH MIDDLEWARE ----------
function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized. Please login first.");
  }
  next();
}

// ---------- ORDER SCHEMA ----------
const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  productName: String,
  sellerName: String,
  sellerEmail: String,
  sellerPhone: String,
  action: String,
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model("Order", orderSchema);

// ---------- ROUTES ----------

// --- Signup (both variants preserved by accepting optional fields) ---
app.post("/signup", async (req, res) => {
  try {
    // accept both payload styles: with or without security fields
    const { username, password, role, securityQuestion, securityAnswer } = req.body;

    if (!username || !password || !role) {
      return res.json({ success: false, message: "⚠️ All fields required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: "⚠️ User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Build new user object conditionally including security fields if provided
    const newUserObj = { username, password: hashedPassword, role };
    if (securityQuestion) newUserObj.securityQuestion = securityQuestion;
    if (securityAnswer) newUserObj.securityAnswer = securityAnswer;

    const newUser = new User(newUserObj);
    await newUser.save();

    console.log("✅ User registered:", newUser.username, newUser.role ? ("- " + newUser.role) : "");
    res.json({ success: true, message: "Signup successful!" });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Login ---
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "❌ User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "❌ Invalid password" });

    req.session.userId = user._id;
    req.session.userName = user.username;
    req.session.role = user.role;

    console.log("✅ Logged in:", user.username);
    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Login error" });
  }
});

// --- Logout ---
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// --- Session user (API) ---
app.get("/session-user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName, role: req.session.role });
  } else {
    res.json({ loggedIn: false });
  }
});

// --- API user (alternate endpoint preserved) ---
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

// --- Password recovery (both endpoints preserved) ---
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

// --- Profile ---
app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("username role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ name: user.username, role: user.role });
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Add Product (both variants: /add-product and /products POST preserved) ---
app.post("/add-product", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    const { name, price, quantity, description, phone, contactEmail, category } = req.body;

    if (!name || !price || !quantity || !phone || !contactEmail) {
      return res.status(400).json({ success: false, message: "⚠️ All required fields must be filled" });
    }

    let formattedCategory = category || "Others";
    formattedCategory = formattedCategory.charAt(0).toUpperCase() + formattedCategory.slice(1).toLowerCase();

    const newProduct = new Product({
      name,
      price,
      quantity,
      description,
      category: formattedCategory,
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

// Keep legacy /products POST route (slightly different shape in earlier version)
app.post("/products", isAuthenticated, upload.single("image"), async (req, res) => {
  try {
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      farmer: req.session.userId
    });

    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("❌ Error saving product (products route):", err);
    res.status(500).json({ error: "Failed to save product" });
  }
});

// --- Get Products (public) ---
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("farmer", "username role");
    const formatted = products.map(p => ({
      id: p._id,
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      description: p.description,
      category: p.category,
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

// --- Delete product ---
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

// --- My Products (for logged in farmer) ---
app.get("/my-products", isAuthenticated, async (req, res) => {
  try {
    const products = await Product.find({ farmer: req.session.userId }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Error fetching farmer products:", err);
    res.status(500).json({ error: "Failed to fetch farmer products" });
  }
});

// --- Orders: save order ---
app.post("/orders", isAuthenticated, async (req, res) => {
  try {
    const { productName, sellerName, sellerEmail, sellerPhone, action } = req.body;

    const order = new Order({
      buyer: req.session.userId,
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

// --- Orders: get orders for logged-in buyer (simple version) ---

app.get("/orders", isAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.session.userId })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});




// --- Test route ---
app.get("/test", (req, res) => {
  res.json({ message: "Server is working ✅" });
});

// ---------- START SERVER ----------
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
