// Generates static, crawlable pages for every day of every track, plus the
// fear index, sitemap.xml and robots.txt. The app itself is a hash-routed
// SPA, which search engines can't index per-day — these pages carry the
// content and link into the app.
//
//   node scripts/build-day-pages.js
//   SITE_URL=https://staging.example.com node scripts/build-day-pages.js
//
// SITE_URL defaults to production. It used to default to empty, which meant
// forgetting the environment variable silently shipped pages with no
// canonical link and no sitemap at all — a failure with no symptom. The
// default is the committed output, and CI diffs it, so a wrong value is
// visible in review rather than absent from the crawl.
//
// Core days publish under day/ (stable URLs); other tracks under track/<id>/.

const fs = require("fs");
const path = require("path");
const { tracks, fearIndex } = require("../content.js");

const SITE_URL = (process.env.SITE_URL || "https://prayers.dougdevitre.org").replace(/\/+$/, "");
const OG_IMAGE = `${SITE_URL}/og-card.png`;
const root = path.join(__dirname, "..");

const slugify = title => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pageName = (track, i) => `${String(i + 1).padStart(2, "0")}-${slugify(track.days[i][0])}`;

// One nav and one footer on every generated page. A search visitor lands on
// day 14 of a courage story far more often than on the landing page, and
// until now those pages were dead ends: a brand mark, one button into the
// app, and prev/next. `current` is the page's own path, left out of its own
// menu.
const NAV_LINKS = [
  { href: "/", label: "Open the app" },
  { href: "/?sos=1", label: "Steady me now" },
  { href: "/fears", label: "Start from a fear" },
  { href: "/day/01-stand", label: "Begin at day one" },
  { href: "/about", label: "What Stand does" }
];

// A <details> disclosure rather than a scripted dropdown: these pages carry
// no JavaScript, the production CSP allows none inline, and the open state
// is announced natively.
function siteNav(current) {
  const items = NAV_LINKS.filter(l => l.href !== current)
    .map(l => `            <li><a href="${l.href}">${l.label}</a></li>`).join("\n");
  return `      <nav class="site-nav" aria-label="Main">
        <a class="nav-cta" href="/">Open the app</a>
        <details class="nav-menu">
          <summary>Menu</summary>
          <ul>
${items}
          </ul>
        </details>
      </nav>`;
}

function siteFooter(current) {
  const links = NAV_LINKS.filter(l => l.href !== current && l.href !== "/")
    .map(l => `<a href="${l.href}">${l.label}</a>`).join(" \u00b7 ");
  return `    <footer class="landing-footer">
      <a class="complete-button" href="/">Open the app</a>
      <p class="footer-links">${links}</p>
      <p>Free, and private by default.</p>
    </footer>`;
}

// Shared social card. One image for every page: a link to any of these pages
// used to preview as a blank grey box, because no og:image existed anywhere
// in the repo. Regenerate the image with scripts/build-og-card.js.
function socialMeta({ title, description, type, relPath }) {
  return `  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${SITE_URL}${relPath}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:site_name" content="Stand" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="${SITE_URL}${relPath}" />`;
}

function weekFor(track, i) {
  const w = track.weeks;
  if (w.length < 5) return w[0];
  return i < 7 ? w[0] : i < 14 ? w[1] : i < 21 ? w[2] : i < 29 ? w[3] : w[4];
}

const allPaths = [];

