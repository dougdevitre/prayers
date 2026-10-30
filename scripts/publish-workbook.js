#!/usr/bin/env node
// Publishes the workbook kit to the site: the four workbooks
// (scripts/build-print-workbook.js) and the four flyers
// (scripts/build-flyer.js), built into workbook/, which the site serves at
// /workbook/<file>. workbook/files.json records each file's pages, its size
// and a fingerprint of what it was built from, so the unit tests can tell
// when the content has moved on without it.
//
//   npm run publish:workbook                 → the files whose sources changed
//   npm run publish:workbook -- --force      → every file
//   CHROMIUM_PATH=/path/to/chrome npm run publish:workbook
//
// The download pages, /workbook and /es/cuaderno (scripts/build-day-pages.js),
// list what files.json lists. Until the pastoral review is done, that is,
// while prayers.js labels the devotional text a draft (meta.reviewNote), the
// kit is a preview: the pages ask search engines not to index them and stay
// out of the menus and the sitemap, so they reach only the people given the
// link, and every file carries the draft note. Removing the draft label
// publishes them; the README's "Review day" lists the steps.
//
// The fingerprint is the HTML a file is printed from, with the form layer's
// source for the files that have a form: every word, the layout and the
// codes. A file whose fingerprint has not changed is not rebuilt, so
// publishing again is a no-op in git. A new Chromium or a new font can change
// the PDFs without changing it; publish with --force after either.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { prayerCorpus } = require("../prayers.js");
const workbook = require("./build-print-workbook.js");
const flyer = require("./build-flyer.js");

const KIT_DIR = path.join(ROOT, "workbook");
const FILES_JSON = path.join(KIT_DIR, "files.json");
// A fixed font address, so a fingerprint does not depend on the checkout's path.
const FONT_BASE = "/fonts/";
const KINDS = ["print", "fillable", "flyer", "insert"];

/** True once the pastoral review is done: the app no longer labels its devotional text a draft. */
const isPublic = () => !(prayerCorpus.meta && prayerCorpus.meta.reviewNote);

const isWorkbook = kind => kind === "print" || kind === "fillable";

/** Every file in the kit, in the order the pages list them: { file, lang, kind }
 *  and, for a workbook, its journey. Per language: each journey's two
 *  workbooks (Stand first), then the flyer and the insert. */
function publications() {
  return workbook.LANGS.flatMap(lang => [
    ...workbook.WORKBOOK_JOURNEYS.flatMap(journey => KINDS.filter(isWorkbook).map(kind =>
      ({ lang, kind, journey, file: workbook.copyFor(lang, kind === "fillable", journey).file }))),
    ...KINDS.filter(kind => !isWorkbook(kind)).map(kind => ({ lang, kind, file: flyer.COPY[lang][kind].file }))
  ]);
}

/** What a file is built from, hashed: its HTML, and the form layer when it has a form. */
async function fingerprint({ lang, kind, journey = "core" }) {
  let html;
  if (isWorkbook(kind)) {
    html = workbook.buildHtml({ qr: await workbook.makeQr(workbook.qrTargets(lang, journey)), lang, journey, fillable: kind === "fillable", fontBase: FONT_BASE }).html;
  } else {
    html = flyer.buildHtml({ qr: await workbook.makeQr([flyer.qrTarget(lang)]), lang, layout: kind, fontBase: FONT_BASE }).html;
  }
  const hash = crypto.createHash("sha256").update(html);
  if (kind !== "print") hash.update(fs.readFileSync(path.join(__dirname, "workbook-form.js")));
  return hash.digest("hex");
}

/** files.json's list ([] before the first publish). */
function readFiles(file = FILES_JSON) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).files : [];
}

/**
 * Builds into workbook/ every file whose sources have changed since files.json
 * recorded them (every file, with `force`), and writes files.json; files.json
 * is left alone if any build fails. A file that is already current is kept as
 * it is, so publishing again changes nothing in git.
 */
async function publish({ dir = KIT_DIR, force = false, log = console.log } = {}) {
  const { PDFDocument } = require("pdf-lib");
  const before = readFiles(path.join(dir, "files.json"));
  const files = [];
  let ok = true;
  for (const pub of publications()) {
    const out = path.join(dir, pub.file);
    const source = await fingerprint(pub);
    const was = before.find(f => f.file === pub.file);
    if (!force && was && was.source === source && fs.existsSync(out) && fs.statSync(out).size === was.bytes) {
      log(`· ${pub.journey && pub.journey !== "core" ? `${pub.journey} ` : ""}${pub.lang} ${pub.kind}: unchanged → ${path.relative(ROOT, out)}`);
      files.push({ ...pub, pages: was.pages, bytes: was.bytes, source });
      continue;
    }
    const built = isWorkbook(pub.kind)
      ? await workbook.build({ lang: pub.lang, fillable: pub.kind === "fillable", journey: pub.journey, out, log })
      : await flyer.build({ lang: pub.lang, layout: pub.kind, out, log });
    ok = built.ok && ok;
    const bytes = fs.readFileSync(out);
    const pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
    files.push({ ...pub, pages, bytes: bytes.length, source });
  }
  if (!ok) {
    log("✗ Not published: fix the pages that run off, then publish again. files.json is unchanged.");
    return { ok, files };
  }
  fs.writeFileSync(path.join(dir, "files.json"), JSON.stringify({ files }, null, 2) + "\n");
  log(`✓ Published ${files.length} files to ${path.relative(ROOT, dir)}/ (${isPublic() ? "public" : "preview, until the pastoral review is done"}). Now run npm run build:seo.`);
  return { ok, files };
}

if (require.main === module) {
  publish({ force: process.argv.includes("--force") }).then(r => process.exit(r.ok ? 0 : 1)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { KIT_DIR, FILES_JSON, KINDS, isPublic, publications, fingerprint, readFiles, publish };
