// Tests for the printable 30-day workbook (scripts/build-print-workbook.js),
// in English and in Spanish, in its print and fillable editions: it carries
// every day word for word, in the right order with a look back after each
// week, each QR code opens its own day with no tracking, and the help lines,
// the Scripture and the draft note follow the app. The fillable edition has a
// field for every place to write, tick or choose, and its form
// (scripts/workbook-form.js) runs no script and sends nothing anywhere. No
// browser: the PDF itself is checked by the build, which fails if anything
// runs off a page.
//
//   npm run test:unit

const assert = require("assert");
const { SITE, LANGS, COPY, WORKBOOK_JOURNEYS, copyFor, daysFor, weekGroups, qrTargets, makeQr, buildHtml } = require("../scripts/build-print-workbook.js");
const { addFields } = require("../scripts/workbook-form.js");
const { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, PDFRef, AcroButtonFlags } = require("pdf-lib");
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
const unesc = s => s.replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// A stand-in code per address, so the tests can see which code went where.
const fakeQr = lang => Object.fromEntries(qrTargets(lang).map(url => [url, `<svg data-for="${url}"></svg>`]));
// What a reader sees: the page text without the stylesheet or the markup.
const visible = html => unesc(html.replace(/<style>[\s\S]*?<\/style>/, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
// Both editions of both languages: EDITIONS.print.en, EDITIONS.fillable.es...
const EDITIONS = { print: {}, fillable: {} };
for (const lang of LANGS) {
  for (const [edition, fillable] of [["print", false], ["fillable", true]]) {
    const { html, pages } = buildHtml({ qr: fakeQr(lang), lang, fillable, fontBase: "fonts/" });
    EDITIONS[edition][lang] = { html, pages, text: visible(html), C: copyFor(lang, fillable) };
  }
}
const book = EDITIONS.print, fill = EDITIONS.fillable;
const each = fn => { for (const edition of Object.keys(EDITIONS)) for (const lang of LANGS) fn(EDITIONS[edition][lang], `${lang} ${edition}`, lang, edition); };
const content = { en: tracks.core.days, es: esTracks.core.days };
const sosSet = { en: sosSetsEn[0], es: esSos[0] };

// The fillable edition's form as its markup describes it: one entry per widget, with its page.
function widgetsIn(html) {
  return html.split('<section class="page ').slice(1).flatMap((section, page) =>
    [...section.matchAll(/<[a-z]+\b[^>]*\bdata-field="[^"]*"[^>]*>/g)].map(([tag]) => {
      const attr = key => { const m = tag.match(new RegExp(`\\bdata-${key}="([^"]*)"`)); return m ? unesc(m[1]) : undefined; };
      return { page, name: attr("field"), kind: attr("kind"), tip: attr("tip"), value: attr("value"), label: attr("label"), look: attr("look"), multiline: attr("multiline") === "1", grow: attr("grow"), size: attr("size") };
    }));
}
const formOf = lang => widgetsIn(fill[lang].html);

(async () => {
  await test("every day of the 30-day journey is in each workbook, word for word, in its language", () => {
    each(({ html }, name, lang) => {
      assert.strictEqual(daysFor(lang).length, content[lang].length, name);
      content[lang].forEach((day, i) => {
        for (const field of day) assert.ok(html.includes(esc(field)), `${name} Day ${i + 1}: ${field.slice(0, 40)}`);
      });
    });
    // The Spanish edition is the Spanish text, not the English with a Spanish frame.
    for (const edition of Object.values(EDITIONS)) assert.ok(!edition.es.html.includes(esc(tracks.core.days[0][4])), "the English Day 1 prayer in a Spanish workbook");
  });

  // Shelter, the second 30-day journey, has the same workbook: the checks
  // above and below run on Stand's, and this one holds Shelter's to the same
  // promises, against Stand's as the reference.
  await test("Shelter's workbook: every day word for word, the same pages and form, its own codes, files and cover", () => {
    assert.deepStrictEqual(WORKBOOK_JOURNEYS, ["core", "shelter"]);
    const days = { en: tracks.shelter.days, es: esTracks.shelter.days };
    for (const lang of LANGS) {
      const urls = qrTargets(lang, "shelter");
      const qr = Object.fromEntries(urls.map(url => [url, `<svg data-for="${url}"></svg>`]));
      for (const fillable of [false, true]) {
        const name = `shelter ${lang} ${fillable ? "fillable" : "print"}`;
        const { html, pages } = buildHtml({ qr, lang, fillable, journey: "shelter", fontBase: "fonts/" });
        const C = copyFor(lang, fillable, "shelter");
        days[lang].forEach((day, i) => { for (const field of day) assert.ok(html.includes(esc(field)), `${name} Day ${i + 1}: ${field.slice(0, 40)}`); });
        assert.ok(!html.includes(esc(tracks.core.days[0][4])) && !html.includes(esc(esTracks.core.days[0][4])), `${name}: Stand's Day 1 prayer`);
        assert.deepStrictEqual(pages, (fillable ? fill : book)[lang].pages, `${name}: the same pages as Stand's`);
        if (fillable) assert.deepStrictEqual(widgetsIn(html).map(w => [w.name, w.kind]), formOf(lang).map(w => [w.name, w.kind]), `${name}: the same form as Stand's`);
        // Every code opens Shelter, in the workbook's language, with nothing else.
        for (const d of daysFor(lang, "shelter")) assert.ok(html.includes(`<svg data-for="${d.url}">`), `${name} Day ${d.n}`);
        assert.ok(html.includes(`<div class="qr-big">${fillable ? `<a href="${esc(urls[0])}">` : ""}<svg data-for="${urls[0]}">`), name);
        assert.ok(html.includes(`<title>${esc(C.docTitle)}</title>`) && C.docTitle.startsWith(lang === "es" ? "Abrigo" : "Shelter"), name);
        // The cover verse is quoted from the source text, as every verse is.
        assert.ok((lang === "es" ? rv : web)[C.epigraph.ref.replace(/^Salmo /, "Psalm ")].includes(C.epigraph.from), `${name}: cover verse`);
        // The last page points to Stand, as Stand's points to Shelter.
        assert.ok(visible(html).includes(`${lang === "es" ? "Firme" : "Stand"} (30 ${C.daysWord})`), `${name}: Stand on the last page`);
        assert.ok((fillable ? fill : book)[lang].text.includes(`${lang === "es" ? "Abrigo" : "Shelter"} (30 ${C.daysWord})`), `${lang}: Shelter on Stand's last page`);
      }
      for (const url of urls) assert.strictEqual(new URL(url).search, lang === "es" ? "?lang=es&track=shelter" : "?track=shelter", url);
    }
    const files = WORKBOOK_JOURNEYS.flatMap(j => LANGS.flatMap(lang => [copyFor(lang, false, j).file, copyFor(lang, true, j).file]));
    assert.strictEqual(new Set(files).size, files.length, "every workbook file has its own name");
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
      // The fillable edition has the same pages, in the same order.
      assert.deepStrictEqual(fill[lang].pages, expected, `${lang} fillable`);
      // The journey's own weeks: a look back after Days 7, 14, 21 and 29.
      assert.deepStrictEqual(groups.slice(0, -1).map(g => g[g.length - 1].n), [7, 14, 21, 29], lang);
    }
  });

  await test("each day's code opens that day in the app, in the workbook's language, with no other parameter", () => {
    assert.deepStrictEqual(qrTargets("en"), [`${SITE}/app`, ...daysFor("en").map(d => `${SITE}/app#${d.n}`)]);
    assert.deepStrictEqual(qrTargets("es"), [`${SITE}/app?lang=es`, ...daysFor("es").map(d => `${SITE}/app?lang=es#${d.n}`)]);
    for (const url of qrTargets("en")) assert.ok(!url.includes("?"), url);
    for (const url of qrTargets("es")) assert.strictEqual(new URL(url).search, "?lang=es", url);
    each(({ html, C }, name, lang, edition) => {
      // In the fillable edition each code is also a link to the same address.
      const code = url => edition === "fillable" ? `<a href="${url}"><svg data-for="${url}">` : `<svg data-for="${url}">`;
      for (const d of daysFor(lang)) {
        assert.ok(html.includes(`${esc(C.scan(d.n))}</span><span class="qr">${code(d.url)}`), `${name} Day ${d.n}`);
      }
      assert.ok(html.includes(`<div class="qr-big">${code(qrTargets(lang)[0])}`), name);
    });
  });

  await test("the codes are real SVG drawings, one per address", async () => {
    for (const lang of LANGS) {
      const qr = await makeQr(qrTargets(lang));
      assert.deepStrictEqual(Object.keys(qr), qrTargets(lang));
      for (const svg of Object.values(qr)) assert.ok(/^<svg[^>]+viewBox="0 0 \d+ \d+"/.test(svg) && svg.includes("<path"), svg.slice(0, 60));
    }
  });

  await test("the help lines are the app's own, in two boxes, each with every route", () => {
    each(({ html }, name, lang) => {
      const boxes = html.split('<div class="support">').slice(1).map(b => visible(b.split("</div>")[0]));
      assert.strictEqual(boxes.length, 2, `${name}: Steady me now and the last page`);
      for (const box of boxes) {
        for (const route of ["988", "741741", "1-800-799-7233", "1-800-422-4453", "911", "findahelpline.com", appUi[lang]["sos.textKeyword"]]) {
          assert.ok(box.includes(route), `${name}: ${route}`);
        }
      }
      for (const key of ["sos.supportIntro", "sos.lifeline", "sos.textLine", "sos.dvLine", "sos.childLine", "sos.emergency", "sos.findHelpline", "sos.disclaimer"]) {
        assert.ok(html.includes(esc(appUi[lang][key])), `${name} ${key}`);
      }
    });
    // Spanish readers get the Spanish routes, as in the app: HOLA, not HOME.
    assert.ok(!book.es.text.includes("HOME") && !fill.es.text.includes("HOME"), "HOME in a Spanish workbook");
  });

  await test("Steady me now is the app's first set, in each language", () => {
    each(({ html }, name, lang) => {
      for (const field of Object.values(sosSet[lang])) assert.ok(html.includes(esc(field)), `${name}: ${field}`);
      assert.ok(html.includes(`<h1 class="page-title">${esc(appUi[lang]["sos.button"])}</h1>`), name);
    });
  });

  await test("the cover's verse is Ephesians 6:13, World English Bible in English and Reina-Valera 1909 in Spanish", () => {
    const en = web["Ephesians 6:10–13"].slice(web["Ephesians 6:10–13"].indexOf("Therefore"));
    const es = rv["Ephesians 6:10–13"].slice(rv["Ephesians 6:10–13"].indexOf("Por tanto"));
    assert.ok(en.endsWith("having done all, to stand.") && es.endsWith("habiendo acabado todo."));
    for (const edition of Object.values(EDITIONS)) {
      assert.ok(edition.en.html.includes(`“${esc(en)}”`) && edition.es.html.includes(`“${esc(es)}”`));
      assert.ok(edition.en.text.includes("World English Bible") && edition.es.text.includes("Reina-Valera 1909"));
      // The cover is the journey's own name in each language.
      assert.ok(edition.en.html.includes(`<h1 class="cover-title">Stand</h1>`) && edition.es.html.includes(`<h1 class="cover-title">Firme</h1>`));
    }
  });

  await test("the draft note follows the app's draft label, in both languages and both editions", () => {
    const note = prayerCorpus.meta.reviewNote;
    // Once the review is done, the label is gone and so is the note.
    each(({ html, C }, name) => assert.strictEqual(html.includes(esc(C.draft)), Boolean(note), name));
    if (!note) return;
    each(({ html, C }, name) => assert.ok(html.includes(esc(`${C.edition} ${C.draft}`)), name));
    delete prayerCorpus.meta.reviewNote;
    try {
      each(({ C }, name, lang, edition) => {
        const after = buildHtml({ qr: fakeQr(lang), lang, fillable: edition === "fillable", fontBase: "fonts/" }).html;
        assert.ok(!after.includes(esc(C.draft)) && after.includes(esc(C.edition)), `${name}: the note should go when the label does`);
      });
    } finally { prayerCorpus.meta.reviewNote = note; }
  });

  await test("the workbook loads nothing from the network, and the fillable edition links only to the app's own days", () => {
    each(({ html }, name, lang, edition) => {
      assert.ok(!/src="https?:/.test(html), `${name}: a remote src`);
      assert.ok(!/url\(["']?https?:/.test(html), `${name}: a remote font or image`);
      const links = [...html.matchAll(/href="([^"]*)"/g)].map(m => unesc(m[1]));
      // Print: no links at all. Fillable: the codes, each once, and nothing else.
      assert.deepStrictEqual(links, edition === "fillable" ? qrTargets(lang) : [], name);
    });
  });

  await test("the workbook's own words follow the glossary in both languages", () => {
    // Its own words only: the days and the Steady me now set are the app's
    // text, which the copy guard leaves alone too (tests/copy.test.js).
    const own = ({ text }, lang) => {
      let t = text;
      // Longest first, so a short title ("Faith") never breaks a longer line that contains it.
      for (const field of [...content[lang].flat(), ...Object.values(sosSet[lang])].sort((a, b) => b.length - a.length)) t = t.split(field.replace(/\s+/g, " ")).join(" ");
      return t;
    };
    for (const edition of Object.keys(EDITIONS)) {
      const en = own(EDITIONS[edition].en, "en"), es = own(EDITIONS[edition].es, "es");
      assert.ok(!/\bSOS\b/.test(en) && !/\bSOS\b/.test(es), `${edition}: Steady me now / Calma ahora, not SOS`);
      const word = en.match(/\b(track|tracks|path)\b/i);
      assert.ok(!word, `${edition}: a journey, not a track or path: “${word && en.slice(Math.max(0, word.index - 30), word.index + 30)}”`);
      assert.ok(!/[A-Za-z]'[A-Za-z]/.test(en), `${edition}: a straight apostrophe`);
      assert.ok(!/favourite|colour|centre|armour/i.test(en), `${edition}: UK spelling`);
      // Spanish: el Devocionario capitalized, una tarjeta not una imagen, no rescue, no grading.
      for (const [re, why] of [[/\bdevocionario\b/, "el Devocionario, capitalized"], [/\bimagen\b/i, "una tarjeta, not una imagen"], [/rescate/i, "una pausa, no un rescate"], [/bien hecho|te mantuviste firme/i, "no line grades the reader"], [/\bpista\b|\bsendero\b/i, "un camino"]]) {
        assert.ok(!re.test(es), `${edition}: ${why}`);
      }
      assert.ok(es.includes("Calma ahora") && es.includes("el Devocionario") && es.includes("el Rosario"), `${edition}: the Spanish glossary's names`);
    }
  });

  await test("the print edition carries no form, and the fillable edition types into boxes, not ruled lines", () => {
    for (const lang of LANGS) {
      assert.ok(!/data-field|data-mark|<a /.test(book[lang].html), `${lang}: form markup in the print edition`);
      assert.ok(!book[lang].html.includes('class="fillable"') && fill[lang].html.includes('<body class="fillable">'), lang);
      // Every writing area of the fillable edition is a field.
      const areas = fill[lang].html.match(/<div class="lines"[^>]*>/g);
      assert.ok(areas.length && areas.every(tag => /data-kind="text"/.test(tag) && /data-multiline="1"/.test(tag)), lang);
    }
  });

  await test("the fillable edition has one field for every place to write, tick or choose, the same in both languages", () => {
    const pad = n => String(n).padStart(2, "0");
    for (const lang of LANGS) {
      const form = formOf(lang);
      const fields = new Map();
      for (const w of form) {
        if (!fields.has(w.name)) fields.set(w.name, { kind: w.kind, tip: w.tip, widgets: [] });
        const f = fields.get(w.name);
        assert.strictEqual(w.kind, f.kind, `${lang} ${w.name}: one kind`);
        assert.strictEqual(w.tip, f.tip, `${lang} ${w.name}: one tooltip`);
        assert.ok(w.tip && w.tip.trim(), `${lang} ${w.name}: a tooltip`);
        assert.ok(w.kind === "text" || ["check", "ring", "dot", "gold"].includes(w.look), `${lang} ${w.name}: a look`);
        f.widgets.push(w);
      }
      const kindOf = name => fields.get(name) && fields.get(name).kind;
      const values = name => fields.get(name).widgets.map(w => w.value).join(",");
      // The person, the pause, the start.
      for (const name of ["cover-name", "cover-began", "begin-when", "begin-where"]) assert.strictEqual(kindOf(name), "text", `${lang} ${name}`);
      for (const name of ["steady-1", "steady-2", "steady-3", "begin-afraid", "begin-hoping", "begin-walking", "final-q1", "final-q2", "final-q3", "final-q4", "notes-1", "notes-2"]) {
        assert.ok(kindOf(name) === "text" && fields.get(name).widgets[0].multiline, `${lang} ${name}`);
      }
      for (const k of [1, 2, 3]) assert.strictEqual(kindOf(`steady-breath-${k}`), "check", `${lang} breath ${k}`);
      for (const name of ["steady-before", "steady-after", "begin-fear"]) assert.strictEqual(values(name), "1,2,3,4,5", `${lang} ${name}`);
      // Each day: its date, two ticks, its check-in and its three prompts. The
      // check-in shows on the day, the tracker's chart and the week's chart;
      // "Done" is also the tracker's "Practice" tick.
      const pages = fill[lang].pages, tracker = pages.indexOf("tracker");
      const nth = (kind, k) => { let seen = 0; return pages.findIndex(p => p === kind && ++seen === k); };
      const groups = weekGroups(lang);
      const pagesOf = name => fields.get(name).widgets.map(w => w.page);
      const five = page => Array(5).fill(page);
      for (const d of daysFor(lang)) {
        const n = pad(d.n), own = nth("day", d.n);
        const g = groups.findIndex(group => group.some(x => x.n === d.n));
        const week = g < groups.length - 1 ? nth("week", g + 1) : null; // Day 30 has no week page
        assert.strictEqual(kindOf(`day-${n}-date`), "text", `${lang} Day ${d.n} date`);
        for (const q of [1, 2, 3]) assert.ok(kindOf(`day-${n}-q${q}`) === "text" && fields.get(`day-${n}-q${q}`).widgets[0].multiline, `${lang} Day ${d.n} q${q}`);
        assert.deepStrictEqual(pagesOf(`day-${n}-said`), [own], `${lang} Day ${d.n} said`);
        assert.deepStrictEqual(pagesOf(`day-${n}-prayed`), [tracker], `${lang} Day ${d.n} prayed`);
        assert.deepStrictEqual(pagesOf(`day-${n}-done`), [tracker, own], `${lang} Day ${d.n}: done on the tracker and the day`);
        assert.deepStrictEqual(pagesOf(`day-${n}-before`), [...five(tracker), ...five(own), ...(week === null ? [] : five(week))], `${lang} Day ${d.n} before`);
        assert.deepStrictEqual(pagesOf(`day-${n}-after`), [...five(own), ...(week === null ? [] : five(week))], `${lang} Day ${d.n} after`);
        for (const key of ["before", "after"]) {
          const name = `day-${n}-${key}`;
          assert.strictEqual(values(name), Array(pagesOf(name).length / 5).fill("1,2,3,4,5").join(","), `${lang} Day ${d.n} ${key}: 1 to 5 in each place`);
        }
      }
      // Each week: the declaration to keep, one choice per day, and three prompts.
      weekGroups(lang).slice(0, -1).forEach((group, g) => {
        assert.strictEqual(values(`week-${g + 1}-keep`), group.map(d => d.n).join(","), `${lang} week ${g + 1} keep`);
        assert.deepStrictEqual(fields.get(`week-${g + 1}-keep`).widgets.map(w => w.label), group.map(d => copyFor(lang, true).day(d.n)), `${lang} week ${g + 1} labels`);
        for (const q of [1, 2, 3]) assert.strictEqual(kindOf(`week-${g + 1}-q${q}`), "text", `${lang} week ${g + 1} q${q}`);
      });
      assert.strictEqual(fields.size, 308, `${lang}: fields`);
    }
    // Same names, kinds and widgets in both languages; only the tooltips differ.
    const shape = lang => formOf(lang).map(w => [w.page, w.name, w.kind, w.value, w.look].join(" "));
    assert.deepStrictEqual(shape("es"), shape("en"));
    assert.ok(formOf("es").find(w => w.name === "day-07-q1").tip.startsWith("Día 7 · ¿Qué me dice hoy el miedo?"));
  });

  await test("the form is real fields that run no script, send nothing, and answer once in every place", async () => {
    // The form layer on a blank 43-page document, with each widget at a stand-in place.
    const blank = await PDFDocument.create();
    for (let i = 0; i < 43; i++) blank.addPage([612, 792]);
    const perPage = {};
    const widgets = formOf("en").map(w => {
      const i = perPage[w.page] = (perPage[w.page] || 0) + 1;
      return { ...w, hit: { x: 20 + (i % 25) * 30, y: 20 + Math.floor(i / 25) * 30, w: 24, h: 24 } };
    });
    const pdf = await PDFDocument.load(await addFields(await blank.save(), widgets));
    const form = pdf.getForm();
    assert.strictEqual(form.getFields().length, 308);

    // Nothing anywhere in the file runs, opens, submits, imports or launches.
    const found = [];
    const seen = new Set();
    const walk = obj => {
      if (obj instanceof PDFRef) { if (!seen.has(obj.tag)) { seen.add(obj.tag); walk(pdf.context.lookup(obj)); } return; }
      if (obj instanceof PDFStream) return walk(obj.dict);
      if (obj instanceof PDFArray) return obj.asArray().forEach(walk);
      if (!(obj instanceof PDFDict)) return;
      for (const [key, value] of obj.entries()) {
        if (["JS", "JavaScript", "AA", "OpenAction", "A", "XFA", "EmbeddedFiles", "SubmitForm", "ImportData", "Launch", "URI"].includes(key.decodeText())) found.push(key.decodeText());
        walk(value);
      }
    };
    walk(pdf.context.trailerInfo.Root);
    assert.deepStrictEqual(found, [], "no script and no action");
    const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
    assert.ok(!acroForm.has(PDFName.of("NeedAppearances")), "the file's own looks, not the viewer's");
    assert.ok(acroForm.lookup(PDFName.of("DR")).lookup(PDFName.of("Font")).has(PDFName.of("Helvetica")), "the typing font is named");

    // Tooltips on every field and every widget; a radio button's names its choice.
    for (const field of form.getFields()) {
      assert.ok(field.acroField.dict.has(PDFName.of("TU")), field.getName());
      for (const widget of field.acroField.getWidgets()) assert.ok(widget.dict.has(PDFName.of("TU")), field.getName());
    }
    const tu = w => w.dict.lookup(PDFName.of("TU")).decodeText();
    assert.strictEqual(tu(form.getRadioGroup("day-07-before").acroField.getWidgets()[2]), "Day 7 · Fear check-in · Before I prayed · 3");

    // A check-in is one choice in all three places: each value names its own
    // "on" state, with no /Opt list, and the buttons turn on in unison.
    const radio = form.getRadioGroup("day-01-before").acroField;
    assert.ok(!radio.dict.has(PDFName.of("Opt")));
    assert.ok(radio.hasFlag(AcroButtonFlags.Radio) && radio.hasFlag(AcroButtonFlags.RadiosInUnison) && !radio.hasFlag(AcroButtonFlags.NoToggleToOff));
    const states = radio.getWidgets().map(w => w.getOnValue().decodeText());
    assert.deepStrictEqual(states, ["1", "2", "3", "4", "5", "1", "2", "3", "4", "5", "1", "2", "3", "4", "5"]);
    radio.setValue(PDFName.of("3"));
    assert.deepStrictEqual(radio.getWidgets().map(w => w.getAppearanceState().decodeText()).filter(s => s !== "Off"), ["3", "3", "3"]);
    // "Done" and the tracker's "Practice" are one tick; the prompts are multi-line.
    assert.strictEqual(form.getCheckBox("day-07-done").acroField.getWidgets().length, 2);
    assert.ok(form.getTextField("day-07-q1").isMultiline() && !form.getTextField("day-07-date").isMultiline());
  });

  await test("the fillable edition says where what you type is kept, and how to save it", () => {
    for (const lang of LANGS) {
      const C = copyFor(lang, true);
      assert.ok(fill[lang].html.includes(esc(C.privateBody)) && fill[lang].html.includes(esc(C.howLead)), lang);
      // Only the fillable edition says it; the print one keeps its own words.
      assert.ok(!book[lang].html.includes(esc(C.privateBody)) && book[lang].html.includes(esc(COPY[lang].privateBody)), lang);
      assert.notStrictEqual(C.file, COPY[lang].file, `${lang}: a file of its own`);
    }
    assert.ok(/sends none of it anywhere/.test(copyFor("en", true).privateBody) && /no lo envía a ninguna parte/.test(copyFor("es", true).privateBody));
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll print workbook tests passed.");
})();
