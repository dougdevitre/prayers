#!/usr/bin/env node
/* Gates the interface string table in ui.js.
 *
 * The app ships English twice: once as the default text inside
 * app/index.html, and once in ui.js so applyUi() can repaint it after a
 * switch back from Spanish. Two copies of the same string drift, and the
 * drift is invisible in English because the markup wins on first paint.
 * So this checks:
 *
 *   1. en and es carry exactly the same keys, none of them empty
 *   2. both languages use the same {placeholders} for each key
 *   3. every data-i18n* attribute in the markup names a real key
 *   4. the markup's inline English matches ui.js's English, character for
 *      character (after collapsing whitespace and decoding entities)
 *   5. no key is dead — each one is used by the markup or by app.js
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const { appUi } = require(path.join(root, "ui.js"));
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
// reminder.js builds the calendar file and asks for its own strings.
const js = ["app.js", "reminder.js"].map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n");

const problems = [];
const langs = Object.keys(appUi);
const enKeys = Object.keys(appUi.en);

// 1 + 2: parity between the languages.
for (const lang of langs) {
  if (lang === "en") continue;
  for (const key of enKeys) if (!(key in appUi[lang])) problems.push(`${lang} is missing ${key}`);
  for (const key of Object.keys(appUi[lang])) if (!(key in appUi.en)) problems.push(`${lang} has an extra key ${key}`);
}
const vars = v => (String(v).match(/\{[a-zA-Z]+\}/g) || []).sort().join(",");
for (const lang of langs) {
  for (const [key, value] of Object.entries(appUi[lang])) {
    if (typeof value !== "string" || !value.trim()) problems.push(`${lang}.${key} is empty`);
    if (lang !== "en" && key in appUi.en && vars(value) !== vars(appUi.en[key])) {
      problems.push(`${lang}.${key} uses ${vars(value) || "no placeholders"}, English uses ${vars(appUi.en[key]) || "none"}`);
    }
  }
}

// 3 + 4: the markup's annotations, and the English it carries inline.
const decode = s => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const norm = s => decode(s).replace(/\s+/g, " ").trim();

const used = new Set();
for (const attr of ["data-i18n-aria", "data-i18n-placeholder"]) {
  for (const m of html.matchAll(new RegExp(`${attr}="([^"]+)"`, "g"))) {
    used.add(m[1]);
    if (!(m[1] in appUi.en)) problems.push(`markup ${attr}="${m[1]}" has no entry in ui.js`);
  }
}
// Elements whose text content is translated: capture the inline English too.
for (const m of html.matchAll(/<(\w+)([^>]*\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g)) {
  const [, , attrs, key, inner] = m;
  used.add(key);
  if (!(key in appUi.en)) { problems.push(`markup data-i18n="${key}" has no entry in ui.js`); continue; }
  if (/<\w/.test(inner)) { problems.push(`markup data-i18n="${key}" wraps elements; applyUi would delete them`); continue; }
  const n = (attrs.match(/data-i18n-n="([^"]+)"/) || [])[1];
  const expected = n ? appUi.en[key].split("{n}").join(n) : appUi.en[key];
  if (norm(inner) !== norm(expected)) {
    problems.push(`markup and ui.js disagree on ${key}:\n    markup: ${norm(inner)}\n    ui.js:  ${norm(expected)}`);
  }
}

// 5: keys app.js and reminder.js ask for, and keys nobody asks for.
for (const m of js.matchAll(/\bt\(\s*"([^"]+)"/g)) {
  used.add(m[1]);
  if (!(m[1] in appUi.en)) problems.push(`the app calls t("${m[1]}") but ui.js has no such key`);
}
// Keys reached through a variable rather than a literal.
for (const m of js.matchAll(/"((?:sos|audio|notes|day|ledger|library|progress|reminder|backup|journal|share|checkin|section|welcome|install|brand|topbar|erase)\.[a-zA-Z]+)"/g)) used.add(m[1]);
for (const key of enKeys) if (!used.has(key)) problems.push(`${key} is never used — remove it or wire it up`);

if (problems.length) {
  console.error(`verify-ui: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
const counts = langs.map(l => `${l} ${Object.keys(appUi[l]).length}`).join(", ");
console.log(`Interface strings verified — ${counts}; markup and table agree, no dead keys.`);
