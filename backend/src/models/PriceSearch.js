const mongoose = require('mongoose');

const priceResultSchema = new mongoose.Schema({
  site: { type: String, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'TRY' },
  imageUrl: { type: String, default: '' },
  productUrl: { type: String, required: true },
  seller: { type: String, default: '' },
  rating: { type: Number, default: 0 }
}, { _id: false });

const priceSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  query: {
    type: String,
    required: true,
    trim: true
  },
  selectedSites: [{
    type: String,
    enum: ['amazon', 'trendyol', 'hepsiburada', 'n11', 'gittigidiyor', 'ciceksepeti', 'akakce']
  }],
  results: [priceResultSchema],
  totalResults: { type: Number, default: 0 },
  searchDuration: { type: Number, default: 0 } // ms
}, {
  timestamps: true
});

// Index for user search history queries
priceSearchSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PriceSearch', priceSearchSchema);
