// Tests for the narration build: scripts/audio-lib.js (hashes, keys, the
// manifest against the plan), scripts/build-audio.js (against a local stand-in
// for ElevenLabs: rendering, skipping what is fresh, retrying, concurrency,
// resuming) and scripts/verify-audio.js (the CI gate).
//
//   npm run test:unit

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("../scripts/audio-lib.js");
const build = require("../scripts/build-audio.js");
const { verify } = require("../scripts/verify-audio.js");
const { slugify } = require("../logic.js");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const voices = lib.loadVoices();
const items = lib.loadItems();
const MP3 = fs.readFileSync(path.join(__dirname, "fixtures", "silence.mp3"));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "stand-audio-"));
const freshManifest = () => ({ version: 1, enabled: true, base: "", items: {} });
const quiet = () => {};

/** A stand-in ElevenLabs: records requests, can fail a set number of times. */
function fakeApi({ failFirst = 0, status = 429 } = {}) {
  const calls = [];
  let inFlight = 0, peak = 0, fails = failFirst;
  const fetchImpl = async (url, init) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(r => setTimeout(r, 5));
    inFlight--;
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    if (fails > 0) { fails--; return { ok: false, status, text: async () => "slow down" }; }
    return { ok: true, status: 200, arrayBuffer: async () => MP3.buffer.slice(MP3.byteOffset, MP3.byteOffset + MP3.byteLength) };
  };
  return { fetchImpl, calls, peak: () => peak };
}

