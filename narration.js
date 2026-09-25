// Narration scripts: the words a listener hears, whether from a recording
// rendered ahead of time (scripts/build-audio.js) or from the device's own
// text-to-speech. One builder serves both, so the fallback never says
// something different from the recording.
//
// The formatting is for a reader, human or synthetic: one beat per line,
// section names on their own line, breath pauses written as ellipses, and
// scripture references spelled out ("chapter six, verses ten through
// thirteen") because "6:10" otherwise reads as a time of day. Nothing here
// touches the DOM or storage; content and language are arguments.
//
// Shared the way content.js is: globals in the browser, CommonJS in Node.

const NARRATION_FRAMES = {
  en: {
    day: "Day {n}.",
    scripture: "Scripture...",
    breathe: "... Pause, and breathe in slowly... Breathe out... Let your shoulders soften.",
    reflection: "Reflection.",
    prayer: "Prayer.",
    amen: "Amen.",
    declaration: "Declaration.",
    practice: "Today's practice.",
    blessing: "Closing blessing.",
    blessingText: "May truth steady your mind, peace guard your heart, courage guide your next step, and grace carry what you cannot... Go in peace.",
    chapter: "chapter",
    verse: "verse",
    verses: "verses",
    through: "through",
    psalm: "Psalm",
    ordinals: ["First", "Second", "Third"]
  },
  es: {
    day: "Día {n}.",
    scripture: "Escritura...",
    breathe: "... Haz una pausa, e inhala despacio... Exhala... Deja que tus hombros se suelten.",
    reflection: "Reflexión.",
    prayer: "Oración.",
    amen: "Amén.",
    declaration: "Declaración.",
    practice: "Práctica de hoy.",
    blessing: "Bendición final.",
    blessingText: "Que la verdad afirme tu mente, que la paz guarde tu corazón, que el valor guíe tu próximo paso, y que la gracia lleve lo que tú no puedes... Ve en paz.",
    chapter: "capítulo",
    verse: "versículo",
    verses: "versículos",
    through: "al",
    psalm: "Salmo",
    ordinals: ["Primera de", "Segunda de", "Tercera de"]
  }
};

const EN_SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ES_SMALL = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const ES_TENS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const ES_HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

/** A whole number from 0 to 999 in words, for the language. */
function numberWords(n, lang) {
  n = Math.trunc(Number(n));
  if (!Number.isFinite(n) || n < 0 || n > 999) return String(n);
  if (lang === "es") {
    if (n === 100) return "cien";
    if (n < 30) return ES_SMALL[n];
    if (n < 100) {
      const tens = ES_TENS[Math.floor(n / 10)];
      return n % 10 ? `${tens} y ${ES_SMALL[n % 10]}` : tens;
    }
    const rest = n % 100;
    return rest ? `${ES_HUNDREDS[Math.floor(n / 100)]} ${numberWords(rest, "es")}` : ES_HUNDREDS[Math.floor(n / 100)];
  }
  if (n < 20) return EN_SMALL[n];
  if (n < 100) {
    const tens = EN_TENS[Math.floor(n / 10)];
    return n % 10 ? `${tens}-${EN_SMALL[n % 10]}` : tens;
  }
  const rest = n % 100;
  return rest ? `${EN_SMALL[Math.floor(n / 100)]} hundred ${numberWords(rest, "en")}` : `${EN_SMALL[Math.floor(n / 100)]} hundred`;
}

/** The regular form of a reference ("1 Samuel 17:16", "Psalm 121:3–4"), or null. */
function parseRef(ref) {
  const m = String(ref).trim().match(/^(?:([1-3])\s+)?(\D+?)\s+(\d+):(\d+)(?:\s*[–-]\s*(\d+))?$/u);
  if (!m) return null;
  return { ordinal: m[1] ? Number(m[1]) : 0, book: m[2].trim(), chapter: Number(m[3]), verse: Number(m[4]), end: m[5] ? Number(m[5]) : null };
}

/**
 * A reference as a reader would say it: "Ephesians 6:10–13" becomes
 * "Ephesians, chapter six, verses ten through thirteen"; "Psalm 4:8" becomes
 * "Psalm four, verse eight" (psalms are numbered, not chaptered); "1 Samuel
 * 17:16" becomes "First Samuel, chapter seventeen, verse sixteen". Anything
 * this does not recognise comes back unchanged.
 */
