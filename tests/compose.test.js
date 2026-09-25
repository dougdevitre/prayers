// Unit tests for the prayer composer in compose.js, run against the real
// corpus in prayers.js. No browser, no network.
//
//   npm run test:unit
//
// The composer's promise is that nothing is generated: every line a reader
// sees is a reviewed corpus block, chosen deterministically by seed, and the
// same seed shows the same prayer in both languages. These tests hold it to
// that.

const assert = require("assert");
const { prayerCorpus: corpus } = require("../prayers.js");
const {
  prayerRng, composePrayer, composeBilingual, prayerCombinations, prayerToText,
  traditionalFor, traditionsOf, narrationSegments,
  PRAYER_MODES, PRAYER_SHAPE, PRAYER_OPTIONAL, CLOSING_STYLES, PETITION_MAX
} = require("../compose.js");

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failures++;
    console.log("FAIL " + name);
    console.log("     " + (e && e.message ? e.message.split("\n")[0] : e));
  }
}

const LANGS = corpus.meta.languages.map(l => l.id);
const intentionsOf = mode => corpus.modes[mode].intentions.map(i => i.id);
// Every block of a slot's pool, in one language, so a line can be traced
// back to the corpus.
const poolText = (mode, slot, intention, lang) => {
  const s = corpus.modes[mode].slots;
  const pool = slot === "body" ? s.body[intention] : s[slot];
  return pool.map(b => b[lang]);
};

/* ---------- the PRNG ---------- */

test("the PRNG is deterministic and stays in [0, 1)", () => {
  const a = prayerRng(42), b = prayerRng(42);
  for (let i = 0; i < 1000; i++) {
    const x = a(), y = b();
    assert.strictEqual(x, y);
    assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
  }
});

test("different seeds give different sequences", () => {
  const first = prayerRng(1)(), second = prayerRng(2)();
  assert.notStrictEqual(first, second);
});

/* ---------- the corpus the composer relies on ---------- */

test("every mode has every slot its shape names, in both languages", () => {
  for (const mode of PRAYER_MODES) {
    const m = corpus.modes[mode];
    assert.ok(m, `corpus has no mode ${mode}`);
    for (const slot of PRAYER_SHAPE[mode]) {
      if (slot === "body") {
        for (const intention of intentionsOf(mode)) {
          assert.ok(Array.isArray(m.slots.body[intention]) && m.slots.body[intention].length, `${mode}.body.${intention} is empty`);
          for (const lang of LANGS) for (const block of m.slots.body[intention]) assert.ok(block[lang], `${mode}.body.${intention} lacks ${lang}`);
        }
      } else {
        assert.ok(Array.isArray(m.slots[slot]) && m.slots[slot].length, `${mode}.${slot} is empty`);
        for (const lang of LANGS) for (const block of m.slots[slot]) assert.ok(block[lang], `${mode}.${slot} lacks ${lang}`);
      }
    }
    for (const lang of LANGS) {
      assert.ok(m.name[lang], `${mode} has no name in ${lang}`);
      for (const i of m.intentions) assert.ok(i.label[lang], `${mode}.${i.id} has no label in ${lang}`);
    }
  }
});

test("every closing names a known style and a labelled tradition", () => {
  for (const mode of PRAYER_MODES) {
    for (const c of corpus.modes[mode].slots.closing) {
      assert.ok(CLOSING_STYLES.includes(c.style) && c.style !== "auto", `${mode}: closing style ${c.style}`);
      assert.ok(c.tradition in corpus.meta.traditionLabels, `${mode}: closing tradition ${c.tradition}`);
    }
    // "As composed" must have something to draw from without falling back.
    const inDefault = corpus.modes[mode].slots.closing.filter(c => corpus.meta.defaultClosingTraditions.includes(c.tradition));
    assert.ok(inDefault.length, `${mode}: no closing in the default traditions`);
  }
});

/* ---------- composing ---------- */

test("the same seed composes the same prayer, and the next seed a different one", () => {
  const a = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 7 });
  const b = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 7 });
  assert.deepStrictEqual(a, b);
  let differs = false;
  for (let seed = 8; seed < 20 && !differs; seed++) {
    differs = JSON.stringify(composePrayer({ corpus, mode: "prayer", intention: "fear", seed }).lines) !== JSON.stringify(a.lines);
  }
  assert.ok(differs, "twelve consecutive seeds never changed the prayer");
});

test("every line of every prayer is a corpus block, for every mode, intention, language and seed 1–25", () => {
  let composed = 0;
  for (const mode of PRAYER_MODES) {
    for (const intention of intentionsOf(mode)) {
      for (const lang of LANGS) {
        for (let seed = 1; seed <= 25; seed++) {
          const p = composePrayer({ corpus, mode, intention, seed, lang });
          const slots = PRAYER_SHAPE[mode];
          assert.strictEqual(p.lines.length, slots.length, `${mode}/${intention}/${lang}/${seed}: line count`);
          p.lines.forEach((line, i) => {
            assert.ok(typeof line === "string" && line.trim(), `${mode}/${intention}/${lang}/${seed}: empty line ${i}`);
            assert.ok(poolText(mode, slots[i], intention, lang).includes(line), `${mode}/${intention}/${lang}/${seed}: line ${i} is not in the ${slots[i]} pool`);
          });
          assert.strictEqual(p.mode, mode);
          assert.strictEqual(p.intention, intention);
          assert.ok(p.title.includes(corpus.modes[mode].name[lang]));
          composed++;
        }
      }
    }
  }
  assert.ok(composed >= 500, `only ${composed} prayers composed`);
});

