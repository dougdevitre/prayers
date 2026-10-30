#!/usr/bin/env node
// The flyer and the bulletin insert, for a church or a group to share Stand:
// one page each, in English and Spanish. The flyer is a US Letter page for a
// notice board; the insert is a half sheet for the bulletin, printed two to a
// US Letter page (landscape) with a dashed line to cut along.
//
//   npm run build:flyer                  → all four, in .workbook/
//   npm run build:flyer -- --lang es     → the Spanish ones only
//   CHROMIUM_PATH=/path/to/chrome npm run build:flyer
//
// Each carries a code that opens the app, the help lines worded as the app
// words them (the workbook's support block, from ui.js), and a line for the
// church's name: a form field to type it into before printing, or a rule to
// write on by hand. The insert's two copies are one field, so the name is
// typed once. Most of the words are the landing pages' own (index.html,
// es/index.html), the counts come from content.js, and the draft note follows
// the app's own draft label (meta.reviewNote in prayers.js), as the
// workbook's does.
//
// Printed by Chromium like the workbook; the build fails, naming the copy, if
// anything runs off the page. The form runs no script and sends nothing
// anywhere (scripts/workbook-form.js).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { tracks } = require("../content.js");
const { esGroups } = require("../content.es.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const { SITE, LANGS, OUT_DIR, COPY: WORKBOOK, appLink, makeQr, supportHtml, fontCss } = require("./build-print-workbook.js");

const HOST = new URL(SITE).host;
const LAYOUTS = ["flyer", "insert"];
// The sheet each layout prints on, and the copies on it.
const SHEETS = {
  flyer: { width: "8.5in", height: "11in", viewport: { width: 816, height: 1056 }, copies: 1 },
  insert: { width: "11in", height: "8.5in", viewport: { width: 1056, height: 816 }, copies: 2 }
};

// The flyers' own words. The help lines are the app's, and the rest follows
// the landing pages and the glossary: Steady me now / Calma ahora, journey /
// camino, the Prayer Book / el Devocionario, the Rosary / el Rosario.
const COPY = {
  en: {
    flyer: { file: "Stand-Flyer.pdf", docTitle: "Stand — Flyer" },
    insert: { file: "Stand-Bulletin-Insert.pdf", docTitle: "Stand — Bulletin insert" },
    kicker: "A prayer companion for fear",
    title: "Steady, when fear will not sit still.",
    lead: "At 3 a.m., before the hearing, in the waiting room — Stand is one tap from a guided moment that slows your breathing and returns you to what is true. Then it becomes a daily practice for standing steady.",
    scan: "Scan to open Stand",
    free: "Free. No account. Works offline, and what you write stays on your device.",
    features: ({ sos, journeys, fear, stories }) => [
      [`${sos}.`, "Ninety seconds, always one tap away: a breathing pacer, one anchoring verse, a short spoken prayer, a declaration."],
      [`${journeys} guided journeys.`, `Two 30-day journeys, through the armor of Ephesians and the Psalms of trust, ${fear} journeys for fear, and ${stories} four-day courage stories.`],
      ["The Prayer Book and the Rosary.", "Traditional Christian prayers, and the Rosary with its mysteries for each day."],
      ["English and Spanish, read aloud.", "Every day and every prayer can be spoken, at your own pace."],
      ["Printable workbooks.", "Both 30-day journeys on paper, or to fill in on screen:"]
    ],
    workbookPath: "/workbook",
    shared: "Shared with you by",
    qrLabel: url => `QR code: ${url}`
  },
  es: {
    flyer: { file: "Stand-Volante.pdf", docTitle: "Stand — Volante" },
    insert: { file: "Stand-Media-Hoja-Boletin.pdf", docTitle: "Stand — Media hoja para el boletín" },
    kicker: "Un compañero de oración para el miedo",
    title: "Firme, cuando el miedo no se queda quieto.",
    lead: "A las tres de la mañana, antes de la audiencia, en la sala de espera: Stand está a un toque de un momento guiado que calma tu respiración y te devuelve a lo que es cierto. Después se vuelve una práctica diaria para mantenerte firme.",
    scan: "Escanea para abrir Stand",
    free: "Gratis. Sin cuenta. Funciona sin conexión, y lo que escribes se queda en tu dispositivo.",
    features: ({ sos, journeys, fear, stories }) => [
      [`${sos}.`, "Noventa segundos, siempre a un toque: una guía de respiración, un versículo que ancla, una oración breve hablada, una declaración."],
      [`${journeys} caminos guiados.`, `Dos caminos de 30 días, por la armadura de Efesios y por los Salmos de confianza, ${fear} caminos para el miedo y ${stories} historias de valor de cuatro días.`],
      ["El Devocionario y el Rosario.", "Oraciones cristianas tradicionales, y el Rosario con sus misterios de cada día."],
      ["En español y en inglés, en voz alta.", "Cada día y cada oración pueden escucharse, a tu ritmo."],
      ["Cuadernos para imprimir.", "Los dos caminos de 30 días en papel, o para rellenar en pantalla:"]
    ],
    workbookPath: "/es/cuaderno",
    shared: "Compartido por",
    qrLabel: url => `Código QR: ${url}`
  }
};

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The counts the flyer quotes, from the content itself. */
function counts(lang = "en") {
  const ids = Object.keys(tracks);
  const group = name => ids.filter(id => tracks[id].group === name).length;
  const thirty = group("The 30-Day Journey");
  // The copy names the two 30-day journeys (Stand and Shelter) in words.
  if (thirty !== 2) throw new Error(`the flyer names two 30-day journeys; the content has ${thirty}`);
  return { sos: appUi[lang]["sos.button"], journeys: ids.length, thirty, fear: group("Journeys for fear"), stories: group("Courage stories") };
}
// The groups the counts read (content.es.js names the same three), so a
// renamed group fails here rather than printing "0 journeys for fear".
for (const name of ["Journeys for fear", "Courage stories"]) if (!esGroups[name]) throw new Error(`content.es.js has no group "${name}"`);

/** The one address the flyers' code opens: the app, in the flyer's language. */
const qrTarget = (lang = "en") => appLink(lang);

/**
 * The HTML for one layout in one language. `qr` maps qrTarget(lang) to an SVG
 * (makeQr); `fontBase` is the URL the bundled fonts load from.
 */
function buildHtml({ qr, lang = "en", layout = "flyer", fontBase = `file://${path.join(ROOT, "fonts")}/` }) {
  const C = COPY[lang];
  const url = qrTarget(lang);
  if (!qr[url]) throw new Error(`no QR code for ${url}`);
  const n = counts(lang);
  const draft = prayerCorpus.meta && prayerCorpus.meta.reviewNote ? WORKBOOK[lang].draft : "";
  const size = layout === "insert" ? 8.5 : 11; // the church's name, in points
  const STAR = `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z"/></svg>`;
  const features = C.features(n);
  const last = features.length - 1;
  const copy = `<div class="copy">
  <p class="mast">${STAR}<span>Stand</span></p>
  <p class="kicker">${esc(C.kicker)}</p>
  <h1>${esc(C.title)}</h1>
  <p class="lead">${esc(C.lead)}</p>
  <div class="scan">
    <div class="qr" role="img" aria-label="${esc(C.qrLabel(url))}">${qr[url]}</div>
    <div class="scan-text">
      <p class="scan-title">${esc(C.scan)}</p>
      <p class="url">${esc(HOST)}</p>
      <p class="free">${esc(C.free)}</p>
    </div>
  </div>
  <ul class="features">
    ${features.map(([lead, text], i) => `<li><b>${esc(lead)}</b> ${esc(text)}${i === last ? ` <span class="path">${esc(HOST + C.workbookPath)}</span>` : ""}</li>`).join("\n    ")}
  </ul>
  <p class="shared"><span>${esc(C.shared)}</span><span class="blank" data-field="shared-by" data-kind="text" data-tip="${esc(C.shared)}" data-size="${size}"></span></p>
  ${supportHtml(lang)}
  ${draft ? `<p class="draft">${esc(draft)}</p>` : ""}
</div>`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(C[layout].docTitle)}</title><style>
${fontCss(fontBase)}
${CSS}</style></head><body class="${layout}"><main class="sheet">${Array(SHEETS[layout].copies).fill(copy).join("\n")}</main></body></html>`;
  return { html };
}

// Ink on white, with gold for accents only: a church office often prints in
// black and white, and the page has to read as well in grey. --s scales the
// flyer's type down for the half-sheet insert.
const CSS = `
@page{margin:0}
:root{--ink:#132a3a;--gold:#b88732;--gold-text:#8a6420;--muted:#4f5f69;--rule:#b9c3c9}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:"StandSans";color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
p{margin:0}
.sheet{display:flex;width:8.5in;height:11in;overflow:hidden}
.insert .sheet{width:11in;height:8.5in}
.copy{--s:1;flex:none;display:flex;flex-direction:column;width:8.5in;height:11in;padding:.5in .68in .48in;overflow:hidden;font-size:calc(var(--s)*11pt);line-height:1.4}
.insert .copy{--s:.7;width:5.5in;height:8.5in;padding:.38in .4in .34in}
.insert .copy+.copy{border-left:1pt dashed var(--rule)}
.mast{display:flex;align-items:center;gap:calc(var(--s)*7pt);font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:calc(var(--s)*12pt)}
.star{width:calc(var(--s)*15pt);height:calc(var(--s)*15pt);fill:var(--gold)}
.kicker{margin:calc(var(--s)*14pt) 0 calc(var(--s)*6pt);font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text);font-size:calc(var(--s)*10pt)}
h1{margin:0 0 calc(var(--s)*10pt);font-family:"StandSerif";font-weight:600;font-size:calc(var(--s)*32pt);line-height:1.08;letter-spacing:-.01em;text-wrap:balance}
.lead{margin:0 0 calc(var(--s)*16pt);font-family:"StandSerif";font-size:calc(var(--s)*13pt);line-height:1.42;text-wrap:pretty}
.scan{display:flex;align-items:center;gap:calc(var(--s)*16pt);padding:calc(var(--s)*12pt);border:calc(var(--s)*1.6pt) solid var(--gold);border-radius:calc(var(--s)*9pt);margin:0 0 calc(var(--s)*16pt)}
.qr{flex:none;width:calc(var(--s)*1.7in);height:calc(var(--s)*1.7in)}
.qr svg{display:block;width:100%;height:100%}
.scan-title{font-weight:700;font-size:calc(var(--s)*17pt);line-height:1.2;margin:0 0 calc(var(--s)*3pt)}
.url{font-family:"StandSerif";font-size:calc(var(--s)*14pt);margin:0 0 calc(var(--s)*8pt)}
.free{color:var(--muted)}
.features{list-style:none;margin:0;padding:0}
.features li{position:relative;padding-left:calc(var(--s)*16pt);margin:0 0 calc(var(--s)*5pt);text-wrap:pretty}
.features li::before{content:"";position:absolute;left:calc(var(--s)*2pt);top:calc(var(--s)*5.5pt);width:calc(var(--s)*6pt);height:calc(var(--s)*6pt);background:var(--gold);transform:rotate(45deg)}
.path{font-weight:700;white-space:nowrap}
.shared{display:flex;align-items:flex-end;gap:calc(var(--s)*8pt);margin:auto 0 0;padding-top:calc(var(--s)*12pt)}
.shared span:first-child{flex:none;font-weight:700}
.shared .blank{flex:1;height:calc(var(--s)*22pt);border-bottom:calc(var(--s)*1pt) solid var(--ink)}
.support{margin-top:calc(var(--s)*12pt);padding:calc(var(--s)*6pt) 0 calc(var(--s)*6pt) calc(var(--s)*12pt);border-left:calc(var(--s)*3pt) solid var(--gold);font-size:calc(var(--s)*9.2pt);line-height:1.36}
.insert .support{font-size:7.1pt}
.support-intro{font-weight:700;margin:0 0 calc(var(--s)*3pt)}
.support ul{margin:0 0 calc(var(--s)*4pt);padding-left:calc(var(--s)*12pt)}
.support li{margin:0 0 calc(var(--s)*1pt)}
.support .fine{color:var(--muted)}
.draft{margin-top:calc(var(--s)*8pt);color:var(--muted);font-size:calc(var(--s)*8.5pt)}
.insert .draft{font-size:6.4pt}
`;

/**
 * Prints one layout in one language to a PDF, with its form field; fails,
 * naming the copy, if anything runs off the sheet.
 */
async function build({ lang = "en", layout = "flyer", out = path.join(OUT_DIR, COPY[lang][layout].file), log = console.log } = {}) {
  const { chromium } = require("playwright");
  const sheet = SHEETS[layout];
  const name = `${lang} ${layout}`;
  const { html } = buildHtml({ qr: await makeQr([qrTarget(lang)]), lang, layout });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const htmlFile = out.replace(/\.pdf$/, ".html");
  fs.writeFileSync(htmlFile, html);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let report, widgets;
  try {
    const tab = await browser.newPage({ viewport: sheet.viewport });
    await tab.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    // Anything past a copy's own padding, which keeps it clear of what a
    // printer cannot reach and of the insert's cut line.
    report = await tab.evaluate(() => [...document.querySelectorAll(".copy")].map((copy, i) => {
      const box = copy.getBoundingClientRect(), pad = getComputedStyle(copy);
      const bottom = box.bottom - parseFloat(pad.paddingBottom) + 1, right = box.right - parseFloat(pad.paddingRight) + 1;
      const overflow = [...copy.querySelectorAll("*")].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && r.height && (r.bottom > bottom || r.right > right);
      }).map(e => (typeof e.className === "string" ? e.className : e.className.baseVal) || e.tagName).slice(0, 3);
      return { copy: i + 1, overflow, clipped: copy.scrollHeight > copy.clientHeight + 1 };
    }));
    widgets = await tab.evaluate(() => [...document.querySelectorAll("[data-field]")].map(el => {
      const r = el.getBoundingClientRect(), d = el.dataset;
      return { page: 0, name: d.field, kind: d.kind, tip: d.tip, size: Number(d.size), hit: { x: r.left, y: r.top, w: r.width, h: r.height } };
    }));
    await tab.pdf({ path: out, width: sheet.width, height: sheet.height, printBackground: true, preferCSSPageSize: false, tagged: true });
    fs.rmSync(htmlFile, { force: true });
  } finally {
    await browser.close();
  }
  fs.writeFileSync(out, await require("./workbook-form.js").addFields(fs.readFileSync(out), widgets));
  const bad = report.filter(r => r.overflow.length || r.clipped);
  for (const r of bad) log(`✗ ${name}, copy ${r.copy}, runs off the sheet: ${r.overflow.join(", ") || "clipped"}`);
  log(bad.length ? `✗ ${name}: ${bad.length} of ${report.length} copies overflow` : `✓ ${name}: ${report.length} ${report.length === 1 ? "copy" : "copies"}, nothing runs off the sheet → ${path.relative(ROOT, out)}`);
  return { ok: !bad.length, report, widgets, out };
}

if (require.main === module) {
  const i = process.argv.indexOf("--lang");
  const langs = i >= 0 ? [process.argv[i + 1]] : LANGS;
  if (!langs.every(l => COPY[l])) { console.error(`--lang must be one of ${LANGS.join(", ")}`); process.exit(2); }
  (async () => {
    let ok = true;
    for (const lang of langs) {
      for (const layout of LAYOUTS) ok = (await build({ lang, layout })).ok && ok;
    }
    process.exit(ok ? 0 : 1);
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { COPY, LAYOUTS, SHEETS, HOST, counts, qrTarget, buildHtml, build };
