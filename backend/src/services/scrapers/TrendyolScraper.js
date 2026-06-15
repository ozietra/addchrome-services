const BaseScraper = require('./BaseScraper');

class TrendyolScraper extends BaseScraper {
  constructor() {
    super('Trendyol', 'trendyol', 'https://www.trendyol.com');
    this.waitSelector = '.p-card-wrppr, [data-id], .prdct-cntnr-wrppr';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/sr?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
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

    // Fallback: if the CSS selectors matched nothing (layout changed or the grid
    // didn't hydrate), use the embedded schema.org data instead.
    if (results.length === 0) return this.parseJsonLd($, 'trendyol');
    return results;
  }
}

module.exports = TrendyolScraper;
