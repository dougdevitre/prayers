// Tests for rosary.js: the mysteries, the days they are prayed on, and the
// order of the Rosary as steps, against the Prayer Book's own prayers.
//
//   npm run test:unit

const assert = require("assert");
const { rosary, setById, setForDate, rosarySteps, mysteryRef, daysLabel, rosaryPagePath } = require("../rosary.js");
const { prayerCorpus } = require("../prayers.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}
const LANGS = ["en", "es"];
const filled = (o, what) => LANGS.forEach(l => assert.ok(typeof o[l] === "string" && o[l].trim(), `${what} has no ${l}`));

test("four sets of five mysteries, every name and verse in both languages", () => {
  assert.deepStrictEqual(rosary.sets.map(s => s.id), ["joyful", "luminous", "sorrowful", "glorious"]);
  const ids = new Set();
  for (const set of rosary.sets) {
    filled(set.name, set.id);
    filled(set.adjective, `${set.id} adjective`);
    assert.strictEqual(set.mysteries.length, 5, set.id);
    for (const m of set.mysteries) {
      assert.ok(!ids.has(m.id), `${m.id} twice`);
      ids.add(m.id);
      filled(m.name, m.id);
      filled(m.verse, `${m.id} verse`);
      assert.match(m.ref, /^[1-3]?\s?[A-Z][a-z]+ \d+:\d+$/, `${m.id} reference`);
    }
  }
  filled(rosary.fatima.name, "the Fatima Prayer's name");
  filled(rosary.fatima.text, "the Fatima Prayer");
  filled(rosary.virtues, "the three Hail Marys' intention");
});

test("slugs are unique lower-case ASCII in each language", () => {
  for (const l of LANGS) {
    const slugs = rosary.sets.map(s => s.slug[l]);
    assert.strictEqual(new Set(slugs).size, 4, l);
    slugs.forEach(slug => assert.match(slug, /^[a-z]+$/, slug));
  }
});

test("each weekday has one set, as Rosarium Virginis Mariae §38 gives them", () => {
  // Sunday is 0: Glorious; Monday Joyful; Tuesday Sorrowful; Wednesday
  // Glorious; Thursday Luminous; Friday Sorrowful; Saturday Joyful.
  const expected = ["glorious", "joyful", "sorrowful", "glorious", "luminous", "sorrowful", "joyful"];
  expected.forEach((id, day) => {
    const owners = rosary.sets.filter(s => s.days.includes(day)).map(s => s.id);
    assert.deepStrictEqual(owners, [id], `day ${day}`);
  });
  assert.strictEqual(setForDate(new Date(2026, 8, 28)).id, "joyful", "Monday 28 September 2026");
  assert.strictEqual(setForDate(new Date(2026, 9, 1)).id, "luminous", "Thursday 1 October 2026");
});

test("the order: opening prayers, five decades, then the Hail Holy Queen", () => {
  const steps = rosarySteps("sorrowful");
  const names = steps.map(s => s.kind === "prayer" ? s.prayer + (s.count ? `×${s.count}` : "") : s.kind);
  assert.deepStrictEqual(names.slice(0, 5), ["sign-of-the-cross", "apostles-creed", "our-father", "hail-mary×3", "glory-be"]);
  for (let d = 0; d < 5; d++) {
    assert.deepStrictEqual(names.slice(5 + d * 5, 10 + d * 5), ["mystery", "our-father", "hail-mary×10", "glory-be", "fatima"], `decade ${d + 1}`);
  }
  assert.deepStrictEqual(names.slice(-2), ["hail-holy-queen", "sign-of-the-cross"]);
  assert.strictEqual(steps.length, 32);
  assert.strictEqual(steps.reduce((n, s) => n + (s.prayer === "hail-mary" ? s.count : 0), 0), 53, "fifty-three Hail Marys");
  assert.deepStrictEqual(steps.filter(s => s.kind === "mystery").map(s => s.mystery), setById("sorrowful").mysteries.map(m => m.id));
  assert.ok(steps.filter(s => s.decade).every(s => s.decade >= 1 && s.decade <= 5));
});

test("without the Fatima Prayer, only it is left out", () => {
  const with_ = rosarySteps("joyful"), without = rosarySteps("joyful", { fatima: false });
  assert.strictEqual(without.length, with_.length - 5);
  assert.deepStrictEqual(without, with_.filter(s => s.kind !== "fatima"));
});

test("every prayer a step names is one of the Prayer Book's", () => {
  const known = new Set(prayerCorpus.traditional.map(p => p.id));
  for (const set of rosary.sets) {
    for (const s of rosarySteps(set.id)) if (s.kind === "prayer") assert.ok(known.has(s.prayer), `${s.prayer} is not in prayers.js`);
  }
});

test("an unknown set gives nothing, and only the Assumption and Coronation carry a note", () => {
  assert.strictEqual(rosarySteps("nope"), null);
  assert.strictEqual(setById("nope"), null);
  const noted = rosary.sets.flatMap(s => s.mysteries).filter(m => m.note).map(m => m.id);
  assert.deepStrictEqual(noted, ["assumption", "coronation"]);
  for (const m of rosary.sets.flatMap(s => s.mysteries).filter(m => m.note)) filled(m.note, `${m.id} note`);
});

test("each set names its days, Monday first, in both languages", () => {
  assert.strictEqual(daysLabel(setById("joyful"), "en"), "Mondays and Saturdays");
  assert.strictEqual(daysLabel(setById("glorious"), "en"), "Wednesdays and Sundays");
  assert.strictEqual(daysLabel(setById("luminous"), "es"), "jueves");
  assert.strictEqual(daysLabel(setById("sorrowful"), "es"), "martes y viernes");
  for (const l of LANGS) assert.strictEqual(rosary.dayNames[l].length, 7);
});

test("Spanish references name the books as the Spanish days do", () => {
  const esBooks = require("../scripts/es-books.json");
  for (const m of rosary.sets.flatMap(s => s.mysteries)) {
    const book = m.ref.replace(/\s+\d+:.*$/, "");
    assert.strictEqual(mysteryRef(m, "es"), m.ref.replace(book, esBooks[book]), m.id);
    assert.strictEqual(mysteryRef(m, "en"), m.ref);
  }
  assert.strictEqual(mysteryRef(setById("joyful").mysteries[0], "es"), "Lucas 1:38");
});

test("the Rosary's pages sit inside the Prayer Book, one per set, at the addresses the app shares", () => {
  const { prayerBook } = require("../prayerbook.js");
  assert.strictEqual(rosaryPagePath("en"), `${prayerBook.bookPath("en")}/rosary`);
  assert.strictEqual(rosaryPagePath("es"), `${prayerBook.bookPath("es")}/rosario`);
  assert.strictEqual(rosaryPagePath("es", "joyful"), "/es/oraciones/rosario/gozosos");
  assert.strictEqual(rosaryPagePath("en", "nope"), "/prayers/rosary");
  const fs = require("fs"), path = require("path");
  for (const l of LANGS) for (const s of rosary.sets) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", `${rosaryPagePath(l, s.id)}.html`)), `${l} ${s.id}`);
  }
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll Rosary tests passed.");
