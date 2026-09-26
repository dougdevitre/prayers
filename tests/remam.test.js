// Tests for scripts/remam-sync.js: the traditional prayers stay tied to
// REMAM's corpus, and every difference from it is either synced or recorded.
//
//   npm run test:unit
//
// No REMAM checkout is needed: the upstream corpus is rebuilt from Stand's own
// prayers in REMAM's shape, which is exact while the lock has no overrides.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { FIELDS, hash, remamHashes, checkLock, syncFrom, recordOverride, writeTraditional } = require("../scripts/remam-sync.js");
const { prayerCorpus } = require("../prayers.js");
const LOCK = require("../scripts/remam-lock.json");

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const copy = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const stand = () => copy(prayerCorpus.traditional);
/** Stand's prayers in REMAM's item shape ({ id, name, es, en, audio }). */
const remamFrom = traditional => ({
  modes: { prayer: {} },
  traditional: { items: traditional.map(t => ({ id: t.id, name: copy(t.name), es: t.text.es, en: t.text.en, audio: copy(t.audio) })) }
});
const lockFor = (remam, extra = {}) => ({ repo: "dougdevitre/remam", path: "p.json", commit: "a".repeat(40), traditional: remamHashes(remam), modes: hash(remam.modes), overrides: [], standOnly: [], ...extra });

test("the committed lock matches prayers.js, and names a full REMAM commit", () => {
  assert.deepStrictEqual(checkLock(prayerCorpus.traditional, LOCK), []);
  assert.match(LOCK.commit, /^[0-9a-f]{40}$/);
  assert.strictEqual(LOCK.path, "packages/data/content/prayers.json");
  assert.deepStrictEqual(Object.keys(LOCK.traditional).sort(), prayerCorpus.traditional.map(t => t.id).sort());
  for (const fields of Object.values(LOCK.traditional)) assert.deepStrictEqual(Object.keys(fields), FIELDS);
});

test("the hash ignores key order but not wording, punctuation or pacing", () => {
  assert.strictEqual(hash({ a: 1, b: { c: 2, d: 3 } }), hash({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notStrictEqual(hash("bendita tú eres"), hash("bendita Tú eres"));
  assert.notStrictEqual(hash("Ángel, del Señor"), hash("Ángel del Señor"));
  assert.notStrictEqual(hash({ breaks: { es: [{ after: "a", seconds: 1 }] } }), hash({ breaks: { es: [{ after: "a", seconds: 1.5 }] } }));
});

test("an edit to a prayer fails the check, naming the prayer and field", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  mine.find(t => t.id === "hail-mary").text.es = mine.find(t => t.id === "hail-mary").text.es.replace("Bendita", "Bendita, bendita");
  mine.find(t => t.id === "memorare").audio.speed = 0.9;
  const problems = checkLock(mine, lock);
  assert.strictEqual(problems.length, 2, problems.join("\n"));
  assert.match(problems[0], /^hail-mary text\.es: differs from REMAM aaaaaaa/);
  assert.match(problems[1], /^memorare audio: differs/);
});

test("a recorded override explains a difference, until the text moves again or REMAM catches up", () => {
  const original = stand();
  const remam = remamFrom(original);
  const mine = stand();
  const hail = mine.find(t => t.id === "hail-mary");
  hail.text.es = "Dios te salve, María. Amén.";
  let lock = recordOverride(mine, lockFor(remam), "hail-mary", "text.es", "Stand's reviewer asked for this");
  assert.deepStrictEqual(checkLock(mine, lock), []);
  assert.strictEqual(lock.overrides[0].reason, "Stand's reviewer asked for this");
  hail.text.es = "Dios te salve, María, llena de gracia. Amén.";
  assert.match(checkLock(mine, lock)[0], /changed since its override was recorded/);
  hail.text.es = original.find(t => t.id === "hail-mary").text.es;
  assert.match(checkLock(mine, lock)[0], /matches REMAM aaaaaaa again; remove its override/);
});

test("overrides need a reason, a known prayer and a real difference", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  assert.throws(() => recordOverride(mine, lock, "hail-mary", "text.es", "why"), /matches REMAM/);
  mine[0].text.en += " Amen.";
  assert.throws(() => recordOverride(mine, lock, mine[0].id, "text.en", "  "), /give a reason/);
  assert.throws(() => recordOverride(mine, lock, "nope", "text.en", "why"), /no traditional prayer/);
  assert.throws(() => recordOverride(mine, lock, mine[0].id, "tradition", "why"), /field must be one of/);
  const bad = { ...lock, overrides: [{ id: mine[0].id, field: "text.en", stand: hash(mine[0].text.en), reason: "" }] };
  assert.ok(checkLock(mine, bad).some(p => /give a reason/.test(p)));
});

test("a prayer only in Stand, or missing from Stand, fails unless listed", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  const extra = { ...copy(mine[0]), id: "prayer-for-courage" };
  assert.match(checkLock([...mine, extra], lock)[0], /^prayer-for-courage: not in REMAM/);
  assert.deepStrictEqual(checkLock([...mine, extra], { ...lock, standOnly: [{ id: "prayer-for-courage", reason: "Stand's own" }] }), []);
  assert.match(checkLock(mine.slice(1), lock)[0], new RegExp(`^${mine[0].id}: in REMAM aaaaaaa but not in prayers.js`));
});

