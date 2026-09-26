#!/usr/bin/env node
/* Checks that a deployed site is serving THIS checkout.
 *
 *   node scripts/verify-deploy.js https://prayers.dougdevitre.org
 *   node scripts/verify-deploy.js https://prayers.dougdevitre.org --attempts 9 --delay 20000
 *
 * Fetches a fixed set of files from the site and compares each one, byte for
 * byte, with the file in this repository. A merge to main is not live until
 * Vercel has built it and moved the production alias, and that can lag by
 * minutes with nothing in GitHub to say so — this is the "nothing". With
 * --attempts it polls, because the alias moves a little after the deployment
 * reports success. Exits 1 if anything is missing or differs.
 *
 * The set is the app shell and every script it loads, plus one page of each
 * static shape, so a build that shipped half its files fails here too.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// [file in the repository, path on the site]. cleanUrls maps x.html to /x.
const FILES = [
  ["app/index.html", "/app"], ["index.html", "/"], ["es/index.html", "/es"],
  ["fears/index.html", "/fears"], ["es/fears/index.html", "/es/fears"],
  ["privacy/index.html", "/privacy"], ["es/privacy/index.html", "/es/privacy"], ["terms/index.html", "/terms"], ["es/terms/index.html", "/es/terms"],
  ["day/01-stand.html", "/day/01-stand"], ["es/day/01-firmeza.html", "/es/day/01-firmeza"],
  ["track/furnace/01-the-decree.html", "/track/furnace/01-the-decree"],
  ["sw.js", "/sw.js"], ["share.js", "/share.js"], ["offline-audio.js", "/offline-audio.js"], ["app.js", "/app.js"], ["ui.js", "/ui.js"], ["logic.js", "/logic.js"],
  ["reminder.js", "/reminder.js"], ["narration.js", "/narration.js"], ["audio-manifest.js", "/audio-manifest.js"], ["compose.js", "/compose.js"], ["prayers.js", "/prayers.js"],
  ["content.js", "/content.js"], ["content.es.js", "/content.es.js"], ["styles.css", "/styles.css"],
  ["manifest.webmanifest", "/manifest.webmanifest"], ["robots.txt", "/robots.txt"], ["sitemap.xml", "/sitemap.xml"]
];

/**
 * One pass: every file fetched and compared. Returns { ok, behind, checked }
 * where behind lists { file, path, reason } for anything missing or different.
 * `fetchImpl` and `root` are injectable so the check itself can be tested.
 */
async function checkOnce(siteUrl, { root = ROOT, fetchImpl = fetch, files = FILES } = {}) {
  const base = siteUrl.replace(/\/+$/, "");
  const behind = [];
  for (const [file, route] of files) {
    const expected = fs.readFileSync(path.join(root, file), "utf8");
    let res;
    try {
      res = await fetchImpl(base + route, { headers: { "cache-control": "no-cache" }, redirect: "manual" });
    } catch (e) {
      behind.push({ file, path: route, reason: `fetch failed: ${e.message}` });
      continue;
    }
    if (res.status !== 200) { behind.push({ file, path: route, reason: `HTTP ${res.status}` }); continue; }
    const served = await res.text();
    if (served !== expected) {
      const at = [...served].findIndex((ch, i) => ch !== expected[i]);
      behind.push({ file, path: route, reason: `differs at byte ${at < 0 ? Math.min(served.length, expected.length) : at} (served ${served.length} bytes, repository ${expected.length})` });
    }
  }
  return { ok: behind.length === 0, behind, checked: files.length };
}

/** Polls checkOnce until it passes or the attempts run out. */
async function verifyDeploy(siteUrl, { attempts = 1, delayMs = 0, log = () => {}, ...opts } = {}) {
  let result;
  for (let i = 1; i <= attempts; i++) {
    result = await checkOnce(siteUrl, opts);
    if (result.ok) return { ...result, attempts: i };
    log(`attempt ${i}/${attempts}: ${result.behind.length} of ${result.checked} behind`);
    if (i < attempts) await new Promise(r => setTimeout(r, delayMs));
  }
  return { ...result, attempts };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
  const siteUrl = args.find(a => /^https?:\/\//.test(a)) || process.env.SITE_URL;
  if (!siteUrl) {
    console.error("usage: node scripts/verify-deploy.js <site url> [--attempts N] [--delay ms]");
    process.exit(2);
  }
  verifyDeploy(siteUrl, { attempts: opt("--attempts", 1), delayMs: opt("--delay", 20000), log: m => console.log(m) }).then(result => {
    if (result.ok) {
      console.log(`✓ ${siteUrl} is serving this checkout — ${result.checked} files match (attempt ${result.attempts})`);
      return;
    }
    console.error(`✗ ${siteUrl} is not serving this checkout — ${result.behind.length} of ${result.checked} files behind:`);
    for (const b of result.behind) console.error(`  ${b.path}  ${b.reason}`);
    process.exit(1);
  }, e => { console.error(e); process.exit(1); });
}

module.exports = { FILES, checkOnce, verifyDeploy };
