// Renders the social sharing card (og:image) to og-card.png.
//
//   node scripts/build-og-card.js
//
// Every static page shares one card, so a link to any of the 110 crawlable
// pages previews as the brand rather than a blank grey box. The card is a
// committed PNG because social scrapers fetch it directly and never run
// JavaScript; this script exists so the PNG has a reviewable source rather
// than being an opaque binary nobody can regenerate.
//
// Run it after changing the brand palette or the card copy, then commit the
// regenerated PNG. It is deliberately not part of `npm run build:seo`: that
// runs in CI, and rendering a PNG needs a browser CI would have to install
// for output that changes perhaps once a year.

const path = require("path");
const { chromium } = require("playwright");

const WIDTH = 1200;
const HEIGHT = 630;
const out = path.join(__dirname, "..", "og-card.png");

// Palette copied from :root in styles.css. Kept literal rather than parsed:
// the card must not silently restyle itself when a token moves.
const INK = "#132a3a";
const PAPER = "#f7f4ec";
const GOLD = "#b88732";

const card = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><style>
  *{box-sizing:border-box;margin:0}
  body{width:${WIDTH}px;height:${HEIGHT}px;display:flex;flex-direction:column;
       justify-content:space-between;padding:72px 80px;background:${INK};color:${PAPER};
       font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .mark{display:flex;align-items:center;gap:16px;color:${GOLD};
        font-size:26px;font-weight:800;letter-spacing:.22em}
  .mark span.ring{display:grid;place-items:center;width:56px;height:56px;
        border:2px solid ${GOLD};border-radius:50%;font-size:28px;letter-spacing:0}
  h1{max-width:20ch;font-family:Georgia,"Times New Roman",serif;font-size:82px;
     line-height:1.04;font-weight:500;letter-spacing:-.03em}
  .foot{display:flex;align-items:baseline;justify-content:space-between;gap:32px}
  .foot p{font-size:25px;opacity:.82;white-space:nowrap}
  .foot .url{color:${GOLD};font-size:24px;font-weight:700;letter-spacing:.06em;opacity:1}
  .rule{height:3px;width:120px;background:${GOLD};margin-bottom:34px}
</style></head><body>
  <div class="mark"><span class="ring">&#10022;</span><span>STAND</span></div>
  <div>
    <div class="rule"></div>
    <h1>Steady, when fear will not sit still.</h1>
  </div>
  <div class="foot">
    <p>A prayer companion for fear &middot; free and offline</p>
    <p class="url">prayers.dougdevitre.org</p>
  </div>
</body></html>`;

(async () => {
  const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(card, { waitUntil: "load" });
  await page.screenshot({ path: out, type: "png" });
  await browser.close();
  console.log(`Wrote og-card.png (${WIDTH}x${HEIGHT})`);
})();
