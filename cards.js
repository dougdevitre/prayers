// Share cards: which text each day's card shows, and the address it lives at.
//
// One module for the page generator (which writes the address into each day
// page), the card function (which renders it) and the tests, so the three
// cannot disagree about what a card says or where it is.
//
// Every day of every journey, in both languages, has two cards:
//   post  1080x1350  verse, reflection and prayer, for posting as an image
//   og    1200x630   the link preview: reflection and the prayer's first line
// and so does every prayer in the Prayer Book (prayerbook.js), under the
// track "prayers": the whole prayer on the post card, its opening on the og.
//
// The address carries a hash of everything the card shows, so an edit to a
// verse, reflection or prayer (or to the template) is a new address: social
// sites that cached the old image fetch the new one, and the image itself can
// be cached forever.
//
//   /cards/en/core/01-stand.1a2b3c4d.post.png
//   /cards/es/prayers/padre-nuestro.1a2b3c4d.og.png
//
// Node only (it hashes with node:crypto).

const crypto = require("crypto");
const { tracks } = require("./content.js");
const { esTracks } = require("./content.es.js");
const { slugify } = require("./logic.js");
const { prayerBook } = require("./prayerbook.js");
const { rosary, setById, mysteryRef, daysLabel } = require("./rosary.js");

// Bump when the card's layout or wording changes, so every address changes.
const TEMPLATE_VERSION = 1;
// The same, for the Rosary's cards alone, so a fix to their layout gives new
// addresses to those cards (and their pages) without touching the others.
// 2: a long mystery no longer squeezes its number out of line.
const ROSARY_LAYOUT = 2;
const FORMATS = { post: { width: 1080, height: 1350 }, og: { width: 1200, height: 630 } };
const LANGS = ["en", "es"];
const SITE_LABEL = "prayers.dougdevitre.org";

// A day's shown text, measured at the longest day when the layout was set
// (The Wall, day 4: 573 characters of verse, reflection and prayer, which
// leaves a quarter of the card empty). tests/cards.test.js fails if any day
// grows past this, so a longer text gets a look at the layout first.
const TEXT_BUDGET = 700;
// A prayer's text, measured at the longest (the Angelus in Spanish, 1,310
// characters). A prayer card sets its text smaller as the prayer grows
// (api/card.js), down to a size checked readable at this length; the tests
// fail past it rather than let a prayer be cut short.
const PRAYER_BUDGET = 1320;
// The track name prayer cards are filed under; never a journey id.
const PRAYER_TRACK = "prayers";
// And the Rosary's: one card per set of mysteries, and one for the whole.
const ROSARY_TRACK = "rosary";
const ROSARY_SLUG = { en: "rosary", es: "rosario" };

const LABELS = {
  en: { day: "DAY", reflection: "REFLECTION", prayer: "PRAYER" },
  es: { day: "DÍA", reflection: "REFLEXIÓN", prayer: "ORACIÓN" }
};
const BOOK = { en: "PRAYER BOOK", es: "DEVOCIONARIO" };

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

/**
 * A prayer's opening for the link preview: whole sentences, as many as fit in
 * about two hundred characters, marked with an ellipsis when the prayer goes
 * on. A first sentence longer than that (the Creed's) ends at its last comma
 * or semicolon inside the limit instead.
 */
function openingOf(text, max = 200) {
  const sentences = String(text).match(/[^.!?]+[.!?]+(?=\s|$)/g) || [String(text)];
  let out = sentences[0].trim();
  if (out.length > max) {
    const cut = Math.max(out.lastIndexOf(",", max), out.lastIndexOf(";", max));
    return (cut > 0 ? out.slice(0, cut + 1) : out.slice(0, max)) + " …";
  }
  for (const s of sentences.slice(1)) {
    if ((out + " " + s.trim()).length > max) break;
    out += " " + s.trim();
  }
  return out.length < String(text).trim().length ? out + " …" : out;
}

/**
 * What a Prayer Book prayer's card shows, or null. `id` is the prayer's id
 * in prayers.js ("our-father"); the slug is its page's, in that language.
 */
function prayerCardFor(lang, id) {
  if (!LANGS.includes(lang)) return null;
  const item = prayerBook.byId(id);
  if (!item) return null;
  const fields = {
    kind: "prayer", lang, track: PRAYER_TRACK, id,
    kicker: `${BOOK[lang]} · ${prayerBook.label(item.tradition, lang).toLocaleUpperCase(lang)}`,
    title: item.name[lang], text: item.text[lang].trim(),
    prayerLead: openingOf(item.text[lang].trim()), site: SITE_LABEL
  };
  const hash = crypto.createHash("sha256")
    .update(JSON.stringify({ v: TEMPLATE_VERSION, ...fields }))
    .digest("hex").slice(0, 8);
  return { ...fields, slug: prayerBook.prayerSlug(lang, id), hash };
}

