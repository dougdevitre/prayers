// Renders the maskable app icons from the same cross as icon.svg.
//
//   node scripts/build-icons.js
//
// Android crops an installed app's icon to its own shape (circle, squircle,
// teardrop). Given only icon.svg's rounded square, it shrinks it onto a white
// plate. A "maskable" icon is full-bleed instead: the background runs to the
// edges and the cross sits inside the safe zone, the centred circle of 40%
// radius that every mask keeps (https://www.w3.org/TR/appmanifest/#icon-masks).
//
// Like the social card and the screenshots, this is run by hand when the
// icon changes, then committed; it needs a browser. Set CHROMIUM_PATH to use a
// preinstalled one.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");

// icon.svg's cross, scaled to 80% about the centre so its farthest point
// (the top cap, 24 units out) lands at 19.2 units, well inside the 25.6-unit
// safe radius. No rounded corners: the platform supplies the shape.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#132a3a"/>
<g transform="translate(32 32) scale(0.8) translate(-32 -32)">
<path d="M32 11v42M18 24h28" stroke="#f1c879" stroke-width="6" stroke-linecap="round"/>
</g></svg>`;

const SIZES = [192, 512];

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const svg = MASKABLE_SVG.replace("<svg ", `<svg width="${size}" height="${size}" `);
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    const file = `icon-maskable-${size}.png`;
    await page.screenshot({ path: path.join(ROOT, file), omitBackground: false });
    await page.close();
    console.log(`  ${file}  ${(fs.statSync(path.join(ROOT, file)).size / 1024).toFixed(1)} KB`);
  }
  await browser.close();
})();