function spokenRef(ref, lang = "en") {
  const f = NARRATION_FRAMES[lang] || NARRATION_FRAMES.en;
  const r = parseRef(ref);
  if (!r) return String(ref);
  const book = r.ordinal ? `${f.ordinals[r.ordinal - 1]} ${r.book}` : r.book;
  const range = r.end
    ? `${f.verses} ${numberWords(r.verse, lang)} ${f.through} ${numberWords(r.end, lang)}`
    : `${f.verse} ${numberWords(r.verse, lang)}`;
  if (r.book === f.psalm) return `${book} ${numberWords(r.chapter, lang)}, ${range}`;
  return `${book}, ${f.chapter} ${numberWords(r.chapter, lang)}, ${range}`;
}

/** Text as it should be read aloud: the WEB's small-caps "LORD" is spoken
 * "Lord", not spelled out or shouted. The content itself is untouched. */
function spokenText(text) {
  return String(text).replace(/\bLORD\b/g, "Lord").trim();
}

/** A sentence closed with a full stop unless it already ends in punctuation. */
function closed(text) {
  const s = spokenText(text);
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

/** A prayer with "... Amen." landing after its last line. */
function withAmen(text, f) {
  return `${spokenText(text).replace(/\.$/, "")}... ${f.amen}`;
}

/** The narration for one day: [title, ref, verse, reflection, prayer,
 * declaration, practice] at a zero-based index, in the language. */
function dayScript(dayData, index, lang = "en") {
  const f = NARRATION_FRAMES[lang] || NARRATION_FRAMES.en;
  const [title, ref, verse, reflection, prayer, declaration, practice] = dayData;
  return [
    `${f.day.replace("{n}", numberWords(index + 1, lang))} ${closed(title)}`,
    `${f.scripture} ${spokenRef(ref, lang)}.\n"${spokenText(verse)}"`,
    f.breathe,
    `${f.reflection}\n\n${closed(reflection)}`,
    `${f.prayer}\n\n${withAmen(prayer, f)}`,
    `${f.declaration}\n\n${closed(declaration)}`,
    `${f.practice}\n\n${closed(practice)}`,
    `${f.blessing}\n\n${f.blessingText}`
  ].join("\n\n");
}

/** The narration for one SOS set: { ref, verse, prayer, declaration }. */
function sosScript(set, lang = "en") {
  const f = NARRATION_FRAMES[lang] || NARRATION_FRAMES.en;
  return [
    `"${spokenText(set.verse)}"\n... ${spokenRef(set.ref, lang)}.`,
    withAmen(set.prayer, f),
    closed(set.declaration)
  ].join("\n\n");
}

/** The id a recording is filed under: "<lang>/day/<track>/<index>" or "<lang>/sos/<index>". */
function dayItemId(lang, trackId, index) { return `${lang}/day/${trackId}/${index}`; }
function sosItemId(lang, index) { return `${lang}/sos/${index}`; }

/**
 * Every narration item there is, in a stable order, each with the exact text
 * a recording of it must carry. deps: { tracks, esTracks, sosSets, esSos }.
 * Used by the audio build and its verifier; the app itself only ever asks
 * for one day or one SOS set at a time.
 */
function narrationItems(deps) {
  const items = [];
  const byLang = { en: deps.tracks, es: deps.esTracks };
  for (const lang of Object.keys(byLang)) {
    const tracks = byLang[lang] || {};
    for (const [trackId, track] of Object.entries(tracks)) {
      track.days.forEach((d, i) => {
        items.push({ id: dayItemId(lang, trackId, i), lang, kind: "day", track: trackId, index: i, title: d[0], text: dayScript(d, i, lang) });
      });
    }
  }
  const sos = { en: deps.sosSets, es: deps.esSos };
  for (const lang of Object.keys(sos)) {
    (sos[lang] || []).forEach((set, i) => {
      items.push({ id: sosItemId(lang, i), lang, kind: "sos", track: null, index: i, title: set.ref, text: sosScript(set, lang) });
    });
  }
  return items;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { NARRATION_FRAMES, numberWords, parseRef, spokenRef, spokenText, dayScript, sosScript, dayItemId, sosItemId, narrationItems };
}
