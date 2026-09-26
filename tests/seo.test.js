// Tests for what every page in the sitemap tells search engines and share
// previews: a unique title and description of a length a results page shows
// whole, a canonical and og:url that name the page itself, a complete share
// card, the right html lang, and English/Spanish alternates that point both
// ways.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

/** The generated or hand-written file a sitemap URL is served from. */
function fileFor(url) {
  let p = new URL(url).pathname;
  if (p === "/") p = "/index.html";
  const base = path.join(ROOT, p);
  for (const f of [base + ".html", path.join(base, "index.html"), base]) {
    if (fs.existsSync(f) && !fs.statSync(f).isDirectory()) return f;
  }
  return null;
}
const unescape = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const meta = (html, re) => { const m = html.match(re); return m ? unescape(m[1]) : null; };

const pages = urls.map(url => {
  const file = fileFor(url);
  const html = file ? fs.readFileSync(file, "utf8") : "";
  return {
    url, file, html,
    path: new URL(url).pathname,
    title: meta(html, /<title>([^<]*)<\/title>/),
    description: meta(html, /<meta name="description" content="([^"]*)"/),
    canonical: meta(html, /<link rel="canonical" href="([^"]*)"/),
    lang: meta(html, /<html[^>]*\blang="([^"]*)"/),
    og: ["title", "description", "image", "url"].map(k => meta(html, new RegExp(`<meta property="og:${k}" content="([^"]*)"`))),
    alternates: [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => ({ lang: m[1], href: m[2] }))
  };
});

test(`every sitemap URL (${urls.length}) is a file in this checkout`, () => {
  assert.ok(urls.length > 200, `only ${urls.length} URLs`);
  const missing = pages.filter(p => !p.file).map(p => p.path);
  assert.deepStrictEqual(missing, []);
});

test("every page has a unique title of 15 to 65 characters", () => {
  const seen = new Map();
  for (const p of pages) {
    assert.ok(p.title, `${p.path}: no title`);
    assert.ok(p.title.length >= 15 && p.title.length <= 65, `${p.path}: title is ${p.title.length} characters`);
    assert.ok(!seen.has(p.title), `${p.path} and ${seen.get(p.title)} share the title "${p.title}"`);
    seen.set(p.title, p.path);
  }
});

test("every page has a unique description that a results page shows whole (70 to 160 characters)", () => {
  const seen = new Map();
  for (const p of pages) {
    assert.ok(p.description, `${p.path}: no description`);
    assert.ok(p.description.length >= 70 && p.description.length <= 160, `${p.path}: description is ${p.description.length} characters`);
    assert.ok(!seen.has(p.description), `${p.path} and ${seen.get(p.description)} share a description`);
    seen.set(p.description, p.path);
  }
});

test("canonical and og:url name the page itself, and the share card is complete", () => {
  for (const p of pages) {
    assert.strictEqual(p.canonical, p.url, `${p.path}: canonical`);
    const [title, description, image, url] = p.og;
    assert.ok(title && description && image && url, `${p.path}: incomplete og tags`);
    assert.strictEqual(url, p.url, `${p.path}: og:url`);
    assert.ok(image.startsWith("https://"), `${p.path}: og:image must be an absolute https URL`);
    assert.ok(/<meta name="twitter:card" content="[^"]+"/.test(p.html), `${p.path}: no twitter:card`);
  }
});

test("html lang matches the section, and the page is indexable", () => {
  for (const p of pages) {
    assert.strictEqual(p.lang, p.path.startsWith("/es") ? "es" : "en", `${p.path}: lang="${p.lang}"`);
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(p.html), `${p.path}: noindex on a sitemap page`);
  }
});

test("English and Spanish alternates include the page, an x-default, and point back", () => {
  const byUrl = new Map(pages.map(p => [p.url, p]));
  for (const p of pages) {
    assert.ok(p.alternates.some(a => a.href === p.url), `${p.path}: its alternates omit itself`);
    assert.ok(p.alternates.some(a => a.lang === "x-default"), `${p.path}: no x-default`);
    for (const a of p.alternates) {
      const other = byUrl.get(a.href);
      assert.ok(other, `${p.path}: alternate ${a.href} is not in the sitemap`);
      assert.ok(other.alternates.some(b => b.href === p.url), `${a.href} does not point back to ${p.path}`);
    }
  }
});

test("structured data parses, and each page has one h1", () => {
  for (const p of pages) {
    for (const m of p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(m[1]), `${p.path}: JSON-LD does not parse`);
    }
    assert.strictEqual((p.html.match(/<h1[\s>]/g) || []).length, 1, `${p.path}: h1 count`);
  }
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll search and share metadata tests passed.");
