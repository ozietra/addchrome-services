const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Same MongoDB Atlas cluster + JWT secret as the shared chrome-extensions
  // backend. This service reads/writes users' subscriptions/usage directly
  // instead of calling the shared backend's HTTP API, so it keeps working
  // even when that backend's own hosting is slow to pick up code changes.
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',

  // Kept for the /listing-config Groq-key lookup only (admin-panel-managed
  // keys); not used for auth/subscriptions anymore.
  mainBackendUrl: (process.env.MAIN_BACKEND_URL || 'https://addchrome.com/api').replace(/\/$/, ''),

  // Free tier: number of generations/day before premium is required.
  freeDailyGenerations: 1,

  // Fallback Groq config, used only if the shared backend's /listing-config
  // can't be reached or the admin panel hasn't saved any keys yet.
  groq: {
    apiKeys: (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },

  // Shared secret matching the main backend's LISTING_CONFIG_SECRET, used to
  // fetch the admin-panel-managed Groq keys from GET /listing-config.
  listingConfigSecret: process.env.LISTING_CONFIG_SECRET || '',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
};
