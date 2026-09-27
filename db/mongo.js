const mongoose = require('mongoose');
const crypto = require('node:crypto');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Secure password hashing helper
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

// Seed product catalog
const seedProducts = [
  {
    name: 'NovaSound Apex Wireless Headphones',
    slug: 'novasound-apex-wireless-headphones',
    category: 'Audio',
    price: 14999,
    original_price: 18999,
    rating: 4.9,
    reviews_count: 142,
    stock: 24,
    badge: 'Best Seller',
    is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    description: 'Engineered for audiophiles. Features hybrid active noise cancellation, custom 40mm beryllium drivers, and up to 45 hours of ultra-long battery life with rapid USB-C charging.',
    features: [
      'Active Noise Cancellation with Ambient Transparency Mode',
      '45 Hours Battery Life + 10-min Quick Charge for 5 Hours',
      'Ultra-soft memory foam ear cushions & aluminum frame',
      'Bluetooth 5.3 with multipoint audio pairing'
    ]
  },
  {
    name: 'BUSRIFY View 27" 4K HDR Studio Display',
    slug: 'busrify-view-27-4k-hdr-studio-display',
    category: 'Electronics',
    price: 34999,
    original_price: 42999,
    rating: 4.8,
    reviews_count: 88,
    stock: 12,
    badge: 'Top Rated',
    is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    description: 'Immerse yourself in stunning true-to-life color accuracy. 4K Ultra HD IPS panel with 99% DCI-P3 color gamut, 90W USB-C power delivery, and an integrated ergonomic swivel stand.',
    features: [
      '3840 x 2160 4K UHD IPS Panel with HDR600',
      '99% DCI-P3 & 100% sRGB Factory Calibrated Colors',
      'Single cable 90W USB-C Power Delivery & DisplayPort',
      'Zero-bezel edge-to-edge minimalist design'
    ]
  },
  {
    name: 'Apex Horizon Titanium Smartwatch',
    slug: 'apex-horizon-titanium-smartwatch',
    category: 'Wearables',
    price: 18999,
    original_price: 23999,
    rating: 4.7,
    reviews_count: 95,
    stock: 18,
    badge: 'New Arrival',
    is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
    description: 'Aerospace-grade titanium case with a crisp sapphire crystal AMOLED touchscreen. Packed with advanced ECG, blood oxygen sensors, multi-band GPS, and 100+ precision sports tracking modes.',
    features: [
      '1.43-inch Always-On Retina AMOLED Display',
      'Aerospace Titanium Bezel with Sapphire Glass',
      'ECG, Heart Rate, SpO2, and Sleep Quality Monitoring',
      'Waterproof up to 50M (5 ATM) with 14-day battery'
    ]
  },
  {
    name: 'EchoPulse Hi-Fi Walnut Bluetooth Speaker',
    slug: 'echopulse-hi-fi-walnut-speaker',
    category: 'Audio',
    price: 12999,
    original_price: 16999,
    rating: 4.8,
    reviews_count: 64,
    stock: 15,
    badge: 'Trending',
    is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
    description: 'Handcrafted solid walnut cabinet delivers warm, rich acoustic resonance. Features dual passive radiators, 60W dynamic audio output, and intuitive touch controls.',
    features: [
      'Acoustically tuned natural walnut wood enclosure',
      '60W dynamic peak room-filling sound',
      'Dual passive radiators for deep, distortion-free bass',
      'Aux-in, Optical, and Bluetooth 5.2 connectivity'
    ]
  },
  {
    name: 'ErgoCraft Mechanical Walnut Keyboard',
    slug: 'ergocraft-mechanical-walnut-keyboard',
    category: 'Workspace',
    price: 9999,
    original_price: 12999,
    rating: 4.9,
    reviews_count: 112,
    stock: 20,
    badge: 'Popular',
    is_featured: 1,
    image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
    description: 'Engineered for tactile perfection. Hot-swappable mechanical switches, PBT double-shot keycaps, south-facing RGB lighting, and wireless tri-mode connectivity (2.4G/BT/Type-C).',
    features: [
      'Hot-swappable custom pre-lubed mechanical switches',
      'CNC aluminum top plate with acoustic dampening foam',
      'Tri-mode connectivity: Bluetooth 5.0, 2.4GHz, and USB-C',
      'South-facing customizable RGB backlighting'
    ]
  },
  {
    name: 'Aurelia Pods Pro Wireless Earbuds',
    slug: 'aurelia-pods-pro-wireless-earbuds',
    category: 'Audio',
    price: 7999,
    original_price: 10499,
    rating: 4.6,
    reviews_count: 78,
    stock: 30,
    badge: 'Sale',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
    description: 'Featherlight true wireless earbuds delivering studio acoustics with personalized spatial audio. Includes wireless charging case, smart capacitive touch, and IPX5 sweat resistance.',
    features: [
      'Active Noise Cancellation with Adaptive Ambient Sound',
      '32 Hours total playtime with Qi wireless charging case',
      'Dual beamforming mics with AI noise suppression',
      'IPX5 water and sweat resistance rating'
    ]
  },
  {
    name: 'HyperCharge Pro 100W GaN Charging Hub',
    slug: 'hypercharge-pro-100w-gan-charging-hub',
    category: 'Electronics',
    price: 4999,
    original_price: 6499,
    rating: 4.7,
    reviews_count: 53,
    stock: 35,
    badge: 'Essential',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
    description: 'Next-generation Gallium Nitride (GaN III) technology packs 100W into an ultra-compact body. Simultaneously fast-charge your laptop, tablet, phone, and watch with smart power distribution.',
    features: [
      '100W Maximum USB-C Power Delivery',
      '3x USB-C + 1x USB-A Simultaneous Fast Charging',
      'GaN III architecture for cool, energy-efficient operation',
      'Compact form factor with surge and overheating protection'
    ]
  },
  {
    name: 'FlowDesk Precision Ergonomic Mouse',
    slug: 'flowdesk-precision-ergonomic-mouse',
    category: 'Workspace',
    price: 4499,
    original_price: 5999,
    rating: 4.8,
    reviews_count: 91,
    stock: 25,
    badge: 'Staff Pick',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    description: 'Designed to relieve wrist strain during long creative sessions. Sculpted thumb cradle, hyper-fast electromagnetic scroll wheel, and an 8000 DPI sensor that tracks on any surface, including glass.',
    features: [
      'Natural 57° ergonomic handshake angle',
      'MagSpeed electromagnetic smart scrolling wheel',
      'Darkfield 8000 DPI high-precision sensor',
      'Multi-device flow across up to 3 computers'
    ]
  },
  {
    name: 'Artisan Top-Grain Leather Desk Mat',
    slug: 'artisan-top-grain-leather-desk-mat',
    category: 'Workspace',
    price: 2999,
    original_price: 3999,
    rating: 4.9,
    reviews_count: 120,
    stock: 40,
    badge: 'Handmade',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    description: 'Elevate your desk workspace with authentic full-grain vegetable-tanned leather. Features burnished edges, non-slip natural suede backing, and a water-resistant protective finish.',
    features: [
      'Premium 100% full-grain vegetable tanned leather',
      'Non-slip natural suede bottom prevents sliding',
      'Waterproof protective coating against spills',
      'Generous 90cm x 40cm coverage for keyboard and mouse'
    ]
  },
  {
    name: 'Vintage Wave Vinyl Turntable',
    slug: 'vintage-wave-vinyl-turntable',
    category: 'Audio',
    price: 16999,
    original_price: 21999,
    rating: 4.7,
    reviews_count: 47,
    stock: 10,
    badge: 'Classic',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80',
    description: 'The golden warmth of analog vinyl paired with modern convenience. Features an Audio-Technica magnetic cartridge, belt-drive motor with vibration dampening, and Bluetooth streaming.',
    features: [
      'Audio-Technica AT3600L moving magnet cartridge',
      'Switchable built-in phono preamp and RCA line-out',
      'Die-cast aluminum platter with anti-resonance slipmat',
      'Bluetooth transmitter for wireless speaker & headphone output'
    ]
  },
  {
    name: 'Chronos Heritage Minimalist Watch',
    slug: 'chronos-heritage-minimalist-watch',
    category: 'Wearables',
    price: 11999,
    original_price: 15499,
    rating: 4.8,
    reviews_count: 67,
    stock: 22,
    badge: 'Timeless',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
    description: 'Subtle sophistication. 316L stainless steel case with domed scratch-resistant sapphire crystal, Japanese quartz movement, and interchangeable quick-release Italian leather strap.',
    features: [
      'Scratch-resistant anti-reflective Sapphire crystal glass',
      'Surgical grade 316L stainless steel casing',
      'Handmade Italian vegetable-tanned leather strap',
      '50M (5 ATM) water resistance rating'
    ]
  },
  {
    name: 'PulseBand Ultra Sport Tracker',
    slug: 'pulseband-ultra-sport-tracker',
    category: 'Wearables',
    price: 5499,
    original_price: 6999,
    rating: 4.5,
    reviews_count: 83,
    stock: 28,
    badge: 'Value Pick',
    is_featured: 0,
    image_url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=800&q=80',
    description: 'Your 24/7 fitness and wellness companion. Lightweight curved OLED band tracks heart rate zones, recovery readiness, VO2 max, sleep stages, and smartphone notifications.',
    features: [
      'Continuous 24/7 PPG heart rate and recovery metrics',
      'Over 50 dedicated workout and sports tracking profiles',
      'Up to 14 days of battery life on a single magnetic charge',
      'Swim-proof water resistance up to 50 meters'
    ]
  }
];

