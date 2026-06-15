const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const NodeCache = require('node-cache');

const TrendyolScraper = require('./scrapers/TrendyolScraper');
const HepsiburadaScraper = require('./scrapers/HepsiburadaScraper');
const AmazonScraper = require('./scrapers/AmazonScraper');
const N11Scraper = require('./scrapers/N11Scraper');
const CiceksepetiScraper = require('./scrapers/CiceksepetiScraper');
const PuppeteerAkakceScraper = require('./scrapers/PuppeteerAkakceScraper');
const CimriScraper = require('./scrapers/CimriScraper');

// Cache results for 15 minutes (per query + selected-site combination)
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const scrapers = {
  trendyol: new TrendyolScraper(),
  hepsiburada: new HepsiburadaScraper(),
  amazon: new AmazonScraper(),
  n11: new N11Scraper(),
  ciceksepeti: new CiceksepetiScraper(),
  akakce: new PuppeteerAkakceScraper(),
  cimri: new CimriScraper()
};

const siteInfo = {
  trendyol: { name: 'Trendyol', color: '#f27a1a' },
  hepsiburada: { name: 'Hepsiburada', color: '#ff6000' },
  amazon: { name: 'Amazon TR', color: '#ff9900' },
  n11: { name: 'n11', color: '#7b2d8e' },
  ciceksepeti: { name: '\u00C7i\u00E7eksepeti', color: '#66cc00' },
  akakce: { name: 'Akak\u00E7e', color: '#e53935' },
  cimri: { name: 'Cimri', color: '#0786e7' }
};

// Used when the caller doesn't specify any sites.
// We default to Cimri alone because it aggregates all other marketplaces,
// and running multiple headless scrapers concurrently crashes the Render free tier.
const DEFAULT_SITES = ['cimri'];

class PriceSearchService {
  /**
   * @param {string} query
   * @param {string[]} sites - which site keys to search (e.g. ['trendyol','amazon'])
   * @param {object} options - { maxResults, debug }
   */
  async search(query, sites = [], options = {}) {
    const { maxResults = 50, debug = false } = options;

    // Keep only sites we actually have a scraper for; fall back to defaults
    let selected = (Array.isArray(sites) ? sites : [])
      .map((s) => String(s).toLowerCase())
      .filter((s) => scrapers[s]);
    if (selected.length === 0) selected = [...DEFAULT_SITES];

    // NOTE: Akakce is blocked by Cloudflare bot protection. We use Cimri
    // as an aggregator and direct marketplace scrapers instead.
    // If Akakce was explicitly requested, swap it for Cimri.
    if (selected.includes('akakce')) {
      selected = selected.filter(s => s !== 'akakce');
      if (!selected.includes('cimri')) selected.push('cimri');
    }
    if (selected.length === 0) selected = [...DEFAULT_SITES];

    const cacheKey = `search:${query.toLowerCase()}:${[...selected].sort().join(',')}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[PriceSearch] cache hit for "${query}"`);
      return cached;
    }

    const startTime = Date.now();
    let browser;
    let results = [];

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });

      const allResults = [];
      const siteStats = {};

      for (const siteKey of selected) {
        const scraper = scrapers[siteKey];
        try {
          const start = Date.now();
          const siteResults = await scraper.scrape(browser, query, { debug });
          siteStats[siteKey] = { items: siteResults.length, ms: Date.now() - start };
          console.log(`[PriceSearch]   ${siteKey}: ${siteResults.length} items`);
          allResults.push(...siteResults);
        } catch (err) {
          siteStats[siteKey] = { items: 0, error: err.message };
          console.error(`[PriceSearch]   ${siteKey} failed: ${err.message}`);
        }
      }
      results = allResults;
    } catch (error) {
      console.error(`[PriceSearch] browser error: ${error.message}`);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }

    // Validate, dedupe (keep cheapest per URL), sort ascending, limit
    results = results.filter(
      (r) => r && r.productName && r.price > 0 && r.productUrl && /^https?:\/\//.test(r.productUrl)
    );

    const byUrl = new Map();
    for (const r of results) {
      const existing = byUrl.get(r.productUrl);
      if (!existing || r.price < existing.price) byUrl.set(r.productUrl, r);
    }
    results = [...byUrl.values()].sort((a, b) => a.price - b.price);

    if (maxResults > 0) results = results.slice(0, maxResults);

    const duration = Date.now() - startTime;
    const response = { results, totalResults: results.length, duration, sites: selected };

    cache.set(cacheKey, response);
    console.log(
      `[PriceSearch] "${query}" [${selected.join(',')}] -> ${results.length} results in ${duration}ms`
    );
    return response;
  }

  getSupportedSites() {
    return Object.entries(siteInfo).map(([id, info]) => ({ id, ...info }));
  }

  clearCache() {
    cache.flushAll();
  }
}

module.exports = new PriceSearchService();
