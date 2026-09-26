// Share cards: which text each day's card shows, and the address it lives at.
//
// One module for the page generator (which writes the address into each day
// page), the card function (which renders it) and the tests, so the three
// cannot disagree about what a card says or where it is.
//
// Every day of every journey, in both languages, has two cards:
//   post  1080x1350  verse, reflection and prayer, for posting as an image
//   og    1200x630   the link preview: reflection and the prayer's first line
//
// The address carries a hash of everything the card shows, so an edit to a
// verse, reflection or prayer (or to the template) is a new address: social
// sites that cached the old image fetch the new one, and the image itself can
// be cached forever.
//
//   /cards/en/core/01-stand.1a2b3c4d.post.png
//
// Node only (it hashes with node:crypto).

const crypto = require("crypto");
const { tracks } = require("./content.js");
const { esTracks } = require("./content.es.js");
const { slugify } = require("./logic.js");

// Bump when the card's layout or wording changes, so every address changes.
const TEMPLATE_VERSION = 1;
const FORMATS = { post: { width: 1080, height: 1350 }, og: { width: 1200, height: 630 } };
const LANGS = ["en", "es"];
const SITE_LABEL = "prayers.dougdevitre.org";

// A day's shown text, measured at the longest day when the layout was set
// (The Wall, day 4: 573 characters of verse, reflection and prayer, which
// leaves a quarter of the card empty). tests/cards.test.js fails if any day
// grows past this, so a longer text gets a look at the layout first.
const TEXT_BUDGET = 700;

const LABELS = {
  en: { day: "DAY", reflection: "REFLECTION", prayer: "PRAYER" },
  es: { day: "DÍA", reflection: "REFLEXIÓN", prayer: "ORACIÓN" }
};

// The Spanish journeys override only their text; ids, groups and weeks are
// the English track's (the same merge the page generator does).
const trackFor = (lang, id) => lang === "en" ? tracks[id] : (tracks[id] && esTracks[id] ? { ...tracks[id], ...esTracks[id] } : null);

/** The page slug, identical to the generated page's file name. */
const slugOf = (track, i) => `${String(i + 1).padStart(2, "0")}-${slugify(track.days[i][0])}`;

/** The prayer's first sentence, for the link preview. */
function firstSentence(text) {
  const m = String(text).match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : String(text);
}

/**
 * What one day's card shows, or null for a day that does not exist.
 * `lang` is "en" or "es", `trackId` a journey id ("core", "wall", ...),
 * `day` the zero-based day index.
 */
function cardFor(lang, trackId, day) {
  if (!LANGS.includes(lang)) return null;
  const track = trackFor(lang, trackId);
  if (!track || !Number.isInteger(day) || day < 0 || day >= track.days.length) return null;
  const [title, ref, verse, reflection, prayer] = track.days[day];
  const fields = {
    lang, track: trackId, day, number: day + 1,
    journey: track.short || track.name, title, ref, verse, reflection, prayer,
    prayerLead: firstSentence(prayer), site: SITE_LABEL
  };
  const hash = crypto.createHash("sha256")
    .update(JSON.stringify({ v: TEMPLATE_VERSION, ...fields }))
    .digest("hex").slice(0, 8);
  return { ...fields, slug: slugOf(track, day), hash, labels: LABELS[lang] };
}

/** The card for a page slug ("01-stand"), or null. */
function cardForSlug(lang, trackId, slug) {
  const track = trackFor(lang, trackId);
  if (!track) return null;
  const day = track.days.findIndex((_, i) => slugOf(track, i) === slug);
  return day === -1 ? null : cardFor(lang, trackId, day);
}

/** Site-relative address of a card in one format. */
const cardPath = (card, format) => `/cards/${card.lang}/${card.track}/${card.slug}.${card.hash}.${format}.png`;

/**
 * Parse a card address back into its parts, or null when it is not one.
 * Only lower-case slugs, an 8-hex hash and a known format are accepted, so
 * nothing else can reach the renderer.
 */
function parseCardFile(lang, trackId, file) {
  const m = /^([a-z0-9-]{1,80})\.([0-9a-f]{8})\.(post|og)\.png$/.exec(String(file || ""));
  if (!m || !LANGS.includes(lang) || !/^[a-z0-9-]{1,40}$/.test(String(trackId || ""))) return null;
  return { lang, track: trackId, slug: m[1], hash: m[2], format: m[3] };
}

/** Every card, for the tests and for warming the cache after a deploy. */
function allCards() {
  const out = [];
  for (const lang of LANGS) for (const id of Object.keys(tracks)) {
    const track = trackFor(lang, id);
    if (track) for (let i = 0; i < track.days.length; i++) out.push(cardFor(lang, id, i));
  }
  return out;
}

module.exports = { TEMPLATE_VERSION, FORMATS, TEXT_BUDGET, SITE_LABEL, cardFor, cardForSlug, cardPath, parseCardFile, allCards, firstSentence };
