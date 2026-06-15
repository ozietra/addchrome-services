const html = require('fs').readFileSync('akakce.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
let count = 0;
$('li').each((i, el) => {
  const html2 = $(el).html();
  if (html2 && html2.includes('iPhone 14') && count < 1) {
    console.log(html2);
    count++;
  }
});