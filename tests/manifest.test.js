// Tests for manifest.webmanifest: every icon and screenshot it lists exists
// and is the size it claims, and the app's install identity does not move.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.ok(b.subarray(1, 4).toString("latin1") === "PNG", `${file} is not a PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

test("the install identity stays /app, inside the scope", () => {
  // Chrome keyed installed copies on start_url before "id" existed; changing
  // it would make every installed Stand a different app from this one.
  assert.strictEqual(manifest.id, "/app");
  assert.strictEqual(manifest.start_url, "/app");
  assert.ok(manifest.start_url.startsWith(manifest.scope));
});

test("every PNG icon exists at the size it claims", () => {
  for (const icon of manifest.icons.filter(i => i.type === "image/png")) {
    assert.strictEqual(pngSize(icon.src), icon.sizes, icon.src);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "icon.svg")));
});

test("maskable icons at 192 and 512, so Android does not put the icon on a white plate", () => {
  const maskable = manifest.icons.filter(i => i.purpose === "maskable").map(i => i.sizes);
  assert.deepStrictEqual(maskable.sort(), ["192x192", "512x512"]);
});

test("the maskable icon is full-bleed: its corners are the background colour, not transparent", () => {
  // Byte 25 is the colour type; 2 is RGB with no alpha channel at all.
  const b = fs.readFileSync(path.join(ROOT, "icon-maskable-512.png"));
  assert.strictEqual(b[25], 2);
});

test("screenshots exist at their stated sizes, labelled, with phone and desktop shapes", () => {
  assert.ok(manifest.screenshots.length >= 2);
  for (const s of manifest.screenshots) {
    assert.strictEqual(pngSize(s.src), s.sizes, s.src);
    assert.ok(s.label && s.label.length > 10, `${s.src} needs a label`);
    const [w, h] = s.sizes.split("x").map(Number);
    // Chrome ignores screenshots outside 320–3840 px or longer than 2.3:1.
    assert.ok(Math.min(w, h) >= 320 && Math.max(w, h) <= 3840, `${s.src} ${s.sizes}`);
    assert.ok(Math.max(w, h) / Math.min(w, h) <= 2.3, `${s.src} aspect`);
    assert.strictEqual(s.form_factor === "wide", w > h, `${s.src} form_factor`);
  }
  assert.ok(manifest.screenshots.some(s => s.form_factor === "narrow"));
  assert.ok(manifest.screenshots.some(s => s.form_factor === "wide"));
});

test("shortcut icons exist", () => {
  for (const sc of manifest.shortcuts) for (const icon of sc.icons) assert.strictEqual(pngSize(icon.src), icon.sizes);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll manifest tests passed.");
