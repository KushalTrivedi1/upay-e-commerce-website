const express = require('express');
const cors = require('cors');
// --- NEW: Added for MongoDB ---
const mongoose = require('mongoose');
require('dotenv').config();

// --- NEW: Added for Razorpay ---
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors()); // CORS is enabled right here!

// --- UPDATED FOR IMAGE UPLOADS: JSON payload limit set to 15mb ---
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// --- NEW: RAZORPAY INSTANCE INITIALIZATION ---
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET',
});

// --- NEW: MONGODB CONNECTION & SCHEMAS ---
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ UPAY Database Connected Successfully");
    
    // --- FIX: Ensure default users exist individually, even if DB is not empty ---
    try {
      if (!(await User.findOne({ email: "admin@upay.com" }))) {
        await User.create({ name: "Admin", phone: "0000000000", email: "admin@upay.com", password: "123", role: "admin", impactPoints: 0 });
      }
      if (!(await User.findOne({ email: "vendor@upay.com" }))) {
        await User.create({ name: "Vendor One", phone: "2222222222", email: "vendor@upay.com", password: "123", role: "vendor", impactPoints: 0 });
      }
      if (!(await User.findOne({ email: "vendor2@upay.com" }))) {
        await User.create({ name: "Vendor Two", phone: "3333333333", email: "vendor2@upay.com", password: "123", role: "vendor", impactPoints: 0 });
      }
      if (!(await User.findOne({ email: "customer@gmail.com" }))) {
        await User.create({ name: "Customer", phone: "1111111111", email: "customer@gmail.com", password: "123", role: "customer", impactPoints: 2400 });
      }
    } catch (err) {
      console.log("Error verifying default users:", err);
    }
  })
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

const productSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  category: String,
  img: String,
  description: String,
  tag: String,
  subCategory: String, 
  inStock: { type: Boolean, default: true }, 
  vendor: { type: String, default: 'admin@upay.com' },
  deliveryDays: String 
});
const Product = mongoose.model('Product', productSchema);

const querySchema = new mongoose.Schema({
  id: Number,
  name: String,
  email: String,
  subject: String,
  message: String,
  date: String,
  vendorEmail: String,
  status: { type: String, default: 'Pending' } // <-- NEW: Added status for queries
});
const Query = mongoose.model('Query', querySchema);

const orderSchema = new mongoose.Schema({
  id: String,
  date: String,
  customer: String,
  total: Number,
  status: String,
  items: String,
  vendors: [{ type: String }],
  paymentMethod: { type: String, default: 'COD' } // <-- NEW: Added payment method
});
const Order = mongoose.model('Order', orderSchema);

const userSchema = new mongoose.Schema({
  name: String,       
  phone: String,      
  email: String,
  password: String,
  role: String,
  impactPoints: Number,
  status: { type: String, default: 'Approved' }
});
const User = mongoose.model('User', userSchema);

const categorySchema = new mongoose.Schema({
  name: String
});
const Category = mongoose.model('Category', categorySchema);

// --- Storage for Customer Messages ---
let customerQueries = [
  { 
    id: 1, 
    name: "Sample User", 
    email: "user@test.com", 
    subject: "Product Inquiry", 
    message: "Do you ship to Mumbai?", 
    date: "2026-03-06",
    vendorEmail: "admin@upay.com",
    status: "Pending"
  }
];

// --- Default Categories ---
let defaultCategories = [
  { name: "Bags" },
  { name: "Accessories" },
  { name: "Masks" }
];

