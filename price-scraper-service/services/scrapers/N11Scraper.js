const BaseScraper = require('./BaseScraper');

class N11Scraper extends BaseScraper {
  constructor() {
    super('N11', 'n11', 'https://www.n11.com');
    this.waitSelector = '.columnContent .pro, .list-ul .column, li.column';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/arama?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
    $('.columnContent .pro, .list-ul .column').each((i, el) => {
      if (i >= this.maxResults) return false;
      const $el = $(el);
      const productName = this.cleanText($el.find('.productName').first().text());
      const priceText = $el.find('.newPrice ins, .newPrice').first().text();
      const price = this.cleanPrice(priceText);
      const imageUrl = this.img(
        $el.find('.imgOrj').attr('data-original') || $el.find('img').attr('src') || ''
      );
      const link = this.abs($el.find('a').first().attr('href') || '');

      if (productName && price > 0) {
        results.push({
          site: 'n11',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link,
          seller: 'n11',
          rating: 0
        });
      }
    });

    if (results.length === 0) return this.parseJsonLd($, 'n11');
    return results;
  }
}

module.exports = N11Scraper;
