// Renders screenshots of the real app for the landing page.
//
//   node scripts/build-screenshots.js
//
// The landing page described the app in 650 words and showed none of it.
// These are captures of the actual running app, not mockups, so they cannot
// drift into promising something the app does not do: regenerate them and
// any change to the real screens shows up.
//
// Like the social card, this is deliberately NOT part of `npm run build:seo`
// — that runs in CI, and rendering PNGs needs a browser for output that
// changes rarely. Run it when a captured screen changes, then commit.
//
// Set CHROMIUM_PATH to use a preinstalled browser.
//
//   node scripts/build-screenshots.js --install
//
// renders only the screenshots the web app manifest lists instead: whole
// screens (not cropped dialogs) at a phone's 2x density, plus one desktop
// window, which browsers show in their install sheet. English and light,
// like the manifest itself.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "shots");
const PORT = 8231;
const VIEWPORT = { width: 390, height: 844 };

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json"
};

const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  if (file === "/") file = "/index.html";
  let full = path.join(ROOT, file);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    for (const candidate of [full + ".html", path.join(full, "index.html")]) {
      if (fs.existsSync(candidate)) { full = candidate; break; }
    }
  }
  try {
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(fs.readFileSync(full));
  } catch { res.writeHead(404); res.end("not found"); }
});

const url = p => `http://localhost:${PORT}${p}`;
const INSTALL_ONLY = process.argv.includes("--install");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  // A fresh page per shot. Sharing one page silently produced two identical
  // captures: navigating from "/" to "/#1" only changes the hash, so the
  // document never reloads and the dialog opened for the previous shot was
  // still covering the screen.
  const freshPage = async (scheme, lang, viewport = VIEWPORT, deviceScaleFactor = 1.5) => {
    const p = await browser.newPage({ viewport, deviceScaleFactor, colorScheme: scheme });
    await p.goto(url("/app"), { waitUntil: "networkidle" });
    // Dismiss the first-run welcome so captures show the app in use.
    if (await p.evaluate(() => Boolean(document.getElementById("welcomeDialog")?.open))) {
      await p.click("#beginButton");
      await p.waitForTimeout(400);
    }
    // The Spanish landing page should show the Spanish app, not the English
    // one with Spanish copy around it.
    if (lang === "es") {
      await p.evaluate(() => { state.lang = "es"; save(); });
      await p.reload({ waitUntil: "networkidle" });
      await p.waitForTimeout(300);
    }
    return p;
  };

  const shots = [];
  // Dialogs are captured as elements, not viewports: a dialog floating over
  // its own dimmed backdrop reads as a screenshot of a screenshot, and the
  // 844px viewport clipped it at both ends.
  const capture = async (page, name, selector) => {
    const target = selector ? page.locator(selector) : page;
    await target.screenshot({ path: path.join(OUT, name) });
    shots.push(name);
    await page.close();
  };

  // Light and dark variants. The landing page now follows the device's colour
  // scheme, so a light-only screenshot would glare out of a dark page. The
  // <picture> element fetches only the matching source, so a visitor still
  // downloads one set.
  // Install sheet: whole screens, listed in manifest.webmanifest.
  if (INSTALL_ONLY) {
    const phone = () => freshPage("light", "en", VIEWPORT, 2);
    let page = await phone();
    await page.waitForTimeout(400);
    await capture(page, "install-day.png");

    page = await phone();
    await page.click("#sosButton");
    await page.waitForTimeout(400);
    await page.click("#sosStage .checkin-scale button:nth-child(4)");
    await page.waitForTimeout(600);
    await capture(page, "install-sos.png");

    page = await phone();
    await page.click("#prayerButton");
    await page.waitForTimeout(600);
    await page.locator("#prayerCard").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, "install-composer.png");

    page = await freshPage("light", "en", { width: 1280, height: 800 }, 1);
    await page.waitForTimeout(400);
    await capture(page, "install-wide.png");
  }

  if (!INSTALL_ONLY) for (const lang of ["en", "es"]) for (const scheme of ["light", "dark"]) {
    const sfx = `${lang === "es" ? "-es" : ""}${scheme === "dark" ? "-dark" : ""}`;

    // 1. SOS mid-breath — the rescue the whole page is built around.
    let page = await freshPage(scheme, lang);
    await page.click("#sosButton");
    await page.waitForTimeout(400);
    await page.click("#sosStage .checkin-scale button:nth-child(4)");
    await page.waitForTimeout(600);
    await capture(page, `sos${sfx}.png`, "#sosDialog");

    // 2. A devotional day, showing the narration card.
    page = await freshPage(scheme, lang);
    await page.waitForTimeout(400);
    await capture(page, `day${sfx}.png`);

    // 3. The prayer composer with a composed prayer on screen.
    page = await freshPage(scheme, lang);
    await page.click("#prayerButton");
    await page.waitForTimeout(600);
    // #prayerCard, not .prayer-card: the hidden #traditionalCard shares the class.
    await page.locator("#prayerCard").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, `composer${sfx}.png`, "#prayerDialog");
  }

  await browser.close();
  server.close();
  for (const s of shots) {
    const kb = (fs.statSync(path.join(OUT, s)).size / 1024).toFixed(0);
    console.log(`  shots/${s}  ${kb} KB`);
  }
  console.log(INSTALL_ONLY ? `Wrote ${shots.length} install screenshots`
    : `Wrote ${shots.length} screenshots from a ${VIEWPORT.width}x${VIEWPORT.height} viewport at 1.5x`);
})();
