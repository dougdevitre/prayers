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
//
// It also writes the privacy policy and terms of use in both languages, and
// the 404 page Vercel serves for any unknown path.

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
const { shareLinks, shareIcons: ICON } = require("../share.js");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pageName = (track, i) => `${String(i + 1).padStart(2, "0")}-${slugify(track.days[i][0])}`;

// Every generated page carries the same nav and footer, in its own language.
// A search visitor lands on day 14 of a courage story far more often than on
// the landing page, and those pages used to be dead ends.
const APP = "/app";

// The one public contact address, used by the privacy policy and the terms.
// There is no public address yet: this is a deliberate placeholder (the
// .invalid domain can never deliver mail) and must be replaced before the
// policies are published. Do not put a personal address here.
const CONTACT_EMAIL = "CONTACT_EMAIL_REQUIRED@example.invalid";

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
    legal: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" }
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
    switchLabel: "Español",
    imageAlt: "Stand — a prayer companion for fear",
    share: { label: "Share this day", copy: "Copy link", copied: "Link copied", native: "Share…", x: "Share on X", facebook: "Share on Facebook", whatsapp: "Share on WhatsApp", email: "Share by email", url: "Page link" }
  },
  {
    code: "es", prefix: "/es", tracks: esTracks, fearIndex: esFearIndex, groups: esGroups,
    nav: [
      { href: APP, label: "Abrir la app" },
      { href: `${APP}?sos=1`, label: "Calma ahora" },
      { href: "/es/fears", label: "Empieza por un miedo" },
      { href: "/es", label: "Qué hace Stand" }
    ],
    legal: [
      { href: "/es/privacy", label: "Privacidad" },
      { href: "/es/terms", label: "Términos" }
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
    switchLabel: "English",
    imageAlt: "Stand — un compañero de oración para el miedo",
    share: { label: "Compartir este día", copy: "Copiar enlace", copied: "Enlace copiado", native: "Compartir…", x: "Compartir en X", facebook: "Compartir en Facebook", whatsapp: "Compartir en WhatsApp", email: "Compartir por correo", url: "Enlace de la página" }
  }
];

// A <details> disclosure rather than a scripted dropdown: these pages carry
// no JavaScript beyond the deferred share.js enhancement, the production CSP
// allows none inline, and the open state is announced natively. `alt` is the same page in the other language, so a
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

// The privacy policy and terms close the list on every page, after the
// ways onward.
function siteFooter(L, current) {
  const links = L.nav.filter(l => l.href !== current && l.href !== APP)
    .concat(L.legal.filter(l => l.href !== current))
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
  // Width, height and alt let a scraper lay the card out before it fetches
  // the image (and give the alt text screen readers announce in a feed);
  // the twitter:* names are what X reads first, falling back to og:* only
  // sometimes, so they are stated rather than assumed.
  return `  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${SITE_URL}${relPath}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(L.imageAlt)}" />
  <meta property="og:site_name" content="Stand" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <meta name="twitter:image:alt" content="${esc(L.imageAlt)}" />
  <meta property="og:locale" content="${L.code === "es" ? "es_ES" : "en_US"}" />
  <meta property="og:locale:alternate" content="${L.code === "es" ? "en_US" : "es_ES"}" />
${alternates}  <link rel="canonical" href="${SITE_URL}${relPath}" />`;
}

