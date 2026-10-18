// Tests for the workbook kit: the eight files scripts/publish-workbook.js
// publishes to workbook/ (the four workbooks and the four flyers), the flyers'
// own pages, and the download pages that list them. The files are checked as
// published, so a change to the content that leaves them behind fails here,
// with the command that brings them up to date; and the download pages stay a
// preview, linked from nowhere, until the pastoral review is done.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRef } = require("pdf-lib");
const { tracks } = require("../content.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const kit = require("../scripts/publish-workbook.js");
const workbook = require("../scripts/build-print-workbook.js");
const flyer = require("../scripts/build-flyer.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = s => s.replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const files = kit.readFiles();
const PAGES = { en: "workbook/index.html", es: "es/cuaderno/index.html" };
const PAGE_PATHS = { en: "/workbook", es: "/es/cuaderno" };
const SITE = workbook.SITE;
// A stand-in code, so the tests can see which address each flyer's code opens.
const fakeQr = lang => ({ [flyer.qrTarget(lang)]: `<svg data-for="${flyer.qrTarget(lang)}"></svg>` });
const flyers = {};
for (const lang of workbook.LANGS) {
  for (const layout of flyer.LAYOUTS) flyers[`${lang} ${layout}`] = { lang, layout, html: flyer.buildHtml({ qr: fakeQr(lang), lang, layout, fontBase: "fonts/" }).html };
}

/** Everything in a PDF that could run, open, submit, import or launch, and every link it holds. */
function actionsIn(pdf) {
  const found = [], uris = [];
  const seen = new Set();
  const ACTIONS = ["JavaScript", "Launch", "SubmitForm", "ImportData", "ResetForm", "GoToR", "GoToE", "Rendition", "Movie", "Sound", "Hide"];
  const walk = obj => {
    if (obj instanceof PDFRef) { if (!seen.has(obj.tag)) { seen.add(obj.tag); walk(pdf.context.lookup(obj)); } return; }
    if (obj instanceof PDFStream) return walk(obj.dict);
    if (obj instanceof PDFArray) return obj.asArray().forEach(walk);
    if (!(obj instanceof PDFDict)) return;
    const type = obj.get(PDFName.of("S"));
    if (type instanceof PDFName && ACTIONS.includes(type.decodeText())) found.push(type.decodeText());
    if (type instanceof PDFName && type.decodeText() === "URI") uris.push(obj.lookup(PDFName.of("URI")).decodeText());
    for (const [key, value] of obj.entries()) {
      if (["JS", "AA", "OpenAction", "XFA", "EmbeddedFiles"].includes(key.decodeText())) found.push(key.decodeText());
      walk(value);
    }
  };
  walk(pdf.context.trailerInfo.Root);
  return { found, uris };
}

(async () => {
  await test("files.json lists the eight files, each language's workbooks and flyers, in order", () => {
    assert.deepStrictEqual(files.map(f => [f.lang, f.kind, f.file]), kit.publications().map(p => [p.lang, p.kind, p.file]));
    assert.deepStrictEqual(files.map(f => f.file), [
      "Stand-30-Day-Workbook.pdf", "Stand-30-Day-Workbook-Fillable.pdf", "Stand-Flyer.pdf", "Stand-Bulletin-Insert.pdf",
      "Stand-Cuaderno-30-Dias.pdf", "Stand-Cuaderno-30-Dias-Rellenable.pdf", "Stand-Volante.pdf", "Stand-Media-Hoja-Boletin.pdf"
    ]);
    // Nothing in workbook/ that the kit does not list (but the page and files.json).
    const extra = fs.readdirSync(kit.KIT_DIR).filter(f => !["index.html", "files.json"].includes(f) && !files.some(x => x.file === f));
    assert.deepStrictEqual(extra, []);
  });

  // The PDFs, as published, with what files.json says about each.
  const pdfs = {};
  for (const f of files) {
    const bytes = fs.readFileSync(path.join(kit.KIT_DIR, f.file));
    pdfs[f.file] = { bytes, pdf: await PDFDocument.load(bytes, { updateMetadata: false }) };
  }

  await test("each published file is a PDF of the size and the page count files.json records", () => {
    for (const f of files) {
      const { bytes, pdf } = pdfs[f.file];
      assert.strictEqual(bytes.subarray(0, 5).toString(), "%PDF-", f.file);
      assert.strictEqual(bytes.length, f.bytes, `${f.file}: ${bytes.length} bytes, files.json says ${f.bytes}`);
      assert.strictEqual(pdf.getPageCount(), f.pages, f.file);
      assert.strictEqual(f.pages, f.kind === "print" || f.kind === "fillable" ? 43 : 1, f.file);
    }
  });

  await test("each published file is current with the content, the layout and the form layer", async () => {
    const stale = [];
    for (const f of files) if (await kit.fingerprint(f) !== f.source) stale.push(f.file);
    assert.deepStrictEqual(stale, [], "out of date with what they are built from: run npm run publish:workbook, then npm run build:seo");
  });

  await test("each file is titled as its edition, and nothing in any of them runs, submits or launches", () => {
    for (const f of files) {
      const { pdf } = pdfs[f.file];
      const title = f.kind === "print" || f.kind === "fillable" ? workbook.copyFor(f.lang, f.kind === "fillable").docTitle : flyer.COPY[f.lang][f.kind].docTitle;
      assert.strictEqual(pdf.getTitle(), title, f.file);
      const { found, uris } = actionsIn(pdf);
      assert.deepStrictEqual(found, [], `${f.file}: no script and no action`);
      // The fillable workbook's codes are also links, to the app's own days; nothing else links anywhere.
      const allowed = f.kind === "fillable" ? workbook.qrTargets(f.lang) : [];
      assert.deepStrictEqual(uris.filter(u => !allowed.includes(u)), [], `${f.file}: links only to the app`);
      if (f.kind === "fillable") assert.strictEqual(new Set(uris).size, allowed.length, `${f.file}: every code is a link`);
    }
  });

  await test("the flyers are tagged for screen readers, in their language, on US Letter", () => {
    for (const f of files.filter(x => x.kind === "flyer" || x.kind === "insert")) {
      const { pdf } = pdfs[f.file];
      assert.ok(pdf.catalog.has(PDFName.of("StructTreeRoot")), `${f.file}: tagged`);
      assert.strictEqual(pdf.catalog.lookup(PDFName.of("Lang")).decodeText(), f.lang, f.file);
      const { width, height } = pdf.getPage(0).getSize();
      assert.deepStrictEqual([Math.round(width), Math.round(height)], f.kind === "flyer" ? [612, 792] : [792, 612], f.file);
    }
  });

  await test("each flyer has one field for the church's name, typed once even where it prints twice", () => {
    for (const f of files.filter(x => x.kind === "flyer" || x.kind === "insert")) {
      const form = pdfs[f.file].pdf.getForm();
      const fields = form.getFields();
      assert.deepStrictEqual(fields.map(x => [x.getName(), x.constructor.name]), [["shared-by", "PDFTextField"]], f.file);
      const widgets = fields[0].acroField.getWidgets();
      assert.strictEqual(widgets.length, f.kind === "insert" ? 2 : 1, f.file);
      for (const w of widgets) {
        assert.strictEqual(w.dict.lookup(PDFName.of("TU")).decodeText(), flyer.COPY[f.lang].shared, `${f.file}: its tooltip`);
        assert.ok(w.getFlags() & 4, `${f.file}: the name prints`);
      }
      const acroForm = pdfs[f.file].pdf.catalog.lookup(PDFName.of("AcroForm"));
      assert.ok(!acroForm.has(PDFName.of("NeedAppearances")), `${f.file}: the file's own looks`);
    }
  });

  await test("each flyer's code opens the app in its language, with no other parameter, and nothing else is linked", () => {
    for (const [name, { lang, html }] of Object.entries(flyers)) {
      const codes = [...html.matchAll(/data-for="([^"]*)"/g)].map(m => unesc(m[1]));
      assert.ok(codes.length >= 1 && codes.every(u => u === `${SITE}/app${lang === "es" ? "?lang=es" : ""}`), `${name}: ${codes}`);
      assert.ok(!/href="/.test(html) && !/src="https?:/.test(html) && !/url\(["']?https?:/.test(html), `${name}: nothing from the network`);
    }
  });

  await test("the insert is two copies of the flyer's words on one sheet; the flyer is one", () => {
    for (const lang of workbook.LANGS) {
      const one = flyers[`${lang} flyer`].html, two = flyers[`${lang} insert`].html;
      assert.strictEqual(one.split('<div class="copy">').length - 1, 1, lang);
      assert.strictEqual(two.split('<div class="copy">').length - 1, 2, lang);
      assert.strictEqual(two.split('data-field="shared-by"').length - 1, 2, lang);
      // The same words; only the size the church's name is typed at differs.
      const copy = html => html.slice(html.indexOf('<div class="copy">'), html.indexOf("</main>")).replace(/ data-size="[\d.]+"/g, "");
      assert.strictEqual(copy(one), copy(two).slice(0, copy(one).length), `${lang}: the insert's copy is the flyer's`);
    }
  });

  await test("the help lines on every flyer are the app's own, with every route", () => {
    for (const [name, { lang, html }] of Object.entries(flyers)) {
      assert.ok(html.includes(workbook.supportHtml(lang)), name);
      for (const n of ["988", "741741", "1-800-799-7233", "1-800-422-4453", "911", "findahelpline.com"]) assert.ok(html.includes(n), `${name}: ${n}`);
      assert.ok(html.includes(`<b>${lang === "es" ? "HOLA" : "HOME"}</b>`), `${name}: the text keyword`);
      assert.ok(html.includes(esc(appUi[lang]["sos.disclaimer"])), `${name}: what Stand is not`);
    }
  });

  await test("the flyers' counts come from the content and account for every journey", () => {
    const n = flyer.counts("en");
    assert.strictEqual(n.journeys, Object.keys(tracks).length);
    assert.ok(n.fear > 0 && n.stories > 0);
    assert.strictEqual(n.journeys, 1 + n.fear + n.stories, "a journey in a group the flyer does not mention");
    assert.ok(flyers["en flyer"].html.includes(`${n.journeys} guided journeys.`) && flyers["en flyer"].html.includes(`${n.stories} four-day courage stories`));
    assert.ok(flyers["es flyer"].html.includes(`${n.journeys} caminos guiados.`) && flyers["es flyer"].html.includes(`${n.stories} historias de valor de cuatro días`));
    assert.ok(flyers["en flyer"].html.includes(`<b>${esc(appUi.en["sos.button"])}.</b>`) && flyers["es flyer"].html.includes(`<b>${esc(appUi.es["sos.button"])}.</b>`));
  });

  await test("each flyer names its language's download page, which exists", () => {
    for (const [name, { lang, html }] of Object.entries(flyers)) {
      assert.ok(html.includes(`${flyer.HOST}${PAGE_PATHS[lang]}`), name);
      assert.ok(fs.existsSync(path.join(ROOT, PAGES[lang])), `${PAGES[lang]} is missing`);
    }
  });

  await test("the flyers' draft note follows the app's draft label, and the kit goes public when it goes", () => {
    const note = prayerCorpus.meta.reviewNote;
    for (const [name, { lang, html }] of Object.entries(flyers)) assert.strictEqual(html.includes(esc(workbook.COPY[lang].draft)), Boolean(note), name);
    assert.strictEqual(kit.isPublic(), !note);
    if (!note) return;
    delete prayerCorpus.meta.reviewNote;
    try {
      for (const [name, { lang, layout }] of Object.entries(flyers)) {
        const after = flyer.buildHtml({ qr: fakeQr(lang), lang, layout, fontBase: "fonts/" }).html;
        assert.ok(!after.includes(esc(workbook.COPY[lang].draft)), `${name}: the note should go when the label does`);
      }
      assert.ok(kit.isPublic(), "the kit goes public when the label goes");
    } finally { prayerCorpus.meta.reviewNote = note; }
    assert.ok(!kit.isPublic());
  });

  // The download pages.
  const pages = Object.fromEntries(workbook.LANGS.map(lang => [lang, read(PAGES[lang])]));
  const downloads = html => [...html.matchAll(/<a\b[^>]*\bhref="\/workbook\/([^"]+)"[^>]*>/g)].map(m => ({ file: m[1], tag: m[0] }));

  await test("each download page offers its language's workbooks and both languages' flyers, every file a download", () => {
    for (const lang of workbook.LANGS) {
      const links = downloads(pages[lang]);
      const want = files.filter(f => f.lang === lang || f.kind === "flyer" || f.kind === "insert").map(f => f.file);
      assert.deepStrictEqual(links.map(l => l.file).sort(), want.sort(), lang);
      for (const l of links) assert.ok(/\sdownload[\s>]/.test(l.tag), `${lang}: ${l.file} is a download`);
    }
    // Between them, the two pages offer every file.
    assert.deepStrictEqual([...new Set(workbook.LANGS.flatMap(lang => downloads(pages[lang]).map(l => l.file)))].sort(), files.map(f => f.file).sort());
  });

  await test("each download page states each file's pages and size, as published", () => {
    const size = (lang, bytes) => {
      const s = bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}\u00a0KB` : `${(bytes / 1024 / 1024).toFixed(1)}\u00a0MB`;
      return lang === "es" ? s.replace(".", ",") : s;
    };
    for (const lang of workbook.LANGS) {
      for (const f of files.filter(x => x.lang === lang || x.kind === "flyer" || x.kind === "insert")) {
        assert.ok(pages[lang].includes(size(lang, f.bytes)), `${lang}: ${f.file} at ${size(lang, f.bytes)}`);
      }
      assert.ok(pages[lang].includes(lang === "es" ? "PDF · 43 páginas" : "PDF · 43 pages"), lang);
      assert.ok(pages[lang].includes(esc(workbook.copyFor(lang).edition)) && pages[lang].includes(esc(workbook.copyFor(lang, true).edition)), `${lang}: the editions`);
    }
  });

  await test("the download pages would pass the sitemap's checks: title, description, canonical, alternates both ways", () => {
    for (const lang of workbook.LANGS) {
      const html = pages[lang];
      const other = lang === "en" ? "es" : "en";
      const title = unesc(html.match(/<title>([^<]*)<\/title>/)[1]);
      const description = unesc(html.match(/<meta name="description" content="([^"]*)"/)[1]);
      assert.ok(title.length >= 15 && title.length <= 65, `${lang}: title is ${title.length} characters`);
      assert.ok(description.length >= 70 && description.length <= 160, `${lang}: description is ${description.length} characters`);
      assert.ok(html.includes(`<html lang="${lang}"`), lang);
      assert.ok(html.includes(`<link rel="canonical" href="${SITE}${PAGE_PATHS[lang]}" />`), lang);
      assert.ok(html.includes(`<link rel="alternate" hreflang="${other}" href="${SITE}${PAGE_PATHS[other]}" />`), lang);
      assert.ok(html.includes(`href="${PAGE_PATHS[other]}" hreflang="${other}"`), `${lang}: links to the other language's page`);
    }
  });

  await test("until the pastoral review is done, the download pages are a preview, linked from nowhere", () => {
    const sitemap = read("sitemap.xml");
    if (kit.isPublic()) {
      for (const lang of workbook.LANGS) {
        assert.ok(!pages[lang].includes('name="robots"'), `${lang}: the review is done, so the page should be indexed: npm run build:seo`);
        assert.ok(sitemap.includes(`<loc>${SITE}${PAGE_PATHS[lang]}</loc>`), `${lang}: not in the sitemap: npm run build:seo`);
      }
      for (const [file, lang] of [["index.html", "en"], ["es/index.html", "es"]]) {
        assert.ok(read(file).includes(`href="${PAGE_PATHS[lang]}"`), `the review is done: link the workbook from ${file}'s menu and footer`);
      }
      return;
    }
    for (const lang of workbook.LANGS) {
      assert.ok(pages[lang].includes('<meta name="robots" content="noindex" />'), `${lang}: asks not to be indexed`);
      assert.ok(pages[lang].includes(esc(workbook.COPY[lang].draft)), `${lang}: says why`);
      assert.ok(!sitemap.includes(`${SITE}${PAGE_PATHS[lang]}<`), `${lang}: in the sitemap`);
    }
    // No other page links to either one: every generated and hand-written page.
    const html = require("child_process").execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.html"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(f => f && !Object.values(PAGES).includes(f) && !f.startsWith(".review/"));
    assert.ok(html.length > 250, `only ${html.length} pages`);
    const linking = html.filter(f => /href="(\/workbook|\/es\/cuaderno)["/?#]/.test(read(f)));
    assert.deepStrictEqual(linking, [], "a page links to the preview");
  });

  await test("the service worker leaves the kit's files to the network", () => {
    assert.ok(read("sw.js").includes('if (url.pathname.startsWith("/workbook/")) return;'));
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll workbook kit tests passed.");
})();
