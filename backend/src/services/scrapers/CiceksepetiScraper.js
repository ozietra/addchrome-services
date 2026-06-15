const BaseScraper = require('./BaseScraper');

class CiceksepetiScraper extends BaseScraper {
  constructor() {
    super('Ciceksepeti', 'ciceksepeti', 'https://www.ciceksepeti.com');
    this.waitSelector = '.product-item, .product__item, [class*="productItem"]';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/ara?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
    $('.product-item, .product__item, [class*="productItem"]').each((i, el) => {
      if (i >= this.maxResults) return false;
      const $el = $(el);
      const productName = this.cleanText(
        $el.find('.product-title, .product__title, [class*="name"]').first().text()
      );
      const priceText = $el
        .find('.product-price, .product__price, [class*="price"]')
        .first()
        .text();
      const price = this.cleanPrice(priceText);
      const imageUrl = this.img(
        $el.find('img').attr('src') || $el.find('img').attr('data-src') || ''
      );
      const link = this.abs($el.find('a').first().attr('href') || '');

      if (productName && price > 0) {
        results.push({
          site: 'ciceksepeti',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link,
          seller: '\u00C7i\u00E7eksepeti',
          rating: 0
        });
      }
    });

    if (results.length === 0) return this.parseJsonLd($, 'ciceksepeti');
    return results;
  }
}

module.exports = CiceksepetiScraper;
