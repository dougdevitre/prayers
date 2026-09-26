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
const { verify, checkRemoteOnce, verifyRemote } = require("../scripts/verify-audio.js");
const { bump: bumpSw } = require("../scripts/bump-sw.js");
const pruneAudio = require("../scripts/prune-audio.js");
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
    const prayer = plan.find(p => p.item.id === "en/prayer/our-father");
    assert.match(prayer.key, /^en\/prayer\/our-father\.[0-9a-f]{8}\.mp3$/);
    const own = prayer.item.audio;
    assert.strictEqual(prayer.settings.speed, own.speed, "the prayer's own pacing wins");
    assert.strictEqual(prayer.settings.stability, own.stability);
    assert.strictEqual(prayer.settings.style, own.style);
    assert.notStrictEqual(own.speed, voices.en.prayer.speed, "and it differs from the default, so the override is real");
    assert.strictEqual(prayer.settings.similarity, voices.en.prayer.similarity, "the rest comes from the prayer defaults");
    assert.strictEqual(voices.en.voiceId, voices.es.voiceId, "one voice narrates both languages, as REMAM's prayers do");
    assert.strictEqual(prayer.settings.voiceId, voices.en.voiceId);
    assert.strictEqual(plan.find(p => p.item.id === "en/sos/0").settings.voiceId, voices.en.voiceId);
    // A kind may still carry its own voice and model, which win over the language's.
    const overridden = JSON.parse(JSON.stringify(voices));
    overridden.en.prayer.voiceId = "voice_override"; overridden.en.prayer.model = "eleven_v3";
    const withOverride = lib.planItems({ items, voices: overridden, slugify });
    assert.strictEqual(withOverride.find(p => p.item.id === "en/prayer/our-father").settings.voiceId, "voice_override");
    assert.strictEqual(withOverride.find(p => p.item.id === "en/prayer/our-father").settings.model, "eleven_v3");
    assert.strictEqual(withOverride.find(p => p.item.id === "en/day/core/0").settings.voiceId, voices.en.voiceId, "other kinds keep the language's");
    assert.strictEqual(plan.filter(p => p.item.kind === "prayer").length, 26);
  });

  await test("a prayer's own pacing is part of its hash", () => {
    const item = items.find(i => i.id === "en/prayer/our-father");
    const h = lib.itemHash(item.text, lib.settingsFor(voices, item));
    const slower = { ...item, audio: { ...item.audio, speed: 0.8 } };
    assert.notStrictEqual(lib.itemHash(slower.text, lib.settingsFor(voices, slower)), h);
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
    const prayerPlan = lib.planItems({ items, voices, slugify }).filter(p => p.item.kind === "prayer").slice(0, 1);
    const good = { version: 1, enabled: true, base: "", items: { [prayerPlan[0].item.id]: { key: prayerPlan[0].key, hash: prayerPlan[0].hash } } };
    assert.deepStrictEqual(lib.manifestReport(good, prayerPlan).fresh, [prayerPlan[0].item.id], "a prayer key is a recording path");
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
    // Before a render, stale items are the work to do, not a failure; an
    // orphan still fails.
    const before = verify({ manifest: lib.readManifest(file), items: edited, voices, slugify, allowStale: true });
    assert.ok(before.ok, before.lines.join("\n"));
    assert.ok(before.lines.some(l => l.startsWith("• es/sos/1 is stale")));
    assert.ok(!verify({ manifest: lib.readManifest(file), items: edited.filter(i => i.id !== "es/sos/2"), voices, slugify, allowStale: true }).ok);
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

  await test("--max-chars refuses a run over the limit before any request is made", async () => {
    const api = fakeApi();
    const dir = tmp();
    const deps = { items, voices, slugify, manifest: freshManifest(), manifestFile: path.join(dir, "m.js"), fetchImpl: api.fetchImpl, apiKey: "k", log: quiet };
    await assert.rejects(build.run({ ...build.parseArgs(["--only", "en/day/core", "--max-chars", "500"]), out: dir }, deps), /over the --max-chars limit of 500/);
    assert.strictEqual(api.calls.length, 0);
    // A dry run only reports, whatever the limit; 0 means no limit.
    const dry = await build.run({ ...build.parseArgs(["--dry-run", "--only", "en/day/core", "--max-chars", "500"]), out: dir }, deps);
    assert.ok(dry.work.length > 0);
    const r = await build.run({ ...build.parseArgs(["--only", "en/sos/0", "--max-chars", "0"]), out: dir }, deps);
    assert.strictEqual(r.rendered.length, 1);
    assert.throws(() => build.parseArgs(["--max-chars", "lots"]), /--max-chars/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("--remote checks every manifest file on the host and names what is wrong", async () => {
    // A stand-in host: serves the fixture for known keys, a short body for one,
    // text for another, nothing for the rest.
    const served = { "en/day/core/01-stand.aaaaaaaa.mp3": MP3, "en/day/core/02-truth.bbbbbbbb.mp3": MP3.subarray(0, 100) };
    const server = http.createServer((req, res) => {
      const key = req.url.slice(1);
      if (key === "en/day/core/03-text.cccccccc.mp3") { res.writeHead(200, { "content-type": "text/plain", "content-length": MP3.length }); return res.end(); }
      if (!served[key]) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": "audio/mpeg", "content-length": served[key].length, "accept-ranges": "bytes" });
      res.end(req.method === "HEAD" ? undefined : served[key]);
    });
    await new Promise(r => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const entry = (key) => ({ key, hash: "0".repeat(64), bytes: MP3.length, seconds: 1 });
    const good = { version: 1, enabled: true, base, items: { "en/day/core/0": entry("en/day/core/01-stand.aaaaaaaa.mp3") } };
    const r1 = await checkRemoteOnce({ manifest: good });
    assert.deepStrictEqual(r1, { ok: true, checked: 1, bad: [] });
    const mixed = { ...good, items: { ...good.items, "en/day/core/1": entry("en/day/core/02-truth.bbbbbbbb.mp3"), "en/day/core/2": entry("en/day/core/03-text.cccccccc.mp3"), "en/day/core/3": entry("en/day/core/04-missing.dddddddd.mp3") } };
    const r2 = await checkRemoteOnce({ manifest: mixed });
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(r2.checked, 4);
    assert.deepStrictEqual(r2.bad.map(b => [b.id, b.reason]), [
      ["en/day/core/1", `100 bytes served, manifest says ${MP3.length}`],
      ["en/day/core/2", "content-type text/plain"],
      ["en/day/core/3", "HTTP 404"]
    ]);
    // --base overrides the manifest's base; no base at all is a failure, not a pass.
    assert.strictEqual((await checkRemoteOnce({ manifest: { ...good, base: "" }, base })).ok, true);
    assert.match((await checkRemoteOnce({ manifest: { ...good, base: "" } })).bad[0].reason, /no usable base/);
    // Polling: the file appears on the second attempt.
    const late = { version: 1, enabled: true, base, items: { "en/day/core/4": entry("en/day/core/05-late.eeeeeeee.mp3") } };
    setTimeout(() => { served["en/day/core/05-late.eeeeeeee.mp3"] = MP3; }, 30);
    const polled = await verifyRemote({ manifest: late, attempts: 5, delayMs: 20 });
    assert.strictEqual(polled.ok, true);
    assert.ok(polled.attempts >= 2, `took ${polled.attempts} attempt(s)`);
    server.close();
  });

  await test("bump-sw increments the service worker cache name and refuses anything else", () => {
    const sw = fs.readFileSync(path.join(lib.ROOT, "sw.js"), "utf8");
    const { source, from, to } = bumpSw(sw);
    assert.match(from, /^stand-v\d+$/);
    assert.strictEqual(to, from.replace(/\d+$/, n => String(Number(n) + 1)));
    assert.ok(source.includes(`const CACHE = "${to}";`) && !source.includes(`const CACHE = "${from}";`));
    assert.strictEqual(source.length, sw.length + (to.length - from.length));
    assert.throws(() => bumpSw("const CACHE = `stand-v1`;"), /no line like/);
  });

  await test("prune-audio removes only recordings no given manifest names, and nothing else", () => {
    const dir = tmp();
    const tree = path.join(dir, "public");
    const put = (key) => { fs.mkdirSync(path.dirname(path.join(tree, key)), { recursive: true }); fs.writeFileSync(path.join(tree, key), MP3); };
    put("en/day/core/01-stand.aaaaaaaa.mp3");   // in the new manifest
    put("en/day/core/01-stand.00000000.mp3");   // superseded, but main still plays it
    put("en/day/core/02-truth.11111111.mp3");   // in neither: goes
    put("es/sos/1-salmo.22222222.mp3");         // in neither, alone in its folder: folder goes too
    fs.writeFileSync(path.join(tree, "index.txt"), "audio\n");
    const manifest = (keys) => { const f = path.join(dir, `m-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, `const audioManifest = { version: 1, enabled: true, base: "", items: ${JSON.stringify(Object.fromEntries(keys.map((k, i) => [`id${i}`, { key: k, hash: "0".repeat(64) }])))} };\nif (typeof module !== "undefined" && module.exports) module.exports = { audioManifest };\n`); return f; };
    const fresh = manifest(["en/day/core/01-stand.aaaaaaaa.mp3"]);
    const main = manifest(["en/day/core/01-stand.00000000.mp3"]);
    const dry = pruneAudio.prune({ dir: tree, keep: [fresh, main], dryRun: true });
    assert.deepStrictEqual(dry.remove, ["en/day/core/02-truth.11111111.mp3", "es/sos/1-salmo.22222222.mp3"]);
    assert.strictEqual(pruneAudio.listRecordings(tree).length, 4, "a dry run deletes nothing");
    const real = pruneAudio.prune({ dir: tree, keep: [fresh, main] });
    assert.deepStrictEqual(real.keep, ["en/day/core/01-stand.00000000.mp3", "en/day/core/01-stand.aaaaaaaa.mp3"]);
    assert.deepStrictEqual(pruneAudio.listRecordings(tree), real.keep);
    assert.ok(fs.existsSync(path.join(tree, "index.txt")), "non-mp3 files are untouched");
    assert.ok(!fs.existsSync(path.join(tree, "es")), "an emptied folder is removed");
    assert.ok(fs.existsSync(path.join(tree, "en/day/core")));
    // The committed manifest against the committed tree shape: every key it names is a .mp3 under public/.
    assert.ok([...pruneAudio.keysOf([path.join(lib.ROOT, "audio-manifest.js")])].every(k => /\.mp3$/.test(k)));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test("the committed manifest verifies against the committed content", () => {
    const r = verify();
    assert.ok(r.ok, r.lines.join("\n"));
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll audio build tests passed.");
})();
