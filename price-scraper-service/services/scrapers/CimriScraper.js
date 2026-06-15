const BaseScraper = require('./BaseScraper');

class CimriScraper extends BaseScraper {
  constructor() {
    super('Cimri', 'cimri', 'https://www.cimri.com');
    this.waitSelector = 'a[href*="-fiyatlari"]';
    this.maxResults = 30;
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/arama?q=${encodeURIComponent(query)}`;
  }

  parse($) {
    const results = [];
    
    // Find all links that go to product prices pages
    $('a[href*="-fiyatlari"]').each((i, el) => {
      if (results.length >= this.maxResults) return false;
      
      const $el = $(el);
      const link = this.abs($el.attr('href'));
      
      // Find a common parent container (card)
      let $card = $el.closest('div[data-variant="default"], div[data-variant="A1"]');
      if (!$card.length) $card = $el.closest('article');
      if (!$card.length) {
         let parent = $el.parent();
         for (let j=0; j<4; j++) {
            if (parent.children().length > 2 || (parent.text().match(/TL/i) && parent.text().length > 20)) {
               break;
            }
            if (parent.parent().length) parent = parent.parent();
         }
         $card = parent;
      }
      
      const text = $card.text();
      // Match price pattern like 47.899,00 TL or 47899 TL
      const priceMatch = text.match(/[\d\.]+(?:,\d+)?\s*TL/i);
      
      // Extract texts from leaf nodes for product name
      const pieces = [];
      $card.find('*').each((idx, child) => {
         if ($(child).children().length === 0) {
            const t = $(child).text().trim();
            if (t) pieces.push(t);
         }
      });
      
      // The first meaningful piece of text is usually the product name
      let productName = pieces.find(p => p.length > 5 && !p.includes('TL') && !p.includes('fiyatı incele') && !p.includes('puan') && !p.includes('En Ucuz') && !p.includes('İndirim'));
      
      if (!productName) {
        productName = this.cleanText($el.text().split('fiyatı incele')[0].replace(/\d+puan\d+/, ''));
      }
      
      if (productName && priceMatch) {
        const priceText = priceMatch[0];
        const price = this.cleanPrice(priceText);
        
        // Find image inside the container
        let imageUrl = '';
        const img = $card.find('img').first();
        if (img.length) {
           imageUrl = this.img(img.attr('src') || img.attr('data-src') || '');
        }

        if (price > 0 && link) {
          results.push({
            site: 'cimri',
            productName: this.cleanText(productName),
            price,
            currency: 'TRY',
            imageUrl,
            productUrl: link,
            seller: 'Cimri (Karşılaştırma)',
            rating: 0
          });
        }
      }
    });

    return results;
  }
}

module.exports = CimriScraper;
