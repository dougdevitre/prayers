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
const { esTracks, esGroups, esFearIndex } = require("../content.es.js");

const SITE_URL = (process.env.SITE_URL || "https://prayers.dougdevitre.org").replace(/\/+$/, "");
const OG_IMAGE = `${SITE_URL}/og-card.png`;
const root = path.join(__dirname, "..");

// slugify is shared with the app's calendar reminder (logic.js), so the
// links the app writes and the pages this generates cannot drift.
const { slugify } = require("../logic.js");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pageName = (track, i) => `${String(i + 1).padStart(2, "0")}-${slugify(track.days[i][0])}`;

// Every generated page carries the same nav and footer, in its own language.
// A search visitor lands on day 14 of a courage story far more often than on
// the landing page, and those pages used to be dead ends.
const APP = "/app";

// Both locales. `prefix` is the URL prefix ("" for English, "/es" for Spanish)
// and is also the directory the pages are written into.
const LOCALES = [
  {
    code: "en", prefix: "", tracks, fearIndex, groups: null,
    nav: [
      { href: APP, label: "Open the app" },
      { href: `${APP}?sos=1`, label: "Steady me now" },
      { href: "/fears", label: "Start from a fear" },
      { href: "/", label: "What Stand does" }
    ],
    openApp: "Open the app", menu: "Menu", brandHome: "/",
    footerNote: "Free, and private by default.",
    reflection: "Reflection", pray: "PRAY", declare: "DECLARE", practice: "TODAY'S PRACTICE", amen: "Amen.",
    dayWord: "DAY", dayNav: n => `Day ${n}`,
    openDay: n => `Open Day ${n} in the app — with guided audio`,
    pageTitle: (n, t) => `Day ${n}: ${t} — Stand`,
    describe: (t, track) => `A prayer for ${t.toLowerCase()} from Stand${track.id === "core" ? ", a 30-day journey from fear to faith" : ` — ${track.name}`}.`,
    daysWord: n => `${n} days`, openInApp: "open in the app",
    fearsTitle: "Where are you right now? — Stand",
    fearsDesc: "Say what you are afraid of \u2014 a court date, a diagnosis, a child, a bill, the dark \u2014 and start with the prayers written for it.",
    fearsEyebrow: "START WHERE YOU ARE", fearsHeading: "Where are you right now?",
    fearsLead: "You do not have to start at day one, and you do not have to know which journey you need. Find the sentence that sounds like your week, and begin there.",
    fearsCloseHeading: "None of these quite fit?",
    fearsCloseBody: "Open the app and press \u201cSteady me now\u201d. It takes ninety seconds and asks nothing of you first.",
    sosLabel: "Steady me now",
    switchLabel: "Español"
  },
  {
    code: "es", prefix: "/es", tracks: esTracks, fearIndex: esFearIndex, groups: esGroups,
    nav: [
      { href: APP, label: "Abrir la app" },
      { href: `${APP}?sos=1`, label: "Calma ahora" },
      { href: "/es/fears", label: "Empieza por un miedo" },
      { href: "/es", label: "Qué hace Stand" }
    ],
    openApp: "Abrir la app", menu: "Menú", brandHome: "/es",
    footerNote: "Gratis y privado por defecto.",
    reflection: "Reflexión", pray: "ORA", declare: "DECLARA", practice: "PRÁCTICA DE HOY", amen: "Amén.",
    dayWord: "DÍA", dayNav: n => `Día ${n}`,
    openDay: n => `Abre el día ${n} en la app — con audio guiado`,
    pageTitle: (n, t) => `Día ${n}: ${t} — Stand`,
    describe: (t, track) => `Una oración para ${t.toLowerCase()} de Stand${track.id === "core" ? ", un camino de 30 días del miedo a la fe" : ` — ${track.name}`}.`,
    daysWord: n => `${n} días`, openInApp: "abrir en la app",
    fearsTitle: "¿Dónde estás ahora mismo? — Stand",
    fearsDesc: "Di a qué le tienes miedo \u2014 una cita en el tribunal, un diagnóstico, un hijo, una cuenta, la oscuridad \u2014 y empieza con las oraciones escritas para eso.",
    fearsEyebrow: "EMPIEZA DONDE ESTÁS", fearsHeading: "¿Dónde estás ahora mismo?",
    fearsLead: "No tienes que empezar en el día uno, ni saber qué camino necesitas. Encuentra la frase que se parezca a tu semana y empieza ahí.",
    fearsCloseHeading: "¿Ninguna encaja del todo?",
    fearsCloseBody: "Abre la app y pulsa \u201cCalma ahora\u201d. Toma noventa segundos y no te pide nada primero.",
    sosLabel: "Calma ahora",
    switchLabel: "English"
  }
];

