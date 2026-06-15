const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('cimri_puppeteer.html', 'utf8');
const $ = cheerio.load(html);

const results = [];
$('a[href*="-fiyatlari"]').each((i, el) => {
  if (i > 5) return;
  const $el = $(el);
  let $card = $el.closest('div[data-variant="default"], div[data-variant="A1"]');
  if (!$card.length) {
    $card = $el.closest('div.wneDI');
  }
  if (!$card.length) {
    $card = $el.closest('article');
  }
  if (!$card.length) {
    $card = $el.closest('li');
  }
  if (!$card.length) {
     let parent = $el.parent();
     for (let j=0; j<4; j++) {
        if (parent.children().length > 3) {
           break;
        }
        parent = parent.parent();
     }
     $card = parent;
  }
  
  const text = $card.text();
  const priceMatch = text.match(/[\d\.]+(?:,\d+)?\s*TL/i);
  
  const pieces = [];
  $card.find('*').each((idx, child) => {
     if ($(child).children().length === 0) {
        const t = $(child).text().trim();
        if (t) pieces.push(t);
     }
  });

  results.push({
    linkText: $el.text(),
    price: priceMatch ? priceMatch[0] : null,
    cardClass: $card.attr('class'),
    cardHTML: $card.html().substring(0, 100),
    pieces
  });
});

console.log(JSON.stringify(results, null, 2));
