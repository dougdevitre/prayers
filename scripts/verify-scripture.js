// Checks every scripture excerpt in the app against the World English Bible.
//
//   npm run verify:scripture
//
// Why this exists: the 30-day journey and the two fear tracks used to carry
// excerpts that read as NIV, which is not licensed for redistribution. They
// were replaced with the public-domain WEB. That is only worth anything if it
// stays true, and "I checked it once" is not a control — so the source text
// lives in scripts/web-source.json and this compares against it.
//
// The fixture is the WEB text for every reference the app cites, extracted
// from the `world-english-bible` npm package (which packages ebible.org's
// text). It is committed rather than installed: 20 KB of public-domain verse
// beats an 11 MB dependency whose own package.json says "UNLICENSED", which
// would be an odd thing to add in a change about licensing hygiene.
//
// Two documented changes are applied to the WEB text before comparing, and
// nothing else is permitted:
//   Yahweh       -> the LORD     (the WEB's divine name is unusual for a
//                                 general devotional audience)
//   utility belt -> belt         (Ephesians 6:14, a WEB quirk)

const fs = require("fs");
const path = require("path");
const { tracks } = require("../content.js");

const SOURCE = JSON.parse(fs.readFileSync(path.join(__dirname, "web-source.json"), "utf8"));
const MODERNIZE = t => t.replace(/Yahweh/g, "the LORD").replace(/utility belt/g, "belt");
const norm = t => t.replace(/\s+/g, " ").trim().toLowerCase();

// The SOS verses live in app.js rather than content.js, so they are read out
// of the source. They were the easiest four to miss and carried the same
// unlicensed text as the day pages.
function sosVerses() {
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const block = src.slice(src.indexOf("const sosSets = ["));
  return [...block.slice(0, block.indexOf("\n];")).matchAll(/\{ ref: "([^"]+)", verse: "([^"]+)"/g)]
    .map(m => ({ ref: m[1], verse: m[2], label: `sos ${m[1]}` }));
}

// Courage-story excerpts are condensed rather than quoted: they drop clauses
// and in places use wording from outside the WEB ("perishing" for Mark 4:38's
// "dying"). The underlying text is public domain either way, so this is a
// labelling question, not a licensing one — but they are not quotations and
// this reports them separately rather than pretending otherwise.
const ADAPTED_GROUP = "COURAGE STORIES";

const gated = [], adapted = [];
for (const track of Object.values(tracks)) {
  track.days.forEach((d, i) => {
    const row = { ref: d[1], verse: d[2], label: `${track.id} day ${i + 1}` };
    (track.group === ADAPTED_GROUP ? adapted : gated).push(row);
  });
}
gated.push(...sosVerses());

function classify({ ref, verse }) {
  const source = SOURCE[ref];
  if (!source) return "no-source";
  const hay = norm(MODERNIZE(source));
  const needle = norm(verse);
  if (hay.includes(needle)) return "verbatim";
  if (hay.includes(needle.replace(/[.?!]$/, ""))) return "punctuation";
  return "not-in-source";
}

let failures = 0, verbatim = 0, punctuation = 0;
for (const row of gated) {
  const verdict = classify(row);
  if (verdict === "verbatim") verbatim++;
  else if (verdict === "punctuation") punctuation++;
  else {
    failures++;
    console.error(`FAIL ${row.label} (${row.ref}) — ${verdict}`);
    console.error(`     app: ${row.verse}`);
    console.error(`     WEB: ${SOURCE[row.ref] ? MODERNIZE(SOURCE[row.ref]) : "(reference not in web-source.json)"}`);
  }
}

const adaptedNotInSource = adapted.filter(r => classify(r) === "not-in-source").length;

if (failures) {
  console.error(`\n✗ ${failures} of ${gated.length} quoted excerpts are not drawn from the WEB text.`);
  process.exit(1);
}
console.log(`✓ scripture verified — ${gated.length} quoted excerpts all drawn from the World English Bible ` +
            `(${verbatim} verbatim, ${punctuation} differing only in trailing punctuation)`);
console.log(`  ${adapted.length} courage-story excerpts are condensed paraphrases and are not gated here; ` +
            `${adaptedNotInSource} of them are not WEB substrings. Public domain either way — see the content note in README.md.`);