// A <details> disclosure rather than a scripted dropdown: these pages carry
// no JavaScript, the production CSP allows none inline, and the open state
// is announced natively. `alt` is the same page in the other language, so a
// reader who lands on the wrong one can cross over in a tap.
function siteNav(L, current, alt) {
  const items = L.nav.filter(l => l.href !== current)
    .map(l => `            <li><a href="${l.href}">${l.label}</a></li>`)
    .concat(alt ? [`            <li><a href="${alt}" hreflang="${L.code === "en" ? "es" : "en"}">${L.switchLabel}</a></li>`] : [])
    .join("\n");
  return `      <nav class="site-nav" aria-label="Main">
        <a class="nav-cta" href="${APP}">${L.openApp}</a>
        <details class="nav-menu">
          <summary>${L.menu}</summary>
          <ul>
${items}
          </ul>
        </details>
      </nav>`;
}

function siteFooter(L, current) {
  const links = L.nav.filter(l => l.href !== current && l.href !== APP)
    .map(l => `<a href="${l.href}">${l.label}</a>`).join(" \u00b7 ");
  return `    <footer class="landing-footer">
      <a class="complete-button" href="${APP}">${L.openApp}</a>
      <p class="footer-links">${links}</p>
      <p>${L.footerNote}</p>
    </footer>`;
}

// Shared social card. One image for every page: a link to any of these pages
// used to preview as a blank grey box, because no og:image existed anywhere
// in the repo. Regenerate the image with scripts/build-og-card.js.
//
// hreflang pairs each page with its translation and names the English one as
// x-default, so a search engine serves the right language rather than
// treating the two as duplicates of each other.
function socialMeta({ L, title, description, type, relPath, altPath }) {
  const alternates = altPath ? [
    `  <link rel="alternate" hreflang="en" href="${SITE_URL}${L.code === "en" ? relPath : altPath}" />`,
    `  <link rel="alternate" hreflang="es" href="${SITE_URL}${L.code === "es" ? relPath : altPath}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${L.code === "en" ? relPath : altPath}" />`
  ].join("\n") + "\n" : "";
  return `  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${SITE_URL}${relPath}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:site_name" content="Stand" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta property="og:locale" content="${L.code === "es" ? "es_ES" : "en_US"}" />
${alternates}  <link rel="canonical" href="${SITE_URL}${relPath}" />`;
}

function weekFor(track, i) {
  const w = track.weeks;
  if (w.length < 5) return w[0];
  return i < 7 ? w[0] : i < 14 ? w[1] : i < 21 ? w[2] : i < 29 ? w[3] : w[4];
}

// Page names for both locales up front, so each page can link to its
// translation: same track, same day index, different slug.
const localeOf = code => LOCALES.find(L => L.code === code);
const trackFor = (L, id) => L.code === "en" ? tracks[id] : { ...tracks[id], ...L.tracks[id] };
const slugs = {};
for (const L of LOCALES) {
  slugs[L.code] = {};
  for (const id of Object.keys(tracks)) {
    slugs[L.code][id] = trackFor(L, id).days.map((_, i) => pageName(trackFor(L, id), i));
  }
}
const urlBaseFor = (L, id) => id === "core" ? `${L.prefix}/day` : `${L.prefix}/track/${id}`;
const dayPath = (code, id, i) => `${urlBaseFor(localeOf(code), id)}/${slugs[code][id][i]}`;

const allPaths = [];

