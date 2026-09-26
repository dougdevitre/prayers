#!/usr/bin/env node
/* Renders the narration library with ElevenLabs and files it for the CDN.
 *
 *   ELEVENLABS_API_KEY=… node scripts/build-audio.js [options]
 *
 *   --only <prefix[,prefix]>  render only items whose id starts with a prefix
 *                             (e.g. en/day/core, es/sos, en/day/core/0)
 *   --limit <n>               stop after n renders (a cheap first look)
 *   --max-chars <n>           refuse to start when the run would send more than
 *                             n characters to ElevenLabs (0 = no limit); a
 *                             content edit that touches every item cannot
 *                             quietly re-spend the whole library
 *   --dry-run                 list what would be rendered and its size; no API calls
 *   --force                   re-render items the manifest already has fresh
 *   --concurrency <n>         parallel requests, at most 4 (the plan allows 5 in
 *                             flight across the whole workspace); default 3
 *   --out <dir>               where MP3s land locally; default .audio-out
 *   --upload                  also put each file in S3 (needs @aws-sdk/client-s3,
 *                             AUDIO_BUCKET or --bucket, and AWS credentials)
 *   --bucket <name>           the bucket, else AUDIO_BUCKET
 *   --base <https://host>     the manifest's CDN origin, else AUDIO_BASE_URL;
 *                             leaves the current value when neither is set
 *
 * Idempotent: an item whose hash already matches the manifest is skipped, so a
 * re-run after a content edit renders only the days that changed. The manifest
 * is rewritten after every item, so an interrupted run resumes where it stopped.
 * Objects are keyed by hash and never overwritten. The API key is only ever
 * read from the environment.
 */

const fs = require("fs");
const path = require("path");
const lib = require("./audio-lib.js");

const API = "https://api.elevenlabs.io/v1/text-to-speech";
const KBPS = 128;

function parseArgs(argv) {
  const o = { only: [], limit: Infinity, maxChars: 0, dryRun: false, force: false, concurrency: 3, out: path.join(lib.ROOT, ".audio-out"), upload: false, bucket: process.env.AUDIO_BUCKET || "", base: process.env.AUDIO_BASE_URL || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--only") o.only.push(...next().split(",").map(s => s.trim()).filter(Boolean));
    else if (a === "--limit") o.limit = Number(next());
    else if (a === "--max-chars") o.maxChars = Number(next());
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force") o.force = true;
    else if (a === "--concurrency") o.concurrency = Math.max(1, Math.min(4, Number(next()) || 3));
    else if (a === "--out") o.out = path.resolve(next());
    else if (a === "--upload") o.upload = true;
    else if (a === "--bucket") o.bucket = next();
    else if (a === "--base") o.base = next();
    else throw new Error(`unknown option ${a}`);
  }
  if (!Number.isFinite(o.limit) && o.limit !== Infinity) throw new Error("--limit needs a number");
  if (!Number.isFinite(o.maxChars) || o.maxChars < 0) throw new Error("--max-chars needs a number of characters (0 for no limit)");
  return o;
}

