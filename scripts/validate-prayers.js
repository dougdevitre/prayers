// Validates the prayer corpus in prayers.js, mirroring the checks REMAM's
// scripts/validate-data.mjs runs on the corpus this one was imported from, so
// the pacing metadata here stays compatible with that audio generator.
//
//   node scripts/validate-prayers.js
//
// Checks, in every language the corpus declares: every mode composes (each slot
// has a non-empty pool for every intention, and no block is missing a
// translation); closings carry a style and a tradition, and the default
// traditions match something; traditional prayers declare a known tradition;
// the UI strings are complete; and audio pacing stays inside ElevenLabs'
// documented limits — speed in [0.7, 1.2], stability and style in [0, 1], at
// most 6 breaks per language, each 0 < seconds <= 3, and every break anchor an
// exact substring appearing exactly once in that language's text.

const { prayerCorpus, prayerUi } = require("../prayers.js");
const { composePrayer, composeBilingual, prayerCombinations, narrationSegments, PRAYER_SHAPE } = require("../compose.js");

const errors = [];
const fail = m => errors.push(m);
const LANGS = prayerCorpus.meta.languages.map(l => l.id);
const TRADITIONS = ["universal", "roman-catholic"];

/** Every language must be present and non-empty on a { en, es } block. */
function checkBlock(where, block) {
  for (const lang of LANGS) {
    if (typeof block[lang] !== "string" || !block[lang].trim()) fail(`${where}: missing ${lang} text`);
  }
}

if (!LANGS.length) fail("meta.languages: no languages declared");

// --- composed modes ---------------------------------------------------------
for (const [id, mode] of Object.entries(prayerCorpus.modes)) {
  if (!PRAYER_SHAPE[id]) { fail(`modes.${id}: no slot shape defined in compose.js`); continue; }
  checkBlock(`modes.${id}.name`, mode.name);
  if (!mode.intentions || !mode.intentions.length) fail(`modes.${id}: no intentions`);
  for (const intention of mode.intentions || []) checkBlock(`modes.${id}.intentions.${intention.id}.label`, intention.label);
  if (mode.note) checkBlock(`modes.${id}.note`, mode.note);

  for (const slot of PRAYER_SHAPE[id]) {
    const pool = mode.slots[slot];
    if (!pool) { fail(`modes.${id}.slots.${slot}: missing`); continue; }
    if (slot === "body") {
      for (const intention of mode.intentions) {
        const lines = pool[intention.id];
        if (!lines || !lines.length) { fail(`modes.${id}.slots.body.${intention.id}: empty pool`); continue; }
        lines.forEach((b, i) => checkBlock(`modes.${id}.slots.body.${intention.id}[${i}]`, b));
      }
      for (const key of Object.keys(pool)) {
        if (!mode.intentions.some(i => i.id === key)) fail(`modes.${id}.slots.body.${key}: no matching intention`);
      }
    } else if (slot === "closing") {
      if (!pool.length) fail(`modes.${id}.slots.closing: empty pool`);
      pool.forEach((c, i) => {
        checkBlock(`modes.${id}.slots.closing[${i}]`, c);
        if (!c.style) fail(`modes.${id}.slots.closing[${i}]: missing style`);
        if (!TRADITIONS.includes(c.tradition)) fail(`modes.${id}.slots.closing[${i}]: tradition "${c.tradition}" is not ${TRADITIONS.join("|")}`);
      });
      if (!pool.some(c => prayerCorpus.meta.defaultClosingTraditions.includes(c.tradition))) {
        fail(`modes.${id}.slots.closing: no block matches meta.defaultClosingTraditions`);
      }
    } else {
      if (!pool.length) fail(`modes.${id}.slots.${slot}: empty pool`);
      pool.forEach((b, i) => checkBlock(`modes.${id}.slots.${slot}[${i}]`, b));
    }
  }

  // Every mode + intention must compose, at both lengths, in every language.
  for (const intention of mode.intentions || []) {
    for (const lang of LANGS) {
      for (const length of ["full", "short"]) {
        try {
          const result = composePrayer({ corpus: prayerCorpus, mode: id, intention: intention.id, seed: 1, lang, options: { length } });
          if (!result.lines.length) fail(`modes.${id}/${intention.id} (${lang}, ${length}): composed no lines`);
          if (result.lines.some(l => typeof l !== "string" || !l.trim())) {
            fail(`modes.${id}/${intention.id} (${lang}, ${length}): composed a blank line`);
          }
          if (result.title.includes("undefined")) fail(`modes.${id}/${intention.id} (${lang}): title has an untranslated part`);
        } catch (e) {
          fail(`modes.${id}/${intention.id} (${lang}, ${length}): ${e.message}`);
        }
      }
    }
    if (prayerCombinations(prayerCorpus, id, intention.id) < 1) fail(`modes.${id}/${intention.id}: zero combinations`);
  }
}