// Structured data for one day: an Article in a series, with its translation
// and a breadcrumb trail. The landing page already carries a WebSite and a
// SoftwareApplication under the same CSP — a JSON-LD block is data, not a
// script, so script-src 'self' does not block it (the smoke suite checks).
// "</" is escaped so no content string could ever close the script element.
function structuredData({ L, track, id, i, title, ref, description, relPath, altPath, other }) {
  const url = `${SITE_URL}${relPath}`;
  const altUrl = `${SITE_URL}${altPath}`;
  const seriesUrl = `${SITE_URL}${urlBaseFor(L, id)}/${slugs[L.code][id][0]}`;
  const article = {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: `${L.dayNav(i + 1)}: ${title}`,
    name: title,
    description,
    url,
    mainEntityOfPage: url,
    inLanguage: L.code,
    image: OG_IMAGE,
    isAccessibleForFree: true,
    citation: ref,
    position: i + 1,
    isPartOf: { "@type": "CreativeWorkSeries", "@id": `${seriesUrl}#series`, name: track.name, url: seriesUrl, inLanguage: L.code },
    publisher: { "@type": "Organization", name: "Stand", url: `${SITE_URL}/` }
  };
  // The two languages point at each other, so a search engine sees one work
  // in two languages rather than two works.
  article[L.code === "en" ? "workTranslation" : "translationOfWork"] = { "@type": "Article", "@id": `${altUrl}#article`, inLanguage: other };
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Stand", item: `${SITE_URL}${L.brandHome}` },
      { "@type": "ListItem", position: 2, name: track.short, item: seriesUrl },
      { "@type": "ListItem", position: 3, name: `${L.dayNav(i + 1)}: ${title}`, item: url }
    ]
  };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [article, breadcrumb] }, null, 2).replace(/<\//g, "<\\/");
}

