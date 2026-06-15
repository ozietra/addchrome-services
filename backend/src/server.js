const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscription');
const paymentRoutes = require('./routes/payment');
const priceRoutes = require('./routes/price');
const adminRoutes = require('./routes/admin');

const app = express();

// cPanel runs behind LiteSpeed reverse proxy — trust proxy headers
// so that express-rate-limit and req.ip work correctly.
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS - allow Chrome extensions and admin panel
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (extensions, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    // Allow configured origins
    if (config.allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    // Allow localhost in development
    if (config.nodeEnv === 'development' && origin.includes('localhost')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later' }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Never let the browser cache API responses. Without this, a normal page
// refresh (F5) can serve a stale/empty cached GET for /api/admin/* while a hard
// refresh (Ctrl+Shift+R) bypasses the cache — which is exactly why the admin
// panel's users/stats "disappeared" on a normal refresh.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Admin panel path: configurable for different deploy environments.
// On cPanel the admin-panel is placed inside the app root, so override with
//   ADMIN_PANEL_PATH=./admin-panel
// Locally the default ../../admin-panel still works.
const adminPanelPath = process.env.ADMIN_PANEL_PATH
  ? path.resolve(process.env.ADMIN_PANEL_PATH)
  : path.join(__dirname, '../../admin-panel');

app.use('/admin', express.static(adminPanelPath, {
  etag: false,
  lastModified: false,
  cacheControl: false,
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); }
}));

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/subscription', apiLimiter, subscriptionRoutes);
app.use('/api/payment', paymentRoutes); // No rate limit on webhooks
app.use('/api/price', apiLimiter, priceRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Chrome Extensions API is running',
    version: '1.0.0',
    environment: config.nodeEnv
  });
});

// Admin panel SPA fallback
app.get('/admin/*', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(adminPanelPath, 'index.html'));
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`  Chrome Extensions API Server`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
  console.log(`===========================================\n`);
});

module.exports = app;