// --- traditional prayers and audio pacing -----------------------------------
const seen = new Set();
for (const item of prayerCorpus.traditional) {
  const p = `traditional.${item.id}`;
  if (!item.id) fail("traditional: item missing id");
  if (seen.has(item.id)) fail(`${p}: duplicate id`);
  seen.add(item.id);
  checkBlock(`${p}.name`, item.name);
  checkBlock(`${p}.text`, item.text);
  if (!TRADITIONS.includes(item.tradition)) fail(`${p}: tradition "${item.tradition}" is not ${TRADITIONS.join("|")}`);
  if (!item.audio) continue;

  const { speed, stability, style, breaks } = item.audio;
  if (typeof speed !== "number" || speed < 0.7 || speed > 1.2) fail(`${p}.audio: speed "${speed}" out of range [0.7, 1.2]`);
  for (const [k, v] of [["stability", stability], ["style", style]]) {
    if (typeof v !== "number" || v < 0 || v > 1) fail(`${p}.audio: ${k} "${v}" out of range [0, 1]`);
  }
  for (const lang of LANGS) {
    const list = (breaks && breaks[lang]) || [];
    if (breaks && !breaks[lang]) fail(`${p}.audio.breaks: no ${lang} list`);
    if (list.length > 6) fail(`${p}.audio.breaks.${lang}: ${list.length} breaks exceeds the cap of 6`);
    for (const b of list) {
      if (typeof b.seconds !== "number" || b.seconds <= 0 || b.seconds > 3) {
        fail(`${p}.audio.breaks.${lang}: seconds "${b.seconds}" out of range (0, 3]`);
      }
      const hits = item.text[lang].split(b.after).length - 1;
      if (hits !== 1) fail(`${p}.audio.breaks.${lang}: anchor ${JSON.stringify(b.after)} found ${hits}x (must be exactly 1)`);
    }
    // Every anchor must survive segmentation, or a pause silently goes missing.
    const segments = narrationSegments(item.text[lang], item.audio, lang);
    if (segments.filter(s => s.pause > 0).length !== list.length) {
      fail(`${p}.audio.breaks.${lang}: ${list.length} breaks but ${segments.filter(s => s.pause > 0).length} produced a pause`);
    }
    if (segments.map(s => s.text).join(" ").replace(/\s+/g, " ") !== item.text[lang].replace(/\s+/g, " ").trim()) {
      fail(`${p}.audio.breaks.${lang}: segmenting the text changed it`);
    }
  }
}

for (const tradition of TRADITIONS) {
  if (!prayerCorpus.traditional.some(t => t.tradition === tradition)) continue;
  for (const map of ["traditionLabels", "traditionNotes"]) {
    if (!prayerCorpus.meta[map][tradition]) { fail(`meta.${map}.${tradition}: missing`); continue; }
    checkBlock(`meta.${map}.${tradition}`, prayerCorpus.meta[map][tradition]);
  }
}
checkBlock("meta.petitionTemplate", prayerCorpus.meta.petitionTemplate);
checkBlock("meta.reviewNote", prayerCorpus.meta.reviewNote);

// --- UI strings -------------------------------------------------------------
const uiKeys = Object.keys(prayerUi.en);
for (const lang of LANGS) {
  if (!prayerUi[lang]) { fail(`prayerUi.${lang}: missing`); continue; }
  for (const key of uiKeys) {
    if (prayerUi[lang][key] === undefined) fail(`prayerUi.${lang}.${key}: missing`);
  }
  for (const style of Object.keys(prayerUi.en.styles)) {
    if (!prayerUi[lang].styles[style]) fail(`prayerUi.${lang}.styles.${style}: missing`);
  }
}

// --- composition is deterministic -------------------------------------------
for (const lang of LANGS) {
  const a = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 7, lang });
  const b = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 7, lang });
  if (JSON.stringify(a.lines) !== JSON.stringify(b.lines)) fail(`composePrayer (${lang}): same seed produced different prayers`);
  const c = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 8, lang });
  if (JSON.stringify(a.lines) === JSON.stringify(c.lines)) fail(`composePrayer (${lang}): seed + 1 produced an identical prayer`);
}
// The same seed must pick the same blocks in every language — a prayer is one
// prayer, translated, not two different ones.
{
  const en = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 3, lang: "en" });
  const es = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 3, lang: "es" });
  if (en.lines.length !== es.lines.length) fail("composePrayer: the same seed composed different shapes per language");
  const pool = prayerCorpus.modes.prayer.slots.invocation;
  const pair = pool.find(b => b.en === en.lines[0]);
  if (!pair || pair.es !== es.lines[0]) fail("composePrayer: the same seed picked different blocks per language");
}

// The side-by-side view pairs the two languages line for line, so a pair must
// always be the same prayer twice — never two different ones.
if (LANGS.length > 1) {
  for (const [id, mode] of Object.entries(prayerCorpus.modes)) {
    for (const intention of mode.intentions) {
      const both = composeBilingual({ corpus: prayerCorpus, mode: id, intention: intention.id, seed: 11, langs: LANGS });
      // Each column must match what that language composes on its own from the
      // same seed. Checking only the primary column would let the second column
      // drift to a different prayer unnoticed.
      const singles = LANGS.map(lang => composePrayer({ corpus: prayerCorpus, mode: id, intention: intention.id, seed: 11, lang }));
      const where = `composeBilingual ${id}/${intention.id}`;
      if (both.pairs.length !== singles[0].lines.length) fail(`${where}: ${both.pairs.length} pairs for ${singles[0].lines.length} lines`);
      both.pairs.forEach((pair, i) => {
        pair.forEach((line, col) => {
          if (typeof line !== "string" || !line.trim()) fail(`${where}: pair ${i} column ${col} is blank`);
          if (line !== singles[col].lines[i]) fail(`${where}: pair ${i} column ${col} (${LANGS[col]}) is not that language's line for this seed`);
        });
        if (pair[0] === pair[1]) fail(`${where}: pair ${i} is the same text in both columns`);
      });
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in the prayer corpus:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const blocks = Object.values(prayerCorpus.modes).reduce((n, m) =>
  n + Object.values(m.slots).reduce((s, v) =>
    s + (Array.isArray(v) ? v.length : Object.values(v).reduce((x, y) => x + y.length, 0)), 0), 0);
const rc = prayerCorpus.traditional.filter(t => t.tradition === "roman-catholic").length;
console.log(`✓ prayer corpus valid — ${LANGS.join("/")}, ${Object.keys(prayerCorpus.modes).length} modes, ${blocks} composable blocks, ${prayerCorpus.traditional.length} traditional prayers (${rc} Roman Catholic)`);
