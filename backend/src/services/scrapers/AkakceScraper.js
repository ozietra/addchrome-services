const cheerio = require('cheerio');
const BaseScraper = require('./BaseScraper');

class AkakceScraper extends BaseScraper {
  constructor() {
    super('Akakce', 'https://www.akakce.com');
  }

  async search(query) {
    const url = `${this.baseUrl}/arama/${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results = [];

    // Akakce lists products with prices from multiple stores
    $('.p_w, .product-widget, li[class*="product"]').each((i, el) => {
      if (i >= 20) return false;

      const $el = $(el);
      const productName = this.cleanText(
        $el.find('.p_n, .product-name, .pn_w a').text()
      );
      const priceText = $el.find('.p_p, .product-price, .pt_v').first().text();
      const price = this.cleanPrice(priceText);
      const imageUrl = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      const link = $el.find('a').first().attr('href') || '';
      const seller = this.cleanText($el.find('.p_s, .store-name').text());

      if (productName && price > 0) {
        results.push({
          site: 'akakce',
          productName,
          price,
          currency: 'TRY',
          imageUrl: imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl,
          productUrl: link.startsWith('/') ? this.baseUrl + link : link,
          seller: seller || 'Akakce',
          rating: 0
        });
      }
    });

    return results;
  }
}

module.exports = AkakceScraper;