for (const track of Object.values(tracks)) {
  const dirRel = track.id === "core" ? "day" : path.join("track", track.id);
  const urlBase = track.id === "core" ? "/day" : `/track/${track.id}`;
  const appQuery = track.id === "core" ? "" : `?track=${track.id}`;
  fs.mkdirSync(path.join(root, dirRel), { recursive: true });

  for (let i = 0; i < track.days.length; i++) {
    const [title, ref, verse, reflection, prayer, declaration, action] = track.days[i];
    const pageTitle = `Day ${i + 1}: ${title} — Stand`;
    const description = `A prayer for ${title.toLowerCase()} from Stand${track.id === "core" ? ", a 30-day journey from fear to faith" : ` — ${track.name}`}. ${reflection}`.slice(0, 155);
    const relPath = `${urlBase}/${pageName(track, i)}`;
    const prev = i > 0 ? `<a href="${urlBase}/${pageName(track, i - 1)}">← Day ${i}</a>` : "<span></span>";
    const next = i < track.days.length - 1 ? `<a href="${urlBase}/${pageName(track, i + 1)}">Day ${i + 2} →</a>` : "<span></span>";

    const html = `<!doctype html>
<html lang="en" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="description" content="${esc(description)}" />
${socialMeta({ title: pageTitle, description, type: "article", relPath })}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(pageTitle)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/about" aria-label="Stand home"><span class="brand-mark">✦</span><span>STAND</span></a>
${siteNav(relPath)}
    </header>
    <main>
      <article class="devotional">
        <p class="eyebrow">${esc(weekFor(track, i))}</p>
        <div class="title-row"><div><p class="day-number">DAY ${String(i + 1).padStart(2, "0")}</p><h1>${esc(title)}</h1></div></div>
        <blockquote class="scripture"><p>“${esc(verse)}”</p><cite>${esc(ref)}</cite></blockquote>
        <section class="content-section"><h2>Reflection</h2><p>${esc(reflection)}</p></section>
        <section class="prayer-panel"><p class="section-kicker">PRAY</p><p>${esc(prayer)}</p><p class="amen">Amen.</p></section>
        <section class="declaration-panel"><p class="section-kicker">DECLARE</p><p>${esc(declaration)}</p></section>
        <section class="action-panel"><div class="action-icon">→</div><div><p class="section-kicker">TODAY'S PRACTICE</p><p>${esc(action)}</p></div></section>
        <a class="complete-button" href="/${appQuery}#${i + 1}">Open Day ${i + 1} in the app — with guided audio</a>
        <nav class="day-nav" aria-label="Day navigation">${prev}${next}</nav>
      </article>
    </main>
${siteFooter(relPath)}
  </div>
</body>
</html>
`;
    fs.writeFileSync(path.join(root, dirRel, `${pageName(track, i)}.html`), html);
    allPaths.push(relPath);
  }
}

// The fear index as a crawlable page. These phrases are close to what people
// actually search for, and until now they existed only inside a dialog. Built
// from the same `fearIndex` the app uses, so the two cannot drift.
{
  const rows = fearIndex
    .filter(([, id]) => tracks[id])
    .map(([label, id]) => {
      const track = tracks[id];
      const base = id === "core" ? "/day" : `/track/${id}`;
      return { label, track, id, href: `${base}/${pageName(track, 0)}` };
    });

  const groups = [];
  for (const row of rows) {
    const name = row.track.group || "";
    const group = groups.find(g => g.name === name);
    if (group) group.rows.push(row);
    else groups.push({ name, rows: [row] });
  }

  const sections = groups.map(group => `
      <section class="landing-section">
        <h2 class="section-kicker">${esc(group.name)}</h2>
        <div class="feature-grid">
${group.rows.map(row => `          <div class="feature-card">
            <h3><a href="${row.href}">${esc(row.label)}</a></h3>
            <p>${esc(row.track.name)} \u00b7 ${row.track.days.length} days \u00b7 <a href="/${row.id === "core" ? "" : `?track=${row.id}`}">open in the app</a></p>
          </div>`).join("\n")}
        </div>
      </section>`).join("\n");

  const title = "Where are you right now? — Stand";
  const description = "Say what you are afraid of \u2014 a court date, a diagnosis, a child, a bill, the dark \u2014 and start with the prayers written for it.";
  const html = `<!doctype html>
<html lang="en" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="description" content="${esc(description)}" />
${socialMeta({ title, description, type: "website", relPath: "/fears" })}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(title)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/about" aria-label="Stand home"><span class="brand-mark">\u2726</span><span>STAND</span></a>
${siteNav("/fears")}
    </header>
    <main>
      <section class="landing-hero">
        <p class="eyebrow">START WHERE YOU ARE</p>
        <h1>Where are you right now?</h1>
        <p class="landing-lead">You do not have to start at day one, and you do not have to know which journey you need. Find the sentence that sounds like your week, and begin there.</p>
        <a class="complete-button" href="/">Open the app</a>
      </section>
${sections}
      <section class="landing-section landing-close">
        <h2>None of these quite fit?</h2>
        <p>Open the app and press \u201cSteady me now\u201d. It takes ninety seconds and asks nothing of you first.</p>
        <a class="complete-button" href="/?sos=1">Steady me now</a>
      </section>
    </main>
${siteFooter("/fears")}
  </div>
</body>
</html>
`;
  fs.mkdirSync(path.join(root, "fears"), { recursive: true });
  fs.writeFileSync(path.join(root, "fears", "index.html"), html);
}

// The landing page is hand-written, not generated, but belongs in the sitemap.
const urls = [`${SITE_URL}/`, `${SITE_URL}/about`, `${SITE_URL}/fears`, ...allPaths.map(p => `${SITE_URL}${p}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Wrote ${allPaths.length} day pages, the fear index, sitemap.xml (${urls.length} URLs) and robots.txt`);