/**
 * What a Rosary card shows, or null: with a set id ("joyful") that set's five
 * mysteries and the days it is prayed on; with none, the four sets and their
 * days, for the Rosary's own page.
 */
function rosaryCardFor(lang, setId = null) {
  if (!LANGS.includes(lang)) return null;
  const set = setId ? setById(setId) : null;
  if (setId && !set) return null;
  const upper = s => s.toLocaleUpperCase(lang);
  const fields = set ? {
    kind: "rosary", lang, track: ROSARY_TRACK, id: set.id,
    kicker: `${upper(rosary.name[lang])} · ${upper(daysLabel(set, lang))}`,
    title: set.name[lang],
    lines: set.mysteries.map(m => ({ lead: m.name[lang], rest: mysteryRef(m, lang) })),
    prayerLead: set.mysteries.map(m => m.name[lang]).join(" · "), site: SITE_LABEL
  } : {
    kind: "rosary", lang, track: ROSARY_TRACK, id: "rosary",
    kicker: `${BOOK[lang]} · ${upper(rosary.name[lang])}`,
    title: rosary.name[lang],
    lines: rosary.sets.map(s => ({ lead: s.name[lang], rest: daysLabel(s, lang) })),
    prayerLead: rosary.sets.map(s => `${s.name[lang]}: ${daysLabel(s, lang)}`).join(" · "), site: SITE_LABEL
  };
  const hash = crypto.createHash("sha256")
    .update(JSON.stringify({ v: TEMPLATE_VERSION, layout: ROSARY_LAYOUT, ...fields }))
    .digest("hex").slice(0, 8);
  return { ...fields, slug: set ? set.slug[lang] : ROSARY_SLUG[lang], hash };
}

/** The card for a page slug ("01-stand", a prayer's "padre-nuestro", a set's "gozosos"), or null. */
function cardForSlug(lang, trackId, slug) {
  if (trackId === ROSARY_TRACK) {
    if (!LANGS.includes(lang)) return null;
    if (slug === ROSARY_SLUG[lang]) return rosaryCardFor(lang);
    const set = rosary.sets.find(s => s.slug[lang] === slug);
    return set ? rosaryCardFor(lang, set.id) : null;
  }
  if (trackId === PRAYER_TRACK) {
    const item = LANGS.includes(lang) && prayerBook.prayerForSlug(lang, slug);
    return item ? prayerCardFor(lang, item.id) : null;
  }
  const track = trackFor(lang, trackId);
  if (!track) return null;
  const day = track.days.findIndex((_, i) => slugOf(track, i) === slug);
  return day === -1 ? null : cardFor(lang, trackId, day);
}

/** Site-relative address of a card in one format. */
const cardPath = (card, format) => `/cards/${card.lang}/${card.track}/${card.slug}.${card.hash}.${format}.png`;
/** The address that always redirects to a day's current card. */
const latestCardPath = (lang, trackId, slug, format) => `/cards/${lang}/${trackId}/${slug}.latest.${format}.png`;

/**
 * Parse a card address back into its parts, or null when it is not one.
 * Only lower-case slugs, an 8-hex hash (or "latest") and a known format are
 * accepted, so nothing else can reach the renderer. "latest" never matches a
 * hash, so it always redirects to the current card: the app uses it, since
 * it has the day but not the hash.
 */
function parseCardFile(lang, trackId, file) {
  const m = /^([a-z0-9-]{1,80})\.([0-9a-f]{8}|latest)\.(post|og)\.png$/.exec(String(file || ""));
  if (!m || !LANGS.includes(lang) || !/^[a-z0-9-]{1,40}$/.test(String(trackId || ""))) return null;
  return { lang, track: trackId, slug: m[1], hash: m[2], format: m[3] };
}

/** Every day's card, then every prayer's, for the tests and for warming the cache after a deploy. */
function allCards() {
  const out = [];
  for (const lang of LANGS) for (const id of Object.keys(tracks)) {
    const track = trackFor(lang, id);
    if (track) for (let i = 0; i < track.days.length; i++) out.push(cardFor(lang, id, i));
  }
  for (const lang of LANGS) for (const item of prayerBook.prayers()) out.push(prayerCardFor(lang, item.id));
  for (const lang of LANGS) {
    out.push(rosaryCardFor(lang));
    for (const set of rosary.sets) out.push(rosaryCardFor(lang, set.id));
  }
  return out;
}

module.exports = { TEMPLATE_VERSION, FORMATS, TEXT_BUDGET, PRAYER_BUDGET, PRAYER_TRACK, ROSARY_TRACK, ROSARY_SLUG, SITE_LABEL, cardFor, prayerCardFor, rosaryCardFor, cardForSlug, cardPath, latestCardPath, parseCardFile, allCards, firstSentence, openingOf };
