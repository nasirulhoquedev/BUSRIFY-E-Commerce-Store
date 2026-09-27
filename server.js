require('dotenv').config();
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initDatabase, dbOps, getDatabaseMode } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'busrify-store-secret-key-2026-secure';

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Cryptographic token generator & validator (Supports String & ObjectId user IDs)
function generateToken(userId) {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, timestamp, signature] = decoded.split(':');
    if (!userId || !timestamp || !signature) return null;

    // Check expiration (7 days)
    const tokenAge = Date.now() - Number(timestamp);
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) return null;

    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${userId}:${timestamp}`).digest('hex');
    if (signature !== expectedSig) return null;

    return userId;
  } catch {
    return null;
  }
}

// Authentication Middleware (Async)
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.auth_token;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.split(' ')[1] 
      : cookieToken;

    const userId = verifyToken(token);
    if (userId) {
      const user = await dbOps.getUserById(userId);
      if (user) {
        req.user = user;
      }
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.use(authMiddleware);

// --- Health / Status Route ---
app.get('/api/system/status', (req, res) => {
  res.json({
    status: 'healthy',
    database: getDatabaseMode(),
    timestamp: new Date().toISOString()
  });
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await dbOps.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const newUser = await dbOps.createUser(name, email, password);
    const token = generateToken(newUser.id);

    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role || 'customer' },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbOps.getUserByEmail(email);
    if (!user || !dbOps.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);

    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Logged in successfully',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

// --- Product Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sort, minPrice, maxPrice } = req.query;
    const products = await dbOps.getProducts({ category, search, sort, minPrice, maxPrice });
    res.json({
      products,
      count: products.length,
      database: getDatabaseMode()
    });
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await dbOps.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ product });
  } catch (err) {
    console.error('Product details error:', err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await dbOps.getCategories();
    res.json({ categories });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// --- Promo Code Validation ---
app.post('/api/promo/validate', (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const upper = code.trim().toUpperCase();
  if (upper === 'SAVE10') {
    const discount = Math.round(subtotal * 0.1 * 100) / 100;
    return res.json({ valid: true, code: 'SAVE10', discount, description: '10% Off Entire Order' });
  } else if (upper === 'FREESHIP') {
    return res.json({ valid: true, code: 'FREESHIP', discount: 99, freeShipping: true, description: 'Free Express Delivery (₹99 off)' });
  } else if (upper === 'BUSRIFY25' || upper === 'LUMINA25') {
    const discount = Math.round(subtotal * 0.25 * 100) / 100;
    return res.json({ valid: true, code: 'BUSRIFY25', discount, description: 'VIP 25% Off Celebration' });
  }

  res.status(400).json({ valid: false, error: 'Invalid or expired promotional code' });
});

// --- Order Routes ---
app.post('/api/orders', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      shippingAddress,
      items,
      subtotal,
      shippingFee,
      discount = 0,
      totalAmount,
      paymentMethod
    } = req.body;

    if (!customerName || !customerEmail || !shippingAddress || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    // Verify item prices & stock against DB
    const validatedItems = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const product = await dbOps.getProductById(item.id);
      if (!product) {
        return res.status(400).json({ error: `Product #${item.id} no longer exists` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Only ${product.stock} left in stock.`
        });
      }
      validatedItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.max(1, parseInt(item.quantity, 10)),
        image_url: product.image_url
      });
      calculatedSubtotal += product.price * item.quantity;
    }

    const calculatedTotal = Math.max(0, calculatedSubtotal + (Number(shippingFee) || 0) - (Number(discount) || 0));

    const order = await dbOps.createOrder({
      userId: req.user ? req.user.id : null,
      customerName,
      customerEmail,
      shippingAddress,
      items: validatedItems,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      shippingFee: Number(shippingFee) || 0,
      discount: Number(discount) || 0,
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      paymentMethod: paymentMethod || 'Credit Card'
    });

    res.status(201).json({
      message: 'Order placed successfully!',
      order
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to process order' });
  }
});

app.get('/api/orders/my-orders', requireAuth, async (req, res) => {
  try {
    const orders = await dbOps.getUserOrders(req.user.id);
    res.json({ orders });
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Failed to fetch your orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await dbOps.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    // Check ownership if user order
    if (order.user_id && req.user && String(req.user.id) !== String(order.user_id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this order' });
    }
    res.json({ order });
  } catch (err) {
    console.error('Order lookup error:', err);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server with Database Initialization
async function startServer() {
  try {
    const { mode } = await initDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 BUSRIFY E-Commerce Server is running at http://localhost:${PORT}`);
      console.log(`🗄️  Active Database Engine: ${mode.toUpperCase()}`);
    });
  } catch (err) {
    console.error('Fatal Server Initialization Error:', err);
    process.exit(1);
  }
}

startServer();
