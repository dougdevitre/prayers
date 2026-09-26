// Tests for offline-audio.js: which recordings a device keeps for offline
// listening, and how big that is.
//
//   npm run test:unit

const assert = require("assert");
const { OFFLINE_DAYS, offlineIds, offlinePlan, megabytes } = require("../offline-audio.js");
const { audioManifest } = require("../audio-manifest.js");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

test("a week from the current day, then every SOS set in the reader's language", () => {
  const ids = offlineIds({ lang: "en", track: "core", day: 4, days: 30, sosCount: 4 });
  assert.strictEqual(OFFLINE_DAYS, 7);
  assert.deepStrictEqual(ids, [
    "en/day/core/4", "en/day/core/5", "en/day/core/6", "en/day/core/7", "en/day/core/8", "en/day/core/9", "en/day/core/10",
    "en/sos/0", "en/sos/1", "en/sos/2", "en/sos/3"
  ]);
});

test("the window stops at the journey's last day rather than wrapping", () => {
  const ids = offlineIds({ lang: "es", track: "unknown", day: 3, days: 5, sosCount: 4 });
  assert.deepStrictEqual(ids.filter(id => id.includes("/day/")), ["es/day/unknown/3", "es/day/unknown/4"]);
  assert.ok(ids.includes("es/sos/0"));
});

test("the plan keeps only what the manifest has, once per file, with its size", () => {
  const manifest = { version: 1, enabled: true, base: "https://audio.example/", items: {
    "en/day/core/0": { key: "en/day/core/01-stand.aaaaaaaa.mp3", bytes: 1000 },
    "en/day/core/1": { key: "en/day/core/01-stand.aaaaaaaa.mp3", bytes: 1000 },
    "en/sos/0": { key: "en/sos/1-psalm.bbbbbbbb.mp3", bytes: 500 }
  } };
  const plan = offlinePlan(manifest, ["en/day/core/0", "en/day/core/1", "en/day/core/2", "en/sos/0"]);
  assert.deepStrictEqual(plan.keep.map(k => k.url), ["https://audio.example/en/day/core/01-stand.aaaaaaaa.mp3", "https://audio.example/en/sos/1-psalm.bbbbbbbb.mp3"]);
  assert.strictEqual(plan.bytes, 1500);
});

test("a disabled manifest, or one with no host, keeps nothing", () => {
  assert.deepStrictEqual(offlinePlan({ enabled: false, base: "https://a", items: { x: { key: "x.mp3" } } }, ["x"]), { keep: [], bytes: 0 });
  assert.deepStrictEqual(offlinePlan({ enabled: true, base: "", items: { x: { key: "x.mp3" } } }, ["x"]), { keep: [], bytes: 0 });
  assert.deepStrictEqual(offlinePlan(null, ["x"]), { keep: [], bytes: 0 });
});

test("against the committed library: a week of the core journey and the SOS sets is under 10 MB", () => {
  for (const lang of ["en", "es"]) {
    const plan = offlinePlan(audioManifest, offlineIds({ lang, track: "core", day: 0, days: 30, sosCount: 4 }));
    assert.strictEqual(plan.keep.length, 11, `${lang}: ${plan.keep.length} files`);
    assert.ok(plan.bytes > 5 * 1048576 && plan.bytes < 10 * 1048576, `${lang}: ${megabytes(plan.bytes)} MB`);
    assert.ok(plan.keep.every(k => k.url.startsWith(`${audioManifest.base}/${lang}/`)));
  }
  assert.strictEqual(megabytes(8.46 * 1048576), "8.5");
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll offline audio tests passed.");
