const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // The shared chrome-extensions-backend (auth, subscriptions, admin). This
  // service has no database of its own — it proxies auth/subscription/usage
  // checks here so all extensions keep sharing one user base.
  mainBackendUrl: (process.env.MAIN_BACKEND_URL || 'https://addchrome.com/api').replace(/\/$/, ''),

  // Groq API (api.groq.com — fast LPU inference) — comma-separated pool of up to
  // 20 keys, rotated on rate-limit/error by GroqService.
  groq: {
    apiKeys: (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },

  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
};
