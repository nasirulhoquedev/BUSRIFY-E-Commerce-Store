require('dotenv').config();
const path = require('node:path');
const crypto = require('node:crypto');
const { connectMongoDB, mongoDbOps, User, Product, Order } = require('./db/mongo');

let sqliteDb = null;
let currentMode = 'mongodb'; // 'mongodb' or 'sqlite'

// Password hashing helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !storedPassword.includes(':')) return false;
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === originalHash;
}

// Lazy SQLite initialization
function initSqliteDatabase() {
  if (sqliteDb) return sqliteDb;

  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(__dirname, 'ecommerce.db');
  sqliteDb = new DatabaseSync(dbPath);

  sqliteDb.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      rating REAL DEFAULT 4.5,
      reviews_count INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 15,
      description TEXT NOT NULL,
      features TEXT NOT NULL,
      image_url TEXT NOT NULL,
      badge TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      subtotal REAL NOT NULL,
      shipping_fee REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT DEFAULT 'Processing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
  `);

  // Seed default users if empty
  const userCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    insertUser.run('Alex Morgan', 'alex@example.com', hashPassword('password123'), 'customer');
    insertUser.run('Store Admin', 'admin@busrify.com', hashPassword('admin123'), 'admin');
    console.log('✔ SQLite: Initialized default users (alex@example.com / password123)');
  }

  return sqliteDb;
}

// SQLite database operations
const sqliteDbOps = {
  createUser: async (name, email, password) => {
    initSqliteDatabase();
    const password_hash = hashPassword(password);
    const stmt = sqliteDb.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(name, email, password_hash);
    return { id: result.lastInsertRowid, name, email };
  },

  getUserByEmail: async (email) => {
    initSqliteDatabase();
    return sqliteDb.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  getUserById: async (id) => {
    initSqliteDatabase();
    return sqliteDb.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(id);
  },

  verifyPassword,

  getProducts: async ({ category, search, sort, minPrice, maxPrice }) => {
    initSqliteDatabase();
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (minPrice !== undefined && minPrice !== null && !isNaN(minPrice)) {
      sql += ' AND price >= ?';
      params.push(Number(minPrice));
    }

    if (maxPrice !== undefined && maxPrice !== null && !isNaN(maxPrice)) {
      sql += ' AND price <= ?';
      params.push(Number(maxPrice));
    }

    if (sort === 'price-low') {
      sql += ' ORDER BY price ASC';
    } else if (sort === 'price-high') {
      sql += ' ORDER BY price DESC';
    } else if (sort === 'rating') {
      sql += ' ORDER BY rating DESC';
    } else if (sort === 'new') {
      sql += ' ORDER BY id DESC';
    } else {
      sql += ' ORDER BY is_featured DESC, rating DESC';
    }

    const stmt = sqliteDb.prepare(sql);
    const products = stmt.all(...params);
    return products.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]')
    }));
  },

  getProductById: async (id) => {
    initSqliteDatabase();
    const p = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!p) return null;
    return {
      ...p,
      features: JSON.parse(p.features || '[]')
    };
  },

  getCategories: async () => {
    initSqliteDatabase();
    return sqliteDb.prepare(`
      SELECT category, COUNT(*) as count 
      FROM products 
      GROUP BY category 
      ORDER BY category ASC
    `).all();
  },

  createOrder: async ({
    userId,
    customerName,
    customerEmail,
    shippingAddress,
    items,
    subtotal,
    shippingFee,
    discount,
    totalAmount,
    paymentMethod
  }) => {
    initSqliteDatabase();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `ORD-IN-${new Date().getFullYear()}-${randomHex}`;

    sqliteDb.exec('BEGIN TRANSACTION');
    try {
      const orderStmt = sqliteDb.prepare(`
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, shipping_address, subtotal, shipping_fee, discount, total_amount, payment_method, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processing')
      `);

      const orderResult = orderStmt.run(
        orderNumber,
        userId || null,
        customerName,
        customerEmail,
        typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress),
        subtotal,
        shippingFee,
        discount || 0,
        totalAmount,
        paymentMethod || 'UPI / Card'
      );

      const orderId = orderResult.lastInsertRowid;

      const itemStmt = sqliteDb.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const updateStockStmt = sqliteDb.prepare(`
        UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?
      `);

      for (const item of items) {
        itemStmt.run(
          orderId,
          item.id,
          item.name,
          item.price,
          item.quantity,
          item.image_url || ''
        );
        updateStockStmt.run(item.quantity, item.id);
      }

      sqliteDb.exec('COMMIT');

      return {
        id: orderId,
        orderNumber,
        customerName,
        customerEmail,
        totalAmount,
        status: 'Processing',
        itemsCount: items.length
      };
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
  },

  getUserOrders: async (userId) => {
    initSqliteDatabase();
    const orders = sqliteDb.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);

    const getItems = sqliteDb.prepare(`
      SELECT * FROM order_items WHERE order_id = ?
    `);

    return orders.map(order => ({
      ...order,
      shipping_address: (() => {
        try { return JSON.parse(order.shipping_address); } catch { return order.shipping_address; }
      })(),
      items: getItems.all(order.id)
    }));
  },

  getOrderById: async (idOrNumber) => {
    initSqliteDatabase();
    const order = sqliteDb.prepare(`
      SELECT * FROM orders WHERE id = ? OR order_number = ?
    `).get(idOrNumber, idOrNumber);

    if (!order) return null;

    const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return {
      ...order,
      shipping_address: (() => {
        try { return JSON.parse(order.shipping_address); } catch { return order.shipping_address; }
      })(),
      items
    };
  }
};

// Unified initDatabase function
async function initDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/busrify_store';
  const allowFallback = process.env.MONGODB_FALLBACK_SQLITE !== 'false';

  try {
    console.log(`📡 Connecting to MongoDB (${uri})...`);
    await connectMongoDB(uri);
    currentMode = 'mongodb';
    console.log('✔ MongoDB: Primary database is active and ready.');
    return { mode: 'mongodb' };
  } catch (mongoErr) {
    if (!allowFallback) {
      console.error('❌ Failed to connect to MongoDB and fallback is disabled:', mongoErr.message);
      throw mongoErr;
    }

    console.warn('\n⚠️  MongoDB connection note:');
    console.warn(`   Unable to reach MongoDB at "${uri}": ${mongoErr.message}`);
    console.warn('   👉 To connect your cloud database, set MONGODB_URI in your .env file.');
    console.log('🔄 Automatic Fallback: Using local SQLite database to keep store online.\n');

    initSqliteDatabase();
    currentMode = 'sqlite';
    return { mode: 'sqlite' };
  }
}

// Unified dbOps proxy
const dbOps = {
  createUser: (name, email, password) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.createUser(name, email, password)
      : sqliteDbOps.createUser(name, email, password);
  },

  getUserByEmail: (email) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getUserByEmail(email)
      : sqliteDbOps.getUserByEmail(email);
  },

  getUserById: (id) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getUserById(id)
      : sqliteDbOps.getUserById(id);
  },

  verifyPassword,

  getProducts: (params) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getProducts(params)
      : sqliteDbOps.getProducts(params);
  },

  getProductById: (id) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getProductById(id)
      : sqliteDbOps.getProductById(id);
  },

  getCategories: () => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getCategories()
      : sqliteDbOps.getCategories();
  },

  createOrder: (params) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.createOrder(params)
      : sqliteDbOps.createOrder(params);
  },

  getUserOrders: (userId) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getUserOrders(userId)
      : sqliteDbOps.getUserOrders(userId);
  },

  getOrderById: (idOrNumber) => {
    return currentMode === 'mongodb'
      ? mongoDbOps.getOrderById(idOrNumber)
      : sqliteDbOps.getOrderById(idOrNumber);
  },

  getDatabaseMode: () => currentMode
};

module.exports = {
  initDatabase,
  dbOps,
  getDatabaseMode: () => currentMode,
  User,
  Product,
  Order
};

// Direct script execution handler (e.g. `node database.js`)
if (require.main === module) {
  (async () => {
    try {
      console.log('🚀 Running database diagnostics & initialization...\n');
      const { mode } = await initDatabase();
      console.log(`\n🎉 Database initialized successfully in [${mode.toUpperCase()}] mode.`);

      const categories = await dbOps.getCategories();
      const catList = categories.map(c => typeof c === 'string' ? c : `${c.category} (${c.count})`).join(', ');
      console.log(`📂 Categories (${categories.length}): ${catList}`);

      const products = await dbOps.getProducts({});
      console.log(`📦 Products available: ${products.length} item(s)`);
      if (products.length > 0) {
        console.log(`   Sample item: "${products[0].name}" - ₹${products[0].price.toLocaleString('en-IN')}`);
      }

      console.log('\n✔ database.js executed successfully without any errors.');
      process.exit(0);
    } catch (err) {
      console.error('\n❌ Database execution error:', err);
      process.exit(1);
    }
  })();
}
