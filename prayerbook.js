// The Prayer Book: how the traditional prayers are arranged and addressed as
// pages, shared by the page generator, the share cards and the tests.
//
// Presentation only. The prayers' words live in prayers.js, which is kept in
// step with REMAM (scripts/remam-sync.js), and the section names and notes are
// its meta.traditionLabels and meta.traditionNotes, so nothing devotional is
// written here and nothing here can drift from what the app shows.
//
//   /prayers                    /es/oraciones                the whole book
//   /prayers/catholic           /es/oraciones/catolicas      Roman Catholic prayers
//   /prayers/our-father         /es/oraciones/padre-nuestro  one prayer
//
// English slugs are the prayer ids. Spanish slugs are the Spanish names with
// accents folded to ASCII, the way the Spanish day pages are named.
//
// A browser global and a CommonJS module, like prayers.js.

(function (root) {
  const corpus = typeof module !== "undefined" && module.exports
    ? require("./prayers.js").prayerCorpus
    : root.prayerCorpus;

  // The order the app lists them in (meta.traditionLabels): the prayers shared
  // across the wider Christian tradition, then the Roman Catholic ones, each
  // in corpus order.
  const SECTIONS = Object.keys(corpus.meta.traditionLabels)
    .filter(t => corpus.traditional.some(p => p.tradition === t));

  const BASE = { en: "/prayers", es: "/es/oraciones" };
  // Only the Roman Catholic prayers have a page of their own; the shared
  // prayers are the book's first section.
  const SECTION_SLUGS = { "roman-catholic": { en: "catholic", es: "catolicas" } };

  const ES_SLUGS = {
    "sign-of-the-cross": "senal-de-la-cruz",
    "our-father": "padre-nuestro",
    "hail-mary": "ave-maria",
    "glory-be": "gloria",
    "apostles-creed": "credo",
    "hail-holy-queen": "salve",
    "act-of-contrition": "acto-de-contricion",
    "angelus": "angelus",
    "memorare": "memorare",
    "st-michael": "san-miguel-arcangel",
    "prayer-of-st-francis": "oracion-de-san-francisco",
    "come-holy-spirit": "ven-espiritu-santo",
    "grace-before-meals": "bendicion-de-la-mesa"
  };

  /** Every prayer in book order: each section's, in corpus order. */
  const prayers = () => SECTIONS.flatMap(t => corpus.traditional.filter(p => p.tradition === t));

  const byId = id => corpus.traditional.find(p => p.id === id) || null;

  /** A prayer's page slug in one language, or null. */
  function prayerSlug(lang, id) {
    if (!byId(id) || !BASE[lang]) return null;
    return lang === "en" ? id : (ES_SLUGS[id] || null);
  }

  /** The prayer a page slug names, or null. */
  function prayerForSlug(lang, slug) {
    return prayers().find(p => prayerSlug(lang, p.id) === slug) || null;
  }

  const bookPath = lang => BASE[lang];
  const prayerPath = (lang, id) => `${BASE[lang]}/${prayerSlug(lang, id)}`;
  /** The page a section is listed on: its own page, or an anchor in the book. */
  const sectionPath = (lang, tradition) => SECTION_SLUGS[tradition]
    ? `${BASE[lang]}/${SECTION_SLUGS[tradition][lang]}`
    : `${BASE[lang]}#${tradition}`;

  const prayerBook = {
    sections: SECTIONS, sectionSlugs: SECTION_SLUGS,
    prayers, byId, prayerSlug, prayerForSlug, bookPath, prayerPath, sectionPath,
    label: (tradition, lang) => corpus.meta.traditionLabels[tradition][lang],
    note: (tradition, lang) => corpus.meta.traditionNotes[tradition][lang]
  };

  if (typeof module !== "undefined" && module.exports) module.exports = { prayerBook };
  else root.prayerBook = prayerBook;
})(typeof window !== "undefined" ? window : globalThis);
