const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * Akakce aggregator scraper.
 *
 * Akakce already lists a product's price across many stores, so it is a useful
 * "bonus" source. It uses the shared browser handed in by PriceSearchService
 * (it no longer launches its own), and exposes the same scrape(browser, query)
 * interface as the BaseScraper-derived scrapers.
 */
class PuppeteerAkakceScraper {
  constructor() {
    this.name = 'Akakce';
    this.key = 'akakce';
    this.baseUrl = 'https://www.akakce.com';
    this.maxResults = 50;     // how many products to parse/return (was 20, only 10 surfaced)
    this.detailLimit = 35;    // how many to enrich with real store name + direct link
    this.dropUnresolved = true; // hide rows whose real store couldn't be resolved (no Akakce leak)
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  cleanPrice(priceText) {
    if (!priceText) return 0;
    const basePrice = String(priceText).split('TL')[0].split('F\u0130YAT')[0];
    return (
      parseFloat(
        basePrice.replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
      ) || 0
    );
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  _dumpHtml(html) {
    try {
      const dir = path.join(__dirname, '..', '..', '..', 'debug');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${this.key}.html`), html);
      console.log(`[${this.name}] debug HTML -> backend/debug/${this.key}.html`);
    } catch (e) {
      console.error(`[${this.name}] debug dump failed: ${e.message}`);
    }
  }

  // Follows Akakce's outbound "/c/?..." redirect to recover the REAL store URL
  // (e.g. https://www.trendyol.com/...), so we can link straight to the store
  // instead of through Akakce's "Y\u00f6nlendiriliyor" interstitial. We only read
  // the redirect target URL — we never load or scrape the store page, so the
  // store's bot protection is irrelevant here.
  async resolveFinalUrl(startUrl) {
    if (typeof fetch === 'undefined') return ''; // Node < 18: no global fetch
    let url = startUrl;
    try {
      for (let hop = 0; hop < 4; hop++) {
        let res;
        try {
          res = await fetch(url, {
            redirect: 'manual',
            headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'tr-TR,tr;q=0.9' }
          });
        } catch (_) { break; }

        const loc = res.headers.get('location');
        if (loc) {
          url = loc.startsWith('http') ? loc : new URL(loc, url).href;
          if (!/akakce\.com/i.test(url)) return url;   // left Akakce -> real store URL
          continue;                                    // another Akakce hop, keep following
        }

        // No HTTP redirect header: read the target from the interstitial HTML
        // (meta-refresh / JS location / embedded url= parameter).
        let body = '';
        try { body = await res.text(); } catch (_) {}
        const m =
          body.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+url=([^"'>\s]+)/i) ||
          body.match(/location(?:\.href|\.replace|\.assign)?\s*=?\s*\(?\s*["']([^"']+)["']/i) ||
          body.match(/[?&](?:url|u|to|redirect)=((?:https?%3A|https?:)[^"'&\s]+)/i);
        if (m) {
          let target = m[1];
          try { target = decodeURIComponent(target); } catch (_) {}
          target = target.startsWith('http') ? target : new URL(target, url).href;
          if (!/akakce\.com/i.test(target)) return target;
          url = target;
          continue;
        }
        break;
      }
    } catch (_) {}
    return /akakce\.com/i.test(url) ? '' : url;
  }

  async scrape(browser, query, options = {}) {
    const { debug = false } = options;
    let page;
    try {
      page = await browser.newPage();
      await page.setUserAgent(this.userAgent);

      const url = `${this.baseUrl}/arama/?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

      const html = await page.content();
      if (debug) this._dumpHtml(html);

      const $ = cheerio.load(html);
      const results = [];

      $('a[href*="-fiyati,"]').each((i, el) => {
        if (i >= this.maxResults) return false;

        const $el = $(el);
        const titleText =
          $el.find('.pn_v8, h3, h2').text() || $el.find('img').attr('alt') || $el.attr('title') || '';
        const productName = this.cleanText(titleText);

        const priceText = $el.find('.pt_v9, .pt_v8').first().text();
        const price = this.cleanPrice(priceText);
        const imageUrl = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
        const link = $el.attr('href') || '';
        const seller = this.cleanText($el.find('.p_s, .store-name, .v8_s').text());

        if (productName && price > 0 && link) {
        let siteKey = 'akakce';
        const sLower = seller.toLowerCase();
        if (sLower.includes('trendyol')) siteKey = 'trendyol';
        else if (sLower.includes('hepsiburada') || sLower.includes('hb')) siteKey = 'hepsiburada';
        else if (sLower.includes('amazon')) siteKey = 'amazon';
        else if (sLower.includes('n11')) siteKey = 'n11';
        else if (sLower.includes('ciceksepeti') || sLower.includes('\u00E7i\u00E7ek')) siteKey = 'ciceksepeti';

        results.push({
        site: siteKey,
        productName,
        price,
        currency: 'TRY',
        imageUrl: imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl,
        productUrl: link.startsWith('/') ? this.baseUrl + link : link,
        seller: seller || '',
        rating: 0
        });
        }
      });

      // Enrich results with the real cheapest-store name + a direct redirect to
      // that store, so each row looks like a normal shop (never "Akakce"). We
      // enrich up to detailLimit; unresolved rows are dropped (dropUnresolved)
      // so the aggregator never leaks through a visible akakce.com URL.
      const toEnrich = results.slice(0, this.detailLimit);
      const detailed = [];
      const BATCH_SIZE = 6;

      const mapLogoToStore = (logoSrc) => {
        if (!logoSrc) return '';
        if (logoSrc.includes('/731.')) return 'Amazon';
        if (logoSrc.includes('/11.')) return 'Hepsiburada';
        if (logoSrc.includes('/8.')) return 'Trendyol';
        if (logoSrc.includes('/33.')) return 'n11';
        if (logoSrc.includes('/14.')) return 'PttAVM';
        if (logoSrc.includes('/74.')) return '\u00C7i\u00E7eksepeti';
        return '';
      };
      const sellerToSite = (name) => {
        const s = (name || '').toLowerCase();
        if (s.includes('trendyol')) return 'trendyol';
        if (s.includes('hepsiburada') || s.includes('hepsi') || s === 'hb') return 'hepsiburada';
        if (s.includes('amazon')) return 'amazon';
        if (s.includes('n11')) return 'n11';
        if (s.includes('ciceksepeti') || s.includes('\u00E7i\u00E7ek')) return 'ciceksepeti';
        if (s.includes('pttavm') || s.includes('ptt')) return 'pttavm';
        return 'store';
      };

      for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
        const batch = toEnrich.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (item) => {
          if (!item.productUrl.includes('.html')) return item;
          let detailPage;
          try {
            detailPage = await browser.newPage();
            await detailPage.setUserAgent(this.userAgent);
            await detailPage.goto(item.productUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            const prodHtml = await detailPage.content();
            const $p = cheerio.load(prodHtml);

            const firstRedirect = $p('a[href*="/c/?"]').first();
            if (firstRedirect.length > 0) {
              const parentRow = firstRedirect.closest('li, div, tr');
              const storeNameText = parentRow.find('.v8_s, .p_s, .store-name').text();
              const storeLogoAlt = parentRow
                .find('img[class^="v"], img[src*="cdn.akakce.com/im/"]')
                .attr('alt');
              const logoSrc =
                parentRow.find('img[class^="v"], img[src*="cdn.akakce.com/im/"]').attr('src') || '';
              const finalLink = firstRedirect.attr('href');

              let store = '';
              if (storeNameText) store = this.cleanText(storeNameText);
              else if (storeLogoAlt && storeLogoAlt !== 'Ma\u011faza logosu') store = this.cleanText(storeLogoAlt);
              else store = mapLogoToStore(logoSrc);

              if (store && !/akak/i.test(store)) {
                item.seller = store;
                item.site = sellerToSite(store);
                item.__resolved = true;
              }
              if (finalLink) {
                const cAbs = finalLink.startsWith('/') ? this.baseUrl + finalLink : finalLink;
                // Resolve the akakce "/c/?..." redirect to the real store URL so
                // the user lands directly on the store (no akakce interstitial).
                const direct = await this.resolveFinalUrl(cAbs);
                item.productUrl = direct || cAbs;
                if (direct) item.__directStore = true;
              }
            }
          } catch (e) {
            console.error(`[Akakce Detail] ${item.productUrl}: ${e.message}`);
          } finally {
            if (detailPage) {
              try { await detailPage.close(); } catch (_) {}
            }
          }
          return item;
        });

        const resolvedBatch = await Promise.all(batchPromises);
        detailed.push(...resolvedBatch);
      }

      // Disguise step: keep resolved rows; drop (or neutralize) unresolved ones
      // so "Akakce" / an akakce.com URL is never shown to the user.
      let out = detailed;
      if (this.dropUnresolved) {
        out = out.filter((item) => item.__resolved);
      } else {
        out = out.map((item) => {
          if (!item.__resolved) {
            if (!item.seller || /akak/i.test(item.seller)) item.seller = 'Ma\u011faza';
            if (item.site === 'akakce') item.site = 'store';
          }
          return item;
        });
      }
      const directCount = out.filter((r) => r.__directStore).length;
      out.forEach((item) => { delete item.__resolved; delete item.__directStore; });

      console.log(`[Akakce] returning ${out.length} products (enriched ${toEnrich.length}, parsed ${results.length}, direct-store URLs ${directCount})`);
      return out;
    } catch (error) {
      console.error(`[${this.name}] scrape error: ${error.message}`);
      return [];
    } finally {
      if (page) {
        try { await page.close(); } catch (_) {}
      }
    }
  }
}

module.exports = PuppeteerAkakceScraper;
