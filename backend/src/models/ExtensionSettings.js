const mongoose = require('mongoose');

const extensionSettingsSchema = new mongoose.Schema({
  extensionId: {
    type: String,
    enum: ['ig-export', 'ig-unfollow', 'price-compare'],
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

  // Extension-specific settings
  settings: { type: Object, default: {} }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExtensionSettings', extensionSettingsSchema);
