#!/usr/bin/env node
/* Generates the sound clips a journey's mix uses (audio-voices.json
 * journeys.<track>.mix.clips) with ElevenLabs Sound Effects, once.
 *
 *   ELEVENLABS_API_KEY=… node scripts/build-sfx.js [--dry-run] [--force]
 *
 * A clip is generated only when its file is missing (or with --force), so a
 * run spends credits once per clip, not once per recording: the clips are
 * committed under audio-sfx/ and mixed under every day by scripts/audio-mix.js.
 * ElevenLabs bills sound effects by length (40 credits a second when the
 * length is given, per its docs; check the current rate), so --dry-run prices
 * the run first. Regenerating a clip re-mixes the days that use it, from
 * their kept voices: no speech credits.
 */
const fs = require("fs");
const path = require("path");
const lib = require("./audio-lib.js");

const API = "https://api.elevenlabs.io/v1/sound-generation";
const CREDITS_PER_SECOND = 40;

/** Every clip any journey's mix names: { journey, name, file, prompt, seconds, influence }. */
function clips(voices) {
  const out = [];
  for (const [journey, j] of Object.entries(voices.journeys || {})) {
    if (!j || !j.mix) continue;
    for (const [name, c] of Object.entries(j.mix.clips || {})) out.push({ journey, name, ...c });
  }
  return out;
}

async function generate(clip, { apiKey, fetchImpl = fetch }) {
  const res = await fetchImpl(API, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: clip.prompt, duration_seconds: clip.seconds, prompt_influence: clip.influence })
  });
  if (!res.ok) throw new Error(`ElevenLabs sound generation failed for ${clip.file}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error(`ElevenLabs returned no audio for ${clip.file}`);
  return bytes;
}

async function run({ dryRun = false, force = false } = {}, deps = {}) {
  const log = deps.log || console.log;
  const root = deps.root || lib.ROOT;
  const voices = deps.voices || lib.loadVoices();
  const all = clips(voices);
  const work = all.filter(c => force || !fs.existsSync(path.join(root, c.file)));
  const seconds = work.reduce((n, c) => n + c.seconds, 0);
  log(`${all.length} clips, ${all.length - work.length} already generated, ${work.length} to generate (${seconds} seconds, about ${(seconds * CREDITS_PER_SECOND).toLocaleString()} credits at ${CREDITS_PER_SECOND} a second)`);
  for (const c of work) log(`  ${c.journey} ${c.name}  ${c.seconds}s  -> ${c.file}`);
  if (dryRun || !work.length) return { generated: [], work };
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const generated = [];
  for (const c of work) {
    const bytes = await generate(c, { apiKey, fetchImpl: deps.fetchImpl });
    const file = path.join(root, c.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    generated.push(c.file);
    log(`  generated ${c.file} (${bytes.length.toLocaleString()} bytes)`);
  }
  return { generated, work };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  run({ dryRun: args.includes("--dry-run"), force: args.includes("--force") })
    .catch(e => { console.error(e.message); process.exit(2); });
}

module.exports = { clips, generate, run, CREDITS_PER_SECOND };
