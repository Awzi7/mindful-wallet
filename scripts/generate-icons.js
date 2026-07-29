const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'images');

const SUNSET = ['#FFC28A', '#FF6B4A'];
const TEAL = '#2E9E8F';
const CREAM = '#FBF3EA';

function walletGlyph({ stroke = 'white', fill = 'white', coin = TEAL, cx = 512, cy = 512, scale = 1 } = {}) {
  const w = 430 * scale;
  const h = 300 * scale;
  const x = cx - w / 2;
  const y = cy - h / 2 + 20 * scale;
  const rx = 52 * scale;
  const flapH = 120 * scale;
  const coinR = 58 * scale;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="0.96" />
    <rect x="${x}" y="${y}" width="${w}" height="${flapH}" rx="${rx}" fill="${fill}" opacity="0.55" />
    <circle cx="${x + w - coinR * 0.9}" cy="${y + h - coinR * 0.75}" r="${coinR}" fill="${coin}" />
    <circle cx="${x + w - coinR * 0.9}" cy="${y + h - coinR * 0.75}" r="${coinR * 0.34}" fill="${fill}" opacity="0.9" />
  `;
}

function fullIconSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${SUNSET[0]}" />
        <stop offset="1" stop-color="${SUNSET[1]}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)" />
    ${walletGlyph({ cx: 512, cy: 512, scale: 1.05 })}
  </svg>`;
}

function splashSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="transparent" />
    ${walletGlyph({ cx: 512, cy: 512, scale: 0.85, fill: SUNSET[1], coin: TEAL })}
  </svg>`;
}

function androidBackgroundSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${SUNSET[0]}" />
        <stop offset="1" stop-color="${SUNSET[1]}" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#bg)" />
  </svg>`;
}

function androidForegroundSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="transparent" />
    ${walletGlyph({ cx: 256, cy: 256, scale: 0.55 })}
  </svg>`;
}

function androidMonochromeSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="transparent" />
    ${walletGlyph({ cx: 256, cy: 256, scale: 0.55, fill: 'white', coin: 'white' })}
  </svg>`;
}

function faviconSVG(size) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${SUNSET[0]}" />
        <stop offset="1" stop-color="${SUNSET[1]}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" rx="180" fill="url(#bg)" />
    ${walletGlyph({ cx: 512, cy: 512, scale: 1.15 })}
  </svg>`;
}

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

async function main() {
  await render(fullIconSVG(1024), path.join(OUT, 'icon.png'), 1024);
  await render(splashSVG(1024), path.join(OUT, 'splash-icon.png'), 1024);
  await render(androidBackgroundSVG(512), path.join(OUT, 'android-icon-background.png'), 512);
  await render(androidForegroundSVG(512), path.join(OUT, 'android-icon-foreground.png'), 512);
  await render(androidMonochromeSVG(432), path.join(OUT, 'android-icon-monochrome.png'), 432);
  await render(faviconSVG(48), path.join(OUT, 'favicon.png'), 48);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
