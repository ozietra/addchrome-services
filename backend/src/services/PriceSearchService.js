/**
 * PriceSearchService — PROXY MODE
 *
 * The actual Puppeteer scraping now runs on a separate microservice
 * (Render.com) because cPanel shared hosting cannot run Chromium.
 *
 * This module proxies search requests from the main backend to the
 * scraper microservice via HTTP, so the Chrome extensions and the
 * rest of the backend code don't need to change at all.
 */

const fetch = require('node-fetch');
const config = require('../config');

const siteInfo = {
  trendyol:    { name: 'Trendyol',      color: '#f27a1a' },
  hepsiburada: { name: 'Hepsiburada',   color: '#ff6000' },
  amazon:      { name: 'Amazon TR',     color: '#ff9900' },
  n11:         { name: 'n11',           color: '#7b2d8e' },
  ciceksepeti: { name: 'Çiçeksepeti',   color: '#66cc00' },
  akakce:      { name: 'Akakçe',        color: '#e53935' }
};

class PriceSearchService {
  /**
   * Proxy the search request to the scraper microservice.
   *
   * @param {string} query
   * @param {string[]} sites
   * @param {object} options - { maxResults, debug }
   */
  async search(query, sites = [], options = {}) {
    const { maxResults = 50, debug = false } = options;

    const scraperUrl = config.scraperServiceUrl;
    if (!scraperUrl) {
      throw new Error('SCRAPER_SERVICE_URL is not configured');
    }

    const startTime = Date.now();
    console.log(`[PriceSearch/Proxy] Forwarding "${query}" to ${scraperUrl}/search`);

    try {
      const response = await fetch(`${scraperUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.scraperApiKey || ''
        },
        body: JSON.stringify({ query, sites, maxResults, debug }),
        // 60 second timeout — scraping can be slow
        timeout: 60000
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[PriceSearch/Proxy] Scraper returned ${response.status}: ${errorBody}`);
        throw new Error(`Scraper service error: ${response.status}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.success && data.data) {
        console.log(
          `[PriceSearch/Proxy] "${query}" -> ${data.data.totalResults} results in ${duration}ms`
        );
        return data.data;
      }

      // Fallback: return empty result set
      return { results: [], totalResults: 0, duration, sites: [] };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[PriceSearch/Proxy] Error after ${duration}ms: ${error.message}`);

      // If scraper is down (Render free tier sleeps after 15 min inactivity),
      // return a friendly error rather than crashing.
      if (error.type === 'request-timeout' || error.code === 'ETIMEDOUT') {
        throw new Error(
          'Fiyat tarama servisi şu anda uyandırılıyor. Lütfen 30-60 saniye sonra tekrar deneyin.'
        );
      }
      throw error;
    }
  }

  getSupportedSites() {
    return Object.entries(siteInfo).map(([id, info]) => ({ id, ...info }));
  }

  clearCache() {
    // Forward cache clear to the microservice
    const scraperUrl = config.scraperServiceUrl;
    if (!scraperUrl) return;

    fetch(`${scraperUrl}/clear-cache`, {
      method: 'POST',
      headers: { 'X-API-Key': config.scraperApiKey || '' }
    }).catch((err) => {
      console.error(`[PriceSearch/Proxy] Failed to clear remote cache: ${err.message}`);
    });
  }
}

module.exports = new PriceSearchService();
