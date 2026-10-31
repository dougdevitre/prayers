// Lays out a recorded day with its journey's sound (audio-voices.json
// journeys.<track>.mix): the voice as ElevenLabs rendered it, cut at its own
// section boundaries with a pause after each, over a quiet bed, between an
// opening and a closing tone, normalized to one loudness. Runs ffmpeg; spends
// no ElevenLabs credits, which is why a change to a mix only re-mixes.
//
// The section boundaries come from the voice's character timing (ElevenLabs
// with-timestamps, kept beside the voice as .json): a cut falls midway
// through the gap between one section's last character and the next one's
// first, where the voice is already silent.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

/**
 * The time of each boundary between sections, in seconds, from the voice's
 * character timing. sections joined by a blank line ("\n\n") are the text the
 * voice read; alignment is ElevenLabs' { characters, character_start_times_seconds,
 * character_end_times_seconds } for that text. Returns null when the timing
 * does not describe this text (then the voice is laid out without pauses).
 */
function cutTimes(sections, alignment) {
  const text = sections.join("\n\n");
  const chars = alignment && alignment.characters;
  const starts = alignment && alignment.character_start_times_seconds;
  const ends = alignment && alignment.character_end_times_seconds;
  if (!Array.isArray(chars) || chars.join("") !== text || starts.length !== chars.length || ends.length !== chars.length) return null;
  const cuts = [];
  let at = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    const last = at + sections[i].length - 1;
    const next = last + 3; // past the blank line
    cuts.push(Math.round(((ends[last] + starts[next]) / 2) * 1000) / 1000);
    at = next;
  }
  return cuts;
}

/** Seconds of audio in a file, by ffprobe. */
function duration(file, ffprobe = "ffprobe") {
  const out = execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  return Number(out.trim());
}

/** The loudest sample in a file, in dBFS, by ffmpeg's volumedetect. */
function peakDb(file, ffmpeg = "ffmpeg") {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const m = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(r.stderr || "");
  if (!m) throw new Error(`could not measure the level of ${file}`);
  return m[1] === "-inf" ? 0 : Number(m[1]);
}

/**
 * Mixes one day. { voiceFile, alignment, sections, names (DAY_SECTIONS), mix,
 * outFile, root, ffmpeg, ffprobe }. Returns { seconds }.
 */
function mixDay({ voiceFile, alignment, sections, names, mix, outFile, root = ROOT, ffmpeg = "ffmpeg", ffprobe = "ffprobe" }) {
  const clip = name => {
    const c = mix.clips && mix.clips[name];
    if (!c) return null;
    const file = path.join(root, c.file);
    if (!fs.existsSync(file)) throw new Error(`${c.file} has not been generated yet: run node scripts/build-sfx.js`);
    // gainDb is where the clip's peak lands (dBFS), whatever level the
    // generator returned it at: a tone that came back at -44 dB still opens
    // the day at the level the mix names.
    return { file, gainDb: Math.round(((c.gainDb || 0) - peakDb(file, ffmpeg)) * 10) / 10 };
  };
  const open = clip("open"), close = clip("close"), bed = clip("bed");
  const voiceSeconds = duration(voiceFile, ffprobe);
  const cuts = cutTimes(sections, alignment) || [];
  // The voice in segments, each followed by its section's pause (none after the last).
  const bounds = [0, ...cuts, voiceSeconds];
  const pauses = cuts.map((_, i) => (mix.pauses && mix.pauses[names[i]]) || 0);
  const intro = open ? mix.introSeconds || 0 : 0;
  const outro = close ? mix.outroSeconds || 0 : 0;
  const voiced = voiceSeconds + pauses.reduce((a, b) => a + b, 0);
  const total = intro + voiced + outro;
  const fmt = "aformat=sample_rates=44100:channel_layouts=stereo";

  const inputs = ["-i", voiceFile];
  const filters = [];
  const parts = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    filters.push(`[0:a]atrim=start=${bounds[i]}:end=${bounds[i + 1]},asetpts=PTS-STARTPTS,${fmt}[v${i}]`);
    parts.push(`[v${i}]`);
    if (pauses[i] > 0) {
      filters.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${pauses[i]}[p${i}]`);
      parts.push(`[p${i}]`);
    }
  }
  filters.push(`${parts.join("")}concat=n=${parts.length}:v=0:a=1,adelay=${Math.round(intro * 1000)}:all=1[voice]`);
  const layers = ["[voice]"];
  let n = 1;
  if (open) {
    inputs.push("-i", open.file);
    filters.push(`[${n++}:a]${fmt},volume=${open.gainDb}dB[open]`);
    layers.push("[open]");
  }
  if (close) {
    inputs.push("-i", close.file);
    const at = Math.round((intro + voiced + 0.4) * 1000);
    filters.push(`[${n++}:a]${fmt},volume=${close.gainDb}dB,adelay=${at}:all=1[close]`);
    layers.push("[close]");
  }
  if (bed) {
    inputs.push("-stream_loop", "-1", "-i", bed.file);
    filters.push(`[${n++}:a]${fmt},atrim=duration=${total},volume=${bed.gainDb}dB,afade=t=in:d=3,afade=t=out:st=${Math.max(0, total - 4)}:d=4[bed]`);
    layers.push("[bed]");
  }
  const mixed = `${layers.join("")}amix=inputs=${layers.length}:normalize=0:duration=longest,atrim=duration=${total}`;
  // Two-pass loudness normalization: measure the whole day, then apply one
  // fixed gain (linear), so the bed and tones keep their level under the
  // voice instead of swelling in the pauses as a single pass would.
  const target = `I=${mix.loudnessLufs || -16}:TP=-1.5:LRA=11`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-mix-"));
  const measureScript = path.join(dir, "measure.txt");
  fs.writeFileSync(measureScript, [...filters, `${mixed},loudnorm=${target}:print_format=json[out]`].join(";\n"));
  const measured = spawnSync(ffmpeg, ["-hide_banner", "-nostats", ...inputs, "-filter_complex_script", measureScript, "-map", "[out]", "-f", "null", "-"], { encoding: "utf8" });
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(measured.stderr || "");
  if (measured.status !== 0 || !json) throw new Error(`could not measure the mix's loudness: ${(measured.stderr || "").slice(-300)}`);
  const m = JSON.parse(json[0]);
  const linear = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"].every(k => Number.isFinite(Number(m[k])))
    ? `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : ""; // silence measures -inf: fall back to the single pass
  filters.push(`${mixed},loudnorm=${target}${linear},aresample=44100[out]`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const script = path.join(dir, "filter.txt");
  fs.writeFileSync(script, filters.join(";\n"));
  execFileSync(ffmpeg, ["-y", "-v", "error", ...inputs, "-filter_complex_script", script, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", outFile]);
  return { seconds: Math.round(duration(outFile, ffprobe)), cuts: cuts.length };
}

module.exports = { cutTimes, duration, peakDb, mixDay };
