#!/usr/bin/env node
/* Removes recordings the manifests no longer reference from a published tree.
 *
 *   node scripts/prune-audio.js --dir ../audio-branch/public --keep audio-manifest.js --keep main-manifest.js [--dry-run]
 *
 * A re-render files the new take under a new hash and leaves the old file in
 * place, so the audio branch only ever grew. This deletes every .mp3 under
 * --dir whose key no manifest given with --keep names. The Build audio
 * workflow passes both the manifest it just rendered and the one on main:
 * the app in production still plays main's keys until the manifest PR
 * merges, so those stay until the run after that. Nothing but .mp3 files is
 * touched.
 */

const fs = require("fs");
const path = require("path");

/** Every key named by any of the manifest files (CommonJS, as committed). */
function keysOf(manifestFiles) {
  const keys = new Set();
  for (const file of manifestFiles) {
    const { audioManifest } = require(path.resolve(file));
    for (const item of Object.values(audioManifest.items || {})) if (item && item.key) keys.add(item.key);
  }
  return keys;
}

/** The .mp3 files under dir, as keys relative to it with forward slashes. */
function listRecordings(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".mp3")) out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** Returns { keep, remove } without touching anything. */
function plan({ dir, keep }) {
  const referenced = keysOf(keep);
  const present = listRecordings(dir);
  return { keep: present.filter(k => referenced.has(k)), remove: present.filter(k => !referenced.has(k)) };
}

/** Deletes the files plan() says to, and any directory that empties. */
function prune({ dir, keep, dryRun = false }) {
  const result = plan({ dir, keep });
  if (!dryRun) {
    for (const key of result.remove) {
      fs.unlinkSync(path.join(dir, key));
      let parent = path.dirname(path.join(dir, key));
      while (parent !== dir && fs.readdirSync(parent).length === 0) { fs.rmdirSync(parent); parent = path.dirname(parent); }
    }
  }
  return result;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const keep = [];
  let dir = "", dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i];
    else if (argv[i] === "--keep") keep.push(argv[++i]);
    else if (argv[i] === "--dry-run") dryRun = true;
    else { console.error(`unknown option ${argv[i]}`); process.exit(2); }
  }
  if (!dir || !keep.length) { console.error("usage: node scripts/prune-audio.js --dir <published tree> --keep <manifest.js> [--keep <manifest.js>] [--dry-run]"); process.exit(2); }
  const { keep: kept, remove } = prune({ dir, keep, dryRun });
  for (const key of remove) console.log(`${dryRun ? "would remove" : "removed"}  ${key}`);
  console.log(`${kept.length} recording(s) referenced, ${remove.length} ${dryRun ? "to remove" : "removed"}`);
}

module.exports = { keysOf, listRecordings, plan, prune };
