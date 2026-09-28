// Tests for what the host is told to send with every page, and the small
// files the site serves for machines: the security headers in vercel.json,
// /.well-known/security.txt, and the IndexNow key (scripts/indexnow.js).
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { readKey, changedUrls, submit } = require("../scripts/indexnow.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const siteHeaders = Object.fromEntries(vercel.headers.find(h => h.source === "/(.*)").headers.map(h => [h.key, h.value]));

(async () => {
  await test("every page is sent with the security headers", () => {
    for (const key of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options",
      "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) assert.ok(siteHeaders[key], `${key} is missing`);
    assert.match(siteHeaders["Strict-Transport-Security"], /max-age=(\d+)/);
    assert.ok(Number(siteHeaders["Strict-Transport-Security"].match(/max-age=(\d+)/)[1]) >= 31536000, "HSTS shorter than a year");
    assert.strictEqual(siteHeaders["X-Content-Type-Options"], "nosniff");
    assert.strictEqual(siteHeaders["X-Frame-Options"], "DENY");
  });

  await test("the Content Security Policy allows no inline script, plugin or framing", () => {
    const csp = Object.fromEntries(siteHeaders["Content-Security-Policy"].split(";").map(d => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
    assert.deepStrictEqual(csp["script-src"], ["'self'"]);
    assert.deepStrictEqual(csp["object-src"], ["'none'"]);
    assert.deepStrictEqual(csp["frame-ancestors"], ["'none'"]);
    assert.deepStrictEqual(csp["base-uri"], ["'self'"]);
    assert.ok(!siteHeaders["Content-Security-Policy"].includes("unsafe-inline") && !siteHeaders["Content-Security-Policy"].includes("unsafe-eval"));
  });

  await test("security.txt names a contact and has not expired, with a month's warning", () => {
    // RFC 9116: Contact and Expires are required, and Expires should be under
    // a year away. This fails a month before it lapses, so it gets renewed.
    const text = fs.readFileSync(path.join(ROOT, ".well-known", "security.txt"), "utf8");
    const field = name => (text.match(new RegExp(`^${name}: (.+)$`, "m")) || [])[1];
    assert.match(field("Contact") || "", /^(mailto:|https:\/\/)/);
    const expires = new Date(field("Expires"));
    const days = (expires - Date.now()) / 86400000;
    assert.ok(days > 30, `security.txt expires in ${Math.floor(days)} days: set Expires a year ahead`);
    assert.ok(days < 400, "Expires is more than a year away");
    assert.strictEqual(field("Canonical"), "https://prayers.dougdevitre.org/.well-known/security.txt");
  });

  await test("the IndexNow key file is named for its key and served from the root", () => {
    assert.match(readKey(), /^[0-9a-f]{32}$/);
  });

  await test("IndexNow is sent only the sitemap pages a deploy changed", () => {
    const urls = changedUrls(["day/01-stand.html", "es/oraciones/index.html", "prayers/catholic.html", "styles.css", "app.js", "404.html", "index.html"]);
    assert.deepStrictEqual(urls.sort(), [
      "https://prayers.dougdevitre.org/", "https://prayers.dougdevitre.org/day/01-stand",
      "https://prayers.dougdevitre.org/es/oraciones", "https://prayers.dougdevitre.org/prayers/catholic"
    ]);
    assert.deepStrictEqual(changedUrls(["styles.css", "app.js"]), []);
  });

  await test("the submission names the host, the key and where it lives; nothing is sent for no change", async () => {
    let sent = null;
    const fetchImpl = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { status: 202 }; };
    const r = await submit("https://prayers.dougdevitre.org", ["https://prayers.dougdevitre.org/day/01-stand"], "a".repeat(32), { fetchImpl });
    assert.deepStrictEqual([r.ok, r.status, r.sent], [true, 202, 1]);
    assert.strictEqual(sent.url, "https://api.indexnow.org/indexnow");
    assert.deepStrictEqual(sent.body, { host: "prayers.dougdevitre.org", key: "a".repeat(32),
      keyLocation: `https://prayers.dougdevitre.org/${"a".repeat(32)}.txt`, urlList: ["https://prayers.dougdevitre.org/day/01-stand"] });
    const refused = await submit("https://prayers.dougdevitre.org", ["https://prayers.dougdevitre.org/"], "a".repeat(32), { fetchImpl: async () => ({ status: 403 }) });
    assert.strictEqual(refused.ok, false);
    let called = false;
    const none = await submit("https://prayers.dougdevitre.org", [], "a".repeat(32), { fetchImpl: async () => { called = true; } });
    assert.ok(none.ok && none.sent === 0 && !called);
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll site configuration tests passed.");
})();
