// Tests for scripts/share-links.js: the intent URLs baked into every day
// page, and the caption limit for X.
//
//   npm run test:unit

const assert = require("assert");
const { shareLinks, truncate, X_TEXT_LIMIT } = require("../scripts/share-links.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const page = {
  url: "https://prayers.dougdevitre.org/day/01-stand",
  title: "Day 1: Stand — Stand",
  text: "“Be strong in the Lord, and in the strength of his might.” — Ephesians 6:10–13"
};

test("each platform gets a plain intent URL with the page link and caption", () => {
  const l = shareLinks(page);
  assert.strictEqual(l.facebook, "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fprayers.dougdevitre.org%2Fday%2F01-stand");
  assert.ok(l.x.startsWith("https://twitter.com/intent/tweet?text="));
  assert.ok(l.x.endsWith("&url=https%3A%2F%2Fprayers.dougdevitre.org%2Fday%2F01-stand"));
  assert.ok(l.whatsapp.startsWith("https://wa.me/?text="));
  assert.ok(l.email.startsWith("mailto:?subject=Day%201%3A%20Stand%20%E2%80%94%20Stand&body="));
  // Decoded, each carries the caption and the link intact.
  const q = (u, k) => new URL(u).searchParams.get(k);
  assert.strictEqual(q(l.x, "text"), page.text);
  assert.strictEqual(q(l.x, "url"), page.url);
  assert.strictEqual(q(l.whatsapp, "text"), `${page.text} ${page.url}`);
  assert.strictEqual(decodeURIComponent(l.email.split("&body=")[1]), `${page.text}\n${page.url}`);
});

test("Spanish punctuation and accents survive the round trip", () => {
  const es = { url: "https://prayers.dougdevitre.org/es/day/01-firmeza", title: "Día 1: Firmeza — Stand", text: "“¿Por qué te abates, alma mía?” — Salmo 42:11" };
  const l = shareLinks(es);
  const q = (u, k) => new URL(u).searchParams.get(k);
  assert.strictEqual(q(l.x, "text"), es.text);
  assert.strictEqual(q(l.whatsapp, "text"), `${es.text} ${es.url}`);
  assert.ok(l.email.includes(encodeURIComponent("Día 1: Firmeza — Stand")));
  // Nothing an HTML attribute could choke on is left unencoded.
  for (const u of Object.values(l)) assert.ok(!/["<>\s]/.test(u), u);
});

test("a long verse is cut for X at a word boundary with an ellipsis, elsewhere kept whole", () => {
  const long = "word ".repeat(80).trim();
  const l = shareLinks({ ...page, text: long });
  const q = (u, k) => new URL(u).searchParams.get(k);
  const x = q(l.x, "text");
  assert.ok(x.length <= X_TEXT_LIMIT, `${x.length} chars`);
  assert.ok(x.endsWith("…") && !x.endsWith(" …"));
  assert.strictEqual(q(l.whatsapp, "text"), `${long} ${page.url}`);
  assert.strictEqual(truncate("short"), "short");
  assert.strictEqual(truncate("abcdefghij", 6), "abcde…");
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll share link tests passed.");