for (const L of LOCALES) {
  const other = L.code === "en" ? "es" : "en";
  for (const id of Object.keys(tracks)) {
    const track = trackFor(L, id);
    const dirRel = id === "core" ? path.join(L.prefix.slice(1), "day") : path.join(L.prefix.slice(1), "track", id);
    const urlBase = urlBaseFor(L, id);
    const appQuery = id === "core" ? "" : `?track=${id}`;
    fs.mkdirSync(path.join(root, dirRel), { recursive: true });

    for (let i = 0; i < track.days.length; i++) {
      const [title, ref, verse, reflection, prayer, declaration, action] = track.days[i];
      const pageTitle = L.pageTitle(i + 1, title);
      const description = `${L.describe(title, track)} ${reflection}`.slice(0, 155);
      const relPath = `${urlBase}/${slugs[L.code][id][i]}`;
      const altPath = dayPath(other, id, i);
      const prev = i > 0 ? `<a href="${urlBase}/${slugs[L.code][id][i - 1]}">← ${L.dayNav(i)}</a>` : "<span></span>";
      const next = i < track.days.length - 1 ? `<a href="${urlBase}/${slugs[L.code][id][i + 1]}">${L.dayNav(i + 2)} →</a>` : "<span></span>";

      const html = `<!doctype html>
<html lang="${L.code}" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="description" content="${esc(description)}" />
${socialMeta({ L, title: pageTitle, description, type: "article", relPath, altPath })}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(pageTitle)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="${L.brandHome}" aria-label="Stand"><span class="brand-mark">✦</span><span>STAND</span></a>
${siteNav(L, relPath, altPath)}
    </header>
    <main>
      <article class="devotional">
        <p class="eyebrow">${esc(weekFor(track, i))}</p>
        <div class="title-row"><div><p class="day-number">${L.dayWord} ${String(i + 1).padStart(2, "0")}</p><h1>${esc(title)}</h1></div></div>
        <blockquote class="scripture"><p>“${esc(verse)}”</p><cite>${esc(ref)}</cite></blockquote>
        <section class="content-section"><h2>${L.reflection}</h2><p>${esc(reflection)}</p></section>
        <section class="prayer-panel"><p class="section-kicker">${L.pray}</p><p>${esc(prayer)}</p><p class="amen">${L.amen}</p></section>
        <section class="declaration-panel"><p class="section-kicker">${L.declare}</p><p>${esc(declaration)}</p></section>
        <section class="action-panel"><div class="action-icon">→</div><div><p class="section-kicker">${L.practice}</p><p>${esc(action)}</p></div></section>
        <a class="complete-button" href="${APP}${appQuery}#${i + 1}">${L.openDay(i + 1)}</a>
        <nav class="day-nav" aria-label="${L.code === "es" ? "Navegación de días" : "Day navigation"}">${prev}${next}</nav>
      </article>
    </main>
${siteFooter(L, relPath)}
  </div>
</body>
</html>
`;
      fs.writeFileSync(path.join(root, dirRel, `${slugs[L.code][id][i]}.html`), html);
      allPaths.push(relPath);
    }
  }

  // The fear index as a crawlable page. These phrases are close to what
  // people actually search for, and they existed only inside a dialog.
  // Built from the same fearIndex the app uses, so the two cannot drift.
  const relPath = `${L.prefix}/fears`;
  const altPath = `${other === "en" ? "" : "/es"}/fears`;
  const rows = L.fearIndex.filter(([, id]) => tracks[id]).map(([label, id]) => ({
    label, id, track: trackFor(L, id), href: dayPath(L.code, id, 0)
  }));
  const groups = [];
  for (const row of rows) {
    const key = tracks[row.id].group || "";
    const name = L.groups ? (L.groups[key] || key) : key;
    const group = groups.find(g => g.name === name);
    if (group) group.rows.push(row); else groups.push({ name, rows: [row] });
  }
  const sections = groups.map(group => `
      <section class="landing-section">
        <h2 class="section-kicker">${esc(group.name)}</h2>
        <div class="feature-grid">
${group.rows.map(row => `          <div class="feature-card">
            <h3><a href="${row.href}">${esc(row.label)}</a></h3>
            <p>${esc(row.track.name)} \u00b7 ${L.daysWord(row.track.days.length)} \u00b7 <a href="${APP}${row.id === "core" ? "" : `?track=${row.id}`}">${L.openInApp}</a></p>
          </div>`).join("\n")}
        </div>
      </section>`).join("\n");

  const html = `<!doctype html>
<html lang="${L.code}" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="description" content="${esc(L.fearsDesc)}" />
${socialMeta({ L, title: L.fearsTitle, description: L.fearsDesc, type: "website", relPath, altPath })}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(L.fearsTitle)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="${L.brandHome}" aria-label="Stand"><span class="brand-mark">\u2726</span><span>STAND</span></a>
${siteNav(L, relPath, altPath)}
    </header>
    <main>
      <section class="landing-hero">
        <p class="eyebrow">${esc(L.fearsEyebrow)}</p>
        <h1>${esc(L.fearsHeading)}</h1>
        <p class="landing-lead">${esc(L.fearsLead)}</p>
        <a class="complete-button" href="${APP}">${L.openApp}</a>
      </section>
${sections}
      <section class="landing-section landing-close">
        <h2>${esc(L.fearsCloseHeading)}</h2>
        <p>${esc(L.fearsCloseBody)}</p>
        <a class="complete-button" href="${APP}?sos=1">${L.sosLabel}</a>
      </section>
    </main>
${siteFooter(L, relPath)}
  </div>
</body>
</html>
`;
  fs.mkdirSync(path.join(root, L.prefix.slice(1) || "."), { recursive: true });
  fs.mkdirSync(path.join(root, L.prefix.slice(1), "fears"), { recursive: true });
  fs.writeFileSync(path.join(root, L.prefix.slice(1), "fears", "index.html"), html);
}

// The landing pages are hand-written, not generated, but belong in the
// sitemap. /app is the SPA shell with no crawlable content of its own.
const urls = [`${SITE_URL}/`, `${SITE_URL}/es`, `${SITE_URL}/fears`, `${SITE_URL}/es/fears`,
  ...allPaths.map(p => `${SITE_URL}${p}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Wrote ${allPaths.length} day pages across ${LOCALES.length} languages, both fear indexes, sitemap.xml (${urls.length} URLs) and robots.txt`);
