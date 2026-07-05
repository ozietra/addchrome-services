// generate-icons.js — Eklenti ikonlarini SVG kaynaklarindan uretir.
//
// Kurulum + kullanim (proje kokunde):
//   npm install sharp
//   node generate-icons.js
//
// Her eklentinin assets/icons/ klasorundeki icon-small.svg + icon.svg dosyalarini
// kullanarak gercek, keskin PNG ikonlar uretir:
//   icon-small.svg  -> icon16.png, icon32.png   (kucuk boyutlar icin sade varyant)
//   icon.svg        -> icon48.png, icon128.png  (tam detayli varyant)

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('HATA: "sharp" bulunamadi. Once su komutu calistirin:  npm install sharp');
  process.exit(1);
}

const EXTENSIONS = ['ig-follower-export', 'ig-unfollow-ai', 'price-compare', 'ai-listing-writer'];

// hangi svg -> hangi boyutlar
const PLAN = [
  { svg: 'icon-small.svg', sizes: [16, 32] },
  { svg: 'icon.svg',       sizes: [48, 128] },
];

(async () => {
  for (const ext of EXTENSIONS) {
    const dir = path.join(__dirname, 'extensions', ext, 'assets', 'icons');
    if (!fs.existsSync(dir)) {
      console.warn('Atlandi (klasor yok):', dir);
      continue;
    }
    for (const { svg, sizes } of PLAN) {
      const svgPath = path.join(dir, svg);
      if (!fs.existsSync(svgPath)) {
        console.warn('Atlandi (svg yok):', svgPath);
        continue;
      }
      const buf = fs.readFileSync(svgPath);
      for (const s of sizes) {
        // density yuksek tutulur ki SVG once buyuk render edilip net kuculsun
        await sharp(buf, { density: 512 })
          .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(path.join(dir, `icon${s}.png`));
      }
    }
    console.log('OK  ', ext, '-> icon16/32/48/128.png');
  }
  console.log('\nTamamlandi. Chrome > Eklenteler sayfasinda eklentileri "Yeniden Yukle" yapin.');
})();
