const BaseScraper = require('./BaseScraper');

class HepsiburadaScraper extends BaseScraper {
  constructor() {
    super('Hepsiburada', 'hepsiburada', 'https://www.hepsiburada.com');
    this.waitSelector = '[data-test-id="product-card-item"], li[class*="productListContent"]';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/ara?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
    $('[data-test-id="product-card-item"], li[class*="productListContent"]').each((i, el) => {
      if (i >= this.maxResults) return false;
      const $el = $(el);
      const productName = this.cleanText(
        $el.find('[data-test-id="product-card-name"], h3').first().text()
      );
      const priceText = $el
        .find('[data-test-id="price-current-price"], [class*="price"]')
        .first()
        .text();
      const price = this.cleanPrice(priceText);
      const imageUrl = this.img($el.find('img').attr('src') || '');
      const link = this.abs($el.find('a').attr('href') || '');

      if (productName && price > 0) {
        results.push({
          site: 'hepsiburada',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link,
          seller: 'Hepsiburada',
          rating: 0
        });
      }
    });

    if (results.length === 0) return this.parseJsonLd($, 'hepsiburada');
    return results;
  }
}

module.exports = HepsiburadaScraper;
