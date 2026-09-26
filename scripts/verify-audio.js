#!/usr/bin/env node
/* Gates audio-manifest.js against the content it was rendered from.
 *
 * Every item in the manifest must carry the hash of the script and voice
 * settings that produce it today. A verse edit, a voice change or a settings
 * change makes the entry stale, and this fails until the item is re-rendered
 * (it prints the command). Items the content no longer has are orphans and
 * fail too. Items not yet rendered are fine: the app falls back to the
 * device's own narration for them.
 *
 * Offline and deterministic by default, so it runs in CI. With --remote it also
 * asks the audio host for every file in the manifest (a HEAD each, a few at a
 * time) and fails unless each answers 200 with audio/mpeg and the byte count
 * the manifest recorded; --attempts and --delay poll, because the host
 * publishes a little after the files are pushed.
 *
 *   node scripts/verify-audio.js
 *   node scripts/verify-audio.js --remote [--base https://host] [--attempts 12 --delay 15000]
 */

const path = require("path");
const lib = require("./audio-lib.js");

function verify({ manifest = lib.readManifest(), items = lib.loadItems(), voices = lib.loadVoices(), slugify = require(path.join(lib.ROOT, "logic.js")).slugify } = {}) {
  const plan = lib.planItems({ items, voices, slugify });
  const report = lib.manifestReport(manifest, plan);
  const lines = [];
  for (const p of report.problems) lines.push(`✗ ${p}`);
  for (const s of report.stale) lines.push(`✗ ${s.id} is stale: rendered as ${s.key}, the current script and settings give ${s.expected}`);
  for (const o of report.orphan) lines.push(`✗ ${o} is in the manifest but not in the content`);
  const ok = !lines.length;
  if (report.stale.length) {
    lines.push(`  re-render with: node scripts/build-audio.js --only ${report.stale.map(s => s.id).join(",")}`);
  }
  if (report.orphan.length) lines.push("  remove orphans by deleting their entries from audio-manifest.js");
  lines.push(`${ok ? "✓" : "✗"} audio manifest — ${report.fresh.length} fresh, ${report.stale.length} stale, ${report.orphan.length} orphaned, ${report.missing.length} not yet rendered of ${plan.length}${manifest.enabled === false ? " (recordings disabled)" : ""}`);
  return { ok, report, lines };
}

/**
 * One pass over the host: every manifest item fetched with HEAD. Returns
 * { ok, checked, bad } where bad lists { id, key, reason }. fetchImpl is
 * injectable so the check itself can be tested against a local server.
 */
async function checkRemoteOnce({ manifest = lib.readManifest(), base = manifest.base, fetchImpl = fetch, concurrency = 6 } = {}) {
  const origin = String(base || "").replace(/\/+$/, "");
  const entries = Object.entries(manifest.items || {});
  if (!entries.length) return { ok: true, checked: 0, bad: [] };
  if (!/^https?:\/\//.test(origin)) return { ok: false, checked: entries.length, bad: [{ id: "*", key: "", reason: `the manifest has no usable base (${JSON.stringify(base)})` }] };
  const bad = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (next < entries.length) {
      const [id, item] = entries[next++];
      const url = `${origin}/${item.key}`;
      let res;
      try { res = await fetchImpl(url, { method: "HEAD", redirect: "manual" }); }
      catch (e) { bad.push({ id, key: item.key, reason: `fetch failed: ${e.message}` }); continue; }
      const type = (res.headers.get("content-type") || "").split(";")[0].trim();
      const length = Number(res.headers.get("content-length"));
      if (res.status !== 200) bad.push({ id, key: item.key, reason: `HTTP ${res.status}` });
      else if (type !== "audio/mpeg") bad.push({ id, key: item.key, reason: `content-type ${type || "(none)"}` });
      else if (item.bytes && length !== item.bytes) bad.push({ id, key: item.key, reason: `${length} bytes served, manifest says ${item.bytes}` });
    }
  }));
  bad.sort((a, b) => a.id.localeCompare(b.id));
  return { ok: bad.length === 0, checked: entries.length, bad };
}

/** Polls checkRemoteOnce until it passes or the attempts run out. */
async function verifyRemote({ attempts = 1, delayMs = 0, log = () => {}, ...opts } = {}) {
  let result;
  for (let i = 1; i <= attempts; i++) {
    result = await checkRemoteOnce(opts);
    if (result.ok) return { ...result, attempts: i };
    log(`attempt ${i}/${attempts}: ${result.bad.length} of ${result.checked} recordings not served yet`);
    if (i < attempts) await new Promise(r => setTimeout(r, delayMs));
  }
  return { ...result, attempts };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback; };
  const { ok, lines } = verify();
  for (const line of lines) (ok ? console.log : console.error)(line);
  if (!ok || !argv.includes("--remote")) process.exit(ok ? 0 : 1);
  const manifest = lib.readManifest();
  const base = opt("--base", manifest.base);
  verifyRemote({ manifest, base, attempts: Number(opt("--attempts", 1)), delayMs: Number(opt("--delay", 15000)), log: m => console.log(m) }).then(result => {
    if (result.ok) {
      console.log(`✓ ${base} serves all ${result.checked} recordings (attempt ${result.attempts})`);
      process.exit(0);
    }
    for (const b of result.bad) console.error(`✗ ${b.id}  ${b.key}  ${b.reason}`);
    console.error(`✗ ${result.bad.length} of ${result.checked} recordings are not served correctly from ${base}`);
    process.exit(1);
  });
}

module.exports = { verify, checkRemoteOnce, verifyRemote };
