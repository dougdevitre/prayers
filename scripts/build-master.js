#!/usr/bin/env node
/* Joins a journey's recorded days into one file per language, with a chapter
 * for each day: the whole journey to download and listen through.
 *
 *   node scripts/build-master.js [--out .audio-out] [--dry-run]
 *
 * Runs for every journey with a mix (audio-voices.json journeys), once every
 * one of its days in a language is recorded and current in the manifest. The
 * days are the mixed recordings the app plays (from --out, else the host),
 * a short silence apart; the file is filed by a hash of theirs, so it is
 * rebuilt only when a day changes, and spends no ElevenLabs credits.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const lib = require("./audio-lib.js");
const { duration } = require("./audio-mix.js");

const GAP_SECONDS = 2;

async function run({ out = path.join(lib.ROOT, ".audio-out"), dryRun = false } = {}, deps = {}) {
  const log = deps.log || console.log;
  const voices = deps.voices || lib.loadVoices();
  const items = deps.items || lib.loadItems();
  const manifestFile = deps.manifestFile || lib.MANIFEST_FILE;
  const manifest = deps.manifest || lib.readManifest(manifestFile);
  const slugify = deps.slugify || require(path.join(lib.ROOT, "logic.js")).slugify;
  const fetchImpl = deps.fetchImpl || fetch;
  const ffmpeg = deps.ffmpeg || "ffmpeg";
  const names = deps.names || {
    en: require(path.join(lib.ROOT, "content.js")).tracks,
    es: require(path.join(lib.ROOT, "content.es.js")).esTracks
  };
  const plan = new Map(lib.planItems({ items, voices, slugify, root: deps.root }).map(p => [p.item.id, p]));
  const built = [];
  manifest.masters = manifest.masters || {};

  for (const journey of Object.keys(voices.journeys || {}).filter(id => voices.journeys[id] && voices.journeys[id].mix)) {
    for (const lang of ["en", "es"]) {
      const id = `${lang}/${journey}`;
      const days = [...plan.values()].filter(p => p.item.lang === lang && p.item.kind === "day" && p.item.track === journey).sort((a, b) => a.item.index - b.item.index);
      const current = days.filter(p => { const e = manifest.items[p.item.id]; return e && e.hash === p.hash && e.key === p.key; });
      if (!days.length || current.length < days.length) { log(`${id}: ${current.length} of ${days.length} days recorded; the whole journey waits for all of them`); continue; }
      const hash = crypto.createHash("sha256").update(JSON.stringify({ days: days.map(p => p.hash), gap: GAP_SECONDS })).digest("hex");
      const key = `${lang}/master/${journey}.${hash.slice(0, 8)}.mp3`;
      if (manifest.masters[id] && manifest.masters[id].hash === hash) { log(`${id}: current (${manifest.masters[id].key})`); continue; }
      log(`${id}: ${days.length} days -> ${key}${dryRun ? " (dry run)" : ""}`);
      if (dryRun) continue;

      // Each day's mixed recording, from this run's output or the host.
      const files = [];
      for (const p of days) {
        const file = path.join(out, p.key);
        if (!fs.existsSync(file)) {
          const res = await fetchImpl(`${manifest.base}/${p.key}`);
          if (!res.ok) throw new Error(`${p.key} is not on the host (${res.status})`);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        }
        files.push(file);
      }
      // A chapter per day, then the days a short silence apart.
      const track = (names[lang] && names[lang][journey]) || {};
      const meta = [";FFMETADATA1", `title=${track.name || journey}`, "artist=Stand", `album=${track.name || journey}`];
      const filters = [], parts = [];
      let at = 0;
      files.forEach((file, i) => {
        const len = duration(file, deps.ffprobe);
        meta.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${Math.round(at * 1000)}`, `END=${Math.round((at + len) * 1000)}`, `title=${lang === "es" ? "Día" : "Day"} ${i + 1} · ${days[i].item.title}`);
        filters.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[d${i}]`);
        parts.push(`[d${i}]`);
        at += len;
        if (i < files.length - 1) {
          filters.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${GAP_SECONDS}[g${i}]`);
          parts.push(`[g${i}]`);
          at += GAP_SECONDS;
        }
      });
      filters.push(`${parts.join("")}concat=n=${parts.length}:v=0:a=1[out]`);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stand-master-"));
      fs.writeFileSync(path.join(tmp, "meta.txt"), meta.join("\n") + "\n");
      fs.writeFileSync(path.join(tmp, "filter.txt"), filters.join(";\n"));
      const outFile = path.join(out, key);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      execFileSync(ffmpeg, ["-y", "-v", "error", ...files.flatMap(f => ["-i", f]), "-i", path.join(tmp, "meta.txt"),
        "-filter_complex_script", path.join(tmp, "filter.txt"), "-map", "[out]", "-map_metadata", String(files.length), "-map_chapters", String(files.length),
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-id3v2_version", "3", outFile]);
      const bytes = fs.statSync(outFile).size;
      manifest.masters[id] = { key, hash, bytes, seconds: Math.round(duration(outFile, deps.ffprobe)), days: days.length };
      lib.writeManifest(manifest, manifestFile);
      built.push(id);
      log(`  ${id}: ${Math.round(manifest.masters[id].seconds / 60)} minutes, ${(bytes / 1048576).toFixed(1)} MB`);
    }
  }
  return { built };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--out");
  run({ out: i >= 0 ? path.resolve(args[i + 1]) : undefined, dryRun: args.includes("--dry-run") })
    .catch(e => { console.error(e.message); process.exit(2); });
}

module.exports = { run, GAP_SECONDS };
