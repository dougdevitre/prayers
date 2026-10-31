// Shared by the narration build (build-audio.js) and its verifier
// (verify-audio.js): what there is to render, what each item was rendered
// from, where it is filed, and whether the committed manifest still matches.
//
// An item's hash covers its script and every setting that shapes the voice,
// so a content edit, a voice change or a settings change each produce a new
// hash, a new object key and a new URL. Old objects are never overwritten,
// and a CDN can cache every file forever.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const MANIFEST_FILE = path.join(ROOT, "audio-manifest.js");
const VOICES_FILE = path.join(ROOT, "audio-voices.json");

/** Every narration item, from the committed content. */
function loadItems(root = ROOT) {
  const { narrationItems } = require(path.join(root, "narration.js"));
  const { tracks, sosSetsEn } = require(path.join(root, "content.js"));
  const { esTracks, esSos } = require(path.join(root, "content.es.js"));
  const { prayerCorpus } = require(path.join(root, "prayers.js"));
  const { rosary, mysteryRef } = require(path.join(root, "rosary.js"));
  const { appUi } = require(path.join(root, "ui.js"));
  // A mystery's heading in the app's own words (ui.js), composed as the app
  // composes it, so the recording and the screen say the same thing.
  const heading = (set, index, lang) => appUi[lang]["rosary.mysteryHeading"]
    .replace("{ordinal}", appUi[lang]["rosary.ordinals"].split("|")[index])
    .replace("{adjective}", set.adjective[lang]);
  return narrationItems({ tracks, esTracks, sosSets: sosSetsEn, esSos, prayers: prayerCorpus.traditional, rosary: { fatima: rosary.fatima, sets: rosary.sets, heading, ref: mysteryRef } });
}

function loadVoices(file = VOICES_FILE) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The voice and delivery settings an item is rendered with. */
function settingsFor(voices, item) {
  const lang = voices[item.lang];
  if (!lang) throw new Error(`audio-voices.json has no voice for ${item.lang}`);
  const kind = lang[item.kind];
  if (!kind) throw new Error(`audio-voices.json has no ${item.kind} settings for ${item.lang}`);
  // A kind may carry its own voice and model (the traditional prayers use
  // the voice REMAM's prayer audio uses, in both languages); otherwise the
  // language's apply.
  const settings = {
    voiceId: kind.voiceId || lang.voiceId, model: kind.model || lang.model, outputFormat: voices.outputFormat || "mp3_44100_128",
    stability: kind.stability, similarity: kind.similarity, style: kind.style, speed: kind.speed, boost: kind.boost !== false
  };
  // A traditional prayer carries its own pacing (prayers.js, validated by
  // scripts/validate-prayers.js); it wins over the per-kind defaults.
  if (item.kind === "prayer" && item.audio) {
    for (const k of ["stability", "style", "speed"]) if (typeof item.audio[k] === "number") settings[k] = item.audio[k];
  }
  return settings;
}

/** sha256 over the script and the settings, in a fixed key order. */
function itemHash(text, settings) {
  const ordered = {};
  for (const k of Object.keys(settings).sort()) ordered[k] = settings[k];
  return crypto.createHash("sha256").update(JSON.stringify({ text, settings: ordered })).digest("hex");
}

/** "en/day/core/01-stand.7f3a9c2e.mp3", "es/sos/1-salmo-27-1.b91d0c44.mp3",
 * "en/prayer/our-father.3c1e77a0.mp3", "es/rosary/annunciation.5d2e0a91.mp3". */
function keyFor(item, hash, slugify) {
  if (item.kind === "prayer") return `${item.lang}/prayer/${item.slug}.${hash.slice(0, 8)}.mp3`;
  if (item.kind === "rosary") return `${item.lang}/rosary/${item.slug}.${hash.slice(0, 8)}.mp3`;
  const n = item.index + 1;
  const number = item.kind === "day" ? String(n).padStart(2, "0") : String(n);
  const dir = item.kind === "day" ? `${item.lang}/day/${item.track}` : `${item.lang}/sos`;
  return `${dir}/${number}-${slugify(item.title)}.${hash.slice(0, 8)}.mp3`;
}

/** The sound a recorded day of this journey is laid out with
 * (audio-voices.json journeys.<track>.mix), or null for a plain recording. */
