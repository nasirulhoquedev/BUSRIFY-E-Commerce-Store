# BUSRIFY E-Commerce Store 🛒✨

A full-stack, responsive modern e-commerce web application featuring dynamic catalog filtering, shopping cart management, secure checkout, order tracking, and a resilient dual-database architecture (MongoDB with automatic zero-configuration SQLite fallback).

---

## 🌟 Key Features

- **🛍️ Dynamic Product Catalog**: Browse products across categories (Audio, Electronics, Wearables, Workspace) with real-time price filtering, keyword search, and sorting (price, rating, new arrivals).
- **🛒 Interactive Cart & Checkout**: Slide-out shopping cart drawer with quantity adjustments, promo code support, order summary, and seamless multi-step checkout.
- **📦 Order Management & Tracking**: Generate instant order numbers, track status, view itemized receipts, and order histories.
- **🔐 User Authentication**: Secure token-based session handling, password hashing via `scrypt`, and role-based access.
- **⚡ Dual-Engine Database Architecture**:
  - **MongoDB** as the primary high-performance document database with Mongoose schemas.
  - **SQLite Fallback** that activates automatically if MongoDB is unreachable, ensuring zero downtime for development or local demos.
- **🎨 Glassmorphic & Modern UI**: Tailored color palette, smooth micro-animations, toast notifications, responsive mobile drawer, and accessible design.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (via Mongoose) & SQLite (via `node:sqlite`)
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Modern Vanilla CSS
- **Authentication**: Cryptographic HMAC tokens & `scrypt` password hashing

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/nasirulhoquedev/BUSRIFY-E-Commerce-Store.git
cd BUSRIFY-E-Commerce-Store
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=3000
SESSION_SECRET=busrify-store-secret-key-2026-secure
MONGODB_URI=mongodb://127.0.0.1:27017/busrify_store
MONGODB_FALLBACK_SQLITE=true
```

> **Note**: If MongoDB is not running locally, the application automatically boots into local SQLite mode using `ecommerce.db`.

### 4. Run database verification
```bash
node database.js
```

### 5. Launch the application
```bash
# Start server
npm start

# Or run with auto-reload (Node.js 18+)
npm run dev
```

Visit the store in your browser at **`http://localhost:3000`**.

---

## 📁 Project Structure

```text
ecommerce-store/
├── db/
│   └── mongo.js           # Mongoose schemas & MongoDB connection logic
├── models/
│   ├── Order.js           # Order schema & model
│   ├── Product.js         # Product schema & model
│   └── User.js            # User schema & model
├── public/
│   ├── app.js             # Client-side shopping cart & UI interactions
│   ├── index.html         # Main storefront application
│   └── styles.css         # Styling, themes, responsive layout & animations
├── scripts/
│   └── seedMongo.js       # Script to populate MongoDB database
├── database.js            # Database abstraction & SQLite fallback layer
├── server.js              # Express REST API & static file server
├── package.json
└── README.md
```

---

## 📡 REST API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Fetch product catalog with filter/sort queries |
| `GET` | `/api/products/:id` | Get individual product details |
| `GET` | `/api/categories` | Retrieve available product categories |
| `POST` | `/api/orders` | Place a new customer order |
| `GET` | `/api/orders/:id` | Fetch order details by ID or order number |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate existing user |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |

---

## 📄 License
This project is open-source and available under the [ISC License](LICENSE).