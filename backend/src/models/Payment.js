const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  extensionId: {
    type: String,
    enum: ['ig-export', 'ig-unfollow', 'price-compare'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ['TRY', 'USD', 'EUR'],
    default: 'TRY'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'paytr'
  },
  // PayTR specific fields
  merchantOid: { type: String, unique: true }, // Unique order ID
  transactionId: { type: String },             // PayTR transaction ID
  paytrToken: { type: String },

  // Subscription details
  planDuration: {
    type: Number,
    default: 30  // Days
  },

  completedAt: { type: Date },
  refundedAt: { type: Date },
  metadata: { type: Object, default: {} }
}, {
  timestamps: true
});

// Generate unique merchant order ID
paymentSchema.statics.generateMerchantOid = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CE-${timestamp}-${random}`.toUpperCase();
};

module.exports = mongoose.model('Payment', paymentSchema);