(async () => {
  await test("the plan covers every day and SOS set with a hash-keyed path", () => {
    const plan = lib.planItems({ items, voices, slugify });
    assert.strictEqual(plan.length, items.length);
    const first = plan.find(p => p.item.id === "en/day/core/0");
    assert.match(first.key, /^en\/day\/core\/01-stand\.[0-9a-f]{8}\.mp3$/);
    assert.strictEqual(first.key.slice(-12, -4), first.hash.slice(0, 8));
    const sos = plan.find(p => p.item.id === "es/sos/0");
    assert.match(sos.key, /^es\/sos\/1-salmo-27-1\.[0-9a-f]{8}\.mp3$/);
    assert.strictEqual(new Set(plan.map(p => p.key)).size, plan.length, "keys are unique");
    assert.strictEqual(first.settings.voiceId, voices.en.voiceId);
    assert.strictEqual(plan.find(p => p.item.id === "es/day/core/0").settings.voiceId, voices.es.voiceId);
  });

  await test("the hash moves with the script and with every setting", () => {
    const settings = lib.settingsFor(voices, items[0]);
    const h = lib.itemHash("a", settings);
    assert.notStrictEqual(lib.itemHash("b", settings), h);
    for (const k of ["voiceId", "model", "stability", "similarity", "style", "speed", "boost", "outputFormat"]) {
      assert.notStrictEqual(lib.itemHash("a", { ...settings, [k]: typeof settings[k] === "number" ? settings[k] + 0.01 : `${settings[k]}x` }), h, `${k} is not in the hash`);
    }
    assert.strictEqual(lib.itemHash("a", { ...settings }), h, "key order does not matter");
  });

  await test("the manifest report tells fresh, stale, orphan and missing apart", () => {
    const plan = lib.planItems({ items, voices, slugify }).slice(0, 3);
    const m = freshManifest();
    m.items[plan[0].item.id] = { key: plan[0].key, hash: plan[0].hash };
    m.items[plan[1].item.id] = { key: plan[1].key.replace(/\.[0-9a-f]{8}\.mp3$/, ".00000000.mp3"), hash: "0".repeat(64) };
    m.items["en/day/nowhere/0"] = { key: "en/day/nowhere/01-x.00000000.mp3", hash: "0".repeat(64) };
    const r = lib.manifestReport(m, plan);
    assert.deepStrictEqual(r.fresh, [plan[0].item.id]);
    assert.deepStrictEqual(r.stale.map(s => s.id), [plan[1].item.id]);
    assert.deepStrictEqual(r.orphan, ["en/day/nowhere/0"]);
    assert.deepStrictEqual(r.missing, [plan[2].item.id]);
    assert.deepStrictEqual(r.problems, []);
  });

  await test("a malformed manifest is named, not trusted", () => {
    const plan = lib.planItems({ items, voices, slugify }).slice(0, 1);
    const bad = { version: 1, enabled: "yes", base: "https://cdn.example.com/", items: { [plan[0].item.id]: { key: "../etc/passwd", hash: "nope" } } };
    const r = lib.manifestReport(bad, plan);
    assert.ok(r.problems.some(p => p.includes("enabled")));
    assert.ok(r.problems.some(p => p.includes("base")));
    assert.ok(r.problems.some(p => p.includes("key is not a recording path")));
    assert.deepStrictEqual(r.fresh, []);
  });

  await test("the written manifest loads as the module the app reads", () => {
    const dir = tmp();
    const file = path.join(dir, "audio-manifest.js");
    const m = freshManifest();
    m.base = "https://audio.example.org";
    m.items["b/sos/0"] = { key: "b/sos/1-x.00000000.mp3", hash: "0".repeat(64), bytes: 1, seconds: 0 };
    m.items["a/sos/0"] = { key: "a/sos/1-x.00000000.mp3", hash: "0".repeat(64), bytes: 1, seconds: 0 };
    lib.writeManifest(m, file);
    const back = lib.readManifest(file);
    assert.strictEqual(back.base, "https://audio.example.org");
    assert.deepStrictEqual(Object.keys(back.items), ["a/sos/0", "b/sos/0"], "sorted for stable diffs");
    assert.ok(fs.readFileSync(file, "utf8").startsWith("// Generated by scripts/build-audio.js"));
    assert.ok(!fs.existsSync(`${file}.${process.pid}.tmp`), "no temp file left behind");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("command-line options parse, and concurrency is capped at 4", () => {
    const o = build.parseArgs(["--only", "en/day/core,es/sos", "--limit", "5", "--dry-run", "--force", "--concurrency", "9", "--out", "x", "--upload", "--bucket", "b", "--base", "https://a.b"]);
    assert.deepStrictEqual(o.only, ["en/day/core", "es/sos"]);
    assert.strictEqual(o.limit, 5);
    assert.ok(o.dryRun && o.force && o.upload);
    assert.strictEqual(o.concurrency, 4);
    assert.strictEqual(o.bucket, "b");
    assert.strictEqual(o.base, "https://a.b");
    assert.throws(() => build.parseArgs(["--what"]), /unknown option/);
  });

  await test("a dry run lists the work and touches nothing", async () => {
    const api = fakeApi();
    const dir = tmp();
    const file = path.join(dir, "audio-manifest.js");
    const r = await build.run({ ...build.parseArgs(["--dry-run", "--only", "en/day/core", "--limit", "2"]), out: dir },
      { items, voices, slugify, manifest: freshManifest(), manifestFile: file, fetchImpl: api.fetchImpl, apiKey: "k", log: quiet });
    assert.strictEqual(r.work.length, 2);
    assert.strictEqual(api.calls.length, 0);
    assert.ok(!fs.existsSync(file));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("the build renders, files by key, writes the manifest, and skips what is fresh", async () => {
    const api = fakeApi();
    const dir = tmp();
    const file = path.join(dir, "audio-manifest.js");
    const opts = { ...build.parseArgs(["--only", "en/sos", "--base", "https://audio.example.org"]), out: dir };
    const deps = { items, voices, slugify, manifestFile: file, fetchImpl: api.fetchImpl, apiKey: "k", log: quiet };
    const r = await build.run(opts, { ...deps, manifest: freshManifest() });
    assert.strictEqual(r.rendered.length, 4);
    assert.deepStrictEqual(r.failed, []);
    const m = lib.readManifest(file);
    assert.strictEqual(m.base, "https://audio.example.org");
    assert.strictEqual(Object.keys(m.items).length, 4);
    const entry = m.items["en/sos/0"];
    assert.ok(fs.existsSync(path.join(dir, entry.key)), "file is on disk under its key");
    assert.strictEqual(entry.bytes, MP3.length);
    assert.strictEqual(entry.seconds, 1);
    const call = api.calls[0];
    assert.ok(call.url.startsWith(`https://api.elevenlabs.io/v1/text-to-speech/${voices.en.voiceId}?output_format=mp3_44100_128`));
    assert.strictEqual(call.headers["xi-api-key"], "k");
    assert.strictEqual(call.body.model_id, voices.en.model);
    assert.deepStrictEqual(call.body.voice_settings, { stability: 0.6, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true, speed: 0.9 });
    assert.ok(call.body.text.includes("... Amen."));
    // Second run: nothing to do.
    const again = await build.run(opts, { ...deps, manifest: lib.readManifest(file) });
    assert.strictEqual(again.rendered.length, 0);
    assert.strictEqual(again.skipped, 4);
    assert.strictEqual(api.calls.length, 4);
    // --force renders again, under the same keys.
    const forced = await build.run({ ...opts, force: true }, { ...deps, manifest: lib.readManifest(file) });
    assert.strictEqual(forced.rendered.length, 4);
    assert.strictEqual(lib.readManifest(file).items["en/sos/0"].key, entry.key);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("the verifier passes a fresh manifest and fails a stale one with the re-render command", async () => {
    const api = fakeApi();
    const dir = tmp();
    const file = path.join(dir, "audio-manifest.js");
    await build.run({ ...build.parseArgs(["--only", "es/sos"]), out: dir },
      { items, voices, slugify, manifest: freshManifest(), manifestFile: file, fetchImpl: api.fetchImpl, apiKey: "k", log: quiet });
    const fresh = verify({ manifest: lib.readManifest(file), items, voices, slugify });
    assert.ok(fresh.ok, fresh.lines.join("\n"));
    assert.strictEqual(fresh.report.fresh.length, 4);
    // The content changes under one item.
    const edited = items.map(i => i.id === "es/sos/1" ? { ...i, text: i.text + " (edited)" } : i);
    const stale = verify({ manifest: lib.readManifest(file), items: edited, voices, slugify });
    assert.ok(!stale.ok);
    assert.ok(stale.lines.some(l => l.includes("es/sos/1 is stale")));
    assert.ok(stale.lines.some(l => l.includes("node scripts/build-audio.js --only es/sos/1")));
    // The settings change under every item of a language.
    const retuned = JSON.parse(JSON.stringify(voices)); retuned.es.sos.speed = 0.95;
    assert.strictEqual(verify({ manifest: lib.readManifest(file), items, voices: retuned, slugify }).report.stale.length, 4);
    // A build after the edit renders just the stale one.
    const r = await build.run({ ...build.parseArgs(["--only", "es/sos"]), out: dir },
      { items: edited, voices, slugify, manifest: lib.readManifest(file), manifestFile: file, fetchImpl: api.fetchImpl, apiKey: "k", log: quiet });
    assert.deepStrictEqual(r.rendered, ["es/sos/1"]);
    assert.ok(verify({ manifest: lib.readManifest(file), items: edited, voices, slugify }).ok);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("429s are retried with backoff and a 4xx is not", async () => {
    const sleeps = [];
    const api = fakeApi({ failFirst: 2 });
    const bytes = await build.render("hi", lib.settingsFor(voices, items[0]), { apiKey: "k", fetchImpl: api.fetchImpl, sleep: async ms => sleeps.push(ms) });
    assert.strictEqual(bytes.length, MP3.length);
    assert.deepStrictEqual(sleeps, [1000, 2000]);
    const bad = fakeApi({ failFirst: 1, status: 401 });
    await assert.rejects(build.render("hi", lib.settingsFor(voices, items[0]), { apiKey: "k", fetchImpl: bad.fetchImpl, sleep: async () => {} }), /401/);
    assert.strictEqual(bad.calls.length, 1);
    const never = fakeApi({ failFirst: 99 });
    await assert.rejects(build.render("hi", lib.settingsFor(voices, items[0]), { apiKey: "k", fetchImpl: never.fetchImpl, sleep: async () => {}, attempts: 3 }), /429/);
    assert.strictEqual(never.calls.length, 3);
  });

  await test("a failure leaves the others rendered, the manifest partial, and the exit non-zero", async () => {
    const api = fakeApi({ failFirst: 1, status: 400 });
    const dir = tmp();
    const file = path.join(dir, "audio-manifest.js");
    const r = await build.run({ ...build.parseArgs(["--only", "en/sos", "--concurrency", "1"]), out: dir },
      { items, voices, slugify, manifest: freshManifest(), manifestFile: file, fetchImpl: api.fetchImpl, apiKey: "k", log: quiet });
    assert.strictEqual(r.failed.length, 1);
    assert.strictEqual(r.rendered.length, 3);
    assert.strictEqual(Object.keys(lib.readManifest(file).items).length, 3);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("no more requests are in flight than --concurrency allows", async () => {
    const api = fakeApi();
    const dir = tmp();
    await build.run({ ...build.parseArgs(["--only", "en/day/core", "--limit", "8", "--concurrency", "2"]), out: dir },
      { items, voices, slugify, manifest: freshManifest(), manifestFile: path.join(dir, "m.js"), fetchImpl: api.fetchImpl, apiKey: "k", log: quiet });
    assert.strictEqual(api.calls.length, 8);
    assert.ok(api.peak() <= 2, `peak in flight was ${api.peak()}`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("the build refuses to run without the key, and uploads go through the injected uploader", async () => {
    const api = fakeApi();
    const dir = tmp();
    const deps = { items, voices, slugify, manifest: freshManifest(), manifestFile: path.join(dir, "m.js"), fetchImpl: api.fetchImpl, log: quiet };
    await assert.rejects(build.run({ ...build.parseArgs(["--only", "en/sos/0"]), out: dir }, { ...deps, apiKey: "" }), /ELEVENLABS_API_KEY/);
    await assert.rejects(build.run({ ...build.parseArgs(["--only", "en/sos/0", "--upload"]), out: dir, bucket: "" }, { ...deps, apiKey: "k" }), /--bucket/);
    const puts = [];
    await build.run({ ...build.parseArgs(["--only", "en/sos/0", "--upload", "--bucket", "stand-audio"]), out: dir },
      { ...deps, apiKey: "k", upload: async (bucket, key, bytes) => puts.push({ bucket, key, size: bytes.length }) });
    assert.strictEqual(puts.length, 1);
    assert.strictEqual(puts[0].bucket, "stand-audio");
    assert.match(puts[0].key, /^en\/sos\/1-psalm-27-1\.[0-9a-f]{8}\.mp3$/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("the committed manifest verifies against the committed content", () => {
    const r = verify();
    assert.ok(r.ok, r.lines.join("\n"));
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll audio build tests passed.");
})();
