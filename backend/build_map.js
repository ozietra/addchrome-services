const p = require('puppeteer');
const cheerio = require('cheerio');

async function checkSellers() {
  const browser = await p.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0');
  
  // Go to search page
  await page.goto('https://www.akakce.com/arama/?q=iphone', {waitUntil:'networkidle2'});
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const links = [];
  $('a[href*="-fiyati,"]').each((i, el) => {
    if(i < 5) links.push($(el).attr('href'));
  });
  
  console.log("Found links:", links);
  
  for (const link of links) {
    const url = 'https://www.akakce.com' + link;
    console.log("Visiting:", url);
    await page.goto(url, {waitUntil:'networkidle2'});
    const prodHtml = await page.content();
    const $p = cheerio.load(prodHtml);
    
    // The top price row
    const firstRow = $p('.pt_v8').first().closest('li');
    const storeLogo = firstRow.find('img[class^="v"]').attr('src') || '';
    const storeName = firstRow.find('.v8_s, .p_s, .store-name').text() || '';
    
    console.log(`Logo: ${storeLogo} -> Name: ${storeName}`);
  }
  
  await browser.close();
}

checkSellers().catch(console.error);