// --- PRODUCT DATABASE ---
let products = [
  {
    id: 1,
    name: "Eco Jute Tote Bag",
    price: 450,
    category: "Bags",
    img: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    description: "Spacious natural jute bag with reinforced handles",
    tag: "Best Seller",
    subCategory: "Best Seller",
    inStock: true,
    vendor: "admin@upay.com",
    deliveryDays: "3-5 working days"
  },
  {
    id: 3,
    name: "Woven Bamboo Clutch",
    price: 580,
    category: "Bags",
    img: "https://images.unsplash.com/photo-1614165586616-0ed9e17b62dc?auto=format&fit=crop&w=800&q=80",
    description: "Elegant bamboo weave with secure clasp",
    tag: "New",
    subCategory: "New",
    inStock: true,
    vendor: "admin@upay.com",
    deliveryDays: "5-7 working days" 
  },
  {
    id: 4,
    name: "Reusable Hand-Painted Mask",
    price: 280,
    category: "Masks",
    img: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=800&q=80",
    description: "Breathable cotton mask with artistic design",
    tag: "Eco-Friendly",
    subCategory: "Eco-Friendly",
    inStock: true,
    vendor: "vendor@upay.com",
    deliveryDays: "2-4 working days" 
  },
  {
    id: 5,
    name: "Hand-Knitted Wool Scarf",
    price: 720,
    category: "Accessories",
    img: "https://images.unsplash.com/photo-1606830733611-ce5d2217181c?auto=format&fit=crop&w=800&q=80",
    description: "Warm, soft wool blend – cozy & stylish",
    tag: "Winter Special",
    subCategory: "Winter Special",
    inStock: true,
    vendor: "vendor2@upay.com", 
    deliveryDays: "5-7 working days" 
  },
  {
    id: 6,
    name: "Organic Cotton Face Mask Set",
    price: 350,
    category: "Masks", 
    img: "https://images.unsplash.com/photo-1585032767093-4a11db918c5e?auto=format&fit=crop&w=800&q=80",
    description: "Breathable, washable masks with adjustable loops",
    tag: "Health & Eco",
    subCategory: "Health & Eco",
    inStock: true,
    vendor: "admin@upay.com",
    deliveryDays: "3-5 working days" 
  }
];

// --- 3. API ROUTES ---

// --- NEW: RAZORPAY API ROUTES ---

// Create Order
app.post('/api/razorpay/order', async (req, res) => {
  try {
    const { amount } = req.body; // Amount expected in rupees from frontend

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: "receipt_order_" + Math.random().toString(36).substring(7),
    };

    const order = await razorpayInstance.orders.create(options);
    
    if (!order) return res.status(500).send("Some error occured");

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error creating Razorpay order" });
  }
});

// Verify Payment
app.post('/api/razorpay/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET')
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      return res.status(200).json({ success: true, message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid signature sent!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
});

// Login Route 
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const foundUser = await User.findOne({ email: email, password: password });

    

    if (foundUser) {
  if (foundUser.role === 'vendor' && foundUser.status === 'Pending') {
    return res.status(403).json({ success: false, message: "Your application is pending admin approval." });
  }
  res.json({ 
    success: true, 
    user: { name: foundUser.name, phone: foundUser.phone, email: foundUser.email, role: foundUser.role, impactPoints: foundUser.impactPoints } 
  });
} else {
  res.status(401).json({ success: false, message: "Invalid email or password" });
}
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// SIGN UP ROUTE
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits and contain only numbers." });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { phone: phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "An account with this email or phone number is already registered. Please Sign In." 
      });
    }

    const newUser = new User({
      name: name,     
      phone: phone,   
      email: email,
      password: password,
      role: role || 'customer',
      impactPoints: 0 ,
      status: (role === 'vendor') ? 'Pending' : 'Approved'
    });
    
    await newUser.save();

    res.status(201).json({ 
      success: true, 
      user: { name: newUser.name, phone: newUser.phone, email: newUser.email, role: newUser.role, impactPoints: newUser.impactPoints } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create account" });
  }
});

// Get Products Route
app.get('/api/products', async (req, res) => {
  try {
    let dbProducts = await Product.find();
    if (dbProducts.length === 0) {
      await Product.insertMany(products);
      dbProducts = await Product.find();
    }
    res.json(dbProducts);
  } catch (err) {
    res.json(products);
  }
});

// Add Product Route
app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product({
      id: Date.now(), 
      ...req.body 
    });
    await newProduct.save();
    
    products.push({ id: newProduct.id, ...req.body });
    
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to save product" });
  }
});

// Delete Product Route 
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Product.deleteOne({ id: parseInt(id) });
    products = products.filter(p => p.id !== parseInt(id));
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
});

// Update Product Stock Status Route
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedProduct = await Product.findOneAndUpdate(
      { id: parseInt(id) }, 
      { $set: req.body }, 
      { returnDocument: 'after' } // <-- FIX: Changed new: true to returnDocument: 'after'
    );
    
    const index = products.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
      products[index] = { ...products[index], ...req.body };
    }
    
    res.json({ success: true, product: updatedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
});

