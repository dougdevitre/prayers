// Tests for narration.js: the scripts a recording or the device's own voice
// reads for a day or an SOS set, and the reference expansion that keeps
// "6:10" from being read as a time of day.
//
//   npm run test:unit

const assert = require("assert");
const { NARRATION_FRAMES, numberWords, parseRef, spokenRef, spokenText, dayScript, sosScript, prayerScript, narrationItems } = require("../narration.js");
const { prayerCorpus } = require("../prayers.js");
const { tracks, sosSetsEn } = require("../content.js");
const { esTracks, esSos } = require("../content.es.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const sosEn = sosSetsEn;

test("numbers are spelled out in both languages", () => {
  assert.strictEqual(numberWords(1, "en"), "one");
  assert.strictEqual(numberWords(17, "en"), "seventeen");
  assert.strictEqual(numberWords(27, "en"), "twenty-seven");
  assert.strictEqual(numberWords(100, "en"), "one hundred");
  assert.strictEqual(numberWords(119, "en"), "one hundred nineteen");
  assert.strictEqual(numberWords(1, "es"), "uno");
  assert.strictEqual(numberWords(16, "es"), "dieciséis");
  assert.strictEqual(numberWords(21, "es"), "veintiuno");
  assert.strictEqual(numberWords(35, "es"), "treinta y cinco");
  assert.strictEqual(numberWords(100, "es"), "cien");
  assert.strictEqual(numberWords(105, "es"), "ciento cinco");
  assert.strictEqual(numberWords(139, "es"), "ciento treinta y nueve");
  assert.strictEqual(numberWords(1000, "en"), "1000", "out of range falls back to digits");
});

test("references parse into book, chapter and verses", () => {
  assert.deepStrictEqual(parseRef("Ephesians 6:10–13"), { ordinal: 0, book: "Ephesians", chapter: 6, verse: 10, end: 13 });
  assert.deepStrictEqual(parseRef("1 Samuel 17:16"), { ordinal: 1, book: "Samuel", chapter: 17, verse: 16, end: null });
  assert.deepStrictEqual(parseRef("Psalm 4:8"), { ordinal: 0, book: "Psalm", chapter: 4, verse: 8, end: null });
  assert.strictEqual(parseRef("Ephesians 6"), null);
  assert.strictEqual(parseRef("nonsense"), null);
});

test("a reference is spoken as chapter and verse, never as a time", () => {
  assert.strictEqual(spokenRef("Ephesians 6:10–13", "en"), "Ephesians, chapter six, verses ten through thirteen");
  assert.strictEqual(spokenRef("Ephesians 6:14", "en"), "Ephesians, chapter six, verse fourteen");
  assert.strictEqual(spokenRef("Psalm 4:8", "en"), "Psalm four, verse eight");
  assert.strictEqual(spokenRef("Psalm 119:105", "en"), "Psalm one hundred nineteen, verse one hundred five");
  assert.strictEqual(spokenRef("1 Samuel 17:16", "en"), "First Samuel, chapter seventeen, verse sixteen");
  assert.strictEqual(spokenRef("2 Kings 6:15", "en"), "Second Kings, chapter six, verse fifteen");
  assert.strictEqual(spokenRef("Efesios 6:10–13", "es"), "Efesios, capítulo seis, versículos diez al trece");
  assert.strictEqual(spokenRef("Salmo 27:1", "es"), "Salmo veintisiete, versículo uno");
  assert.strictEqual(spokenRef("1 Reyes 17:12", "es"), "Primera de Reyes, capítulo diecisiete, versículo doce");
  assert.strictEqual(spokenRef("Éxodo 2:2", "es"), "Éxodo, capítulo dos, versículo dos");
  assert.strictEqual(spokenRef("Ephesians 6", "en"), "Ephesians 6", "an unrecognised form is left alone");
});

test("every reference in the content is recognised", () => {
  const refs = [];
  for (const t of Object.values(tracks)) for (const d of t.days) refs.push(["en", d[1]]);
  for (const t of Object.values(esTracks)) for (const d of t.days) refs.push(["es", d[1]]);
  for (const s of esSos) refs.push(["es", s.ref]);
  const unspoken = refs.filter(([lang, ref]) => /\d/.test(spokenRef(ref, lang)));
  assert.deepStrictEqual(unspoken, [], "references still carrying digits");
});

test("LORD is spoken as Lord and the content is untouched", () => {
  const verse = "In peace I will both lay myself down and sleep, for you, the LORD alone, make me live in safety.";
  assert.strictEqual(spokenText(verse), verse.replace("LORD", "Lord"));
  assert.strictEqual(spokenText("Lordship"), "Lordship");
  assert.ok(tracks.night.days[0][2].includes("LORD"), "content keeps the WEB's small caps");
});

test("a day script has every section, in order, with breaths as ellipses", () => {
  const s = dayScript(tracks.core.days[0], 0, "en");
  const order = ["Day one. Stand.", "Scripture... Ephesians, chapter six, verses ten through thirteen.", "\"Be strong in the Lord",
    "... Pause, and breathe in slowly... Breathe out... Let your shoulders soften.", "Reflection.\n\n", "Prayer.\n\n",
    "Help me stand... Amen.", "Declaration.\n\n", "Today's practice.\n\n", "Closing blessing.\n\n", "... Go in peace."];
  let at = -1;
  for (const piece of order) {
    const next = s.indexOf(piece, at + 1);
    assert.ok(next > at, `missing or out of order: ${piece}`);
    at = next;
  }
  assert.ok(!/\d/.test(s), "no digits are left for the reader to guess at");
  assert.ok(!s.includes("Amen. Amen"), "amen is said once");
});

test("a Spanish day is framed in Spanish", () => {
  const s = dayScript(esTracks.core.days[0], 0, "es");
  assert.ok(s.startsWith("Día uno. Firmeza."));
  for (const frame of ["Escritura... Efesios, capítulo seis, versículos diez al trece.", "Reflexión.", "Oración.", "Amén.", "Declaración.", "Práctica de hoy.", "Bendición final.", "Ve en paz."]) {
    assert.ok(s.includes(frame), `missing ${frame}`);
  }
  assert.ok(!/\b(Day|Scripture|Reflection|Prayer|Amen\.)\b/.test(s), "no English frames");
});

test("the day number and title follow the index", () => {
  assert.ok(dayScript(tracks.core.days[29], 29, "en").startsWith("Day thirty. "));
  assert.ok(dayScript(esTracks.core.days[29], 29, "es").startsWith("Día treinta. "));
});

test("an SOS script is verse, reference, prayer with amen, declaration", () => {
  const s = sosScript(sosEn[0], "en");
  assert.strictEqual(s, "\"The Lord is my light and my salvation. Whom shall I fear?\"\n... Psalm twenty-seven, verse one.\n\n"
    + "Lord, bring me back to this moment. Slow my heart, steady my breath, and stand with me here. I hand You what I cannot control... Amen.\n\n"
    + "Fear may speak, but it does not get the final word.");
  assert.ok(sosScript(esSos[0], "es").endsWith("... Amén.\n\nEl miedo puede hablar, pero no tiene la última palabra."));
});

test("a prayer script is its name, then the text with its pacing as break tags", () => {
  const ourFather = prayerCorpus.traditional.find(t => t.id === "our-father");
  const s = prayerScript(ourFather, "en");
  assert.ok(s.startsWith("Our Father.\n\nOur Father, who art in heaven"));
  assert.ok(s.includes('as it is in heaven. <break time="1s" /> Give us'), "the first anchor gets its pause");
  assert.ok(s.includes('trespass against us; <break time="0.8s" /> and lead'), "the second anchor gets its pause");
  assert.ok(s.endsWith("Amen."), "the prayer's own Amen closes it; none is added");
  assert.strictEqual((s.match(/<break/g) || []).length, ourFather.audio.breaks.en.length);
  const es = prayerScript(ourFather, "es");
  assert.ok(es.startsWith("Padre Nuestro.\n\n"));
  assert.strictEqual((es.match(/<break/g) || []).length, ourFather.audio.breaks.es.length);
  const plain = prayerCorpus.traditional.find(t => t.id === "sign-of-the-cross");
  assert.ok(!prayerScript(plain, "en").includes("<break"), "no breaks, no tags");
  const capped = prayerScript({ name: { en: "X" }, text: { en: "One. Two." }, audio: { breaks: { en: [{ after: "One.", seconds: 9 }] } } }, "en");
  assert.ok(capped.includes('<break time="3s" />'), "pauses are capped at the three seconds ElevenLabs honours");
  const missing = prayerScript({ name: { en: "X" }, text: { en: "One. Two." }, audio: { breaks: { en: [{ after: "Three.", seconds: 1 }] } } }, "en");
  assert.strictEqual(missing, "X.\n\nOne. Two.", "an anchor that is not in the text is skipped");
});

test("the frames carry the same keys in both languages", () => {
  assert.deepStrictEqual(Object.keys(NARRATION_FRAMES.es).sort(), Object.keys(NARRATION_FRAMES.en).sort());
  for (const [k, v] of Object.entries(NARRATION_FRAMES.es)) assert.ok(v && v.length, `es ${k} is empty`);
});

test("narrationItems lists every day, SOS set and traditional prayer in both languages, once", () => {
  const items = narrationItems({ tracks, esTracks, sosSets: sosEn, esSos, prayers: prayerCorpus.traditional });
  const dayCount = Object.values(tracks).reduce((n, t) => n + t.days.length, 0);
  assert.strictEqual(items.filter(i => i.kind === "prayer").length, prayerCorpus.traditional.length * 2);
  const prayer = items.find(i => i.id === "es/prayer/our-father");
  assert.strictEqual(prayer.title, "Padre Nuestro");
  assert.strictEqual(prayer.slug, "our-father");
  assert.strictEqual(prayer.audio.speed, prayerCorpus.traditional.find(t => t.id === "our-father").audio.speed);
  assert.strictEqual(items.filter(i => i.kind === "day" && i.lang === "en").length, dayCount);
  assert.strictEqual(items.filter(i => i.kind === "day" && i.lang === "es").length, dayCount);
  assert.strictEqual(items.filter(i => i.kind === "sos").length, sosEn.length + esSos.length);
  assert.strictEqual(new Set(items.map(i => i.id)).size, items.length, "ids are unique");
  const first = items.find(i => i.id === "en/day/core/0");
  assert.strictEqual(first.text, dayScript(tracks.core.days[0], 0, "en"));
  assert.strictEqual(first.title, "Stand");
  const sos = items.find(i => i.id === "es/sos/0");
  assert.strictEqual(sos.text, sosScript(esSos[0], "es"));
  const longest = Math.max(...items.map(i => i.text.length));
  assert.ok(longest < 5000, `longest script is ${longest} characters, within one request`);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll narration tests passed.");
