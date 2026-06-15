const fs = require('fs');
const path = require('path');

// Minimal 1x1 purple PNG (placeholder)
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mOUZ/j/HwAEOAHulYbWYAAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

const extensions = [
  'ig-follower-export',
  'ig-unfollow-ai',
  'price-compare'
];

extensions.forEach(ext => {
  const dir = path.join(__dirname, 'extensions', ext, 'assets', 'icons');
  fs.mkdirSync(dir, { recursive: true });
  [16, 32, 48, 128].forEach(size => {
    fs.writeFileSync(path.join(dir, `icon${size}.png`), pngBuffer);
  });
  console.log(`Icons created for ${ext}`);
});
