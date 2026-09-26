// Accessibility audit: axe-core against every page shape and every app
// dialog, in light and dark, at phone width.
//
//   npm run test:a11y
//
// The smoke suite checks the contrast and labels it knows about; this checks
// the ones nobody has thought of yet. It found a 3.9:1 subtitle on the
// selected journey chip that no hand-written check covered.
//
// Rules: WCAG 2.0/2.1/2.2 A and AA, plus axe's best practices. Any violation
// fails the run and is printed with the page, theme and elements involved.
// Set CHROMIUM_PATH to use a preinstalled browser.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.A11Y_PORT || 8193);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const cardHandler = require("../api/card.js");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".woff": "font/woff" };

// The same routes as the smoke server: cleanUrls, the /cards rewrite, the
// site's 404 page, and an empty audio manifest so nothing reaches the audio host.
const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  const card = /^\/cards\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(file);
  if (card) {
    req.url = `/api/card?${new URLSearchParams({ lang: card[1], track: card[2], file: card[3] })}`;
    return cardHandler(req, res);
  }
  if (file === "/") file = "/index.html";
  if (file === "/audio-manifest.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end(`const audioManifest = { version: 1, enabled: true, base: "", items: {} };\n`);
  }
  let full = path.join(ROOT, file);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    for (const candidate of [full + ".html", path.join(full, "index.html")]) {
      if (fs.existsSync(candidate)) { full = candidate; break; }
    }
  }
  try {
    const data = fs.readFileSync(full);
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(ROOT, "404.html")));
  }
});

// [path, what to open in the app first]
const PAGES = [
  ["/"], ["/es"], ["/fears"], ["/es/fears"],
  ["/day/01-stand"], ["/es/day/01-firmeza"], ["/track/wall/04-fifty-two-days"],
  ["/privacy"], ["/es/terms"], ["/no-such-page"],
  ["/app", "welcome"], ["/app", "day"], ["/app", "#sosButton"], ["/app", "#prayerButton"],
  ["/app", "#journalButton"], ["/app", "#shareButton"], ["/app", "#libraryButton"], ["/app", "es"]
];

async function open(browser, scheme, url, mode) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "networkidle" });
  if (!mode) return page;
  if (mode === "es") {
    await page.evaluate(() => { state.lang = "es"; save(); });
    await page.reload({ waitUntil: "networkidle" });
  }
  if (mode !== "welcome" && await page.evaluate(() => Boolean(document.getElementById("welcomeDialog")?.open))) {
    await page.click("#beginButton");
    await page.waitForTimeout(300);
  }
  // The app has its own theme toggle rather than following the device.
  if (scheme === "dark" && !(await page.evaluate(() => document.documentElement.classList.contains("dark") || document.body.classList.contains("dark")))) {
    await page.click("#themeButton");
    await page.waitForTimeout(200);
  }
  if (mode.startsWith("#")) {
    await page.click(mode);
    await page.waitForTimeout(500);
  }
  return page;
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let checked = 0;
  const failures = [];
  for (const scheme of ["light", "dark"]) {
    for (const [url, mode] of PAGES) {
      const page = await open(browser, scheme, url, mode);
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }
      })).violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        nodes: v.nodes.slice(0, 3).map(n => n.target.join(" ") + (n.any[0] ? ` (${n.any[0].message})` : ""))
      })));
      const where = `${scheme} ${url}${mode ? ` [${mode}]` : ""}`;
      checked++;
      if (violations.length) failures.push({ where, violations });
      console.log(`${violations.length ? "FAIL" : "PASS"} ${where}`);
      await page.close();
    }
  }
  await browser.close();
  server.close();
  for (const f of failures) {
    console.log(`\n${f.where}`);
    for (const v of f.violations) {
      console.log(`  ${v.id} [${v.impact}] ${v.help}`);
      for (const n of v.nodes) console.log(`    ${n}`);
    }
  }
  if (failures.length) { console.log(`\n${failures.length} of ${checked} screens have accessibility violations`); process.exit(1); }
  console.log(`\nNo accessibility violations on ${checked} screens.`);
})().catch(e => { console.error(e); process.exit(1); });
