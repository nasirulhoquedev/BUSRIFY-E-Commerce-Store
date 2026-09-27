require('dotenv').config();
const mongoose = require('mongoose');
const { connectMongoDB, seedMongoDB, User, Product, Order } = require('../db/mongo');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/busrify_store';
  console.log(`Connecting to MongoDB at: ${uri}`);
  
  try {
    await connectMongoDB(uri);
    console.log('✔ Connected to MongoDB successfully.');

    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();
    const orderCount = await Order.countDocuments();

    console.log('\n📊 Database Status:');
    console.log(`- Users: ${userCount}`);
    console.log(`- Products: ${productCount}`);
    console.log(`- Orders: ${orderCount}`);

    console.log('\n✔ MongoDB setup & seed check complete!');
  } catch (err) {
    console.error('\n❌ MongoDB Connection Error:', err.message);
    console.log('\nTip: Ensure your MongoDB server is running locally or provide a valid MONGODB_URI in .env (e.g. MongoDB Atlas cluster).');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

run();
