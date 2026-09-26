// Tests for the pastoral review workbook (scripts/build-review-workbook.js):
// it covers everything a reader hears or reads, ids and hashes stay put while
// the text does, and the page it builds carries the data intact.
//
//   npm run test:unit

const assert = require("assert");
const { collect, render, flagsFor, attachSuggestions } = require("../scripts/build-review-workbook.js");
const c = require("../content.js");
const e = require("../content.es.js");
const { prayerCorpus: p } = require("../prayers.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (err) { failures++; console.log("FAIL " + name); console.log("     " + (err && err.message ? err.message.split("\n")[0] : err)); }
}

const wb = collect();
const byId = new Map(wb.items.map(i => [i.id, i]));

test("every day of every track, every SOS set and every traditional prayer is an item", () => {
  for (const [tid, t] of Object.entries(c.tracks)) {
    t.days.forEach((_, i) => assert.ok(byId.has(`day.${tid}.${String(i + 1).padStart(2, "0")}`), `${tid} day ${i + 1}`));
  }
  c.sosSetsEn.forEach((_, i) => assert.ok(byId.has(`sos.${i + 1}`), `SOS set ${i + 1}`));
  for (const t of p.traditional) assert.ok(byId.has(`trad.${t.id}`), t.id);
  assert.ok(byId.has("finder.phrases"));
});

test("every composer block is an item, word for word in both languages", () => {
  const texts = new Set(wb.items.filter(i => i.section === "composer").map(i => i.fields[0].en + "\u0000" + i.fields[0].es));
  let n = 0;
  for (const m of Object.values(p.modes)) {
    for (const slot of Object.values(m.slots)) {
      for (const blocks of Array.isArray(slot) ? [slot] : Object.values(slot)) {
        for (const b of blocks) { n++; assert.ok(texts.has(b.en + "\u0000" + b.es), `missing block: ${b.en.slice(0, 40)}`); }
      }
    }
  }
  assert.ok(n > 50, `only ${n} blocks`);
});

test("ids are unique and every item has text in both languages", () => {
  assert.strictEqual(byId.size, wb.items.length, "duplicate ids");
  for (const i of wb.items) {
    for (const f of i.fields) {
      assert.ok(f.en && f.es, `${i.id}: ${f.label} is missing ${f.en ? "Spanish" : "English"}`);
    }
  }
  assert.strictEqual(wb.items.filter(i => i.section === "finder")[0].fields.length, e.esFearIndex.length);
});

test("a hash moves with the text and only with the text", () => {
  const again = collect();
  assert.deepStrictEqual(again.items.map(i => i.hash), wb.items.map(i => i.hash), "hashes differ between runs");
  assert.strictEqual(new Set(wb.items.map(i => i.hash)).size, wb.items.length, "two items share a hash");
  const day = c.tracks.core.days[0];
  const saved = day[4];
  day[4] = saved + " Amen.";
  try {
    const edited = collect();
    const changed = edited.items.filter((it, k) => it.hash !== wb.items[k].hash).map(it => it.id);
    assert.deepStrictEqual(changed, ["day.core.01"]);
  } finally { day[4] = saved; }
});

test("masculine reader-voice forms become questions, neutral ones do not", () => {
  const f = s => flagsFor([{ label: "Prayer", en: "", es: s }]).length;
  assert.strictEqual(f("Donde estoy confundido, dame claridad."), 1);
  assert.strictEqual(f("Me siento tan cansado y estoy asustado."), 2);
  assert.strictEqual(f("Donde tengo miedo, dame valor."), 0);
  assert.strictEqual(f("Estoy aquí, Señor."), 0);
});

test("every flagged item offers neutral wording, and every suggestion is found in its item", () => {
  for (const i of wb.items.filter(x => x.flags.length)) assert.ok(i.suggestions && i.suggestions.length, `${i.id} is flagged but offers no wording`);
  for (const i of wb.items.filter(x => x.suggestions)) {
    for (const s of i.suggestions) {
      assert.ok(i.fields.some(f => f[s.lang].includes(s.from)), `${i.id}: "${s.from}"`);
      for (const o of s.options) assert.strictEqual(flagsFor([{ label: "x", en: "", es: o }]).length, 0, `${i.id}: "${o}" is still masculine`);
    }
  }
});

test("a suggestion for text that has changed fails the build", () => {
  const items = [{ id: "a", fields: [{ label: "Prayer", en: "e", es: "Estoy aquí." }] }];
  assert.throws(() => attachSuggestions(items, { a: [{ from: "Estoy cansado.", options: ["Me cansa."] }] }), /no longer says/);
  assert.throws(() => attachSuggestions(items, { b: [] }), /no item b/);
  attachSuggestions(items, { a: [{ from: "Estoy aquí.", options: ["Aquí estoy."] }] });
  assert.strictEqual(items[0].suggestions[0].options[0], "Aquí estoy.");
  // A reason makes the item a question for the reviewer; an English fix is checked against the English.
  const withWhy = [{ id: "b", flags: [], fields: [{ label: "Prayer", en: "Let You go.", es: "Ve." }] }];
  assert.throws(() => attachSuggestions(withWhy, { b: [{ from: "Let You go.", options: ["Go."] }] }), /no longer says/);
  attachSuggestions(withWhy, { b: [{ from: "Let You go.", options: ["Go."], lang: "en", why: "Ungrammatical." }] });
  assert.deepStrictEqual([withWhy[0].suggestions[0].lang, withWhy[0].flags[0].text], ["en", "Ungrammatical."]);
});

test("the page carries every item, and text cannot close its script tag", () => {
  const html = render({ items: [{ id: "x", fields: [{ label: "Prayer", en: "a </script> b $& $' c", es: "d" }], flags: [], hash: "h" }], meta: {} }, "2026-01-01");
  assert.ok(!html.includes("</script> b"), "</script> in the data was not escaped");
  const m = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/);
  assert.ok(m, "no data block in the page");
  const data = JSON.parse(m[1]);
  assert.strictEqual(data.items[0].fields[0].en, "a </script> b $& $' c");
  assert.strictEqual(data.meta.built, "2026-01-01");
  assert.ok(/<title>[^<]+<\/title>/.test(html.slice(0, 8192)), "no title in the first 8 KB");
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll review workbook tests passed.");
