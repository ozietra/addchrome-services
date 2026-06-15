const cheerio = require('cheerio');
const BaseScraper = require('./BaseScraper');

class GittiGidiyorScraper extends BaseScraper {
  constructor() {
    super('GittiGidiyor', 'https://www.gittigidiyor.com');
  }

  async search(query) {
    const url = `${this.baseUrl}/arama/?k=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results = [];

    $('.catalog-view .product-card, .listingGrid .product-card').each((i, el) => {
      if (i >= 20) return false;

      const $el = $(el);
      const productName = this.cleanText($el.find('.product-title, .product-card-title').text());
      const priceText = $el.find('.product-price, .price').first().text();
      const price = this.cleanPrice(priceText);
      const imageUrl = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      const link = $el.find('a').first().attr('href') || '';

      if (productName && price > 0) {
        results.push({
          site: 'gittigidiyor',
          productName,
          price,
          currency: 'TRY',
          imageUrl,
          productUrl: link.startsWith('/') ? this.baseUrl + link : link,
          seller: 'GittiGidiyor',
          rating: 0
        });
      }
    });

    return results;
  }
}

module.exports = GittiGidiyorScraper;