// Seed MongoDB collections if empty
async function seedMongoDB() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create([
        {
          name: 'Alex Morgan',
          email: 'alex@example.com',
          password_hash: hashPassword('password123'),
          role: 'customer'
        },
        {
          name: 'Store Admin',
          email: 'admin@busrify.com',
          password_hash: hashPassword('admin123'),
          role: 'admin'
        }
      ]);
      console.log('✔ MongoDB: Initialized default users (alex@example.com / password123)');
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(seedProducts);
      console.log(`✔ MongoDB: Seeded ${seedProducts.length} products with INR (₹) prices into MongoDB.`);
    }
  } catch (err) {
    console.error('Error seeding MongoDB:', err);
  }
}

// Connect to MongoDB
async function connectMongoDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/busrify_store';
  
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 4000
  });

  console.log(`🍃 Connected to MongoDB database at ${mongoUri}`);
  await seedMongoDB();
  return mongoose.connection;
}

// MongoDB database operations (async)
const mongoDbOps = {
  createUser: async (name, email, password) => {
    const password_hash = hashPassword(password);
    const user = await User.create({ name, email, password_hash });
    return user.toJSON();
  },

  getUserByEmail: async (email) => {
    if (!email) return null;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return user ? user.toJSON() : null;
  },

  getUserById: async (id) => {
    if (!id) return null;
    let user;
    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id).select('-password_hash');
    } else {
      user = await User.findOne({ _id: id }).select('-password_hash');
    }
    return user ? user.toJSON() : null;
  },

  verifyPassword,

  getProducts: async ({ category, search, sort, minPrice, maxPrice }) => {
    const query = {};

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ];
    }

    if (minPrice !== undefined && minPrice !== null && !isNaN(minPrice)) {
      query.price = { ...(query.price || {}), $gte: Number(minPrice) };
    }

    if (maxPrice !== undefined && maxPrice !== null && !isNaN(maxPrice)) {
      query.price = { ...(query.price || {}), $lte: Number(maxPrice) };
    }

    let sortOption = { is_featured: -1, rating: -1 };
    if (sort === 'price-low') {
      sortOption = { price: 1 };
    } else if (sort === 'price-high') {
      sortOption = { price: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1 };
    } else if (sort === 'new') {
      sortOption = { created_at: -1 };
    }

    const products = await Product.find(query).sort(sortOption);
    return products.map(p => p.toJSON());
  },

  getProductById: async (id) => {
    if (!id) return null;
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ $or: [{ slug: id }, { _id: id }] });
    }

    return product ? product.toJSON() : null;
  },

  getCategories: async () => {
    const counts = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1
        }
      },
      {
        $sort: { category: 1 }
      }
    ]);
    return counts;
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
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `ORD-IN-${new Date().getFullYear()}-${randomHex}`;

    const orderDoc = await Order.create({
      order_number: orderNumber,
      user_id: userId || null,
      customer_name: customerName,
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      items: items.map(item => ({
        product_id: item.id || item.product_id,
        product_name: item.name || item.product_name,
        price: item.price,
        quantity: item.quantity,
        image_url: item.image_url || ''
      })),
      subtotal,
      shipping_fee: shippingFee || 0,
      discount: discount || 0,
      total_amount: totalAmount,
      payment_method: paymentMethod || 'UPI / Card',
      status: 'Processing'
    });

    // Atomically decrement product stock
    for (const item of items) {
      const productId = item.id || item.product_id;
      if (mongoose.Types.ObjectId.isValid(productId)) {
        await Product.updateOne(
          { _id: productId },
          { $inc: { stock: -item.quantity } }
        );
      } else {
        await Product.updateOne(
          { $or: [{ _id: productId }, { slug: productId }] },
          { $inc: { stock: -item.quantity } }
        );
      }
    }

    return {
      id: orderDoc._id.toString(),
      orderNumber: orderDoc.order_number,
      customerName: orderDoc.customer_name,
      customerEmail: orderDoc.customer_email,
      totalAmount: orderDoc.total_amount,
      status: orderDoc.status,
      itemsCount: items.length
    };
  },

  getUserOrders: async (userId) => {
    if (!userId) return [];
    const orders = await Order.find({ user_id: userId }).sort({ created_at: -1 });
    return orders.map(o => o.toJSON());
  },

  getOrderById: async (idOrNumber) => {
    if (!idOrNumber) return null;
    let order = null;
    if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
      order = await Order.findById(idOrNumber);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ order_number: idOrNumber }, { _id: idOrNumber }]
      });
    }
    return order ? order.toJSON() : null;
  }
};

module.exports = {
  connectMongoDB,
  seedMongoDB,
  mongoDbOps,
  hashPassword,
  verifyPassword,
  User,
  Product,
  Order
};