// The share row on every day page: copy the link, the device's share sheet,
// and four intent links. The links are plain anchors and work with no
// JavaScript at all; the two buttons start hidden and share.js reveals them,
// so a reader without scripts never sees a control that does nothing. Icons
// come from share.js, inline SVG, so the page loads nothing from any
// platform. The caption is the verse and its reference, the same text the
// app shares.
function shareRow({ L, url, title, text }) {
  const links = shareLinks({ url, title, text });
  const S = L.share;
  const platform = (name, label) => `<a class="share-link" href="${esc(links[name])}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}" title="${esc(label)}">${ICON[name]}</a>`;
  return `        <nav class="share-row" aria-label="${esc(S.label)}" data-url="${esc(url)}" data-title="${esc(title)}" data-text="${esc(text)}">
          <span class="share-label">${esc(S.label)}</span>
          <button type="button" class="share-copy" data-copied="${esc(S.copied)}" hidden>${ICON.link}<span>${esc(S.copy)}</span></button>
          <button type="button" class="share-native" hidden>${ICON.share}<span>${esc(S.native)}</span></button>
          ${platform("x", S.x)}
          ${platform("facebook", S.facebook)}
          ${platform("whatsapp", S.whatsapp)}
          ${platform("email", S.email)}
          <input class="share-url" type="text" readonly value="${esc(url)}" aria-label="${esc(S.url)}" hidden />
        </nav>`;
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
  <script type="application/ld+json">
${structuredData({ L, track, id, i, title, ref, description, relPath, altPath, other })}
  </script>
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
        <section class="action-panel" id="practice"><div class="action-icon">→</div><div><p class="section-kicker">${L.practice}</p><p>${esc(action)}</p></div></section>
${shareRow({ L, url: `${SITE_URL}${relPath}`, title: pageTitle, text: `“${verse}” — ${ref}` })}
        <a class="complete-button" href="${APP}${appQuery}#${i + 1}">${L.openDay(i + 1)}</a>
        <nav class="day-nav" aria-label="${L.code === "es" ? "Navegación de días" : "Day navigation"}">${prev}${next}</nav>
      </article>
    </main>
${siteFooter(L, relPath)}
  </div>
  <script src="/share.js" defer></script>
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

// ---------------------------------------------------------------------
// Privacy policy and terms of use, in both languages.
//
// Plain language, short sections, nothing claimed that the code does not do:
// every statement below was checked against this repository (localStorage
// only, no cookies or analytics, the Cache API for offline audio, Vercel
// hosting, the /calendar.ics query, the scrubbed /api/report error reports,
// pre-rendered ElevenLabs narration). If the app changes what it stores or
// sends, these pages must change with it.
//
// Section bodies are trusted markup written here, not content, so they are
// not escaped; headings are. Paragraph text stays on one line because
// .content-section p is white-space:pre-line.
const DRAFT_NOTE = "Plain-language draft for review by an attorney before publication.";
const contactLink = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const para = s => `<p>${s}</p>`;
const list = items => `<ul>\n${items.map(i => `            <li>${i}</li>`).join("\n")}\n          </ul>`;

// Plain-language draft for review by an attorney before publication.
const PRIVACY = {
  slug: "privacy",
  en: {
    title: "Privacy — Stand",
    description: "How Stand handles your information, in plain language: no account, no cookies, no tracking, and what you write stays on your device.",
    eyebrow: "PRIVACY POLICY",
    heading: "Privacy",
    summary: "Stand has no account, no cookies, no advertising and no tracking, and it never sells or shares your personal data. What you write, save and choose in the app stays on your own device; we never see it. Like any website, Stand is delivered by a hosting company, which receives basic technical information in order to send you the pages. The sections below explain each of these in a little more detail.",
    sections: [
      ["WHAT STAND DOES NOT DO", [
        list(["No account and no sign-in.", "No cookies.", "No advertising.", "No analytics or tracking scripts.", "No selling or sharing of your personal data."])
      ]],
      ["WHAT STAYS ON YOUR DEVICE", [
        para("Everything you enter in Stand — your progress, notes, journal, fear check-ins, favorites and preferences — is stored only on your own device, in your browser’s local storage. It is not sent to us or to anyone else."),
        para("It leaves your device only if you choose to take it out: by downloading your journal as a text file (.txt), by downloading a backup file (.json), or by sharing.")
      ]],
      ["REMOVING YOUR DATA", [
        para("You can delete everything at any time with “Erase all data” in the app. Clearing your browser’s stored data for this site deletes it too."),
        para("One thing to know on iPhone: Safari may delete a website’s stored data after about a week without a visit, unless the site has been added to your Home Screen. If your notes matter to you, please download a backup from time to time.")
      ]],
      ["LISTENING OFFLINE", [
        para("If you turn on offline listening, audio recordings are saved on your device, in the browser’s cache, so they can play without a connection. Turning it off, or erasing all data, deletes them.")
      ]],
      ["HOSTING", [
        para("The website and the audio recordings are served by Vercel, our hosting provider; the recordings come from stand-audio.vercel.app. Like any web host, Vercel receives technical information with each request, such as your IP address, your browser type and the page you asked for, in order to deliver the site and protect it. You can read <a href=\"https://vercel.com/legal/privacy-policy\">Vercel’s privacy notice</a>.")
      ]],
      ["ERROR REPORTS", [
        para("If part of Stand stops working on your device, the app sends a short technical report to our host so we can fix it: the kind of error, a shortened error message with any quoted text removed, the file and line in Stand’s own code where it happened, and the page it happened on. It never includes your notes, your progress or anything you typed, and it carries no identifier. At most three reports are sent per visit, and none if your browser sends the Global Privacy Control signal. Reports are kept only in our host’s logs, for a short time.")
      ]],
      ["CALENDAR SUBSCRIPTION", [
        para("If you subscribe to Stand’s calendar feed (/calendar.ics), your calendar app will request a link from time to time. That link contains only the journey, the day to start on, a date, a time, the language and a few option settings. It contains no notes and no personal details. The request is handled by our host.")
      ]],
      ["RECORDED NARRATION", [
        para("The spoken narration was produced ahead of time with ElevenLabs text-to-speech. Nothing you enter in Stand is ever sent to ElevenLabs or to any AI service.")
      ]],
      ["SHARING", [
        para("When you use Share, Copy link, or a link to X, Facebook, WhatsApp or email, what happens next is governed by that platform. Stand adds no tracking parameters to the links it shares.")
      ]],
      ["CHILDREN", [
        para("Stand is not directed to children under 13.")
      ]],
      ["CHANGES TO THIS POLICY", [
        para("If this policy changes, the new version will be posted on this page with a new date.")
      ]],
      ["CONTACT", [
        para(`If you have a question about your privacy, you can write to ${contactLink}.`)
      ]]
    ],
    updated: "Last updated: 26 September 2026"
  },
  es: {
    title: "Privacidad — Stand",
    description: "Cómo trata Stand tu información, en palabras sencillas: sin cuenta, sin cookies, sin rastreo, y lo que escribes se queda en tu dispositivo.",
    eyebrow: "POLÍTICA DE PRIVACIDAD",
    heading: "Privacidad",
    summary: "Stand no tiene cuentas, ni cookies, ni publicidad, ni rastreo, y nunca vende ni comparte tus datos personales. Lo que escribes, guardas y eliges en la app se queda en tu propio dispositivo; nosotros nunca lo vemos. Como cualquier sitio web, Stand llega a ti a través de una empresa de alojamiento, que recibe información técnica básica para poder enviarte las páginas. Aquí abajo te lo explicamos con un poco más de detalle.",
    sections: [
      ["LO QUE STAND NO HACE", [
        list(["No hay cuenta ni inicio de sesión.", "No usa cookies.", "No muestra publicidad.", "No lleva scripts de analítica ni de rastreo.", "No vende ni comparte tus datos personales."])
      ]],
      ["LO QUE SE QUEDA EN TU DISPOSITIVO", [
        para("Todo lo que introduces en Stand —tu progreso, tus notas, tu diario, tus registros del miedo, tus favoritos y tus preferencias— se guarda solo en tu propio dispositivo, en el almacenamiento local del navegador. No se envía ni a nosotros ni a nadie."),
        para("Solo sale de tu dispositivo si tú decides sacarlo: al descargar tu diario como archivo de texto (.txt), al descargar un respaldo (.json) o al compartir.")
      ]],
      ["CÓMO BORRAR TUS DATOS", [
        para("Puedes borrarlo todo cuando quieras con “Borrar todos los datos” en la app. Si borras los datos guardados de este sitio en tu navegador, también desaparecen."),
        para("Algo importante en iPhone: Safari puede borrar los datos que guarda un sitio web si pasa alrededor de una semana sin que lo visites, a menos que hayas añadido el sitio a tu pantalla de inicio. Si tus notas son valiosas para ti, descarga un respaldo de vez en cuando.")
      ]],
      ["ESCUCHAR SIN CONEXIÓN", [
        para("Si activas la escucha sin conexión, las grabaciones de audio se guardan en tu dispositivo, en la caché del navegador, para que suenen aunque no tengas internet. Al desactivarla, o al borrar todos los datos, se eliminan.")
      ]],
      ["ALOJAMIENTO", [
        para("El sitio web y las grabaciones de audio los sirve Vercel, nuestro proveedor de alojamiento; las grabaciones llegan desde stand-audio.vercel.app. Como cualquier servidor web, Vercel recibe información técnica con cada solicitud —por ejemplo, tu dirección IP, el tipo de navegador y la página que pediste— para poder entregarte el sitio y protegerlo. Puedes leer el <a href=\"https://vercel.com/legal/privacy-policy\">aviso de privacidad de Vercel</a>.")
      ]],
      ["INFORMES DE ERRORES", [
        para("Si alguna parte de Stand deja de funcionar en tu dispositivo, la app envía un breve informe técnico a nuestro proveedor de alojamiento para que podamos arreglarlo: el tipo de error, un mensaje de error abreviado sin el texto entre comillas, el archivo y la línea del código de Stand donde ocurrió, y la página en la que estabas. Nunca incluye tus notas, tu progreso ni nada de lo que escribiste, y no lleva ningún identificador. Se envían como máximo tres informes por visita, y ninguno si tu navegador envía la señal Global Privacy Control. Los informes se guardan solo en los registros de nuestro proveedor, por poco tiempo.")
      ]],
      ["SUSCRIPCIÓN AL CALENDARIO", [
        para("Si te suscribes al calendario de Stand (/calendar.ics), tu app de calendario pedirá un enlace de vez en cuando. Ese enlace contiene solo el camino, el día en que empiezas, una fecha, una hora, el idioma y algunas opciones. No contiene notas ni datos personales. La solicitud la atiende nuestro proveedor de alojamiento.")
      ]],
      ["NARRACIÓN GRABADA", [
        para("La narración se grabó de antemano con la tecnología de texto a voz de ElevenLabs. Nada de lo que introduces en Stand se envía nunca a ElevenLabs ni a ningún servicio de inteligencia artificial.")
      ]],
      ["COMPARTIR", [
        para("Cuando usas Compartir, Copiar enlace o un enlace a X, Facebook, WhatsApp o el correo, lo que ocurre después depende de esa plataforma y de sus propias reglas. Stand no añade parámetros de rastreo a los enlaces que comparte.")
      ]],
      ["MENORES", [
        para("Stand no está dirigido a menores de 13 años.")
      ]],
      ["CAMBIOS EN ESTA POLÍTICA", [
        para("Si esta política cambia, publicaremos la nueva versión en esta página con una fecha nueva.")
      ]],
      ["CONTACTO", [
        para(`Si tienes alguna pregunta sobre tu privacidad, puedes escribir a ${contactLink}.`)
      ]]
    ],
    updated: "Última actualización: 26 de septiembre de 2026"
  }
};

// Plain-language draft for review by an attorney before publication.
const TERMS = {
  slug: "terms",
  en: {
    title: "Terms of use — Stand",
    description: "The terms for using Stand, in plain language: spiritual encouragement rather than professional advice, where to find help in a crisis, and what you may share.",
    eyebrow: "TERMS OF USE",
    heading: "Terms of use",
    summary: "Stand is a free companion for prayer when you are afraid. It offers spiritual encouragement, not medical, mental health, legal or financial advice, and it does not take the place of a licensed professional. If you are in crisis or in danger, please reach out for help now; the numbers are below. Stand is offered freely and as it is, and we ask only that you use it kindly.",
    sections: [
      ["WHAT STAND IS", [
        para("Stand offers spiritual encouragement and prayer. It is not medical, mental health, legal or financial advice, and it is not a substitute for a licensed professional."),
        para("The journeys about health and money pray alongside medical care and practical steps, never instead of them.")
      ]],
      ["IF YOU ARE IN CRISIS", [
        para("You do not have to carry this alone. If you are in the United States:"),
        list(["Call or text <a href=\"tel:988\">988</a>.", "Text HOME to 741741.", "If you are in immediate danger, call <a href=\"tel:911\">911</a>."]),
        para("Outside the United States, you can find a local helpline at <a href=\"https://findahelpline.com\">findahelpline.com</a>.")
      ]],
      ["SCRIPTURE", [
        para("The scripture in Stand is in the public domain: the World English Bible in English and the Reina-Valera 1909 in Spanish.")
      ]],
      ["STAND’S OWN WORDS AND RECORDINGS", [
        para("The original text, prayers and recordings in Stand belong to the Stand project. You are welcome to use them for your own personal, non-commercial prayer, and to share links to them with anyone.")
      ]],
      ["OFFERED FREELY, AS IT IS", [
        para("Stand is free. It is provided “as is”, without warranties of any kind. The service may change, and it may stop.")
      ]],
      ["USING STAND", [
        para("Please use Stand kindly and lawfully, and do not try to disrupt the service.")
      ]],
      ["YOUR PRIVACY", [
        para("How Stand handles information is explained in the <a href=\"/privacy\">privacy policy</a>.")
      ]],
      ["CONTACT", [
        para(`If you have a question about these terms, you can write to ${contactLink}.`)
      ]]
    ],
    updated: "Last updated: 26 September 2026"
  },
  es: {
    title: "Términos de uso — Stand",
    description: "Los términos de uso de Stand, en palabras sencillas: acompañamiento espiritual y no consejo profesional, dónde buscar ayuda en una crisis y qué puedes compartir.",
    eyebrow: "TÉRMINOS DE USO",
    heading: "Términos de uso",
    summary: "Stand es un compañero gratuito para orar cuando tienes miedo. Ofrece acompañamiento espiritual, no consejo médico, de salud mental, legal ni financiero, y no ocupa el lugar de un profesional con licencia. Si estás en crisis o en peligro, busca ayuda ahora; los números están más abajo. Stand se ofrece gratis y tal como es, y solo te pedimos que lo uses con amabilidad.",
    sections: [
      ["QUÉ ES STAND", [
        para("Stand ofrece ánimo espiritual y oración. No es consejo médico, de salud mental, legal ni financiero, y no sustituye a un profesional con licencia."),
        para("Los caminos sobre la salud y el dinero oran junto a la atención médica y los pasos prácticos, nunca en su lugar.")
      ]],
      ["SI ESTÁS EN CRISIS", [
        para("No tienes que cargar con esto a solas. Si estás en Estados Unidos:"),
        list(["Llama al <a href=\"tel:988\">988</a> y marca 2, o envía un mensaje de texto con la palabra AYUDA al 988.", "Envía AYUDA por mensaje de texto al 741741.", "Si estás en peligro inmediato, llama al <a href=\"tel:911\">911</a>."]),
        para("Fuera de Estados Unidos, puedes encontrar una línea de ayuda local en <a href=\"https://findahelpline.com\">findahelpline.com</a>.")
      ]],
      ["LA ESCRITURA", [
        para("La Escritura en Stand es de dominio público: la World English Bible en inglés y la Reina-Valera 1909 en español.")
      ]],
      ["LAS PALABRAS Y GRABACIONES DE STAND", [
        para("Los textos, las oraciones y las grabaciones originales de Stand pertenecen al proyecto Stand. Puedes usarlos para tu oración personal, sin fines comerciales, y compartir enlaces a ellos con quien quieras.")
      ]],
      ["GRATIS Y TAL COMO ES", [
        para("Stand es gratuito. Se ofrece “tal cual”, sin garantías de ningún tipo. El servicio puede cambiar, y también puede dejar de existir.")
      ]],
      ["CÓMO USAR STAND", [
        para("Te pedimos que uses Stand con amabilidad y dentro de la ley, y que no intentes interrumpir el servicio.")
      ]],
      ["TU PRIVACIDAD", [
        para("Cómo trata Stand la información se explica en la <a href=\"/es/privacy\">política de privacidad</a>.")
      ]],
      ["CONTACTO", [
        para(`Si tienes alguna pregunta sobre estos términos, puedes escribir a ${contactLink}.`)
      ]]
    ],
    updated: "Última actualización: 26 de septiembre de 2026"
  }
};

// One document in one language, in the same shell as the fear index: the
// hero carries the plain summary, and each heading is a real h2 so the
// outline does not skip a level.
const legalPaths = [];
for (const doc of [PRIVACY, TERMS]) {
  for (const L of LOCALES) {
    const d = doc[L.code];
    const relPath = `${L.prefix}/${doc.slug}`;
    const altPath = `${L.code === "en" ? "/es" : ""}/${doc.slug}`;
    const sections = d.sections.map(([heading, body]) => `        <section class="content-section">
          <h2 class="section-kicker">${esc(heading)}</h2>
${body.map(b => `          ${b}`).join("\n")}
        </section>`).join("\n");
    const html = `<!doctype html>
<!-- ${DRAFT_NOTE} -->
<html lang="${L.code}" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="description" content="${esc(d.description)}" />
${socialMeta({ L, title: d.title, description: d.description, type: "website", relPath, altPath })}
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>${esc(d.title)}</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="${L.brandHome}" aria-label="Stand"><span class="brand-mark">✦</span><span>STAND</span></a>
${siteNav(L, relPath, altPath)}
    </header>
    <main>
      <section class="landing-hero">
        <p class="eyebrow">${esc(d.eyebrow)}</p>
        <h1>${esc(d.heading)}</h1>
        <p class="landing-lead">${esc(d.summary)}</p>
      </section>
      <section class="landing-section">
${sections}
        <p class="landing-fineprint">${esc(d.updated)}</p>
      </section>
    </main>
${siteFooter(L, relPath)}
  </div>
</body>
</html>
`;
    fs.mkdirSync(path.join(root, L.prefix.slice(1), doc.slug), { recursive: true });
    fs.writeFileSync(path.join(root, L.prefix.slice(1), doc.slug, "index.html"), html);
    legalPaths.push(relPath);
  }
}

// The 404 page. Vercel serves /404.html for any path that matches nothing,
// at that path, so a reader never knows which language they meant: one
// page carries both, and every link is absolute. It is never indexed and
// is not in the sitemap, and it carries no canonical or hreflang, since it
// stands in for whatever URL was mistyped. No script.
{
  const [en, es] = LOCALES;
  const description = "This page could not be found. Open Stand, steady yourself, or start from the home page.";
  const html = `<!doctype html>
<html lang="en" class="theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#132a3a" />
  <meta name="robots" content="noindex" />
  <meta name="description" content="${esc(description)}" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <title>Page not found · Página no encontrada — Stand</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Stand"><span class="brand-mark">✦</span><span>STAND</span></a>
${siteNav(en, null, "/es")}
    </header>
    <main>
      <section class="landing-hero">
        <p class="eyebrow">PAGE NOT FOUND</p>
        <h1>This page isn’t here.</h1>
        <p class="landing-lead">The link may be old, or a letter may have slipped — it happens. You can open the app, take ninety steady seconds, or start again from the home page.</p>
        <div class="hero-actions">
          <a class="complete-button" href="${APP}">${en.openApp}</a>
          <a class="complete-button hero-secondary" href="${APP}?sos=1">${en.sosLabel}</a>
        </div>
        <p class="landing-fineprint"><a href="/">Go to the home page</a></p>
      </section>
      <section class="landing-section landing-close" lang="es">
        <p class="section-kicker">PÁGINA NO ENCONTRADA</p>
        <h2>Esta página no está aquí.</h2>
        <p>Puede que el enlace sea antiguo o que se haya colado una letra; son cosas que pasan. Puedes abrir la app, tomarte noventa segundos para recuperar la calma o empezar de nuevo desde la página de inicio.</p>
        <div class="hero-actions">
          <a class="complete-button" href="${APP}">${es.openApp}</a>
          <a class="complete-button hero-secondary" href="${APP}?sos=1">${es.sosLabel}</a>
        </div>
        <p class="landing-fineprint"><a href="/es">Ir a la página de inicio en español</a></p>
      </section>
    </main>
${siteFooter(en, null)}
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, "404.html"), html);
}

// The landing pages are hand-written, not generated, but belong in the
// sitemap. /app is the SPA shell with no crawlable content of its own; the
// 404 page is deliberately absent.
const urls = [`${SITE_URL}/`, `${SITE_URL}/es`, `${SITE_URL}/fears`, `${SITE_URL}/es/fears`,
  ...legalPaths.map(p => `${SITE_URL}${p}`),
  ...allPaths.map(p => `${SITE_URL}${p}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Wrote ${allPaths.length} day pages across ${LOCALES.length} languages, both fear indexes, ${legalPaths.length} privacy and terms pages, 404.html, sitemap.xml (${urls.length} URLs) and robots.txt`);