test("an unknown intention falls back to the mode's first; an unknown mode throws", () => {
  const p = composePrayer({ corpus, mode: "prayer", intention: "not-a-thing" });
  assert.strictEqual(p.intention, intentionsOf("prayer")[0]);
  assert.throws(() => composePrayer({ corpus, mode: "not-a-mode", intention: "fear" }), /unknown mode/);
});

test("a short forgiveness prayer drops the examen and contrition, and only those", () => {
  const full = composePrayer({ corpus, mode: "forgiveness", intention: intentionsOf("forgiveness")[0], seed: 3 });
  const short = composePrayer({ corpus, mode: "forgiveness", intention: intentionsOf("forgiveness")[0], seed: 3, options: { length: "short" } });
  assert.strictEqual(full.lines.length, PRAYER_SHAPE.forgiveness.length);
  assert.strictEqual(short.lines.length, PRAYER_SHAPE.forgiveness.length - PRAYER_OPTIONAL.forgiveness.length);
  const kept = PRAYER_SHAPE.forgiveness.filter(s => !PRAYER_OPTIONAL.forgiveness.includes(s));
  short.lines.forEach((line, i) => assert.ok(poolText("forgiveness", kept[i], intentionsOf("forgiveness")[0], "en").includes(line), `short line ${i} is not from ${kept[i]}`));
  // Modes with nothing optional are unchanged by "short".
  assert.deepStrictEqual(
    composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 3, options: { length: "short" } }).lines,
    composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 3 }).lines
  );
});

/* ---------- closings ---------- */

test("\"As composed\" never picks a closing outside the default traditions", () => {
  const allowed = corpus.meta.defaultClosingTraditions;
  for (const mode of PRAYER_MODES) {
    const closings = corpus.modes[mode].slots.closing;
    for (let seed = 1; seed <= 60; seed++) {
      const p = composePrayer({ corpus, mode, intention: intentionsOf(mode)[0], seed });
      const last = p.lines[p.lines.length - 1];
      const block = closings.find(c => c.en === last);
      assert.ok(block, `${mode}/${seed}: closing is not a corpus block`);
      assert.ok(allowed.includes(block.tradition), `${mode}/${seed}: a ${block.tradition} closing was chosen automatically`);
    }
  }
});

test("an explicit closing style is honoured, including the Roman Catholic ones", () => {
  for (const style of CLOSING_STYLES.filter(s => s !== "auto")) {
    const closings = corpus.modes.prayer.slots.closing;
    if (!closings.some(c => c.style === style)) continue;
    for (let seed = 1; seed <= 20; seed++) {
      const p = composePrayer({ corpus, mode: "prayer", intention: "fear", seed, options: { closing: style } });
      const last = p.lines[p.lines.length - 1];
      const block = closings.find(c => c.en === last);
      assert.ok(block && block.style === style, `${style}/${seed}: got ${block && block.style}`);
    }
  }
});

test("a style the corpus does not carry falls back to the whole pool rather than nothing", () => {
  const p = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 1, options: { closing: "no-such-style" } });
  assert.ok(corpus.modes.prayer.slots.closing.some(c => c.en === p.lines[p.lines.length - 1]));
});

/* ---------- the personal petition ---------- */

test("a petition is woven in right after the body, in the template of its language", () => {
  for (const lang of LANGS) {
    const p = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 2, lang, options: { petition: "  my sister's surgery  " } });
    assert.strictEqual(p.lines.length, PRAYER_SHAPE.prayer.length + 1);
    const bodyAt = PRAYER_SHAPE.prayer.indexOf("body");
    assert.strictEqual(p.lines[bodyAt + 1], corpus.meta.petitionTemplate[lang].replace("{petition}", "my sister's surgery"));
  }
});

test("a blank petition adds nothing and a long one is cut at the limit", () => {
  const none = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 2, options: { petition: "   " } });
  assert.strictEqual(none.lines.length, PRAYER_SHAPE.prayer.length);
  const long = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 2, options: { petition: "x".repeat(PETITION_MAX + 50) } });
  const inserted = long.lines[PRAYER_SHAPE.prayer.indexOf("body") + 1];
  assert.ok(inserted.includes("x".repeat(PETITION_MAX)) && !inserted.includes("x".repeat(PETITION_MAX + 1)));
});

test("the petition is inserted as text, never interpreted", () => {
  const p = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 2, options: { petition: "<b>{petition}</b>" } });
  const inserted = p.lines[PRAYER_SHAPE.prayer.indexOf("body") + 1];
  assert.ok(inserted.includes("<b>{petition}</b>"));
});

