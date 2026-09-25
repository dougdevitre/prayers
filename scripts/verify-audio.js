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
 * Offline and deterministic, so it runs in CI; whether the files are actually
 * reachable through the CDN is the deploy check's job.
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

if (require.main === module) {
  const { ok, lines } = verify();
  for (const line of lines) (ok ? console.log : console.error)(line);
  process.exit(ok ? 0 : 1);
}

module.exports = { verify };
