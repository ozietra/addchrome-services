const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');

const TrendyolScraper = require('./scrapers/TrendyolScraper');
const HepsiburadaScraper = require('./scrapers/HepsiburadaScraper');
const AmazonScraper = require('./scrapers/AmazonScraper');
const N11Scraper = require('./scrapers/N11Scraper');
const CiceksepetiScraper = require('./scrapers/CiceksepetiScraper');
const PuppeteerAkakceScraper = require('./scrapers/PuppeteerAkakceScraper');

// Cache results for 15 minutes (per query + selected-site combination)
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const scrapers = {
  trendyol: new TrendyolScraper(),
  hepsiburada: new HepsiburadaScraper(),
  amazon: new AmazonScraper(),
  n11: new N11Scraper(),
  ciceksepeti: new CiceksepetiScraper(),
  akakce: new PuppeteerAkakceScraper()
};

const siteInfo = {
  trendyol: { name: 'Trendyol', color: '#f27a1a' },
  hepsiburada: { name: 'Hepsiburada', color: '#ff6000' },
  amazon: { name: 'Amazon TR', color: '#ff9900' },
  n11: { name: 'n11', color: '#7b2d8e' },
  ciceksepeti: { name: '\u00C7i\u00E7eksepeti', color: '#66cc00' },
  akakce: { name: 'Akak\u00E7e', color: '#e53935' }
};

// Used when the caller doesn't specify any sites
const DEFAULT_SITES = ['trendyol', 'hepsiburada', 'amazon', 'n11'];

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

    // NOTE: The direct marketplace scrapers (Trendyol/Hepsiburada/n11/Çiçeksepeti)
    // are blocked by aggressive bot protection and return nothing. We therefore
    // source everything from the Akakce aggregator, which already returns each
    // result tagged with its real store (Trendyol, Hepsiburada, ...) and a
    // direct link to that store — so the UI still shows diverse shops.
    selected = ['akakce'];

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

      // Run all selected scrapers in parallel against the same browser.
      const settled = await Promise.allSettled(
        selected.map((site) => scrapers[site].scrape(browser, query, { debug }))
      );

      settled.forEach((r, idx) => {
        const site = selected[idx];
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          console.log(`[PriceSearch]   ${site}: ${r.value.length} items`);
          results.push(...r.value);
        } else if (r.status === 'rejected') {
          console.error(`[PriceSearch]   ${site}: FAILED -> ${r.reason}`);
        } else {
          console.warn(`[PriceSearch]   ${site}: 0 items (no array returned)`);
        }
      });
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
