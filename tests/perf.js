// Page-speed audit: the pages a new reader lands on, loaded cold in Chromium
// on a simulated mid-range phone over a slow connection, with each page's
// timings held to a budget.
//
//   npm run test:perf
//
// The conditions are Lighthouse's mobile preset: 150 ms round trips, 1.6
// Mbit/s down, 750 kbit/s up, and the CPU slowed 4x. Text is served gzipped,
// as the host serves it. Each page is loaded three times in a fresh browser
// context (no cache, no service worker) and the median is kept, so one slow
// run on a busy CI machine does not fail the build.
//
// Measured, per page:
//   FCP  first contentful paint: something on screen
//   LCP  largest contentful paint: the main thing on screen
//   TBT  total blocking time: main-thread time past 50 ms per task, between
//        the page starting and it settling; what makes a tap feel ignored
//   KB   bytes transferred
//
// The budgets start from Google's "good" thresholds (LCP 2.5 s, TBT 200 ms)
// and allow for CI machines, which are slower and noisier than this
// simulation's phone: the CPU slowdown multiplies whatever the machine is.
// Set CHROMIUM_PATH to use a preinstalled browser.

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PERF_PORT || 8194);
const RUNS = 3;
// About twice what this machine measured when set (28 September 2026: FCP
// ~0.55 s, LCP 1.26 s for the app in English and 1.36 s in Spanish, TBT
// ~0.2 s), so a slow CI runner passes and a real regression does not.
const BUDGET = { fcp: 2500, lcp: 3000, tbt: 500 };

// A first visit to each kind of page a reader arrives on: the landing page,
// the app in each language (the Spanish one fetches its journeys on demand),
// a day page and a Prayer Book page.
const PAGES = ["/", "/app", "/app?lang=es", "/day/01-stand", "/es/day/01-firmeza", "/prayers/angelus"];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
const TEXT = new Set([".html", ".js", ".css", ".svg", ".webmanifest"]);

// cleanUrls like Vercel, gzip like Vercel, and an empty audio manifest so no
// request leaves the machine. Share cards are not rendered here (their cost
// is the card function's, and a page shows them lazily below the fold).
const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  if (file.startsWith("/cards/")) { res.writeHead(204); return res.end(); }
  if (file === "/") file = "/index.html";
  let body;
  let full = path.join(ROOT, file);
  if (file === "/audio-manifest.js") {
    body = Buffer.from('const audioManifest = { version: 1, enabled: true, base: "", items: {} };\n');
    full = "audio-manifest.js";
  } else {
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      for (const candidate of [full + ".html", path.join(full, "index.html")]) {
        if (fs.existsSync(candidate)) { full = candidate; break; }
      }
    }
    try { body = fs.readFileSync(full); } catch { res.writeHead(404); return res.end(); }
  }
  const ext = path.extname(full);
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
  if (TEXT.has(ext) && /gzip/.test(req.headers["accept-encoding"] || "")) {
    body = zlib.gzipSync(body);
    headers["Content-Encoding"] = "gzip";
  }
  res.writeHead(200, headers);
  res.end(body);
});

// Collects long tasks and LCP from the first moment of the page, before any
// of its own script runs.
const OBSERVE = `
  window.__perf = { longtasks: [], lcp: 0 };
  new PerformanceObserver(list => { for (const e of list.getEntries()) window.__perf.longtasks.push(e.duration); })
    .observe({ type: "longtask", buffered: true });
  new PerformanceObserver(list => { const e = list.getEntries(); if (e.length) window.__perf.lcp = e[e.length - 1].startTime; })
    .observe({ type: "largest-contentful-paint", buffered: true });
`;

async function measure(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript(OBSERVE);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let bytes = 0;
  cdp.on("Network.loadingFinished", e => { bytes += e.encodedDataLength; });
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "load" });
  // Let the page settle: late script, LCP candidates, the welcome dialog.
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      fcp: fcp ? fcp.startTime : 0,
      lcp: window.__perf.lcp,
      tbt: window.__perf.longtasks.reduce((n, d) => n + Math.max(0, d - 50), 0)
    };
  });
  await context.close();
  return { ...m, kb: bytes / 1024 };
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const failures = [];
  console.log("page                      FCP ms   LCP ms   TBT ms     KB");
  for (const url of PAGES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, url));
    const m = Object.fromEntries(["fcp", "lcp", "tbt", "kb"].map(k => [k, median(runs.map(r => r[k]))]));
    const over = Object.keys(BUDGET).filter(k => m[k] > BUDGET[k]);
    console.log(`${over.length ? "FAIL" : "PASS"} ${url.padEnd(20)} ${String(Math.round(m.fcp)).padStart(6)} ${String(Math.round(m.lcp)).padStart(8)} ${String(Math.round(m.tbt)).padStart(8)} ${m.kb.toFixed(0).padStart(6)}`);
    if (!m.fcp || !m.lcp) failures.push(`${url}: no paint was measured`);
    for (const k of over) failures.push(`${url}: ${k.toUpperCase()} ${Math.round(m[k])} ms, budget ${BUDGET[k]} ms`);
  }
  await browser.close();
  server.close();
  if (failures.length) {
    console.log(`\n${failures.length} over budget:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\nEvery page within budget (FCP ${BUDGET.fcp} ms, LCP ${BUDGET.lcp} ms, TBT ${BUDGET.tbt} ms; median of ${RUNS}).`);
})();
