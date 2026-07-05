const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // The shared chrome-extensions-backend (auth, subscriptions, admin). This
  // service has no database of its own — it proxies auth/subscription/usage
  // checks here so all extensions keep sharing one user base.
  mainBackendUrl: (process.env.MAIN_BACKEND_URL || 'https://addchrome.com/api').replace(/\/$/, ''),

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