/** One request to ElevenLabs; the bytes of an MP3. Retries 429 and 5xx with backoff. */
async function render(text, settings, { apiKey, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), api = API, attempts = 5 } = {}) {
  const url = `${api}/${encodeURIComponent(settings.voiceId)}?output_format=${encodeURIComponent(settings.outputFormat)}`;
  const body = JSON.stringify({
    text, model_id: settings.model,
    voice_settings: { stability: settings.stability, similarity_boost: settings.similarity, style: settings.style, use_speaker_boost: settings.boost, speed: settings.speed }
  });
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetchImpl(url, { method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" }, body });
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length) throw new Error("ElevenLabs returned an empty body");
      return bytes;
    }
    last = `${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break;
    if (attempt < attempts) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
  }
  throw new Error(`ElevenLabs request failed: ${last}`);
}

async function uploadObject(bucket, key, bytes) {
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = uploadObject.client || (uploadObject.client = new S3Client({}));
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: bytes, ContentType: "audio/mpeg",
    CacheControl: "public, max-age=31536000, immutable"
  }));
}

/** A worker pool over the work list; returns the settled results in order. */
async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await fn(items[i], i) }; }
      catch (e) { results[i] = { ok: false, error: e }; }
    }
  }));
  return results;
}

/**
 * The build. deps are injectable for tests: { items, voices, slugify, manifest,
 * manifestFile, fetchImpl, sleep, upload, apiKey, log }.
 */
async function run(options, deps = {}) {
  const log = deps.log || console.log;
  const items = deps.items || lib.loadItems();
  const voices = deps.voices || lib.loadVoices();
  const slugify = deps.slugify || require(path.join(lib.ROOT, "logic.js")).slugify;
  const manifestFile = deps.manifestFile || lib.MANIFEST_FILE;
  const manifest = deps.manifest || lib.readManifest(manifestFile);
  if (options.base != null) manifest.base = options.base;
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.ELEVENLABS_API_KEY;

  const plan = lib.planItems({ items, voices, slugify })
    .filter(p => !options.only.length || options.only.some(prefix => p.item.id === prefix || p.item.id.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)));
  const report = lib.manifestReport(manifest, plan);
  const fresh = new Set(report.fresh);
  const work = plan.filter(p => options.force || !fresh.has(p.item.id)).slice(0, options.limit);
  const chars = work.reduce((n, p) => n + p.item.text.length, 0);

  log(`${plan.length} items in scope, ${fresh.size} already fresh, ${work.length} to render (${chars.toLocaleString()} characters)`);
  if (options.dryRun) {
    for (const p of work) log(`  ${p.item.id}  ${p.item.text.length} chars  -> ${p.key}`);
    return { rendered: [], failed: [], skipped: plan.length - work.length, work };
  }
  if (!work.length) return { rendered: [], failed: [], skipped: plan.length, work };
  if (options.maxChars && chars > options.maxChars) {
    throw new Error(`this run would send ${chars.toLocaleString()} characters to ElevenLabs, over the --max-chars limit of ${options.maxChars.toLocaleString()}; narrow it with --only or --limit, or raise the limit if the spend is intended`);
  }
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  if (options.upload && !options.bucket) throw new Error("--upload needs --bucket or AUDIO_BUCKET");

  const upload = deps.upload || uploadObject;
  let done = 0;
  const results = await pool(work, options.concurrency, async p => {
    const bytes = await render(p.item.text, p.settings, { apiKey, fetchImpl: deps.fetchImpl, sleep: deps.sleep });
    const file = path.join(options.out, p.key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    if (options.upload) await upload(options.bucket, p.key, bytes);
    // 128 kbps constant bitrate, so the length follows from the size.
    const seconds = Math.round(bytes.length * 8 / (KBPS * 1000));
    manifest.items[p.item.id] = { key: p.key, hash: p.hash, bytes: bytes.length, seconds };
    lib.writeManifest(manifest, manifestFile);
    log(`  ${++done}/${work.length}  ${p.item.id}  ${seconds}s  ${p.key}`);
    return p.item.id;
  });

  const rendered = results.filter(r => r.ok).map(r => r.value);
  const failed = results.map((r, i) => r.ok ? null : { id: work[i].item.id, error: r.error.message }).filter(Boolean);
  for (const f of failed) log(`  FAILED ${f.id}: ${f.error}`);
  log(`${rendered.length} rendered, ${failed.length} failed, manifest written to ${path.relative(lib.ROOT, manifestFile)}`);
  return { rendered, failed, skipped: plan.length - work.length, work };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then(r => process.exit(r.failed.length ? 1 : 0))
    .catch(e => { console.error(e.message); process.exit(2); });
}

module.exports = { parseArgs, render, pool, run };
