// After a production deploy, fetch every day's share cards from the site.
//
//   node scripts/verify-cards.js https://prayers.dougdevitre.org
//
// Two jobs in one pass. It proves the card function works in production (the
// preview deployments sit behind a login, so this is the first place a real
// request reaches it), and it warms the CDN: each card is rendered once here,
// then served from the cache for a year, so a social site asking for a
// preview never waits on a cold render.
//
// Exits non-zero, naming each card, if any is not a PNG after three tries.

const { allCards, cardPath } = require("../cards.js");

const FORMATS = ["og", "post"];

/**
 * Fetch every card in every format. `fetchImpl` and `delayMs` are injectable
 * so the check itself can be tested. Returns { ok, checked, failed } where
 * failed lists { path, reason }.
 */
async function checkCards(siteUrl, { cards = allCards(), formats = FORMATS, fetchImpl = fetch, concurrency = 6, attempts = 3, delayMs = 2000 } = {}) {
  const base = String(siteUrl).replace(/\/+$/, "");
  const queue = cards.flatMap(card => formats.map(format => cardPath(card, format)));
  const failed = [];
  let checked = 0;

  async function one(path) {
    let reason = "";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await fetchImpl(base + path, { redirect: "manual" });
        const body = Buffer.from(await res.arrayBuffer());
        const type = res.headers.get("content-type") || "";
        if (res.status === 200 && type.startsWith("image/png") && body.subarray(1, 4).toString("latin1") === "PNG") return;
        reason = `${res.status} ${type || "no content-type"}`;
      } catch (e) {
        reason = String(e && e.message || e);
      }
      if (attempt < attempts) await new Promise(r => setTimeout(r, delayMs));
    }
    failed.push({ path, reason });
  }

  async function worker() {
    while (queue.length) {
      const path = queue.shift();
      await one(path);
      checked++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { ok: failed.length === 0, checked, failed };
}

module.exports = { checkCards };

if (require.main === module) {
  const site = process.argv[2];
  if (!site) {
    console.error("usage: node scripts/verify-cards.js <site url>");
    process.exit(2);
  }
  const started = Date.now();
  checkCards(site).then(({ ok, checked, failed }) => {
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    if (ok) {
      console.log(`✓ ${checked} share cards served as PNGs from ${site} (${secs}s)`);
      return;
    }
    for (const f of failed) console.log(`✗ ${f.path}: ${f.reason}`);
    console.log(`✗ ${failed.length} of ${checked} share cards failed`);
    process.exit(1);
  });
}
