const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chrome-extensions',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_dev_only',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@admin.com',
    password: process.env.ADMIN_PASSWORD || 'admin123456'
  },
  // Price scraper microservice (Render.com)
  scraperServiceUrl: (process.env.SCRAPER_SERVICE_URL || '').replace(/\/$/, ''),
  scraperApiKey: process.env.SCRAPER_API_KEY || '',
  paytr: {
    merchantId: process.env.PAYTR_MERCHANT_ID || '',
    merchantKey: process.env.PAYTR_MERCHANT_KEY || '',
    merchantSalt: process.env.PAYTR_MERCHANT_SALT || '',
    okUrl: process.env.PAYTR_OK_URL || '',
    failUrl: process.env.PAYTR_FAIL_URL || '',
    callbackUrl: process.env.PAYTR_CALLBACK_URL || ''
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
  // Shared secret so the standalone ai-listing-backend service can pull the
  // admin-configured Groq keys from GET /api/listing-config.
  listingConfigSecret: process.env.LISTING_CONFIG_SECRET || '',
  extensions: {
    'ig-export': {
      name: { en: 'Instagram Follower Export Tool', tr: 'Instagram Takipçi Dışa Aktarma Aracı' },
      // dailyExports = number of scans/exports allowed per day (free tier).
      free: { dailyExports: 5, followerLimit: 1000, likesEnabled: false, commentsEnabled: false, excelEnabled: false },
      premium: { dailyExports: -1, followerLimit: -1, likesEnabled: true, commentsEnabled: true, excelEnabled: true }
    },
    'ig-unfollow': {
      name: { en: 'Instagram Unfollow AI', tr: 'Instagram Takipten Çıkarma AI' },
      free: { dailyScans: 2, dailyUnfollows: 30, whitelistLimit: 15, speedModes: ['slow'] },
      premium: { dailyScans: -1, dailyUnfollows: -1, whitelistLimit: -1, speedModes: ['slow', 'balanced', 'fast'] }
    },
    'price-compare': {
      name: { en: 'Price Compare - Smart Shopping Assistant', tr: 'Fiyat Karşılaştır - Akıllı Alışveriş Asistanı' },
      free: { dailySearches: 5, maxSites: -1, maxResults: 30, historyEnabled: false, favoritesEnabled: false },
      premium: { dailySearches: -1, maxSites: -1, maxResults: 50, historyEnabled: true, favoritesEnabled: true }
    },
    'ai-listing-writer': {
      name: { en: 'AI Listing Writer', tr: 'AI İlan Yazarı' },
      // dailyGenerations = number of AI title+description generations allowed per day (free tier).
      free: { dailyGenerations: 1 },
      premium: { dailyGenerations: -1 }
    }
  }
};
