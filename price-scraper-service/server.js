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

// POST /debug-html — fetch Akakce search HTML for debugging selectors
app.post('/debug-html', requireApiKey, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'query required' });

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const siteUrl = req.body.site === 'cimri' ? `https://www.cimri.com/arama/?q=${encodeURIComponent(query)}` : `https://www.akakce.com/arama/?q=${encodeURIComponent(query)}`;
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    
    if (req.body.site === 'cimri') {
       try { await page.waitForSelector('a[href*="-fiyatlari"]', {timeout: 10000}); } catch(e) {}
    } else {
       try { await page.waitForSelector('a[href*="-fiyati,"]', {timeout: 10000}); } catch(e) {}
    }

    const html = await page.content();
    await browser.close();

    // Extract first 5000 chars of product-related HTML
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Find all links/elements that look product-related
    const productSelectors = [];
    $('a').each((i, el) => {
      if (i >= 20) return false;
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().substring(0, 100);
      const classes = $(el).attr('class') || '';
      if (text && href) {
        productSelectors.push({ href: href.substring(0, 150), text, classes });
      }
    });

    // Get the main content area classes
    const bodyClasses = $('body').attr('class') || '';
    const mainContent = $('ul, .w, #content, main, .search-results').first().html() || '';

    res.json({
      success: true,
      pageTitle: $('title').text(),
      bodyClasses,
      totalLinks: $('a').length,
      fiyatiLinks: $('a[href*="-fiyati,"]').length,
      sampleLinks: productSelectors,
      mainContentSnippet: mainContent.substring(0, 3000)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
