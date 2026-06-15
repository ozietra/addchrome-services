const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * BaseScraper: shared Puppeteer + Cheerio engine.
 *
 * The big Turkish marketplaces (Trendyol, Hepsiburada, Amazon...) render their
 * product lists with JavaScript and block plain HTTP requests, so we render the
 * page with a real (headless) browser via Puppeteer and then parse the rendered
 * HTML with Cheerio.
 *
 * Subclasses only implement:
 *   - buildSearchUrl(query) -> string
 *   - parse($, query)       -> array of result objects
 * and optionally set `this.waitSelector` (a CSS selector to wait for).
 */
class BaseScraper {
  constructor(name, key, baseUrl) {
    this.name = name;
    this.key = key;
    this.baseUrl = baseUrl;
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.maxResults = 20;
    this.waitSelector = null;
    // IMPORTANT: 'networkidle2' never settles on sites like Trendyol (they keep
    // long-lived analytics / websocket connections open), which caused the
    // "Navigation timeout of 25000 ms exceeded" errors. 'domcontentloaded' lets
    // the page load and we then explicitly wait for the product grid selector.
    this.gotoOptions = { waitUntil: 'domcontentloaded', timeout: 30000 };
    // How long to wait for the product grid to render after navigation.
    this.selectorTimeout = 12000;
  }

  // ---- hooks to override in subclasses ----
  buildSearchUrl(query) {
    throw new Error(`${this.name}: buildSearchUrl() not implemented`);
  }

  parse($, query) {
    throw new Error(`${this.name}: parse() not implemented`);
  }

  // ---- main entry, called by PriceSearchService with a shared browser ----
  async scrape(browser, query, options = {}) {
    const { debug = false } = options;
    const url = this.buildSearchUrl(query);
    let page;
    try {
      page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' });
      await page.setViewport({ width: 1366, height: 900 });

      // Reduce the bot-detection surface: hide navigator.webdriver and give the
      // page a realistic languages/plugins fingerprint before any site JS runs.
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });

      // Speed things up and reduce the detection surface by skipping heavy assets
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'image' || type === 'media' || type === 'font') req.abort();
        else req.continue();
      });

      await page.goto(url, this.gotoOptions);

      if (this.waitSelector) {
        try {
          await page.waitForSelector(this.waitSelector, { timeout: this.selectorTimeout });
        } catch (_) {
          // Selector never appeared: page may be blocked or the layout changed.
          // Give client-side rendering a last chance to hydrate, then parse
          // whatever is there (and fall back to embedded JSON in the subclass).
          await this.sleep(2500);
        }
      }

      const html = await page.content();
      if (debug) this._dumpHtml(html);

      const $ = cheerio.load(html);
      const items = (this.parse($, query) || []).filter(Boolean);
      return items.slice(0, this.maxResults);
    } catch (error) {
      console.error(`[${this.name}] scrape error: ${error.message}`);
      return [];
    } finally {
      if (page) {
        try { await page.close(); } catch (_) {}
      }
    }
  }

  // Writes the rendered HTML to backend/debug/<key>.html so you can inspect the
  // real DOM and fix selectors quickly. Enable with search(..., { debug: true }).
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

  // ---- helpers ----
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Generic, layout-independent fallback: most Turkish marketplaces embed
  // schema.org Product / ItemList data in <script type="application/ld+json">.
  // Parsing that is far more stable than CSS class names (which change often).
  // Returns an array of { productName, price, productUrl, imageUrl } or [].
  parseJsonLd($, site) {
    const out = [];
    const pushProduct = (node) => {
      if (!node || typeof node !== 'object') return;
      const type = node['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) return;
      let price = 0;
      const offers = node.offers;
      if (offers) {
        const o = Array.isArray(offers) ? offers[0] : offers;
        price = this.cleanPrice(o && (o.price || o.lowPrice || o.highPrice));
      }
      const name = this.cleanText(node.name || '');
      const url = this.abs(node.url || (node.offers && !Array.isArray(node.offers) && node.offers.url) || '');
      let image = node.image;
      if (Array.isArray(image)) image = image[0];
      if (image && typeof image === 'object') image = image.url;
      if (name && price > 0) {
        out.push({
          site,
          productName: name,
          price,
          currency: 'TRY',
          imageUrl: this.img(image || ''),
          productUrl: url,
          seller: this.name,
          rating: 0
        });
      }
    };
    $('script[type="application/ld+json"]').each((i, el) => {
      let raw = $(el).contents().text() || $(el).text();
      if (!raw) return;
      let json;
      try { json = JSON.parse(raw); } catch (_) { return; }
      const visit = (n) => {
        if (Array.isArray(n)) return n.forEach(visit);
        if (!n || typeof n !== 'object') return;
        pushProduct(n);
        if (Array.isArray(n.itemListElement)) {
          n.itemListElement.forEach((it) => visit(it && it.item ? it.item : it));
        }
        if (Array.isArray(n['@graph'])) n['@graph'].forEach(visit);
      };
      visit(json);
    });
    return out;
  }

  // Parses Turkish-formatted prices like "12.999,90 TL" -> 12999.9
  cleanPrice(priceText) {
    if (!priceText) return 0;
    const base = String(priceText).split('TL')[0].split('\u20BA')[0];
    return (
      parseFloat(
        base
          .replace(/[^\d.,]/g, '')
          .replace(/\.(?=\d{3})/g, '') // drop thousand separators
          .replace(',', '.')
      ) || 0
    );
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // Turns a relative or protocol-relative href into an absolute URL
  abs(link) {
    if (!link) return '';
    if (link.startsWith('//')) return 'https:' + link;
    return link.startsWith('/') ? this.baseUrl + link : link;
  }

  img(src) {
    if (!src) return '';
    return src.startsWith('//') ? 'https:' + src : src;
  }
}

module.exports = BaseScraper;
