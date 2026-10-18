// Tests for the printable 30-day workbook (scripts/build-print-workbook.js):
// it carries every day word for word, in the right order with a look back
// after each week, each QR code opens its own day with no tracking, and the
// help lines and the draft note follow the app. No browser: the PDF itself is
// checked by the build, which fails if anything runs off a page.
//
//   npm run test:unit

const assert = require("assert");
const { SITE, days, weekGroups, qrTargets, makeQr, buildHtml } = require("../scripts/build-print-workbook.js");
const { tracks } = require("../content.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const web = require("../scripts/web-source.json");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// A stand-in code per address, so the tests can see which code went where.
const fakeQr = Object.fromEntries(qrTargets().map(url => [url, `<svg data-for="${url}"></svg>`]));
const { html, pages } = buildHtml({ qr: fakeQr, fontBase: "fonts/" });
// What a reader sees: the page text without the stylesheet or the markup.
const text = html.replace(/<style>[\s\S]*?<\/style>/, " ").replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ");

(async () => {
  await test("every day of the 30-day journey is in the workbook, word for word", () => {
    assert.strictEqual(days.length, tracks.core.days.length);
    tracks.core.days.forEach((day, i) => {
      for (const field of day) assert.ok(html.includes(esc(field)), `Day ${i + 1}: ${field.slice(0, 40)}`);
    });
  });

  await test("the pages run cover, how-to, Steady me now, before Day 1, tracker, the days with a look back after each week, then the close", () => {
    const groups = weekGroups();
    const expected = ["cover", "howto", "steady", "begin", "tracker"];
    groups.forEach((group, g) => {
      expected.push(...group.map(() => "day"));
      if (g < groups.length - 1) expected.push("week");
    });
    expected.push("final", "notes", "notes", "about");
    assert.deepStrictEqual(pages, expected);
    // The journey's own weeks: a look back after Days 7, 14, 21 and 29.
    assert.deepStrictEqual(groups.slice(0, -1).map(g => g[g.length - 1].n), [7, 14, 21, 29]);
  });

  await test("each day's code opens that day in the app, and no code carries a query or tracking parameter", () => {
    assert.deepStrictEqual(qrTargets(), [`${SITE}/app`, ...days.map(d => `${SITE}/app#${d.n}`)]);
    for (const url of qrTargets()) assert.ok(!url.includes("?"), url);
    for (const d of days) {
      assert.ok(html.includes(`Scan to listen to Day ${d.n}</span><span class="qr"><svg data-for="${SITE}/app#${d.n}">`), `Day ${d.n}`);
    }
    assert.ok(html.includes(`<div class="qr-big"><svg data-for="${SITE}/app">`));
  });

  await test("the codes are real SVG drawings, one per address", async () => {
    const qr = await makeQr();
    assert.deepStrictEqual(Object.keys(qr), qrTargets());
    for (const svg of Object.values(qr)) assert.ok(/^<svg[^>]+viewBox="0 0 \d+ \d+"/.test(svg) && svg.includes("<path"), svg.slice(0, 60));
  });

  await test("the help lines are the app's own, on Steady me now and on the last page", () => {
    for (const route of ["988", "741741", "1-800-799-7233", "88788", "1-800-422-4453", "911", "findahelpline.com"]) {
      assert.strictEqual(text.split(route).length - 1, 2, `${route} should appear twice`);
    }
    for (const key of ["sos.supportIntro", "sos.lifeline", "sos.dvLine", "sos.childLine", "sos.emergency", "sos.disclaimer"]) {
      assert.ok(html.includes(esc(appUi.en[key])), key);
    }
  });

  await test("the draft note follows the app's draft label", () => {
    assert.ok(prayerCorpus.meta.reviewNote, "the app still labels its content a draft");
    assert.ok(text.includes("a draft awaiting review by a pastoral advisor"));
    const note = prayerCorpus.meta.reviewNote;
    delete prayerCorpus.meta.reviewNote;
    try {
      const after = buildHtml({ qr: fakeQr, fontBase: "fonts/" }).html;
      assert.ok(!after.includes("a draft awaiting review"), "the note should go when the label does");
    } finally { prayerCorpus.meta.reviewNote = note; }
  });

  await test("the cover's verse is Ephesians 6:13 as the World English Bible words it", () => {
    const source = web["Ephesians 6:10–13"];
    const verse = source.slice(source.indexOf("Therefore"));
    assert.ok(verse.endsWith("having done all, to stand."));
    assert.ok(html.includes(`“${esc(verse)}”`));
  });

  await test("the workbook loads nothing from the network", () => {
    assert.ok(!/(src|href)="https?:/.test(html), "no remote src or href");
    assert.ok(!/url\(["']?https?:/.test(html), "no remote fonts or images");
  });

  await test("the workbook's own words follow the glossary: no SOS, track or path, curly apostrophes, US spelling", () => {
    // Its own words only: the days and the Steady me now set are the app's
    // text, which the copy guard leaves alone too (tests/copy.test.js).
    const { sosSetsEn } = require("../content.js");
    let own = text;
    // Longest first, so a short title ("Faith") never breaks a longer line that contains it.
    for (const field of [...tracks.core.days.flat(), ...Object.values(sosSetsEn[0])].sort((a, b) => b.length - a.length)) own = own.split(field.replace(/\s+/g, " ")).join(" ");
    assert.ok(!/\bSOS\b/.test(own), "Steady me now, not SOS");
    const word = own.match(/\b(track|tracks|path)\b/i);
    assert.ok(!word, `a journey, not a track or path: “${word && own.slice(Math.max(0, word.index - 30), word.index + 30)}”`);
    assert.ok(!/[A-Za-z]'[A-Za-z]/.test(own), "a straight apostrophe");
    assert.ok(!/favourite|colour|centre|armour/i.test(own), "UK spelling");
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll print workbook tests passed.");
})();
