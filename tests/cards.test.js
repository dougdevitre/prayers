// Tests for cards.js (what each day's share card says and where it lives) and
// api/card.js (the function that renders it).
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { FORMATS, TEXT_BUDGET, cardFor, cardForSlug, cardPath, latestCardPath, parseCardFile, allCards, firstSentence } = require("../cards.js");
const handler = require("../api/card.js");
const { checkCards } = require("../scripts/verify-cards.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

/** Call the handler the way Vercel does, after the /cards rewrite. */
async function request(method, lang, track, file) {
  const res = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    removeHeader(k) { delete this.headers[k.toLowerCase()]; },
    end(b) { this.body = b || null; }
  };
  const q = new URLSearchParams({ lang, track, file });
  await handler({ method, url: `/api/card?${q}` }, res);
  return res;
}
const pngSize = b => [b.readUInt32BE(16), b.readUInt32BE(20)];
const fileOf = (card, format) => path.basename(cardPath(card, format));

(async () => {
  await test("every day in both languages has a card whose slug is a generated page", () => {
    const all = allCards();
    assert.strictEqual(all.length, 216);
    for (const c of all) {
      const dir = c.track === "core" ? "day" : path.join("track", c.track);
      const page = path.join(ROOT, c.lang === "es" ? "es" : "", dir, `${c.slug}.html`);
      assert.ok(fs.existsSync(page), `no page for ${cardPath(c, "post")}`);
    }
    assert.strictEqual(new Set(all.map(c => cardPath(c, "post"))).size, 216);
  });

  await test("a card shows the day's verse, reflection and prayer, and the site", () => {
    const c = cardFor("en", "core", 0);
    assert.strictEqual(c.title, "Stand");
    assert.strictEqual(c.ref, "Ephesians 6:10–13");
    assert.ok(c.reflection.startsWith("The first command of spiritual combat"));
    assert.ok(c.prayer.startsWith("Father, establish me within"));
    assert.strictEqual(c.prayerLead, "Father, establish me within before I attempt to change anything around me.");
    assert.strictEqual(c.site, "prayers.dougdevitre.org");
    assert.strictEqual(cardPath(c, "post"), `/cards/en/core/01-stand.${c.hash}.post.png`);
    const es = cardFor("es", "core", 0);
    assert.strictEqual(es.title, "Firmeza");
    assert.deepStrictEqual([es.labels.day, es.labels.prayer], ["DÍA", "ORACIÓN"]);
    assert.strictEqual(cardForSlug("es", "core", "01-firmeza").hash, es.hash);
  });

  await test("the hash is stable, and changes when anything the card shows changes", () => {
    const a = cardFor("en", "wall", 3), b = cardFor("en", "wall", 3);
    assert.match(a.hash, /^[0-9a-f]{8}$/);
    assert.strictEqual(a.hash, b.hash);
    const hashes = new Set(allCards().map(c => c.hash));
    assert.strictEqual(hashes.size, 216, "two different days share a hash");
    assert.notStrictEqual(cardFor("en", "core", 0).hash, cardFor("es", "core", 0).hash);
  });

  await test("only well-formed card addresses parse", () => {
    assert.deepStrictEqual(parseCardFile("en", "core", "01-stand.0123abcd.og.png"),
      { lang: "en", track: "core", slug: "01-stand", hash: "0123abcd", format: "og" });
    for (const [l, t, f] of [["fr", "core", "01-stand.0123abcd.og.png"], ["en", "core", "01-stand.0123abcd.gif"],
      ["en", "core", "01-stand.0123ABCD.og.png"], ["en", "core", "../x.0123abcd.og.png"], ["en", "Core!", "01-stand.0123abcd.og.png"],
      ["en", "core", "01-stand.0123abc.post.png"], ["en", "core", ""]]) {
      assert.strictEqual(parseCardFile(l, t, f), null, `${l} ${t} ${f}`);
    }
    assert.strictEqual(cardFor("en", "core", 99), null);
    assert.strictEqual(cardFor("en", "nope", 0), null);
    assert.strictEqual(cardForSlug("en", "core", "99-nope"), null);
  });

  await test(`no day's shown text is longer than the layout was checked for (${TEXT_BUDGET} characters)`, () => {
    for (const c of allCards()) {
      const n = c.verse.length + c.reflection.length + c.prayer.length;
      assert.ok(n <= TEXT_BUDGET, `${cardPath(c, "post")}: ${n} characters; check the card layout, then raise TEXT_BUDGET`);
      // The link preview holds at most a two-line title and about 400 characters beneath it.
      assert.ok(c.title.length <= 40 && c.reflection.length + c.prayerLead.length <= 400, `${cardPath(c, "og")} is too long for the preview`);
    }
  });

  await test("the prayer's first sentence ends at its first full stop, question or exclamation", () => {
    assert.strictEqual(firstSentence("Lord, help. Amen."), "Lord, help.");
    assert.strictEqual(firstSentence("¿Hasta cuándo? Señor."), "¿Hasta cuándo?");
    assert.strictEqual(firstSentence("No stop at all"), "No stop at all");
  });

  await test("the function renders both formats as PNGs at their sizes, cached for a year", async () => {
    for (const [lang, track, day] of [["en", "core", 0], ["es", "wall", 3]]) {
      const c = cardFor(lang, track, day);
      for (const format of Object.keys(FORMATS)) {
        const res = await request("GET", lang, track, fileOf(c, format));
        assert.strictEqual(res.statusCode, 200, `${format} ${res.statusCode}`);
        assert.strictEqual(res.headers["content-type"], "image/png");
        assert.match(res.headers["cache-control"], /max-age=31536000.*immutable/);
        assert.strictEqual(res.body.subarray(1, 4).toString("latin1"), "PNG");
        assert.deepStrictEqual(pngSize(res.body), [FORMATS[format].width, FORMATS[format].height]);
      }
    }
  });

  await test("an out-of-date hash, or \"latest\", redirects to the card's current address", async () => {
    const c = cardFor("en", "core", 0);
    const res = await request("GET", "en", "core", "01-stand.00000000.post.png");
    assert.strictEqual(res.statusCode, 308);
    assert.strictEqual(res.headers.location, cardPath(c, "post"));
    assert.strictEqual(res.body, null);
    const es = cardFor("es", "wall", 3);
    const latest = await request("GET", "es", "wall", path.basename(latestCardPath("es", "wall", es.slug, "og")));
    assert.strictEqual(latest.statusCode, 308);
    assert.strictEqual(latest.headers.location, cardPath(es, "og"));
    assert.match(latest.headers["cache-control"], /max-age=300/);
  });

  await test("unknown days and malformed addresses are 404, other methods 405, HEAD has no body", async () => {
    assert.strictEqual((await request("GET", "en", "core", "99-nope.0123abcd.og.png")).statusCode, 404);
    assert.strictEqual((await request("GET", "en", "core", "01-stand.svg")).statusCode, 404);
    assert.strictEqual((await request("GET", "de", "core", "01-stand.0123abcd.og.png")).statusCode, 404);
    const post = await request("POST", "en", "core", fileOf(cardFor("en", "core", 0), "og"));
    assert.strictEqual(post.statusCode, 405);
    assert.strictEqual(post.headers.allow, "GET, HEAD");
    const head = await request("HEAD", "en", "core", fileOf(cardFor("en", "core", 0), "og"));
    assert.strictEqual(head.statusCode, 200);
    assert.strictEqual(head.headers["content-type"], "image/png");
    assert.strictEqual(head.body, null);
  });

  await test("the deploy check fetches every card in both formats and names the ones that fail", async () => {
    const cards = allCards().slice(0, 3);
    const seen = [];
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const reply = (status, type, body) => ({ status, headers: { get: () => type }, arrayBuffer: async () => body });
    const good = async url => { seen.push(url); return reply(200, "image/png", png); };
    const all = await checkCards("https://site.example/", { cards, fetchImpl: good, delayMs: 0 });
    assert.deepStrictEqual([all.ok, all.checked, all.failed.length], [true, 6, 0]);
    assert.ok(seen.every(u => u.startsWith("https://site.example/cards/")));
    // One card keeps failing: it is retried, then named; a flaky one recovers.
    const bad = cardPath(cards[1], "og");
    let flaky = 0;
    const mixed = async url => {
      if (url.endsWith(bad)) return reply(500, "", Buffer.alloc(0));
      if (url.endsWith(cardPath(cards[2], "post")) && flaky++ === 0) throw new Error("socket hang up");
      return reply(200, "image/png", png);
    };
    const some = await checkCards("https://site.example", { cards, fetchImpl: mixed, delayMs: 0 });
    assert.strictEqual(some.ok, false);
    assert.deepStrictEqual(some.failed, [{ path: bad, reason: "500 no content-type" }]);
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll share card tests passed.");
})();
