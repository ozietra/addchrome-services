const p = require('puppeteer');
const cheerio = require('cheerio');

async function mapStores() {
  const browser = await p.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0');
  
  await page.goto('https://www.akakce.com/arama/?q=iphone', {waitUntil:'networkidle2'});
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const products = [];
  $('a[href*="-fiyati,"]').each((i, el) => {
    if(i < 5) {
      products.push({
        href: 'https://www.akakce.com' + $(el).attr('href'),
        logo: $(el).find('img[class^="v"]').attr('src')
      });
    }
  });
  
  for (const prod of products) {
    if (!prod.logo) continue;
    
    console.log("Product:", prod.href);
    console.log("Logo:", prod.logo);
    
    await page.goto(prod.href, {waitUntil:'networkidle2'});
    const prodHtml = await page.content();
    const $p = cheerio.load(prodHtml);
    
    const goLink = $p('a[rel="nofollow"]').attr('href');
    if (goLink) {
      console.log("Go Link:", goLink);
      try {
        await page.goto('https://www.akakce.com' + goLink, {waitUntil:'domcontentloaded'});
        console.log("Redirected to:", page.url());
      } catch(e) {}
    }
    console.log("-----------------------");
  }
  
  await browser.close();
}
mapStores().catch(console.error);
