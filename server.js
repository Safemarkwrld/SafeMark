const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

// -------------------- Cloudinary Config --------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(file, folder = "safemark", publicId) {
  if (!file || !file.buffer) return null;

  const opts = { folder };
  if (publicId) opts.public_id = publicId;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve({ url: result.secure_url, public_id: result.public_id });
    });

    const readStream = new Readable();
    readStream._read = () => {};
    readStream.push(file.buffer); // ✅ always file.buffer
    readStream.push(null);
    readStream.pipe(uploadStream);
  });
}


const app = express();

// -------------------- Middleware --------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// -------------------- MongoDB Schemas --------------------
const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  lastId: Number,
});
const Counter = mongoose.model("Counter", counterSchema);

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  passwordHash: String,
  verified: { type: Boolean, default: false },
  pending: { type: Boolean, default: false },
  profileIcon: { type: String, default: "" }, // ✅ store Cloudinary URL, not boolean
  role: { type: String, default: "user" },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const verificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  fullName: String, // ✅ fixed name (was fullname earlier)
  dob: String,
  address: String,
  email: String,
  phone: String,
  droppedPin: {
    lat: Number,
    lon: Number,
  },
  idFront: String,
  idBack: String,
  selfie: String,
  submittedAt: { type: Date, default: Date.now },
});
const Verification = mongoose.model("Verification", verificationSchema);

const itemSchema = new mongoose.Schema({
  productCode: { type: String, unique: true },
  ownerId: { type: String, required: true },
  name: String,
  description: String,
  price: Number,
  quantity: Number,
  createdAt: { type: Date, default: Date.now },
  images: [String], // ✅ Cloudinary URLs
  droppedPin: {
    lat: Number,
    lon: Number,
  },
});
const Item = mongoose.model("Item", itemSchema);

const cartItemSchema = new mongoose.Schema({
  productCode: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
});
const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [cartItemSchema],
});
const Cart = mongoose.model("Cart", cartSchema);

// -------------------- Checkout Schema --------------------
const checkoutSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sellers: [
    {
      sellerId: String,
      sellerDroppedPin: { lat: Number, lon: Number },
      items: [
        {
          productCode: String,
          name: String,
          updatedPrice: Number, // pulled from front-end
          quantity: Number,
        },
      ],
    },
  ],
  createdAt: { type: Date, default: Date.now },
});
const Checkout = mongoose.model("Checkout", checkoutSchema);

// -------------------- Payments Schema --------------------
const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // buyer (string ID, e.g., sm25mf3001)
  method: { type: String, enum: ["Binance Pay", "Card"], required: true },

  // client-side numbers (we'll also recompute later if you want tighter rules)
  originalTotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },

  // ✅ file path (Cloudinary URL)
  proofPath: { type: String, required: true },

  // workflow
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  adminNote: { type: String, default: "" },
  reviewedAt: { type: Date, default: null },
  reviewerId: { type: String, default: null }, // admin's userId

  // traceability
  checkoutSnapshot: {},
});
const Payment = mongoose.model("Payment", paymentSchema);

const orderSchema = new mongoose.Schema({
  buyerId: { type: String, required: true },
  checkoutSnapshot: {}, // copy of checkout at payment
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
  sellers: [
    {
      sellerId: String,
      sellerDroppedPin: { lat: Number, lon: Number },
      items: [
        {
          productCode: String,
          name: String,
          quantity: Number,
          price: Number,
          image: String,
        },
      ],
    },
  ],
  totalAmount: { type: Number, required: true },
  orderStatus: { type: Boolean, default: false }, // false = payment pending review
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

// -------------------- Utilities --------------------
async function getNextUserId() {
  let counter = await Counter.findOne({ name: "userId" });
  if (!counter) counter = new Counter({ name: "userId", lastId: 3000 });
  counter.lastId++;
  await counter.save();
  return `sm25mf${counter.lastId}`;
}

async function getNextProductCode() {
  let counter = await Counter.findOne({ name: "productCode" });
  if (!counter) counter = new Counter({ name: "productCode", lastId: 4719 });
  counter.lastId += 27;
  await counter.save();
  return `sm2k25mpitms${counter.lastId}`;
}

// -------------------- Middleware --------------------
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    if (req.originalUrl.endsWith(".html")) return res.redirect("/login.html");
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.role || req.session.role !== "admin") {
    return res.status(403).send("Admin only");
  }
  next();
}

