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


// Initialize app
const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins for now
    methods: ["GET", "POST"]
  }
});


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

// --------- Middleware ----------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.json({ success: false, message: "⚠️ All fields required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: "⚠️ User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();

    console.log("✅ User registered:", newUser.username, "-", newUser.role);

    res.json({ success: true, message: "Signup Successful!" });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ---------- LOGIN ----------
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


// ---------- AUTH MIDDLEWARE ----------
function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized. Please login first.");
  }
  next();
}

// ---------- GET SESSION USER ----------
app.get("/session-user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName, role: req.session.role });
  } else {
    res.json({ loggedIn: false });
  }
});

// ---------- LOGOUT ----------
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
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

// ---------- GET PRODUCTS ----------
app.get("/products", async (req, res) => {
  const products = await Product.find().populate("farmer", "username role");
  res.json(products);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
  