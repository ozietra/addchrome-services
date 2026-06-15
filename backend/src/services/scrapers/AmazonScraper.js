const BaseScraper = require('./BaseScraper');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon', 'amazon', 'https://www.amazon.com.tr');
    this.waitSelector = '[data-component-type="s-search-result"]';
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/s?k=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
    $('[data-component-type="s-search-result"]').each((i, el) => {
      if (i >= this.maxResults) return false;
      const $el = $(el);
      const productName = this.cleanText($el.find('h2 span').first().text());
      const whole = $el.find('.a-price-whole').first().text();
      const fraction = $el.find('.a-price-fraction').first().text();
      const price = this.cleanPrice(whole + (fraction ? ',' + fraction : ''));
      const imageUrl = this.img($el.find('.s-image').attr('src') || '');
      const link = this.abs($el.find('h2 a, a.a-link-normal').attr('href') || '');
      const rating =
        parseFloat(($el.find('.a-icon-alt').first().text() || '').replace(',', '.')) || 0;

      if (productName && price > 0) {
        results.push({
          site: 'amazon',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link,
          seller: 'Amazon',
          rating
        });
      }
    });
    return results;
  }
}

module.exports = AmazonScraper;
