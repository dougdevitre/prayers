// Validates the prayer corpus in prayers.js, mirroring the checks REMAM's
// scripts/validate-data.mjs runs on the corpus this one was imported from, so
// the pacing metadata here stays compatible with that audio generator.
//
//   node scripts/validate-prayers.js
//
// Checks: every mode composes (each slot has a non-empty pool for every
// intention); closings carry a style and the default styles match something;
// the default traditions match something; and audio pacing stays inside
// ElevenLabs' documented limits — speed in [0.7, 1.2], stability and style in
// [0, 1], at most 6 breaks, each 0 < seconds <= 3, and every break anchor an
// exact substring appearing exactly once in its prayer's text.

const { prayerCorpus } = require("../prayers.js");
const { composePrayer, prayerCombinations, narrationSegments, PRAYER_SHAPE } = require("../compose.js");

const errors = [];
const fail = m => errors.push(m);

// --- composed modes ---------------------------------------------------------
for (const [id, mode] of Object.entries(prayerCorpus.modes)) {
  if (!PRAYER_SHAPE[id]) { fail(`modes.${id}: no slot shape defined in compose.js`); continue; }
  if (!mode.name) fail(`modes.${id}: missing name`);
  if (!mode.intentions || !mode.intentions.length) fail(`modes.${id}: no intentions`);

  for (const slot of PRAYER_SHAPE[id]) {
    const pool = mode.slots[slot];
    if (!pool) { fail(`modes.${id}.slots.${slot}: missing`); continue; }
    if (slot === "body") {
      for (const intention of mode.intentions) {
        const lines = pool[intention.id];
        if (!lines || !lines.length) fail(`modes.${id}.slots.body.${intention.id}: empty pool`);
      }
      for (const key of Object.keys(pool)) {
        if (!mode.intentions.some(i => i.id === key)) fail(`modes.${id}.slots.body.${key}: no matching intention`);
      }
    } else if (slot === "closing") {
      if (!pool.length) fail(`modes.${id}.slots.closing: empty pool`);
      for (const c of pool) {
        if (!c.style) fail(`modes.${id}.slots.closing: block missing style — ${JSON.stringify(c.text).slice(0, 50)}`);
        if (!c.text) fail(`modes.${id}.slots.closing: block missing text`);
      }
      if (!pool.some(c => prayerCorpus.meta.defaultClosingStyles.includes(c.style))) {
        fail(`modes.${id}.slots.closing: no block matches meta.defaultClosingStyles`);
      }
    } else if (!pool.length) {
      fail(`modes.${id}.slots.${slot}: empty pool`);
    }
  }

  // Every mode+intention must actually compose, at both lengths.
  for (const intention of mode.intentions || []) {
    for (const length of ["full", "short"]) {
      try {
        const result = composePrayer({ corpus: prayerCorpus, mode: id, intention: intention.id, seed: 1, options: { length } });
        if (!result.lines.length) fail(`modes.${id}/${intention.id} (${length}): composed no lines`);
        if (result.lines.some(l => typeof l !== "string" || !l.trim())) {
          fail(`modes.${id}/${intention.id} (${length}): composed a blank line`);
        }
      } catch (e) {
        fail(`modes.${id}/${intention.id} (${length}): ${e.message}`);
      }
    }
    if (prayerCombinations(prayerCorpus, id, intention.id) < 1) {
      fail(`modes.${id}/${intention.id}: zero combinations`);
    }
  }
}

// --- traditional prayers and audio pacing -----------------------------------
const seen = new Set();
for (const item of prayerCorpus.traditional) {
  const p = `traditional.${item.id}`;
  if (!item.id) fail("traditional: item missing id");
  if (seen.has(item.id)) fail(`${p}: duplicate id`);
  seen.add(item.id);
  if (!item.name) fail(`${p}: missing name`);
  if (!item.text || !item.text.trim()) fail(`${p}: missing text`);
  if (!["universal", "catholic"].includes(item.tradition)) fail(`${p}: tradition "${item.tradition}" is not universal|catholic`);
  if (!item.audio) continue;

  const { speed, stability, style, breaks } = item.audio;
  if (typeof speed !== "number" || speed < 0.7 || speed > 1.2) fail(`${p}.audio: speed "${speed}" out of range [0.7, 1.2]`);
  for (const [k, v] of [["stability", stability], ["style", style]]) {
    if (typeof v !== "number" || v < 0 || v > 1) fail(`${p}.audio: ${k} "${v}" out of range [0, 1]`);
  }
  const list = breaks || [];
  if (list.length > 6) fail(`${p}.audio.breaks: ${list.length} breaks exceeds the cap of 6`);
  for (const b of list) {
    if (typeof b.seconds !== "number" || b.seconds <= 0 || b.seconds > 3) {
      fail(`${p}.audio.breaks: seconds "${b.seconds}" out of range (0, 3]`);
    }
    const hits = item.text.split(b.after).length - 1;
    if (hits !== 1) fail(`${p}.audio.breaks: anchor ${JSON.stringify(b.after)} found ${hits}x (must be exactly 1)`);
  }
  // Every anchor must survive segmentation, or a pause silently goes missing.
  const segments = narrationSegments(item.text, item.audio);
  if (segments.filter(s => s.pause > 0).length !== list.length) {
    fail(`${p}.audio.breaks: ${list.length} breaks but ${segments.filter(s => s.pause > 0).length} produced a pause`);
  }
  if (segments.map(s => s.text).join(" ").replace(/\s+/g, " ") !== item.text.replace(/\s+/g, " ").trim()) {
    fail(`${p}.audio.breaks: segmenting the text changed it`);
  }
}

if (!prayerCorpus.traditional.some(t => prayerCorpus.meta.defaultTraditions.includes(t.tradition))) {
  fail("meta.defaultTraditions: matches no traditional prayer");
}

// --- composition is deterministic -------------------------------------------
const a = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 7 });
const b = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 7 });
if (JSON.stringify(a.lines) !== JSON.stringify(b.lines)) fail("composePrayer: same seed produced different prayers");
const c = composePrayer({ corpus: prayerCorpus, mode: "prayer", intention: "fear", seed: 8 });
if (JSON.stringify(a.lines) === JSON.stringify(c.lines)) fail("composePrayer: seed + 1 produced an identical prayer");

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in the prayer corpus:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const lines = Object.values(prayerCorpus.modes).reduce((n, m) =>
  n + Object.values(m.slots).reduce((s, v) =>
    s + (Array.isArray(v) ? v.length : Object.values(v).reduce((x, y) => x + y.length, 0)), 0), 0);
console.log(`✓ prayer corpus valid — ${Object.keys(prayerCorpus.modes).length} modes, ${lines} composable lines, ${prayerCorpus.traditional.length} traditional prayers`);
