const mongoose = require('mongoose');
const config = require('./index');

async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[ai-listing-backend] MongoDB connected');
  } catch (error) {
    console.error('[ai-listing-backend] MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
