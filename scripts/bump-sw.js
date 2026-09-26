#!/usr/bin/env node
/* Bumps the service worker's cache name so installed apps refetch the shell.
 *
 *   node scripts/bump-sw.js          rewrites sw.js and prints the new name
 *
 * sw.js precaches audio-manifest.js and serves it cache-first, refreshing in
 * the background: without a new cache name, an installed app plays the
 * previous manifest for one whole visit after a change. The Build audio
 * workflow runs this in the same commit as every manifest it pushes; a
 * hand-edited manifest needs it too.
 */

const fs = require("fs");
const path = require("path");

const SW_FILE = path.join(__dirname, "..", "sw.js");
const PATTERN = /^const CACHE = "([a-z]+-v)(\d+)";$/m;

/** Returns { source, from, to } with the cache name incremented. */
function bump(source) {
  const m = source.match(PATTERN);
  if (!m) throw new Error('sw.js has no line like: const CACHE = "stand-v28";');
  const from = m[1] + m[2];
  const to = m[1] + (Number(m[2]) + 1);
  return { source: source.replace(PATTERN, `const CACHE = "${to}";`), from, to };
}

if (require.main === module) {
  const { source, from, to } = bump(fs.readFileSync(SW_FILE, "utf8"));
  fs.writeFileSync(SW_FILE, source);
  console.log(`sw.js cache ${from} -> ${to}`);
}

module.exports = { bump, PATTERN };
