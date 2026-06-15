const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.cimri.com/arama?q=iphone+16', {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('a[href*="-fiyatlari"]', {timeout: 10000});
  const html = await page.content();
  fs.writeFileSync('cimri_puppeteer.html', html);
  await browser.close();
})();
