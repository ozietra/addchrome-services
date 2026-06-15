const BaseScraper = require('./BaseScraper');

class TrendyolScraper extends BaseScraper {
  constructor() {
    super('Trendyol', 'trendyol', 'https://www.trendyol.com');
    this.waitSelector = '.p-card-wrppr, [data-id], .prdct-cntnr-wrppr, .search-productresults';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/sr?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    let results = [];

    // Strategy 1: Try parsing from embedded __SEARCH_RESULT_MODEL__ or similar
    // Trendyol embeds search data as JSON in script tags
    $('script').each((i, el) => {
      const text = $(el).html() || '';
      // Look for embedded product data in window.__SEARCH_RESULT_MODEL__
      const patterns = [
        /window\.__SEARCH_RESULT_MODEL__\s*=\s*(\{.+?\});?\s*(?:<\/script|$)/s,
        /window\.__PRODUCT_DETAIL_APP_INITIAL_STATE__\s*=\s*(\{.+?\});?\s*(?:<\/script|$)/s,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const products = data.result?.products || data.products || [];
            for (const p of products) {
              if (results.length >= this.maxResults) break;
              const name = this.cleanText(p.name || p.brand?.name + ' ' + p.name || '');
              const price = p.price?.sellingPrice || p.price?.originalPrice || p.sellingPrice || 0;
              const imageUrl = p.images?.[0] 
                ? `https://cdn.dsmcdn.com${p.images[0]}` 
                : (p.imageUrl || '');
              const url = p.url 
                ? `https://www.trendyol.com${p.url}` 
                : '';
              
              if (name && price > 0) {
                results.push({
                  site: 'trendyol',
                  productName: name,
                  price,
                  currency: 'TRY',
                  imageUrl,
                  productUrl: url,
                  seller: 'Trendyol',
                  rating: p.ratingScore?.averageRating || 0
                });
              }
            }
          } catch (_) {}
        }
      }
    });

    if (results.length > 0) return results;

    // Strategy 2: Parse product cards from DOM
    $('.p-card-wrppr, [data-id]').each((i, el) => {
      if (i >= this.maxResults) return false;
      const $el = $(el);
      const productName = this.cleanText(
        `${$el.find('.prdct-desc-cntnr-ttl').text()} ${$el.find('.prdct-desc-cntnr-name').text()}`
      );
      const priceText =
        $el.find('.prc-box-dscntd').first().text() ||
        $el.find('.prc-box-sllng').first().text() ||
        $el.find('[class*="price"]').first().text();
      const price = this.cleanPrice(priceText);
      const imageUrl = this.img($el.find('.p-card-img, img').attr('src') || '');
      const link = this.abs($el.find('a').attr('href') || '');

      if (productName && price > 0) {
        results.push({
          site: 'trendyol',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link,
          seller: 'Trendyol',
          rating: 0
        });
      }
    });

    // Strategy 3: JSON-LD fallback
    if (results.length === 0) return this.parseJsonLd($, 'trendyol');
    return results;
  }
}

module.exports = TrendyolScraper;