// -------------------- File Uploads (Cloudinary + memory) --------------------
const uploadMemory = multer({ storage: multer.memoryStorage() });

// -------------------- Health Check --------------------
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// -------------------- Routes --------------------
// Public pages
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "landingpage.html"))
);
app.get("/login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);
app.get("/signup.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);
app.get("/verification.html", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "verification.html"))
);

// Protected pages
app.get("/profile.html", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "profile.html"))
);
app.get("/landingpage.html", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "landingpage.html"))
);
app.get("/admin-dashboard.html", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
);

// -------------------- Auth Routes --------------------
app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).send("Email already registered.");

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await getNextUserId();

    const newUser = new User({
      userId,
      firstName,
      lastName,
      email,
      passwordHash,
      role: "user",
    });
    await newUser.save();

    req.session.userId = newUser.userId;
    req.session.role = newUser.role;

    res.redirect("/verification.html");
  } catch (err) {
    console.error(err);
    res.status(500).send("Signup failed");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("Invalid credentials.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).send("Invalid credentials.");

    req.session.userId = user.userId;
    req.session.role = user.role;

    if (user.role === "admin") return res.redirect("/admin-dashboard.html");
    if (user.verified || user.pending) return res.redirect("/landingpage.html");
    return res.redirect("/verification.html");
  } catch (err) {
    console.error(err);
    res.status(500).send("Login failed");
  }
});

// File filter helper (used only for client-side validation if needed)
function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .jpg, .png, .pdf files are allowed!"));
  }
}

// -------------------- Verification Submit --------------------
app.post(
  "/verification/submit",
  uploadMemory.fields([
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { fullName, dob, address, email, phone, latitude, longitude } = req.body;

      if (!fullName || !dob || !address || !email || !phone || !latitude || !longitude) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not logged in" });
      }

      // South Africa bounds check
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lon) || lat < -35 || lat > -22 || lon < 16 || lon > 33) {
        return res.status(400).json({ error: "Latitude/Longitude must be within South Africa." });
      }

      // ✅ Upload files to Cloudinary
      const uploadToCloudinary = async (file, folder) => {
        if (!file) return null;
        const b64 = file.buffer.toString("base64");
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        const result = await cloudinary.uploader.upload(dataURI, { folder });
        return result.secure_url;
      };

      const idFrontUrl = await uploadToCloudinary(req.files["idFront"]?.[0], "verification");
      const idBackUrl = await uploadToCloudinary(req.files["idBack"]?.[0], "verification");
      const selfieUrl = await uploadToCloudinary(req.files["selfie"]?.[0], "verification");

      // Save or overwrite verification
      await Verification.findOneAndUpdate(
        { userId },
        {
          userId,
          fullName,
          dob,
          address,
          email,
          phone,
          droppedPin: { lat, lon },
          idFront: idFrontUrl,
          idBack: idBackUrl,
          selfie: selfieUrl,
          submittedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Update user status → pending
      await User.updateOne({ userId }, { $set: { verified: false, pending: true } });

      res.json({ success: true, message: "Verification submitted. Pending admin review." });
    } catch (err) {
      console.error("Verification error:", err);
      res.status(500).json({ error: "Server error." });
    }
  }
);