function mixFor(voices, item) {
  const j = item.kind === "day" && voices.journeys && voices.journeys[item.track];
  return j && j.mix ? j.mix : null;
}

/** sha256 over a mix's settings and the bytes of each clip it uses (a clip not
 * generated yet counts as missing, so generating it moves the hash). */
function mixHash(mix, root = ROOT) {
  const clips = {};
  for (const [name, c] of Object.entries(mix.clips || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const file = path.join(root, c.file);
    clips[name] = fs.existsSync(file) ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") : "missing";
  }
  return crypto.createHash("sha256").update(JSON.stringify({ mix, clips })).digest("hex");
}

/** Every item with its settings, hash and key: the build's work list. A day
 * with a mix is two files: the voice as ElevenLabs rendered it (voiceHash,
 * voiceKey under voice/, with its timing beside it as .json) and the mixed
 * recording the app plays (hash, key), whose hash covers the voice's and the
 * mix's. A change to the mix alone re-mixes from the kept voice: no credits. */
function planItems({ items, voices, slugify, root }) {
  root = root || ROOT;
  const mixHashes = new Map();
  return items.map(item => {
    const settings = settingsFor(voices, item);
    const voiceHash = itemHash(item.text, settings);
    const mix = mixFor(voices, item);
    if (!mix) return { item, settings, hash: voiceHash, key: keyFor(item, voiceHash, slugify) };
    if (!mixHashes.has(mix)) mixHashes.set(mix, mixHash(mix, root));
    const hash = crypto.createHash("sha256").update(JSON.stringify({ voice: voiceHash, mix: mixHashes.get(mix) })).digest("hex");
    return { item, settings, mix, voiceHash, voiceKey: `voice/${keyFor(item, voiceHash, slugify)}`, hash, key: keyFor(item, hash, slugify) };
  });
}

/** Whether the voice a mixed item needs is already rendered (the manifest
 * records it on the host): then only the mix runs, and nothing is sent. */
function voiceKept(manifest, p) {
  const entry = p.mix && manifest && manifest.items && manifest.items[p.item.id];
  return Boolean(entry && entry.voice && entry.voice.hash === p.voiceHash && entry.voice.key === p.voiceKey);
}

/** The committed manifest, read fresh (not from require's cache). */
function readManifest(file = MANIFEST_FILE) {
  delete require.cache[require.resolve(file)];
  return require(file).audioManifest;
}

/** Writes the manifest as the JS module the app loads, atomically. */
function writeManifest(manifest, file = MANIFEST_FILE) {
  const items = {};
  for (const id of Object.keys(manifest.items).sort()) items[id] = manifest.items[id];
  const out = { version: manifest.version || 1, enabled: manifest.enabled !== false, base: manifest.base || "", items };
  // The whole-journey files (scripts/build-master.js), once there are any.
  if (manifest.masters && Object.keys(manifest.masters).length) {
    out.masters = {};
    for (const id of Object.keys(manifest.masters).sort()) out.masters[id] = manifest.masters[id];
  }
  const body = JSON.stringify(out, null, 2);
  const src = `// Generated by scripts/build-audio.js. Do not edit by hand: run the build and
// commit the result. Each item is filed under "<lang>/day/<track>/<index>" or
// "<lang>/sos/<index>" or "<lang>/prayer/<id>", with the object key of its recording and the hash of
// the script and voice settings it was rendered from (and, for a day with a
// mix, the voice it was mixed from). masters are whole journeys in one file. scripts/verify-audio.js
// fails CI when an item's hash no longer matches the current script, so a
// content edit can never ship stale audio. Days without an entry fall back
// to the device's own narration.
const audioManifest = ${body};

if (typeof module !== "undefined" && module.exports) module.exports = { audioManifest };
`;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, src);
  fs.renameSync(tmp, file);
}

/**
 * The manifest against the plan: fresh (hash matches), stale (the script or
 * settings changed since it was rendered), orphan (in the manifest but no
 * longer in the content), missing (in the content, not yet rendered), plus
 * anything malformed.
 */
/**
 * Credits left on the ElevenLabs account, from /v1/user/subscription, or null
 * when the key may not read it (a key scoped to text to speech only): then
 * the caller goes ahead and ElevenLabs refuses what it cannot cover.
 */
