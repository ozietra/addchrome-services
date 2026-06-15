/**
 * Price Scraper Microservice
 * 
 * Standalone Express server that runs Puppeteer + Chromium for price scraping.
 * Deployed on Render.com (free tier) because cPanel shared hosting cannot run Chromium.
 * 
 * The main backend (api.addchrome.com) proxies price search requests here.
 * Protected by X-API-Key header — only the main backend knows the key.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const PriceSearchService = require('./services/PriceSearchService');

const app = express();

const API_KEY = process.env.SCRAPER_API_KEY || '';
const PORT = process.env.PORT || 4000;

// Security
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Key middleware — reject requests without the correct key
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!API_KEY) {
    console.warn('[WARN] SCRAPER_API_KEY is not set — all requests are allowed (insecure!)');
    return next();
  }
  if (key !== API_KEY) {
    return res.status(403).json({ success: false, message: 'Invalid API key' });
  }
  next();
}

// Health check (no auth needed)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Price Scraper Service is running',
    version: '1.0.0'
  });
});

// GET /sites — supported sites list (no auth needed)
app.get('/sites', (req, res) => {
  const sites = PriceSearchService.getSupportedSites();
  res.json({ success: true, data: { sites } });
});

// POST /search — perform price search (API key required)
app.post('/search', requireApiKey, async (req, res) => {
  try {
    const { query, sites, maxResults, debug } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    console.log(`[Scraper] Search request: "${query}" sites=[${(sites || []).join(',')}]`);

    const result = await PriceSearchService.search(
      query.trim(),
      sites || [],
      { maxResults: maxResults || 50, debug: debug === true }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`[Scraper] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Scraping failed', error: error.message });
  }
});

// POST /clear-cache — flush the result cache
app.post('/clear-cache', requireApiKey, (req, res) => {
  PriceSearchService.clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`  Price Scraper Microservice`);
  console.log(`  Port: ${PORT}`);
  console.log(`  API Key: ${API_KEY ? 'SET' : 'NOT SET (insecure!)'}`);
  console.log(`=========================================\n`);
});
