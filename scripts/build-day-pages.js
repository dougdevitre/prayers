// Generates static, crawlable pages for each day under day/, plus robots.txt
// (and sitemap.xml when SITE_URL is set). The app itself is a hash-routed SPA,
// which search engines can't index per-day — these pages carry the content
// and link into the app.
//
//   node scripts/build-day-pages.js
//   SITE_URL=https://example.com node scripts/build-day-pages.js   # adds sitemap + canonical

const fs = require("fs");
const path = require("path");
const { themes, weeks } = require("../content.js");

const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");
const outDir = path.join(__dirname, "..", "day");
fs.mkdirSync(outDir, { recursive: true });

const slugify = title => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pageName = i => `${String(i + 1).padStart(2, "0")}-${slugify(themes[i][0])}`;
const weekFor = i => (i < 7 ? weeks[0] : i < 14 ? weeks[1] : i < 21 ? weeks[2] : i < 29 ? weeks[3] : weeks[4]);

for (let i = 0; i < themes.length; i++) {
  const [title, ref, verse, reflection, prayer, declaration, action] = themes[i];
  const pageTitle = `Day ${i + 1}: ${title} — Stand`;
  const description = `A prayer for ${title.toLowerCase()} from Stand, a 30-day journey from fear to faith. ${reflection}`.slice(0, 155);
  const canonical = SITE_URL ? `\n  <link rel="canonical" href="${SITE_URL}/day/${pageName(i)}" />` : "";
  const prev = i > 0 ? `<a href="/day/${pageName(i - 1)}">← Day ${i}</a>` : "<span></span>";
  const next = i < themes.length - 1 ? `<a href="/day/${pageName(i + 1)}">Day ${i + 2} →</a>` : "<span></span>";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(description)}" />
  <meta property="og:title" content="${esc(pageTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="article" />${canonical}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(pageTitle)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Stand home"><span class="brand-mark">✦</span><span>STAND</span></a>
    </header>
    <main>
      <article class="devotional">
        <p class="eyebrow">${esc(weekFor(i))}</p>
        <div class="title-row"><div><p class="day-number">DAY ${String(i + 1).padStart(2, "0")}</p><h1>${esc(title)}</h1></div></div>
        <blockquote class="scripture"><p>“${esc(verse)}”</p><cite>${esc(ref)}</cite></blockquote>
        <section class="content-section"><h2>Reflection</h2><p>${esc(reflection)}</p></section>
        <section class="prayer-panel"><p class="section-kicker">PRAY</p><p>${esc(prayer)}</p><p class="amen">Amen.</p></section>
        <section class="declaration-panel"><p class="section-kicker">DECLARE</p><p>${esc(declaration)}</p></section>
        <section class="action-panel"><div class="action-icon">→</div><div><p class="section-kicker">TODAY'S PRACTICE</p><p>${esc(action)}</p></div></section>
        <a class="complete-button" href="/#${i + 1}">Open Day ${i + 1} in the app — with guided audio</a>
        <nav class="day-nav" aria-label="Day navigation">${prev}${next}</nav>
      </article>
    </main>
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(outDir, `${pageName(i)}.html`), html);
}

let robots = "User-agent: *\nAllow: /\n";
if (SITE_URL) {
  const urls = [`${SITE_URL}/`, ...themes.map((_, i) => `${SITE_URL}/day/${pageName(i)}`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(__dirname, "..", "sitemap.xml"), sitemap);
  robots += `Sitemap: ${SITE_URL}/sitemap.xml\n`;
}
fs.writeFileSync(path.join(__dirname, "..", "robots.txt"), robots);

console.log(`Wrote ${themes.length} day pages${SITE_URL ? ", sitemap.xml" : ""} and robots.txt`);
