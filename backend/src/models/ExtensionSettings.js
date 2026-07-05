const mongoose = require('mongoose');

const extensionSettingsSchema = new mongoose.Schema({
  extensionId: {
    type: String,
    enum: ['ig-export', 'ig-unfollow', 'price-compare', 'ai-listing-writer'],
    required: true,
    unique: true
  },
  name: {
    en: { type: String, required: true },
    tr: { type: String, required: true }
  },
  isActive: { type: Boolean, default: true },

  // Payment settings
  vposLink: { type: String, default: '' },
  premiumPriceMonthly: { type: Number, default: 0 },
  premiumPriceYearly: { type: Number, default: 0 },
  premiumCurrency: { type: String, default: 'TRY' },

  // Free plan limits
  freeLimits: { type: Object, default: {} },

  // AI Listing Writer only: Groq API key pool + model, managed from the admin
  // panel so keys can be rotated/added without a redeploy. The standalone
  // ai-listing-backend service fetches these via GET /api/listing-config.
  groqApiKeys: { type: [String], default: [] },
  groqModel: { type: String, default: 'llama-3.3-70b-versatile' },

  // Extension-specific settings
  settings: { type: Object, default: {} }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExtensionSettings', extensionSettingsSchema);