/* ---------- bilingual ---------- */

test("a bilingual prayer is one prayer shown twice: the same blocks, paired line by line", () => {
  for (const mode of PRAYER_MODES) {
    for (let seed = 1; seed <= 10; seed++) {
      const b = composeBilingual({ corpus, mode, intention: intentionsOf(mode)[0], seed, langs: ["en", "es"], options: { petition: "peace at home" } });
      const slots = PRAYER_SHAPE[mode];
      assert.strictEqual(b.pairs.length, slots.length + 1);
      b.pairs.forEach(([en, es], i) => {
        assert.ok(en && es, `${mode}/${seed}: pair ${i} has a blank side`);
        if (i === slots.indexOf("body") + 1) return;   // the petition line
        const slot = slots[i > slots.indexOf("body") ? i - 1 : i];
        const pool = slot === "body" ? corpus.modes[mode].slots.body[intentionsOf(mode)[0]] : corpus.modes[mode].slots[slot];
        const block = pool.find(x => x.en === en);
        assert.ok(block && block.es === es, `${mode}/${seed}: pair ${i} is not the same block in both languages`);
      });
      assert.deepStrictEqual(b.langs, ["en", "es"]);
      assert.strictEqual(b.titles.length, 2);
    }
  }
});

/* ---------- counts, text, traditional prayers, narration ---------- */

test("prayerCombinations is the product of the active pools", () => {
  const m = corpus.modes.prayer;
  const auto = m.slots.closing.filter(c => corpus.meta.defaultClosingTraditions.includes(c.tradition)).length;
  assert.strictEqual(prayerCombinations(corpus, "prayer", "fear"), m.slots.invocation.length * m.slots.body.fear.length * auto);
  const marian = m.slots.closing.filter(c => c.style === "marian").length;
  if (marian) assert.strictEqual(prayerCombinations(corpus, "prayer", "fear", { closing: "marian" }), m.slots.invocation.length * m.slots.body.fear.length * marian);
  const f = corpus.modes.forgiveness, fi = intentionsOf("forgiveness")[0];
  const fAuto = f.slots.closing.filter(c => corpus.meta.defaultClosingTraditions.includes(c.tradition)).length;
  assert.strictEqual(prayerCombinations(corpus, "forgiveness", fi, { length: "short" }), f.slots.invocation.length * f.slots.body[fi].length * fAuto);
});

test("prayerToText is the title, a blank line, then the lines", () => {
  const p = composePrayer({ corpus, mode: "prayer", intention: "fear", seed: 1 });
  assert.strictEqual(prayerToText(p), [p.title, "", ...p.lines].join("\n"));
});

test("traditional prayers are grouped by tradition and every tradition present is labelled", () => {
  const traditions = traditionsOf(corpus);
  assert.deepStrictEqual(traditions, Object.keys(corpus.meta.traditionLabels).filter(t => corpus.traditional.some(x => x.tradition === t)));
  let total = 0;
  for (const t of traditions) {
    const list = traditionalFor(corpus, t);
    assert.ok(list.length, `${t} has no prayers`);
    for (const p of list) {
      assert.strictEqual(p.tradition, t);
      for (const lang of LANGS) assert.ok(p.name[lang] && p.text[lang], `${p.id} lacks ${lang}`);
    }
    total += list.length;
  }
  assert.strictEqual(total, corpus.traditional.length, "a prayer names a tradition that is not labelled");
});

test("narration splits at the audio anchors, in order, and keeps the tail", () => {
  const text = "Hail Mary, full of grace. The Lord is with thee. Blessed art thou among women.";
  const audio = { breaks: { en: [{ after: "full of grace.", seconds: 0.6 }, { after: "with thee.", seconds: 0.4 }] } };
  assert.deepStrictEqual(narrationSegments(text, audio, "en"), [
    { text: "Hail Mary, full of grace.", pause: 0.6 },
    { text: "The Lord is with thee.", pause: 0.4 },
    { text: "Blessed art thou among women.", pause: 0 }
  ]);
  // An anchor that is not in the text is skipped; no anchors means one segment.
  assert.deepStrictEqual(narrationSegments(text, { breaks: { en: [{ after: "nope", seconds: 1 }] } }, "en"), [{ text, pause: 0 }]);
  assert.deepStrictEqual(narrationSegments(text, null, "en"), [{ text, pause: 0 }]);
});

test("every traditional prayer's audio anchors are found in its text, in both languages", () => {
  for (const p of corpus.traditional) {
    const breaks = p.audio && p.audio.breaks;
    if (!breaks) continue;
    for (const lang of LANGS) {
      for (const b of breaks[lang] || []) assert.ok(p.text[lang].includes(b.after), `${p.id}/${lang}: anchor "${b.after}" is not in the text`);
      const segments = narrationSegments(p.text[lang], p.audio, lang);
      assert.strictEqual(segments.map(s => s.text).join(" ").replace(/\s+/g, " "), p.text[lang].replace(/\s+/g, " ").trim(), `${p.id}/${lang}: segments do not rebuild the text`);
    }
  }
});

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nAll composer tests passed.");
