// A size budget for what a first visit to the app downloads: the page, the
// stylesheet and every script it loads, measured gzipped (as the host sends
// them). A later visit is served from the service worker's cache, so this is
// the cost a new reader, often on a phone and in a hard moment, pays once.
//
// It fails when the total or any one file grows past its budget, so growth
// is a decision made in review rather than something that creeps in. When a
// change is worth the bytes, raise the number here in the same PR and say why.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
// Measured at 157 KB when the budget was set (28 September 2026).
const TOTAL_BUDGET_KB = 175;
// The largest single files are the two languages' journeys (~28 KB each) and
// app.js (~26 KB).
const FILE_BUDGET_KB = 32;

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const gz = file => zlib.gzipSync(fs.readFileSync(path.join(ROOT, file)), { level: 9 }).length;
const kb = bytes => Math.round(bytes / 102.4) / 10;

const page = fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
const assets = [
  ...[...page.matchAll(/<script src="\/([^"]+)"/g)].map(m => m[1]),
  ...[...page.matchAll(/<link rel="stylesheet" href="\/([^"]+)"/g)].map(m => m[1])
];
const sizes = [["app/index.html", gz("app/index.html")], ...assets.map(f => [f, gz(f)])];
const total = sizes.reduce((n, [, b]) => n + b, 0);

test("the app loads its scripts and stylesheet from this repository", () => {
  assert.ok(assets.includes("app.js") && assets.includes("styles.css"), assets.join(", "));
  for (const f of assets) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is missing`);
});

test(`a first visit to the app is under ${TOTAL_BUDGET_KB} KB gzipped (now ${kb(total)} KB)`, () => {
  const top = [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, b]) => `${f} ${kb(b)}`).join(", ");
  assert.ok(total <= TOTAL_BUDGET_KB * 1024, `${kb(total)} KB; largest: ${top}`);
});

test(`no single file is over ${FILE_BUDGET_KB} KB gzipped`, () => {
  const over = sizes.filter(([, b]) => b > FILE_BUDGET_KB * 1024).map(([f, b]) => `${f} ${kb(b)} KB`);
  assert.deepStrictEqual(over, []);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll size budget tests passed.");