// -------------------- Admin Get Pending Verifications --------------------
app.get("/verification/pending", async (req, res) => {
  try {
    const pendingUsers = await Verification.find({}); // ✅ removed populate

    const users = await User.find({ pending: true });

    const merged = users.map(u => {
      const v = pendingUsers.find(v => v.userId.toString() === u.userId.toString());
      return {
        userId: u.userId,
        fullName: v?.fullName, // ✅ fixed field name
        email: u.email,
        idFront: v?.idFront,
        idBack: v?.idBack,
        selfie: v?.selfie,
      };
    });

    res.json(merged);
  } catch (err) {
    console.error("Fetch pending error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// -------------------- Admin Approve --------------------
app.post("/verification/approve/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await User.updateOne({ userId }, { $set: { verified: true, pending: false } });
    res.json({ success: true, message: "✅ User approved" });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// -------------------- Admin Reject --------------------
app.post("/verification/reject/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await User.updateOne({ userId }, { $set: { verified: false, pending: false } });
    res.json({ success: true, message: "❌ User rejected" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// -------------------- Helper: Safe Profile Icon --------------------
function safeProfileIcon(icon) {
  return icon && icon.trim() !== ""
    ? icon
    : "/default-avatar.png"; // ✅ served from public/
}

//=============Users' Profiles===============
app.get("/api/me", async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });

    const user = await User.findOne({ userId: req.session.userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    const verification = await Verification.findOne({ userId: user.userId });
    if (!verification || !verification.droppedPin) {
      return res.status(404).json({ error: "No buyer droppedPin found" });
    }

    res.json({
      userId: user.userId,
      email: user.email,
      droppedPin: verification.droppedPin,
      profileIcon: safeProfileIcon(user.profileIcon),
    });
  } catch (err) {
    console.error("Error in /api/me:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- Profile API --------------------
app.get("/api/profile", requireLogin, async (req, res) => {
  try {
    const user = await User.findOne(
      { userId: req.session.userId },
      "userId firstName lastName email role verified pending profileIcon createdAt"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const verification = await Verification.findOne(
      { userId: req.session.userId },
      "address"
    );

    res.json({
      ...user.toObject(),
      profileIcon: safeProfileIcon(user.profileIcon), // ✅ fallback
      address: verification ? verification.address : null,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ✅ Profile photo → Cloudinary
app.post("/api/profile-photo", requireLogin, uploadMemory.single("profilePhoto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Upload to Cloudinary
    const b64 = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: "profile" });

    await User.updateOne(
      { userId: req.session.userId },
      { $set: { profileIcon: result.secure_url } }
    );

    res.json({ message: "✅ Profile photo updated", url: result.secure_url });
  } catch (err) {
    console.error("Profile upload error:", err);
    res.status(500).json({ error: "Failed to upload profile photo" });
  }
});

app.get("/api/profile-photo/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).send("User not found");

    res.json({ url: safeProfileIcon(user.profileIcon) }); // ✅ fallback
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).send("Failed to fetch photo");
  }
});

app.delete("/api/profile-photo", requireLogin, async (req, res) => {
  try {
    await User.updateOne(
      { userId: req.session.userId },
      { $set: { profileIcon: "" } } // ✅ fallback will cover this
    );
    res.json({ message: "✅ Profile photo deleted" });
  } catch (err) {
    console.error("Profile delete error:", err);
    res.status(500).json({ error: "Failed to delete profile photo" });
  }
});

// -------------------- Public User Profile API --------------------
app.get("/api/users/:userId", async (req, res) => {
  try {
    const user = await User.findOne(
      { userId: req.params.userId },
      "userId firstName lastName email role verified pending profileIcon createdAt"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const verification = await Verification.findOne(
      { userId: req.params.userId },
      "address"
    );

    res.json({
      ...user.toObject(),
      profileIcon: safeProfileIcon(user.profileIcon), // ✅ fallback
      address: verification ? verification.address : null,
    });
  } catch (err) {
    console.error("Public profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// -------------------- Marketplace Routes --------------------
app.post("/items/add", requireLogin, uploadMemory.array("images", 5), async (req, res) => {
  try {
    const productCode = await getNextProductCode();

    // Fetch seller verification for droppedPin
    const verification = await Verification.findOne({ userId: req.session.userId });

    // ✅ Upload item images to Cloudinary (store only URLs)
    const uploadedImages = await Promise.all(
      (req.files || []).map(file => uploadToCloudinary(file.buffer, "items"))
    );

    const images = uploadedImages.filter(url => !!url); // make sure null/undefined are removed

    const newItem = new Item({
      productCode,
      ownerId: req.session.userId,
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
      images, // ✅ now array of strings (URLs only)
      droppedPin: verification?.droppedPin || null,
    });

    await newItem.save();
    res.redirect("/marketplace.html");
  } catch (err) {
    console.error("Add item error:", err);
    res.status(500).send("Failed to add item");
  }
});

app.get("/items/mine", requireLogin, async (req, res) => {
  try {
    const items = await Item.find({ ownerId: req.session.userId });
    const sanitized = items.map(i => ({
      ...i.toObject(),
      images: i.images
    }));
    res.json(sanitized);
  } catch (err) {
    console.error("Get items error:", err);
    res.status(500).json({ error: "Failed to fetch seller items" });
  }
});

app.delete("/items/:id", requireLogin, async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, ownerId: req.session.userId });
    if (!item) return res.status(404).send("Item not found or not authorized");

    // ⚠ Skip Cloudinary destroy since we only stored URLs
    await item.deleteOne();

    res.send("✅ Item deleted");
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).send("Failed to delete item");
  }
});

app.get("/items/search", requireLogin, async (req, res) => {
  try {
    const code = req.query.code?.trim();
    if (!code) return res.status(400).send("Product code is required");

    const items = await Item.find({ productCode: code });

    const itemsWithSeller = await Promise.all(
      items.map(async item => {
        const seller = await User.findOne({ userId: item.ownerId }, "firstName lastName");
        return {
          ...item.toObject(),
          images: item.images,
          seller: seller
            ? { userId: item.ownerId, firstName: seller.firstName, lastName: seller.lastName }
            : null,
        };
      })
    );

    res.json(itemsWithSeller);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Search failed");
  }
});

// -------------------- Cart Routes --------------------
app.get("/api/cart", requireLogin, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.session.userId });
    if (!cart || cart.items.length === 0) return res.json([]);

    const detailedItems = await Promise.all(
      cart.items.map(async cartItem => {
        const product = await Item.findOne({ productCode: cartItem.productCode });
        if (!product) return null;

        const seller = await User.findOne(
          { userId: product.ownerId },
          "userId firstName lastName profileIcon"
        );

        return {
          productCode: product.productCode,
          name: product.name,
          description: product.description,
          price: product.price,
          images: product.images,
          quantity: cartItem.quantity,
          seller: seller
            ? {
                userId: seller.userId,
                firstName: seller.firstName,
                lastName: seller.lastName,
                profileIcon: seller.profileIcon,
              }
            : null,
          droppedPin: product.droppedPin || null,
        };
      })
    );

    res.json(detailedItems.filter(Boolean));
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

// ADD TO CART
app.post("/api/cart/add", requireLogin, async (req, res) => {
  try {
    const { productCode, quantity = 1 } = req.body;
    let cart = await Cart.findOne({ userId: req.session.userId });

    if (!cart) {
      cart = new Cart({ userId: req.session.userId, items: [] });
    }

    const existing = cart.items.find(i => i.productCode === productCode);
    if (existing) {
      existing.quantity += Number(quantity);
    } else {
      cart.items.push({ productCode, quantity: Number(quantity) });
    }

    await cart.save();
    res.json({ message: "✅ Item added to cart" });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// REMOVE FROM CART
app.post("/api/cart/remove", requireLogin, async (req, res) => {
  try {
    const { productCode } = req.body;
    if (!productCode) return res.status(400).json({ error: "productCode is required" });

    const cart = await Cart.findOne({ userId: req.session.userId });
    if (!cart) return res.json({ message: "Cart is already empty" });

    cart.items = cart.items.filter(i => i.productCode !== productCode);
    await cart.save();

    res.json({ message: "✅ Item removed from cart" });
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// CLEAR CART
app.post("/api/cart/clear", requireLogin, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.session.userId },
      { $set: { items: [] } },
      { upsert: true }
    );
    res.json({ message: "✅ Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

// GET CART ITEMS
app.get("/api/cart/get", requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) return res.json([]);

    const detailedItems = await Promise.all(
      cart.items.map(async cartItem => {
        const product = await Item.findOne({ productCode: cartItem.productCode });
        if (!product) return null;

        return {
          productCode: product.productCode,
          name: product.name,
          price: product.price,
          quantity: cartItem.quantity,
          images: product.images,
          seller: {
            userId: product.ownerId,
            droppedPin: product.droppedPin || null,
          },
        };
      })
    );

    res.json(detailedItems.filter(Boolean));
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

// -------------------- Seller Verification --------------------
const router = express.Router();

router.get("/api/users/:userId/verification", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const verification = await Verification.findOne({ userId }).lean();
    if (!verification) return res.status(404).json({ error: "Verification not found" });

    res.json({
      address: verification.address || "",
      fullName: verification.fullName || "",
    });
  } catch (err) {
    console.error("Verification fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- Checkout Routes --------------------
const checkoutRouter = express.Router();

// 1️⃣ Proceed to checkout → create record
checkoutRouter.post("/create", requireLogin, async (req, res) => {
  try {
    const { sellers } = req.body; // array of { sellerId, items }

    if (!sellers?.length) return res.status(400).json({ message: "Empty checkout" });

    // Populate sellerDroppedPin from DB if missing
    for (const s of sellers) {
      if (!s.sellerDroppedPin) {
        const item = await Item.findOne({ ownerId: s.sellerId });
        s.sellerDroppedPin = item?.droppedPin || null;
      }
    }

    await Checkout.deleteOne({ userId: req.session.userId });

    const newCheckout = new Checkout({
      userId: req.session.userId,
      sellers,
    });

    await newCheckout.save();
    res.json({ success: true, checkout: newCheckout });
  } catch (err) {
    res.status(500).json({ message: "Error creating checkout", error: err.message });
  }
});

// 2️⃣ Get current checkout (with item images & ensured seller pin)
checkoutRouter.get("/get", requireLogin, async (req, res) => {
  try {
    const checkoutDoc = await Checkout.findOne({ userId: req.session.userId }).lean();
    if (!checkoutDoc) {
      return res.status(404).json({ success: false, message: "No active checkout" });
    }

    // enrich sellers + items
    const sellers = await Promise.all(
      (checkoutDoc.sellers || []).map(async (s) => {
        let sellerDroppedPin = s.sellerDroppedPin || null;
        if (!sellerDroppedPin) {
          const anyItem = await Item.findOne({ ownerId: s.sellerId }, "droppedPin").lean();
          sellerDroppedPin = anyItem?.droppedPin || null;
        }

        const items = await Promise.all(
          (s.items || []).map(async (it) => {
            const prod = await Item.findOne({ productCode: it.productCode }, "images price name").lean();
            return {
              productCode: it.productCode,
              name: it.name ?? prod?.name ?? "",
              quantity: it.quantity,
              updatedPrice:
                typeof it.updatedPrice === "number" ? it.updatedPrice : (typeof prod?.price === "number" ? prod.price : 0),
              image: prod?.images?.[0] || null,
            };
          })
        );

        return {
          sellerId: s.sellerId,
          sellerDroppedPin,
          items,
        };
      })
    );

    return res.json({
      success: true,
      checkout: {
        ...checkoutDoc,
        sellers,
      },
    });
  } catch (err) {
    console.error("Error fetching checkout:", err);
    res.status(500).json({ success: false, message: "Error fetching checkout", error: err.message });
  }
});

// 3️⃣ Cancel / back → delete record
checkoutRouter.delete("/cancel", requireLogin, async (req, res) => {
  try {
    await Checkout.deleteOne({ userId: req.session.userId });
    res.json({ success: true, message: "Checkout cancelled" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error cancelling checkout", error: err.message });
  }
});

// 4️⃣ Finalize order (future extension)
checkoutRouter.post("/finalize", requireLogin, async (req, res) => {
  try {
    const checkout = await Checkout.findOne({ userId: req.session.userId });
    if (!checkout) return res.status(404).json({ success: false, message: "No active checkout" });

    // TODO: Move checkout → Orders DB here

    await Checkout.deleteOne({ userId: req.session.userId }); // kill checkout after finalization
    res.json({ success: true, message: "Order placed" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error finalizing checkout", error: err.message });
  }
});

// -------------------- Payment Proof Upload --------------------
const uploadProofToCloudinary = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const streamifier = require("streamifier");
    const stream = cloudinary.uploader.upload_stream({ folder: "payment_proofs" }, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });

app.post("/api/payments/upload-proof", requireLogin, uploadMemory.single("proof"), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { amount, method } = req.body;

    const checkout = await Checkout.findOne({ userId });
    if (!checkout) return res.status(400).json({ error: "No active checkout found" });

    let proofUrl = null;
    if (req.file) {
      proofUrl = await uploadProofToCloudinary(req.file.buffer);
    }

    const payment = new Payment({
      userId,
      method,
      originalTotal: Number(amount),
      discount: Number(amount) * 0.15,
      finalAmount: Number(amount) * 0.85,
      proofPath: proofUrl,
      checkoutSnapshot: checkout.toObject(),
      status: "pending",
    });
    await payment.save();

    const order = new Order({
      buyerId: userId,
      paymentId: payment._id,
      checkoutSnapshot: checkout.toObject(),
      sellers: checkout.sellers.map((s) => ({
        sellerId: s.sellerId,
        sellerDroppedPin: s.sellerDroppedPin,
        items: s.items.map((it) => ({
          productCode: it.productCode,
          name: it.name,
          quantity: it.quantity,
          price: it.updatedPrice || it.price,
          image: it.image || "",
        })),
      })),
      totalAmount: Number(amount),
      orderStatus: false,
    });
    await order.save();

    await Checkout.deleteOne({ userId });

    return res.json({ success: true, message: "Payment proof uploaded. Order pending approval." });
  } catch (err) {
    console.error("Payment proof error:", err);
    return res.status(500).json({ error: "Server error uploading payment proof" });
  }
});

// -------------------- Get My Orders --------------------
app.get("/api/orders/my", requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const order = await Order.findOne({ buyerId: userId }).sort({ createdAt: -1 }).populate("paymentId");

    if (!order) return res.json({ success: false, order: null });

    return res.json({ success: true, order });
  } catch (err) {
    console.error("Fetch my order error:", err);
    return res.status(500).json({ success: false, error: "Server error fetching order" });
  }
});

// -------------------- Get Checkout --------------------
app.get("/api/checkout/get", requireLogin, async (req, res) => {
  try {
    const checkout = await Checkout.findOne({ userId: req.session.userId });
    if (!checkout) return res.status(404).json({ error: "No active checkout found" });

    res.json({ success: true, checkout });
  } catch (err) {
    console.error("Checkout fetch error:", err);
    res.status(500).json({ error: "Server error fetching checkout" });
  }
});

app.use("/api/checkout", checkoutRouter);

// -------------------- Server Start --------------------
async function startServer(app) {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    const PORT = process.env.PORT || 3000;

    if (!MONGO_URI) throw new Error("❌ MONGODB_URI is not defined in .env file");

    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`✅ MongoDB Connected`);

    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

module.exports = startServer;
startServer(app);