// API ROUTES FOR CUSTOMER QUERIES
app.get('/api/queries', async (req, res) => {
  try {
    let dbQueries = await Query.find().sort({ id: -1 });
    if (dbQueries.length === 0) {
      await Query.insertMany(customerQueries);
      dbQueries = await Query.find().sort({ id: -1 });
    }
    res.json(dbQueries);
  } catch (err) {
    res.json(customerQueries);
  }
});

app.post('/api/queries', async (req, res) => {
  try {
    const newQueryData = { 
      id: Date.now(), 
      ...req.body, 
      date: new Date().toISOString().split('T')[0] 
    };
    
    const dbQuery = new Query(newQueryData);
    await dbQuery.save();
    
    customerQueries.unshift(newQueryData); 
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

// --- NEW: Route to update query status (Resolve) ---
app.put('/api/queries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedQuery = await Query.findOneAndUpdate(
      { id: parseInt(id) }, 
      { $set: req.body }, 
      { returnDocument: 'after' } // <-- FIX: Changed new: true to returnDocument: 'after'
    );
    res.json({ success: true, query: updatedQuery });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update query" });
  }
});

// --- NEW: Route to delete query ---
app.delete('/api/queries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Query.deleteOne({ id: parseInt(id) });
    res.json({ success: true, message: "Query deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete query" });
  }
});

// API ROUTES FOR ORDERS
app.get('/api/orders', async (req, res) => {
  try {
    // Sort backend orders dynamically (newest date first)
    const dbOrders = await Order.find().sort({ date: -1 });
    res.json(dbOrders);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = new Order({
      id: Math.floor(1000 + Math.random() * 9000).toString(), 
      date: new Date().toISOString().split('T')[0],
      ...req.body, 
      status: 'Pending'
    });
    await newOrder.save();
    res.status(201).json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to place order" });
  }
});

// --- NEW: Route to update order status (Pending / Delivered) ---
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = await Order.findOneAndUpdate(
      { id: id }, 
      { $set: req.body }, 
      { returnDocument: 'after' } // <-- FIX: Changed new: true to returnDocument: 'after'
    );
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update order" });
  }
});

// GET single order by ID (for order tracking page)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ id: id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Parse items string into array for frontend
    const itemsArray = order.items
      ? order.items.split(',').map(item => {
          const parts = item.trim().split('x ');
          return {
            qty: parseInt(parts[0]) || 1,
            name: parts[1] || item.trim(),
            price: 0
          };
        })
      : [];

    // Map status string to step number
    const statusMap = {
      'Pending': 0,
      'Packed': 1,
      'Shipped': 2,
      'Delivered': 3
    };

    res.json({
      order: {
        id: order.id,
        date: order.date,
        status: statusMap[order.status] ?? 0,
        items: itemsArray,
        total: order.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
});

// API ROUTES FOR CATEGORIES
app.get('/api/categories', async (req, res) => {
  try {
    let dbCategories = await Category.find();
    if (dbCategories.length === 0) {
      await Category.insertMany(defaultCategories);
      dbCategories = await Category.find();
    }
    res.json(dbCategories.map(c => c.name)); 
  } catch (err) {
    res.json(defaultCategories.map(c => c.name));
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    
    const existingCategory = await Category.findOne({ name: name });
    if (existingCategory) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }

    const newCategory = new Category({ name: name });
    await newCategory.save();
    
    res.status(201).json({ success: true, category: newCategory.name });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add category" });
  }
});

// DELETE CATEGORY ROUTE
app.delete('/api/categories/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await Category.deleteOne({ name: name });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
});

// GET all vendor applications (for Admin Dashboard)
app.get('/api/applications', async (req, res) => {
  try {
    const vendors = await User.find({ role: 'vendor' });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch vendors" });
  }
});

// APPROVE a vendor application
app.put('/api/vendors/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { status: 'Approved' } },
      { new: true }
    );
    res.json({ success: true, vendor: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to approve vendor" });
  }
});

// REJECT (delete) a vendor application
app.delete('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ success: true, message: "Application rejected and deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reject vendor" });
  }
});

// --- 4. SERVER START ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`UPAY Backend running on http://localhost:${PORT}`);
});