async function creditsLeft({ apiKey, fetchImpl = fetch, api = "https://api.elevenlabs.io/v1/user/subscription" }) {
  try {
    const res = await fetchImpl(api, { headers: { "xi-api-key": apiKey, Accept: "application/json" } });
    if (!res.ok) return null;
    const s = await res.json();
    if (!Number.isFinite(s.character_limit) || !Number.isFinite(s.character_count)) return null;
    return { left: s.character_limit - s.character_count, limit: s.character_limit, resets: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : null };
  } catch {
    return null;
  }
}

/** Throws before any spend when the account cannot cover `need` credits. */
async function requireCredits(need, { apiKey, fetchImpl, log = console.log, what = "this run" }) {
  const c = await creditsLeft({ apiKey, fetchImpl });
  if (!c) { log("  (could not read the account's remaining credits; going ahead)"); return null; }
  log(`  ElevenLabs credits left: ${c.left.toLocaleString()} of ${c.limit.toLocaleString()}${c.resets ? `, resets ${c.resets}` : ""}`);
  if (c.left < need) throw new Error(`${what} needs about ${need.toLocaleString()} credits and the ElevenLabs account has ${c.left.toLocaleString()} left${c.resets ? ` (it resets ${c.resets})` : ""}; nothing was sent`);
  return c;
}

function manifestReport(manifest, plan) {
  const report = { fresh: [], stale: [], orphan: [], missing: [], problems: [] };
  if (!manifest || typeof manifest !== "object") { report.problems.push("manifest is not an object"); return report; }
  if (typeof manifest.enabled !== "boolean") report.problems.push("enabled must be true or false");
  if (typeof manifest.base !== "string" || (manifest.base && !/^https:\/\/[^/\s]+$/.test(manifest.base))) {
    report.problems.push(`base must be empty or an https origin with no path or trailing slash, not ${JSON.stringify(manifest.base)}`);
  }
  const items = manifest.items && typeof manifest.items === "object" ? manifest.items : (report.problems.push("items must be an object"), {});
  const byId = new Map(plan.map(p => [p.item.id, p]));
  for (const [id, entry] of Object.entries(items)) {
    const p = byId.get(id);
    if (!p) { report.orphan.push(id); continue; }
    if (!entry || typeof entry.key !== "string" || !/^[a-z]{2}\/(day\/[a-z0-9-]+|sos|prayer|rosary)\/[a-z0-9-]+\.[0-9a-f]{8}\.mp3$/.test(entry.key)) {
      report.problems.push(`${id}: key is not a recording path: ${JSON.stringify(entry && entry.key)}`); continue;
    }
    if (!/^[0-9a-f]{64}$/.test(entry.hash || "")) { report.problems.push(`${id}: hash is not sha256 hex`); continue; }
    if (entry.voice !== undefined && (!entry.voice || !/^voice\/[a-z]{2}\/day\/[a-z0-9-]+\/[a-z0-9-]+\.[0-9a-f]{8}\.mp3$/.test(entry.voice.key || "") || !/^[0-9a-f]{64}$/.test(entry.voice.hash || ""))) {
      report.problems.push(`${id}: voice is not a kept voice recording: ${JSON.stringify(entry.voice)}`); continue;
    }
    if (entry.hash !== p.hash || entry.key !== p.key) report.stale.push({ id, key: entry.key, expected: p.key });
    else report.fresh.push(id);
  }
  for (const p of plan) if (!(p.item.id in items)) report.missing.push(p.item.id);
  for (const [id, m] of Object.entries(manifest.masters || {})) {
    if (!/^[a-z]{2}\/[a-z0-9-]+$/.test(id) || !m || !/^[a-z]{2}\/master\/[a-z0-9-]+\.[0-9a-f]{8}\.mp3$/.test(m.key || "")) report.problems.push(`masters ${id}: not a whole-journey recording: ${JSON.stringify(m)}`);
  }
  return report;
}

module.exports = { ROOT, MANIFEST_FILE, VOICES_FILE, loadItems, loadVoices, settingsFor, itemHash, keyFor, mixFor, mixHash, planItems, voiceKept, readManifest, writeManifest, manifestReport, creditsLeft, requireCredits };
