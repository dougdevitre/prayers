// After a production deploy, tell search engines which pages changed.
//
//   node scripts/indexnow.js https://prayers.dougdevitre.org [--base <sha>] [--dry-run]
//
// IndexNow (https://www.indexnow.org) is one POST that Bing, Yandex, Seznam,
// Naver and others share; Google does not take part (Search Console covers
// it). The site proves it owns the key by serving it: the key is the name and
// the content of the one <32 hex>.txt file at the root, and it is public by
// design, not a secret.
//
// Only pages the deploy changed are sent: the site files changed between
// --base (default: the commit before HEAD, which for a merge is main before
// the PR) and HEAD, kept when they are pages in the sitemap. Sending every
// page on every deploy is what the protocol asks sites not to do.
//
// Exits non-zero when the search engines refuse the list, so the Deploy
// check shows it; the workflow runs this step with continue-on-error, since a
// search engine being unreachable is no reason to call a deploy broken.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** The key: the one file at the root named <32 hex>.txt, containing its own name. */
function readKey(root = ROOT) {
  const files = fs.readdirSync(root).filter(f => /^[0-9a-f]{32}\.txt$/.test(f));
  if (files.length !== 1) throw new Error(`expected one IndexNow key file at the root, found ${files.length}`);
  const key = files[0].slice(0, -4);
  if (fs.readFileSync(path.join(root, files[0]), "utf8").trim() !== key) throw new Error(`${files[0]} does not contain its own key`);
  return key;
}

/** The file a sitemap URL is served from (cleanUrls: x.html or x/index.html). */
function fileForPath(root, pathname) {
  const base = pathname === "/" ? "index" : pathname.slice(1);
  for (const f of [`${base}.html`, path.join(base, "index.html")]) {
    if (fs.existsSync(path.join(root, f))) return f.split(path.sep).join("/");
  }
  return null;
}

/**
 * Sitemap URLs whose page is among `changedFiles` (repository-relative
 * paths). A change to styles.css or a script is not a page change.
 */
function changedUrls(changedFiles, { root = ROOT, sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8") } = {}) {
  const changed = new Set(changedFiles.map(f => f.split(path.sep).join("/")));
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    .filter(url => changed.has(fileForPath(root, new URL(url).pathname)));
}

/** POST the list. `fetchImpl` is injectable for the tests. Returns { ok, status, sent }. */
async function submit(site, urls, key, { fetchImpl = fetch } = {}) {
  if (!urls.length) return { ok: true, status: null, sent: 0 };
  const host = new URL(site).host;
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${new URL(site).origin}/${key}.txt`, urlList: urls.slice(0, 10000) })
  });
  // 200 accepted, 202 accepted pending the key check.
  return { ok: res.status === 200 || res.status === 202, status: res.status, sent: Math.min(urls.length, 10000) };
}

module.exports = { readKey, changedUrls, submit, fileForPath };

if (require.main === module) {
  const args = process.argv.slice(2);
  const site = args.find(a => /^https?:\/\//.test(a));
  const baseAt = args.indexOf("--base");
  const base = baseAt === -1 ? "HEAD^1" : args[baseAt + 1];
  if (!site) { console.error("usage: node scripts/indexnow.js <site> [--base <sha>] [--dry-run]"); process.exit(2); }
  const files = execFileSync("git", ["diff", "--name-only", base, "HEAD"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const urls = changedUrls(files);
  const key = readKey();
  if (args.includes("--dry-run")) {
    console.log(`${urls.length} changed page${urls.length === 1 ? "" : "s"} would be sent:`);
    for (const u of urls) console.log(`  ${u}`);
    process.exit(0);
  }
  submit(site, urls, key).then(({ ok, status, sent }) => {
    if (!sent) { console.log("No page changed; nothing to send."); return; }
    if (ok) { console.log(`✓ IndexNow accepted ${sent} changed page${sent === 1 ? "" : "s"} (${status})`); return; }
    console.log(`✗ IndexNow answered ${status} for ${sent} page${sent === 1 ? "" : "s"}`);
    process.exit(1);
  }).catch(e => { console.log(`✗ IndexNow unreachable: ${e.message}`); process.exit(1); });
}
