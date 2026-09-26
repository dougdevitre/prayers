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
const SITE = new URL(urls[0]).origin;

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

test("every internal link and asset reference on every page resolves", () => {
  // Every .html file the site serves, not only the sitemap: the app shell,
  // 404 and the landing pages link out too.
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "tests", "infra", ".claude"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".html")) files.push(p);
    }
  })(ROOT);
  const resolve = p => {
    if (p === "/") return path.join(ROOT, "index.html");
    const f = path.join(ROOT, p);
    return [f, f + ".html", path.join(f, "index.html")].find(c => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
  };
  const ids = new Map();
  const idsOf = f => {
    if (!ids.has(f)) ids.set(f, new Set([...fs.readFileSync(f, "utf8").matchAll(/\bid="([^"]+)"/g)].map(m => m[1])));
    return ids.get(f);
  };
  const broken = [];
  let checked = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const where = "/" + path.relative(ROOT, file);
    for (const m of html.matchAll(/\b(href|src|srcset|content)="([^"]+)"/g)) {
      let value = m[2];
      if (value.startsWith(SITE)) value = value.slice(SITE.length) || "/";
      if (!value.startsWith("/") || value.startsWith("//")) continue;
      for (const ref of value.split(",").map(s => s.trim().split(" ")[0])) {
        const [p, hash] = ref.split("#");
        const target = p.split("?")[0];
        // Cards, the API and the calendar feed are functions; /app#N is a deep
        // link the app reads, not an anchor.
        if (!target || /^\/(cards|api)\//.test(target) || target === "/calendar.ics") continue;
        checked++;
        const file2 = resolve(decodeURI(target));
        if (!file2) broken.push(`${where}: ${ref}`);
        else if (hash && target !== "/app" && file2.endsWith(".html") && !idsOf(file2).has(hash)) broken.push(`${where}: ${ref} (no such id)`);
      }
    }
    for (const m of html.matchAll(/href="#([^"]+)"/g)) {
      checked++;
      if (!idsOf(file).has(m[1])) broken.push(`${where}: #${m[1]} (no such id)`);
    }
  }
  assert.ok(checked > 5000, `only ${checked} references found`);
  assert.ok(broken.length === 0, `${broken.length} broken: ${broken.slice(0, 5).join("; ")}`);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll search and share metadata tests passed.");
