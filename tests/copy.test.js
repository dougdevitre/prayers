// The copy guard: the words readers see follow one glossary, in both
// languages, and the punctuation stays typographic. It reads the interface
// tables (ui.js, the composer's in prayers.js), the hand-written pages, and
// the visible text of every generated page.
//
// Narrated text (the days, SOS sets, prayers and mysteries) is left out on
// purpose: a change there changes its recording, so it is edited with the
// audio, never by a copy sweep. That is also why the generated pages are
// checked only for words the content never uses.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { appUi } = require("../ui.js");
const { prayerUi } = require("../prayers.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

// Every string in a table, flattened, as "lang key: value".
function strings(table, lang) {
  const out = [];
  const walk = (value, key) => {
    if (typeof value === "string") out.push([`${lang} ${key}`, value]);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, key ? `${key}.${k}` : k);
  };
  walk(table, "");
  return out;
}
const ui = lang => [...strings(appUi[lang], lang), ...strings(prayerUi[lang], lang)];

// What a reader sees or hears from a page: its text, and the alt, title,
// aria-label and placeholder attributes, without scripts or styles.
function visibleText(html) {
  const attrs = [...html.matchAll(/\s(?:alt|title|aria-label|placeholder)="([^"]*)"/g)].map(m => m[1]);
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ").replace(/<head>[\s\S]*?<\/head>/, " ")
    .replace(/<[^>]+>/g, " ");
  return [body, ...attrs].join("\n").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#39;/g, "'");
}
const HAND_WRITTEN = ["index.html", "es/index.html", "app/index.html"];
const pages = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean)
  .filter(f => !f.startsWith(".review/"));
const text = Object.fromEntries(pages.map(f => [f, visibleText(fs.readFileSync(path.join(ROOT, f), "utf8"))]));

// Each rule names the words it retires and what to write instead.
const INTERFACE_RULES = {
  en: [
    [/\b(track|tracks|path)\b/i, "a journey, not a track or path"],
    [/\bSOS\b/, "“Steady me now”, not SOS"],
    [/\bprayer book\b/, "the Prayer Book, capitalized"],
    [/\bimage\b/i, "a card, not an image"],
    [/\breflections?\b/i, "Notes are what the reader writes; the Reflection is the day’s text"]
  ],
  es: [
    [/\bSOS\b/, "«Calma ahora», not SOS"],
    [/\bdevocionario\b/, "el Devocionario, capitalized"],
    [/\bimagen\b/i, "una tarjeta, not una imagen"],
    [/acompañad[oa]/i, "“Rezar con el audio”: “acompañado” is masculine"],
    [/Santo Rosario/, "el Rosario; “El Santo Rosario” only in titles"],
    [/reflexiones/i, "las notas son lo que escribe quien lee; la Reflexión es el texto del día"]
  ]
};
// Keys whose wording is the day's own text, not the reader's.
const KEEP = new Set(["en section.reflection", "es section.reflection", "en welcome.body", "es welcome.body"]);

test("the interface follows the glossary in English and Spanish", () => {
  const bad = [];
  for (const lang of ["en", "es"]) {
    for (const [key, value] of ui(lang)) {
      if (KEEP.has(key)) continue;
      for (const [re, why] of INTERFACE_RULES[lang]) {
        if (re.test(value.replace(/\{\w+\}/g, ""))) bad.push(`${key}: “${value}” — ${why}`);
      }
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("the interface uses curly apostrophes, a real ellipsis and US spelling", () => {
  const bad = [];
  for (const lang of ["en", "es"]) {
    for (const [key, value] of ui(lang)) {
      if (/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(value)) bad.push(`${key}: straight apostrophe in “${value}”`);
      if (/\.\.\./.test(value)) bad.push(`${key}: “...” in “${value}” (use …)`);
      if (lang === "en" && /favourite|armour|colour|honour|centre/i.test(value)) bad.push(`${key}: UK spelling in “${value}”`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("Spanish buttons and menus use the infinitive", () => {
  // Commands belong in sentences ("Abre la app: …"); a control names what it does.
  const commands = /^(Empieza|Abre|Reza|Ora|Lee|Léelas|Descarga|Guarda|Comparte|Escucha)\b/;
  const controls = ui("es").filter(([key]) => /\.(fears|fromComposer|entryTitle|again|toBook|share|saveCard|download|button|listen|copy|close)$/.test(key));
  const bad = controls.filter(([, value]) => commands.test(value.replace(/^[▶■←→ ]+/, ""))).map(([key, value]) => `${key}: “${value}”`);
  assert.deepStrictEqual(bad, []);
});

test("the hand-written pages use curly apostrophes, US spelling and the glossary", () => {
  const bad = [];
  for (const file of HAND_WRITTEN) {
    const t = text[file];
    for (const m of t.matchAll(/\S*[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]\S*/g)) bad.push(`${file}: straight apostrophe in “${m[0]}”`);
    for (const m of t.matchAll(/\S*(favourite|armour|\.\.\.)\S*/gi)) bad.push(`${file}: “${m[0]}”`);
    for (const m of t.matchAll(/\b(tracks?|SOS|rezado acompañado|Empieza por un miedo)\b/g)) bad.push(`${file}: “${m[0]}”`);
  }
  assert.deepStrictEqual(bad, []);
});

test("no page says SOS, image or imagen, or miscounts the mysteries", () => {
  const bad = [];
  for (const [file, t] of Object.entries(text)) {
    for (const m of t.matchAll(/\bSOS\b|\bimage\b|\bimagen\b|cuatro misterios|Empieza por un miedo/gi)) bad.push(`${file}: “${m[0]}”`);
  }
  assert.deepStrictEqual(bad.slice(0, 10), [], `${bad.length} found`);
});

test("the guard itself catches what it retires", () => {
  // A rule that matched nothing would pass forever; each is shown a violation.
  const hits = (lang, s) => INTERFACE_RULES[lang].some(([re]) => re.test(s));
  for (const s of ["Choose your path", "A five-day track", "The SOS screen", "Share image", "My reflections"]) assert.ok(hits("en", s), s);
  for (const s of ["Rezar acompañado", "El Santo Rosario", "Abrir el devocionario", "Compartir imagen", "Mis reflexiones"]) assert.ok(hits("es", s), s);
  assert.ok(visibleText('<p>Don\'t</p><img alt="x">').includes("Don't"));
  assert.ok(!visibleText("<script>var sos = 'SOS'</script><p>ok</p>").includes("SOS"));
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll copy tests passed.");