test("sync applies an upstream fix, moves the lock, and leaves a clean check", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  const next = remamFrom(mine);
  const angelus = next.traditional.items.find(i => i.id === "angelus");
  angelus.es = angelus.es.replace("Ángel", "ángel");
  next.modes = { prayer: { changed: true } };
  next.traditional.items.push({ id: "te-deum", name: { es: "Te Deum", en: "Te Deum" }, es: "A ti, oh Dios.", en: "We praise thee, O God.", audio: {} });
  const dry = syncFrom(next, "b".repeat(40), mine, lock);
  assert.deepStrictEqual(dry.report.changed, [{ id: "angelus", field: "text.es" }]);
  assert.deepStrictEqual(dry.report.applied, [{ id: "angelus", field: "text.es" }]);
  assert.deepStrictEqual(dry.report.newUpstream, ["te-deum"]);
  assert.strictEqual(dry.report.modesChanged, true);
  assert.strictEqual(dry.lock, lock, "a dry run changes nothing");
  assert.strictEqual(mine.find(t => t.id === "angelus").text.es, prayerCorpus.traditional.find(t => t.id === "angelus").text.es);

  // REMAM writes es before en; a synced field keeps prayers.js's own key order.
  const memorare = next.traditional.items.find(i => i.id === "memorare");
  memorare.audio = { breaks: { es: memorare.audio.breaks.es, en: memorare.audio.breaks.en }, style: memorare.audio.style, stability: memorare.audio.stability, speed: 0.84 };
  const { lock: moved } = syncFrom(next, "b".repeat(40), mine, lock, { write: true });
  assert.strictEqual(mine.find(t => t.id === "angelus").text.es, angelus.es);
  const synced = mine.find(t => t.id === "memorare").audio;
  assert.strictEqual(synced.speed, 0.84);
  assert.deepStrictEqual([Object.keys(synced), Object.keys(synced.breaks)], [["speed", "stability", "style", "breaks"], ["en", "es"]]);
  assert.strictEqual(moved.commit, "b".repeat(40));
  assert.ok(!moved.traditional["te-deum"], "a new upstream prayer is not imported");
  assert.deepStrictEqual(checkLock(mine, moved), []);
});

test("sync refuses to overwrite an overridden field, and drops the override once REMAM adopts it", () => {
  const mine = stand();
  let lock = lockFor(remamFrom(mine));
  const memorare = mine.find(t => t.id === "memorare");
  memorare.name.es = "Memorare (Acuérdate)";
  lock = recordOverride(mine, lock, "memorare", "name.es", "pending REMAM PR");

  const other = remamFrom(stand());
  other.traditional.items.find(i => i.id === "memorare").name.es = "Memorare";
  const clash = syncFrom(other, "c".repeat(40), mine, lock, { write: true });
  assert.strictEqual(clash.refused, "conflicts");
  assert.deepStrictEqual(clash.report.conflicts.map(c => c.id + " " + c.field), ["memorare name.es"]);
  assert.strictEqual(memorare.name.es, "Memorare (Acuérdate)");

  const adopted = remamFrom(stand());
  adopted.traditional.items.find(i => i.id === "memorare").name.es = "Memorare (Acuérdate)";
  const { report, lock: moved } = syncFrom(adopted, "d".repeat(40), mine, lock, { write: true });
  assert.deepStrictEqual(report.conflicts, []);
  assert.deepStrictEqual(moved.overrides, []);
  assert.deepStrictEqual(checkLock(mine, moved), []);
});

test("sync treats the same fix made in both places as already applied", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  mine.find(t => t.id === "glory-be").text.en += " ";
  const next = remamFrom(mine);
  const { report, lock: moved } = syncFrom(next, "f".repeat(40), mine, lock, { write: true });
  assert.deepStrictEqual([report.applied, report.conflicts], [[], []]);
  assert.deepStrictEqual(report.changed, [{ id: "glory-be", field: "text.en" }]);
  assert.deepStrictEqual(checkLock(mine, moved), []);
});

test("sync reports a prayer REMAM removed, and never deletes it from Stand", () => {
  const mine = stand();
  const lock = lockFor(remamFrom(mine));
  const next = remamFrom(mine);
  next.traditional.items = next.traditional.items.filter(i => i.id !== "st-michael");
  const { report } = syncFrom(next, "e".repeat(40), mine, lock, { write: true });
  assert.deepStrictEqual(report.goneUpstream, ["st-michael"]);
  assert.ok(mine.some(t => t.id === "st-michael"));
});

test("rewriting the traditional prayers in prayers.js changes only what changed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remam-"));
  const file = path.join(dir, "prayers.js");
  const src = fs.readFileSync(path.join(__dirname, "..", "prayers.js"), "utf8");
  fs.writeFileSync(file, src);
  const mine = stand();
  writeTraditional(mine, file);
  assert.strictEqual(fs.readFileSync(file, "utf8"), src, "an unchanged corpus is written back byte for byte");
  mine.find(t => t.id === "angelus").text.es = "Cambiado.";
  writeTraditional(mine, file);
  const out = fs.readFileSync(file, "utf8");
  const changed = out.split("\n").filter((line, i) => line !== src.split("\n")[i]);
  assert.deepStrictEqual(changed, ['        "es": "Cambiado."']);
  delete require.cache[require.resolve(file)];
  assert.strictEqual(require(file).prayerCorpus.traditional.find(t => t.id === "angelus").text.es, "Cambiado.");
  fs.rmSync(dir, { recursive: true, force: true });
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll REMAM sync tests passed.");
