// Tests for the printable 30-day workbook (scripts/build-print-workbook.js),
// in English and in Spanish: it carries every day word for word, in the right
// order with a look back after each week, each QR code opens its own day with
// no tracking, and the help lines, the Scripture and the draft note follow the
// app. No browser: the PDF itself is checked by the build, which fails if
// anything runs off a page.
//
//   npm run test:unit

const assert = require("assert");
const { SITE, LANGS, COPY, daysFor, weekGroups, qrTargets, makeQr, buildHtml } = require("../scripts/build-print-workbook.js");
const { tracks, sosSetsEn } = require("../content.js");
const { esTracks, esSos } = require("../content.es.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const web = require("../scripts/web-source.json");
const rv = require("../scripts/es-source.json");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// A stand-in code per address, so the tests can see which code went where.
const fakeQr = lang => Object.fromEntries(qrTargets(lang).map(url => [url, `<svg data-for="${url}"></svg>`]));
// What a reader sees: the page text without the stylesheet or the markup.
const visible = html => html.replace(/<style>[\s\S]*?<\/style>/, " ").replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const book = {};
for (const lang of LANGS) {
  const { html, pages } = buildHtml({ qr: fakeQr(lang), lang, fontBase: "fonts/" });
  book[lang] = { html, pages, text: visible(html) };
}
const content = { en: tracks.core.days, es: esTracks.core.days };
const sosSet = { en: sosSetsEn[0], es: esSos[0] };

(async () => {
  await test("every day of the 30-day journey is in each workbook, word for word, in its language", () => {
    for (const lang of LANGS) {
      assert.strictEqual(daysFor(lang).length, content[lang].length, lang);
      content[lang].forEach((day, i) => {
        for (const field of day) assert.ok(book[lang].html.includes(esc(field)), `${lang} Day ${i + 1}: ${field.slice(0, 40)}`);
      });
    }
    // The Spanish edition is the Spanish text, not the English with a Spanish frame.
    assert.ok(!book.es.html.includes(esc(tracks.core.days[0][4])), "the English Day 1 prayer in the Spanish workbook");
  });

  await test("the pages run cover, how-to, Steady me now, before Day 1, tracker, the days with a look back after each week, then the close", () => {
    for (const lang of LANGS) {
      const groups = weekGroups(lang);
      const expected = ["cover", "howto", "steady", "begin", "tracker"];
      groups.forEach((group, g) => {
        expected.push(...group.map(() => "day"));
        if (g < groups.length - 1) expected.push("week");
      });
      expected.push("final", "notes", "notes", "about");
      assert.deepStrictEqual(book[lang].pages, expected, lang);
      // The journey's own weeks: a look back after Days 7, 14, 21 and 29.
      assert.deepStrictEqual(groups.slice(0, -1).map(g => g[g.length - 1].n), [7, 14, 21, 29], lang);
    }
  });

  await test("each day's code opens that day in the app, in the workbook's language, with no other parameter", () => {
    assert.deepStrictEqual(qrTargets("en"), [`${SITE}/app`, ...daysFor("en").map(d => `${SITE}/app#${d.n}`)]);
    assert.deepStrictEqual(qrTargets("es"), [`${SITE}/app?lang=es`, ...daysFor("es").map(d => `${SITE}/app?lang=es#${d.n}`)]);
    for (const url of qrTargets("en")) assert.ok(!url.includes("?"), url);
    for (const url of qrTargets("es")) assert.strictEqual(new URL(url).search, "?lang=es", url);
    for (const lang of LANGS) {
      for (const d of daysFor(lang)) {
        assert.ok(book[lang].html.includes(`${esc(COPY[lang].scan(d.n))}</span><span class="qr"><svg data-for="${d.url}">`), `${lang} Day ${d.n}`);
      }
      assert.ok(book[lang].html.includes(`<div class="qr-big"><svg data-for="${qrTargets(lang)[0]}">`), lang);
    }
  });

  await test("the codes are real SVG drawings, one per address", async () => {
    for (const lang of LANGS) {
      const qr = await makeQr(qrTargets(lang));
      assert.deepStrictEqual(Object.keys(qr), qrTargets(lang));
      for (const svg of Object.values(qr)) assert.ok(/^<svg[^>]+viewBox="0 0 \d+ \d+"/.test(svg) && svg.includes("<path"), svg.slice(0, 60));
    }
  });

  await test("the help lines are the app's own, in two boxes, each with every route", () => {
    for (const lang of LANGS) {
      const boxes = book[lang].html.split('<div class="support">').slice(1).map(b => visible(b.split("</div>")[0]));
      assert.strictEqual(boxes.length, 2, `${lang}: Steady me now and the last page`);
      for (const box of boxes) {
        for (const route of ["988", "741741", "1-800-799-7233", "1-800-422-4453", "911", "findahelpline.com", appUi[lang]["sos.textKeyword"]]) {
          assert.ok(box.includes(route), `${lang}: ${route}`);
        }
      }
      for (const key of ["sos.supportIntro", "sos.lifeline", "sos.textLine", "sos.dvLine", "sos.childLine", "sos.emergency", "sos.findHelpline", "sos.disclaimer"]) {
        assert.ok(book[lang].html.includes(esc(appUi[lang][key])), `${lang} ${key}`);
      }
    }
    // Spanish readers get the Spanish routes, as in the app: AYUDA, not HOME.
    assert.ok(!book.es.text.includes("HOME"), "HOME in the Spanish workbook");
  });

  await test("Steady me now is the app's first set, in each language", () => {
    for (const lang of LANGS) {
      for (const field of Object.values(sosSet[lang])) assert.ok(book[lang].html.includes(esc(field)), `${lang}: ${field}`);
      assert.ok(book[lang].html.includes(`<h1 class="page-title">${esc(appUi[lang]["sos.button"])}</h1>`), lang);
    }
  });

  await test("the cover's verse is Ephesians 6:13, World English Bible in English and Reina-Valera 1909 in Spanish", () => {
    const en = web["Ephesians 6:10–13"].slice(web["Ephesians 6:10–13"].indexOf("Therefore"));
    const es = rv["Ephesians 6:10–13"].slice(rv["Ephesians 6:10–13"].indexOf("Por tanto"));
    assert.ok(en.endsWith("having done all, to stand.") && es.endsWith("habiendo acabado todo."));
    assert.ok(book.en.html.includes(`“${esc(en)}”`) && book.es.html.includes(`“${esc(es)}”`));
    assert.ok(book.en.text.includes("World English Bible") && book.es.text.includes("Reina-Valera 1909"));
    // The cover is the journey's own name in each language.
    assert.ok(book.en.html.includes(`<h1 class="cover-title">Stand</h1>`) && book.es.html.includes(`<h1 class="cover-title">Firme</h1>`));
  });

  await test("the draft note follows the app's draft label, in both languages", () => {
    assert.ok(prayerCorpus.meta.reviewNote, "the app still labels its content a draft");
    for (const lang of LANGS) assert.ok(book[lang].html.includes(esc(COPY[lang].draft)), lang);
    const note = prayerCorpus.meta.reviewNote;
    delete prayerCorpus.meta.reviewNote;
    try {
      for (const lang of LANGS) {
        const after = buildHtml({ qr: fakeQr(lang), lang, fontBase: "fonts/" }).html;
        assert.ok(!after.includes(esc(COPY[lang].draft)), `${lang}: the note should go when the label does`);
      }
    } finally { prayerCorpus.meta.reviewNote = note; }
  });

  await test("the workbook loads nothing from the network", () => {
    for (const lang of LANGS) {
      assert.ok(!/(src|href)="https?:/.test(book[lang].html), `${lang}: a remote src or href`);
      assert.ok(!/url\(["']?https?:/.test(book[lang].html), `${lang}: a remote font or image`);
    }
  });

  await test("the workbook's own words follow the glossary in both languages", () => {
    // Its own words only: the days and the Steady me now set are the app's
    // text, which the copy guard leaves alone too (tests/copy.test.js).
    const own = lang => {
      let t = book[lang].text;
      // Longest first, so a short title ("Faith") never breaks a longer line that contains it.
      for (const field of [...content[lang].flat(), ...Object.values(sosSet[lang])].sort((a, b) => b.length - a.length)) t = t.split(field.replace(/\s+/g, " ")).join(" ");
      return t;
    };
    const en = own("en"), es = own("es");
    assert.ok(!/\bSOS\b/.test(en) && !/\bSOS\b/.test(es), "Steady me now / Calma ahora, not SOS");
    const word = en.match(/\b(track|tracks|path)\b/i);
    assert.ok(!word, `a journey, not a track or path: “${word && en.slice(Math.max(0, word.index - 30), word.index + 30)}”`);
    assert.ok(!/[A-Za-z]'[A-Za-z]/.test(en), "a straight apostrophe");
    assert.ok(!/favourite|colour|centre|armour/i.test(en), "UK spelling");
    // Spanish: el Devocionario capitalized, una tarjeta not una imagen, no rescue, no grading.
    for (const [re, why] of [[/\bdevocionario\b/, "el Devocionario, capitalized"], [/\bimagen\b/i, "una tarjeta, not una imagen"], [/rescate/i, "una pausa, no un rescate"], [/bien hecho|te mantuviste firme/i, "no line grades the reader"], [/\bpista\b|\bsendero\b/i, "un camino"]]) {
      assert.ok(!re.test(es), why);
    }
    assert.ok(es.includes("Calma ahora") && es.includes("el Devocionario") && es.includes("el Rosario"), "the Spanish glossary's names");
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll print workbook tests passed.");
})();
