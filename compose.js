// Prayer composition — ported from REMAM's packages/ui/compose-prayer.js and
// adapted to Stand's no-build convention (globals in the browser, CommonJS in
// Node) instead of ES modules.
//
// Composes a whole prayer from the reviewed corpus in prayers.js: one block per
// slot, chosen by a seeded PRNG, so a given (mode, intention, seed, options)
// always yields the same prayer and "another prayer" is just seed + 1. No
// network and no generation at runtime — every line a user can see is
// reviewable in the corpus. The only free text is the optional personal
// petition, which is inserted into the corpus's petitionTemplate and never
// leaves the device.

/** Deterministic PRNG (mulberry32). */
function prayerRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];

/** Slot order per mode — the shape of each prayer. REMAM's Laudato Si' slot is
 * specific to its ecological mission and is not part of Stand's prayer mode. */
const PRAYER_SHAPE = {
  prayer: ["invocation", "body", "closing"],
  forgiveness: ["invocation", "examen", "body", "contrition", "closing"],
  grace: ["invocation", "body", "closing"]
};

/** Slots dropped when options.length is "short". */
const PRAYER_OPTIONAL = {
  prayer: [],
  forgiveness: ["examen", "contrition"],
  grace: []
};

const PRAYER_MODES = Object.keys(PRAYER_SHAPE);
const CLOSING_STYLES = ["auto", "simple", "trinitarian", "marian", "franciscan"];
const PETITION_MAX = 200;

/** The slots actually composed for a mode under the given options. */
function activeSlots(mode, options) {
  const short = options.length === "short";
  return PRAYER_SHAPE[mode].filter(slot => !(short && PRAYER_OPTIONAL[mode].includes(slot)));
}

/** The pool a slot draws from under the given options. Closings are objects
 * ({style, text}); every other slot is a plain string array. */
function poolFor(corpus, m, slot, intention, options) {
  if (slot === "body") return m.slots.body[intention];
  if (slot !== "closing") return m.slots[slot];
  const wanted = options.closing && options.closing !== "auto"
    ? [options.closing]
    : corpus.meta.defaultClosingStyles;
  const filtered = m.slots.closing.filter(c => wanted.includes(c.style));
  return filtered.length ? filtered : m.slots.closing;
}

/**
 * Compose one prayer.
 * options: length "full" (default) | "short"; closing "auto" (default) or a
 * style name; petition — a personal intention woven into meta.petitionTemplate.
 * Returns { mode, intention, seed, title, lines, note }.
 */
function composePrayer({ corpus, mode, intention, seed = 1, options = {} }) {
  const m = corpus.modes[mode];
  if (!m) throw new Error(`unknown mode: ${mode}`);
  const intentions = m.intentions.map(i => i.id);
  if (!intentions.includes(intention)) intention = intentions[0];
  const r = prayerRng(seed * 2654435761 + PRAYER_MODES.indexOf(mode) * 97 + intentions.indexOf(intention));

  const lines = [];
  for (const slot of activeSlots(mode, options)) {
    const picked = pickFrom(poolFor(corpus, m, slot, intention, options), r);
    lines.push(slot === "closing" ? picked.text : picked);
    if (slot === "body") {
      const petition = String(options.petition || "").trim().slice(0, PETITION_MAX);
      if (petition && corpus.meta.petitionTemplate) {
        lines.push(corpus.meta.petitionTemplate.replace("{petition}", petition));
      }
    }
  }

  return {
    mode,
    intention,
    seed,
    title: `${m.name} — ${m.intentions.find(i => i.id === intention).label}`,
    lines,
    note: m.note
  };
}

/** Distinct combinations for a mode+intention under the given options, for the
 * page's footnote. The petition is fixed text, so it does not multiply. */
function prayerCombinations(corpus, mode, intention, options = {}) {
  const m = corpus.modes[mode];
  return activeSlots(mode, options).reduce(
    (n, slot) => n * poolFor(corpus, m, slot, intention, options).length,
    1
  );
}

/** Plain text, for copying and for narration. */
function prayerToText(result) {
  return [result.title, "", ...result.lines].join("\n");
}

/** Traditional prayers Stand shows by default (meta.defaultTraditions). */
function traditionalFor(corpus) {
  return corpus.traditional.filter(t => corpus.meta.defaultTraditions.includes(t.tradition));
}

/** Split a text into spoken segments at its audio break anchors, so device
 * narration can pause where REMAM's generator would insert an SSML break.
 * Returns [{ text, pause }] in order; pause is seconds of silence after. */
function narrationSegments(text, audio) {
  const breaks = (audio && audio.breaks) || [];
  const segments = [];
  let rest = text;
  for (const b of breaks) {
    const at = rest.indexOf(b.after);
    if (at === -1) continue;
    const end = at + b.after.length;
    segments.push({ text: rest.slice(0, end).trim(), pause: b.seconds });
    rest = rest.slice(end);
  }
  if (rest.trim()) segments.push({ text: rest.trim(), pause: 0 });
  return segments.length ? segments : [{ text, pause: 0 }];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    prayerRng, composePrayer, prayerCombinations, prayerToText,
    traditionalFor, narrationSegments,
    PRAYER_MODES, PRAYER_SHAPE, PRAYER_OPTIONAL, CLOSING_STYLES, PETITION_MAX
  };
}
