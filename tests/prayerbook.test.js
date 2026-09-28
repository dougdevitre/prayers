// Tests for prayerbook.js (how the traditional prayers are arranged and
// addressed as pages) and the Prayer Book pages built from it.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { prayerBook } = require("../prayerbook.js");
const { prayerCorpus } = require("../prayers.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}
const fileOf = rel => [path.join(ROOT, rel + ".html"), path.join(ROOT, rel, "index.html")].find(f => fs.existsSync(f));

test("every traditional prayer is in the book exactly once, shared prayers first", () => {
  const ids = prayerBook.prayers().map(p => p.id);
  assert.deepStrictEqual([...ids].sort(), prayerCorpus.traditional.map(p => p.id).sort());
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.deepStrictEqual(prayerBook.sections, ["universal", "roman-catholic"]);
  const first = prayerBook.prayers().findIndex(p => p.tradition === "roman-catholic");
  assert.ok(prayerBook.prayers().slice(first).every(p => p.tradition === "roman-catholic"));
});

test("slugs are unique, lower-case ASCII, and round-trip in both languages", () => {
  for (const lang of ["en", "es"]) {
    const slugs = prayerBook.prayers().map(p => prayerBook.prayerSlug(lang, p.id));
    assert.strictEqual(new Set(slugs).size, slugs.length, lang);
    for (const [i, slug] of slugs.entries()) {
      assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${lang} ${slug}`);
      assert.strictEqual(prayerBook.prayerForSlug(lang, slug).id, prayerBook.prayers()[i].id);
      assert.ok(!Object.values(prayerBook.sectionSlugs).some(s => s[lang] === slug), `${slug} collides with a section page`);
    }
  }
  assert.strictEqual(prayerBook.prayerSlug("en", "our-father"), "our-father");
  assert.strictEqual(prayerBook.prayerSlug("es", "our-father"), "padre-nuestro");
  assert.strictEqual(prayerBook.prayerSlug("fr", "our-father"), null);
  assert.strictEqual(prayerBook.prayerSlug("en", "nope"), null);
  assert.strictEqual(prayerBook.prayerForSlug("es", "our-father"), null);
});

test("every prayer, section and book page is built, and shows the corpus's own words", () => {
  for (const lang of ["en", "es"]) {
    for (const rel of [prayerBook.bookPath(lang), prayerBook.sectionPath(lang, "roman-catholic")]) {
      assert.ok(fileOf(rel.slice(1)), `no page for ${rel}`);
    }
    for (const p of prayerBook.prayers()) {
      const file = fileOf(prayerBook.prayerPath(lang, p.id).slice(1));
      assert.ok(file, `no page for ${p.id} in ${lang}`);
      const html = fs.readFileSync(file, "utf8");
      const escText = p.text[lang].trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      assert.ok(html.includes(`<p>${escText}</p>`), `${file} does not show the prayer's text`);
      assert.ok(html.includes(`/app?prayer=${p.id}${lang === "es" ? "&amp;lang=es" : ""}"`), `${file} does not open the prayer in the app`);
    }
  }
});

test("the Roman Catholic page lists every Roman Catholic prayer before the shared ones", () => {
  for (const lang of ["en", "es"]) {
    const html = fs.readFileSync(fileOf(prayerBook.sectionPath(lang, "roman-catholic").slice(1)), "utf8");
    const at = id => html.indexOf(`href="${prayerBook.prayerPath(lang, id)}"`);
    const catholic = prayerBook.prayers().filter(p => p.tradition === "roman-catholic");
    const shared = prayerBook.prayers().filter(p => p.tradition === "universal");
    assert.ok(catholic.every(p => at(p.id) > -1) && shared.every(p => at(p.id) > -1), lang);
    assert.ok(Math.max(...catholic.map(p => at(p.id))) < Math.min(...shared.map(p => at(p.id))), lang);
  }
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll Prayer Book tests passed.");
