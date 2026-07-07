const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const listingRoutes = require('./routes/listing');

const app = express();

// Runs behind a platform reverse proxy (Render) — trust proxy headers so
// express-rate-limit and req.ip work correctly.
app.set('trust proxy', 1);

connectDB();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS - allow Chrome extensions and any explicitly configured origins
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    if (config.allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    if (config.nodeEnv === 'development' && origin.includes('localhost')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' }
});

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Listing Writer backend is running',
    environment: config.nodeEnv
  });
});

app.use('/api/listing', apiLimiter, listingRoutes);

app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`  AI Listing Writer Backend`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`===========================================\n`);
});

module.exports = app;
