#!/usr/bin/env node
// The printable workbook for the 30-day journey: one PDF, US Letter portrait,
// for a reader to print and write in. (Not the pastoral review workbook,
// scripts/build-review-workbook.js, which is for the reviewer.)
//
//   npm run build:workbook            → .workbook/Stand-30-Day-Workbook.pdf
//   CHROMIUM_PATH=/path/to/chrome npm run build:workbook
//
// Every devotional word comes from content.js and every help line from ui.js,
// so the workbook says what the app says; rebuild it after the content
// changes (after the pastoral review, for one). Each day carries a QR code
// that opens that day in the app, where it can be read aloud: a plain link,
// no tracking parameters. The draft note on the last page follows the app's
// own draft label (meta.reviewNote in prayers.js) and goes when that does.
//
// Pages are fixed-size boxes printed by Chromium; the writing lines are drawn
// as real rules after layout, so they print crisp. The build fails, naming the
// page, if anything runs off a page: a longer prayer after an edit gets a look
// at the layout instead of a clipped line.
//
// The PDF is written to .workbook/ (ignored by git, never deployed).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { tracks, sosSetsEn } = require("../content.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const { weekLabel, appDayLink } = require("../reminder.js");
const web = require("./web-source.json");

const SITE = "https://prayers.dougdevitre.org";
// Update with each printed edition.
const EDITION = "First printed edition, October 2026.";
const OUT_DIR = path.join(ROOT, ".workbook");
const OUT_FILE = path.join(OUT_DIR, "Stand-30-Day-Workbook.pdf");

const core = tracks.core;
const ui = appUi.en;
const days = core.days.map(([title, ref, verse, reflection, prayer, declaration, practice], i) => ({
  n: i + 1, title, ref, verse, reflection, prayer, declaration, practice,
  week: weekLabel(core.weeks, i), url: appDayLink(SITE, "core", i)
}));
// The cover's verse, Ephesians 6:13, as the World English Bible words it.
const EPIGRAPH = (s => s.slice(s.indexOf("Therefore")))(web["Ephesians 6:10–13"]);

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// "WEEK ONE · ESTABLISH THE GROUND" → "Week one · Establish the ground"; the
// stylesheet sets kickers in capitals, so the text itself reads as words.
const sentence = s => s.split(" · ").map(part => part.charAt(0) + part.slice(1).toLowerCase()).join(" · ");

/** The days grouped by the journey's own week labels (reminder.js weekLabel). */
function weekGroups() {
  const groups = [];
  for (const d of days) {
    if (!groups.length || groups[groups.length - 1][0].week !== d.week) groups.push([]);
    groups[groups.length - 1].push(d);
  }
  return groups;
}

/** Every address a QR code in the workbook opens: the app, and each day in it. */
const qrTargets = () => [`${SITE}/app`, ...days.map(d => d.url)];

/** { url: inline SVG } for every target, drawn in the workbook's ink. */
async function makeQr(urls = qrTargets()) {
  const QRCode = require("qrcode");
  const out = {};
  for (const url of urls) {
    out[url] = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#132a3aff", light: "#0000" } });
  }
  return out;
}

/**
 * The whole workbook as one HTML document. `qr` maps each of qrTargets() to
 * an SVG; `fontBase` is the URL the bundled fonts are loaded from.
 * Returns { html, pages } where pages lists each page's kind, in order.
 */
function buildHtml({ qr, fontBase = `file://${path.join(ROOT, "fonts")}/` }) {
  const STAR = `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z"/></svg>`;
  const box = label => `<span class="tick"><span class="box"></span>${esc(label)}</span>`;
  const scale = () => `<span class="dots">${[1, 2, 3, 4, 5].map(n => `<span class="dot">${n}</span>`).join("")}</span>`;
  const lines = (grow = 1, prompt = "") => `<div class="prompt" style="flex-grow:${grow}">${prompt ? `<p class="q">${esc(prompt)}</p>` : ""}<div class="lines"></div></div>`;

  const pages = [];
  const page = (cls, body, { footer = true } = {}) => {
    const n = pages.length + 1;
    const foot = footer ? `<footer>
      <span class="brand">${STAR}<span>Stand</span><span class="sep">·</span><span class="series">The 30-Day Journey</span></span>
      <span class="num">${n}</span>
    </footer>` : "";
    pages.push({ cls, html: `<section class="page ${cls}">${body}${foot}</section>` });
    return n;
  };

  // One column of five circles per mark; 5 (overwhelming) at the top.
  const chart = ({ cols, sub = [""], width = 540, height = 150, label }) => {
    const left = 74, bottom = 26, top = 8;
    const plotW = width - left - 6, plotH = height - bottom - top;
    const colW = plotW / cols.length, subW = colW / sub.length;
    const y = level => top + plotH - (level - 0.5) * (plotH / 5);
    let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">`;
    for (const level of [1, 2, 3, 4, 5]) {
      s += `<line x1="${left}" x2="${width - 6}" y1="${y(level)}" y2="${y(level)}" class="grid"/>`;
      const name = level === 5 ? "5 overwhelming" : level === 1 ? "1 calm" : String(level);
      s += `<text x="${left - 8}" y="${y(level) + 3}" text-anchor="end" class="axis">${name}</text>`;
    }
    const r = Math.min(4.2, subW * 0.32);
    cols.forEach((c, i) => {
      const x0 = left + i * colW;
      if (i) s += `<line x1="${x0}" x2="${x0}" y1="${top}" y2="${top + plotH}" class="divide"/>`;
      sub.forEach((name, k) => {
        const cx = x0 + subW * (k + 0.5);
        for (const level of [1, 2, 3, 4, 5]) s += `<circle cx="${cx}" cy="${y(level)}" r="${r}" class="pip"/>`;
        if (name) s += `<text x="${cx}" y="${top + plotH + 10}" text-anchor="middle" class="sub">${name}</text>`;
      });
      s += `<text x="${x0 + colW / 2}" y="${height - 3}" text-anchor="middle" class="axis day">${esc(c)}</text>`;
    });
    return s + "</svg>";
  };

  // The help lines, worded as the app's support panel words them.
  const support = `<div class="support">
  <p class="support-intro">${esc(ui["sos.supportIntro"])}</p>
  <ul>
    <li><b>988</b> ${esc(ui["sos.lifeline"])}</li>
    <li>${esc(ui["sos.textVerb"])} <b>${esc(ui["sos.textKeyword"])}</b> ${esc(ui["sos.textTo"])} <b>741741</b> ${esc(ui["sos.textLine"])}</li>
    <li><b>1-800-799-7233</b> ${esc(ui["sos.dvLine"])}</li>
    <li><b>1-800-422-4453</b> ${esc(ui["sos.childLine"])}</li>
    <li><b>911</b> ${esc(ui["sos.emergency"])}</li>
    <li>${esc(ui["sos.outsideUs"])} <b>findahelpline.com</b> ${esc(ui["sos.findHelpline"])}</li>
  </ul>
  <p class="fine">${esc(ui["sos.disclaimer"])}</p>
</div>`;

  /* ---------- cover ---------- */
  page("cover", `
  <div class="cover-frame">
    <p class="kicker">A prayer workbook</p>
    <h1 class="cover-title">Stand</h1>
    <p class="cover-sub">30 Days of Spiritual Combat</p>
    <p class="cover-lead">Thirty days of Scripture, prayer and one small practice, with room to write down what you notice along the way.</p>
    <blockquote class="cover-verse">“${esc(EPIGRAPH)}”</blockquote>
    <p class="ref cover-ref">Ephesians 6:13</p>
    <div class="fields">
      <div class="field"><span>This workbook belongs to</span><span class="blank"></span></div>
      <div class="field"><span>I began on</span><span class="blank"></span></div>
    </div>
    <div class="cover-foot"><span class="brand">${STAR}<span>Stand</span></span><span>prayers.dougdevitre.org</span></div>
  </div>`, { footer: false });

  /* ---------- how to use ---------- */
  const steps = [
    ["Read", "the verse and the reflection, slowly."],
    ["Pray", "the day’s prayer, aloud if you can."],
    ["Declare", "speak the declaration, then tick the box."],
    ["Practice", "one small, concrete step for the day."],
    ["Check in", "circle where your fear is, before and after you pray."],
    ["Write", "a few lines. A sentence is enough."]
  ];
  const reviews = weekGroups().slice(0, -1).map(g => g[g.length - 1].n);
  page("howto", `
  <p class="kicker">Before you start</p>
  <h1 class="page-title">How to use this workbook</h1>
  <p class="lead">Each day takes about ten minutes, at the kitchen table, before work or last thing at night. There is no wrong way to do it.</p>
  <h2 class="label">The daily rhythm</h2>
  <ol class="steps">${steps.map(([k, v]) => `<li><b>${k}</b> ${v}</li>`).join("")}</ol>
  <div class="two">
    <div>
      <h2 class="label">The fear check-in</h2>
      <p>${esc(ui["checkin.scale"])}. It isn’t a score. It simply records where you are, so you can look back later and see what happened.</p>
      <p class="example">${scale()}</p>
      <h2 class="label">If you miss a day</h2>
      <p>Pick up where you left off. Missing a day does not erase your progress.</p>
      <h2 class="label">Look back each week</h2>
      <p>After Days ${reviews.slice(0, -1).join(", ")} and ${reviews[reviews.length - 1]} there is a page for looking back on the week, and after Day ${days.length}, one for the whole journey.</p>
    </div>
    <div>
      <h2 class="label">Listen along</h2>
      <p>Every day can be read aloud to you in the Stand app, which is free and needs no account. Scan the code beside any day’s title to open that day. This one opens the app.</p>
      <div class="qr-big">${qr[`${SITE}/app`]}</div>
      <h2 class="label">Keep it private</h2>
      <p>This workbook is yours. What you write here is for you, so keep it somewhere you trust.</p>
    </div>
  </div>
  <h2 class="label">The journey at a glance</h2>
  <ul class="glance">${weekGroups().map(g => `<li><span class="glance-week">${esc(sentence(g[0].week))}</span><span class="glance-days">${g.length > 1 ? `Days ${g[0].n}–${g[g.length - 1].n}` : `Day ${g[0].n}`}</span><span class="glance-titles">${g.map(d => esc(d.title)).join(" · ")}</span></li>`).join("")}</ul>`);

  /* ---------- Steady me now ---------- */
  const sos = sosSetsEn[0];
  const steadyPage = page("steady", `
  <p class="kicker">When fear spikes</p>
  <h1 class="page-title">Steady me now</h1>
  <p class="lead">A ninety-second pause for when fear will not sit still. The same steps are one tap away in the app.</p>
  <ol class="pause">
    <li><b>Breathe.</b> In for four, hold for four, out for six. Three slow breaths.
      <span class="breaths">${[1, 2, 3].map(() => `<span class="breath"></span>`).join("")}</span></li>
    <li><b>Anchor.</b> <span class="verse-inline">“${esc(sos.verse)}”</span> <span class="ref-inline">${esc(sos.ref)}</span></li>
    <li><b>Pray.</b> <span class="serif">${esc(sos.prayer)}</span></li>
    <li><b>Declare.</b> <span class="serif">${esc(sos.declaration)}</span></li>
    <li><b>Check in.</b> Steadier? If not, take another round. ${esc(ui["sos.closing"])}
      <span class="inline-checkin">Before ${scale()} <span class="gap"></span> After ${scale()}</span></li>
  </ol>
  <h2 class="label">What steadies me</h2>
  <div class="write steadies">
    ${lines(3, "People I can call or text")}
    ${lines(2, "A verse or phrase that steadies me")}
    ${lines(2, "Something I can do with my hands or feet")}
  </div>
  ${support}`);

  /* ---------- before Day 1 ---------- */
  page("begin", `
  <p class="kicker">Before Day 1</p>
  <h1 class="page-title">Where are you right now?</h1>
  <div class="write">
    ${lines(5, "What am I afraid of? Name it plainly.")}
    <div class="checkin solo"><span class="label">Where is my fear today?</span>${scale()}<span class="legend">${esc(ui["checkin.scale"])}</span></div>
    ${lines(4, "What am I hoping for in these thirty days?")}
    ${lines(3, "Who is walking with me? (Initials are enough.)")}
    <div class="when"><span class="label">When I’ll pray each day</span><span class="blank short"></span><span class="label">Where</span><span class="blank"></span></div>
  </div>`);

  /* ---------- tracker ---------- */
  page("tracker", `
  <p class="kicker">At a glance</p>
  <h1 class="page-title">My thirty days</h1>
  <p class="lead">Tick each day as you go. Missing a day does not erase your progress.</p>
  <div class="grid30">${days.map(d => `<div class="cell"><span class="cell-n">${d.n}</span><span class="cell-t">${esc(d.title)}</span><span class="cell-ticks">${box("Prayed")}${box("Practice")}</span></div>`).join("")}</div>
  <h2 class="label">Where my fear was each day, before I prayed</h2>
  <p class="hint">Fill one circle a day.</p>
  ${chart({ cols: days.map(d => String(d.n)), label: "Thirty-day fear chart, one column per day" })}`);

  /* ---------- the days, with a look back after each week ---------- */
  const dayPage = d => page("day", `
    <div class="run"><span class="kicker">Day ${d.n} of ${days.length} · ${esc(sentence(d.week))}</span><span class="date">Date <span class="blank tiny"></span></span></div>
    <div class="card">
      <div class="title-row">
        <h1 class="title">${esc(d.title)}</h1>
        <span class="qr-wrap"><span class="qr-label">Scan to listen to Day ${d.n}</span><span class="qr">${qr[d.url]}</span></span>
      </div>
      <blockquote class="verse">“${esc(d.verse)}”</blockquote>
      <p class="ref">${esc(d.ref)}</p>
      <h2 class="label">Reflection</h2>
      <p class="reflection">${esc(d.reflection)}</p>
      <h2 class="label">Prayer</h2>
      <p class="prayer">${esc(d.prayer)}</p>
      <div class="pair">
        <div><h2 class="label">Declare</h2><p class="declare">${esc(d.declaration)}</p>${box("Said aloud")}</div>
        <div><h2 class="label">Today’s practice</h2><p class="practice">${esc(d.practice)}</p>${box("Done")}</div>
      </div>
    </div>
    <div class="checkin"><span class="label">Fear check-in</span><span class="pair-in">Before I prayed ${scale()}</span><span class="pair-in">After ${scale()}</span><span class="legend">${esc(ui["checkin.scale"])}</span></div>
    <div class="write">
      ${lines(4, "What is fear telling me today? What is true instead?")}
      ${lines(3, "Where did I notice help today, from God or from someone?")}
      ${lines(2, "One thing I want to carry into tomorrow")}
    </div>`);

  const weekPage = group => {
    const label = sentence(group[0].week);
    const first = group[0].n, last = group[group.length - 1].n;
    return page("week", `
    <p class="kicker">${esc(label)}</p>
    <h1 class="page-title">Looking back on ${esc(label.split(" · ")[0].toLowerCase())}</h1>
    <h2 class="label">My check-ins, Days ${first}–${last}</h2>
    <p class="hint">For each day, fill the circle for your fear before (B) and after (A) you prayed.</p>
    ${chart({ cols: group.map(d => `Day ${d.n}`), sub: ["B", "A"], height: 160, label: `Fear check-ins for Days ${first} to ${last}` })}
    <h2 class="label">The declarations</h2>
    <p class="hint">Circle the one you most want to keep.</p>
    <ul class="decls">${group.map(d => `<li><span class="ring"></span><span class="decl-n">Day ${d.n}</span><span class="serif">${esc(d.declaration)}</span></li>`).join("")}</ul>
    <div class="write">
      ${lines(3, "What shifted this week, even a little?")}
      ${lines(3, "Where was it hardest?")}
      ${lines(3, "What do I want to bring into next week?")}
    </div>`);
  };

  const groups = weekGroups();
  groups.forEach((group, g) => {
    for (const d of group) dayPage(d);
    if (g < groups.length - 1) weekPage(group);
  });

  /* ---------- the whole journey ---------- */
  const others = Object.entries(tracks).filter(([id]) => id !== "core");
  const fearJourneys = others.filter(([, t]) => t.group === "JOURNEYS FOR FEAR").map(([, t]) => `${esc(t.short)} (${t.days.length} days)`);
  const stories = others.filter(([, t]) => t.group === "COURAGE STORIES");
  page("final", `
  <p class="kicker">${esc(sentence(core.weeks[core.weeks.length - 1]))}</p>
  <h1 class="page-title">Looking back on thirty days</h1>
  <div class="write">
    ${lines(3, "Read what you wrote before Day 1. What do you notice now?")}
    ${lines(3, "What has changed, in me or around me?")}
    ${lines(2, "Which declaration will I keep?")}
    ${lines(3, "What comes next?")}
  </div>
  <div class="next">
    <h2 class="label">Where to go from here</h2>
    <p>In the Stand app: ${fearJourneys.join(" · ")} · ${stories.length} four-day courage stories, from ${esc(stories[0][1].short.toLowerCase())} to ${esc(stories[stories.length - 1][1].short.toLowerCase())} · the Prayer Book and the Rosary · Steady me now, any time. Or begin these thirty days again; the second time through often reads differently.</p>
  </div>`);

  /* ---------- notes ---------- */
  for (let k = 0; k < 2; k++) page("notes", `<p class="kicker">Notes</p><div class="write">${lines(1)}</div>`);

  /* ---------- about ---------- */
  const draft = prayerCorpus.meta && prayerCorpus.meta.reviewNote
    ? " The devotional text is a draft awaiting review by a pastoral advisor; later editions will follow that review." : "";
  page("about", `
  <p class="kicker">About</p>
  <h1 class="page-title">About this workbook</h1>
  <p>Stand is a free prayer companion for fear, with no account, no advertising and no tracking. Every day in this workbook is also in the app, where it can be read aloud: <b>prayers.dougdevitre.org</b>.</p>
  <h2 class="label">Scripture</h2>
  <p>Scripture quotations are from the World English Bible, which is in the public domain.</p>
  <h2 class="label">What Stand is, and isn’t</h2>
  <p>Stand offers spiritual encouragement and prayer. It is not medical, mental health, legal or financial advice, and it is not a substitute for a licensed professional. If you need help now, the numbers are on page ${steadyPage}.</p>
  <h2 class="label">Using this workbook</h2>
  <p>The text and prayers in Stand belong to the Stand project. You are welcome to print this workbook for your own personal, non-commercial prayer, and to share the link with anyone.</p>
  <h2 class="label">This edition</h2>
  <p>${esc(EDITION)}${draft}</p>
  ${support}`);

  const font = (file, family, weight, style = "normal") =>
    `@font-face{font-family:"${family}";src:url("${fontBase}${file}") format("woff");font-weight:${weight};font-style:${style}}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stand — 30-Day Workbook</title><style>
${font("source-serif-4-latin-400-normal.woff", "StandSerif", 400)}
${font("source-serif-4-latin-400-italic.woff", "StandSerif", 400, "italic")}
${font("source-serif-4-latin-600-normal.woff", "StandSerif", 600)}
${font("source-sans-3-latin-400-normal.woff", "StandSans", 400)}
${font("source-sans-3-latin-700-normal.woff", "StandSans", 700)}
${CSS}</style></head><body>${pages.map(p => p.html).join("\n")}</body></html>`;
  return { html, pages: pages.map(p => p.cls) };
}

// Family names are distinct on purpose: "Serif" would be read as the generic
// serif keyword and the bundled face would never apply.
const CSS = `
@page{size:8.5in 11in;margin:0}
:root{--ink:#132a3a;--gold:#b88732;--gold-text:#8a6420;--muted:#5b6b75;--rule:#b9c3c9;--tint:#fbf5e8;--sage:#eef3ef}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:"StandSans";color:var(--ink);font-size:10.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
p{margin:0 0 6pt}
.page{width:8.5in;height:11in;padding:.55in .62in .42in;display:flex;flex-direction:column;overflow:hidden;break-after:page;position:relative}
.kicker,.label{font-family:"StandSans";font-weight:700;text-transform:uppercase;color:var(--gold-text);letter-spacing:.16em}
.kicker{font-size:8pt;margin:0}
.label{font-size:7.5pt;margin:12pt 0 4pt}
.page-title{font:400 27pt/1.1 "StandSerif";letter-spacing:-.015em;margin:4pt 0 10pt}
.lead{font-size:11pt;color:var(--ink);margin-bottom:4pt}
.hint{font-size:8.5pt;color:var(--muted);margin:0 0 4pt}
.serif{font-family:"StandSerif"}
.blank{display:inline-block;flex:1;border-bottom:.75pt solid var(--ink);min-width:1in;height:14pt}
.blank.short{flex:0 0 1.3in}
.blank.tiny{width:1.35in;flex:none;height:10pt}
footer{margin-top:auto;padding-top:8pt;display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt;color:var(--muted)}
.brand{display:inline-flex;align-items:center;gap:6pt;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--ink);font-size:8pt}
.brand .sep,.brand .series{letter-spacing:.06em;font-weight:400;color:var(--muted);text-transform:none}
.star{width:9pt;height:9pt;fill:var(--gold)}
.num{font-weight:700;color:var(--ink)}
.qr-wrap{display:inline-flex;align-items:center;gap:6pt}
.qr-label{font-size:7.5pt;color:var(--muted);text-align:right;max-width:.8in;line-height:1.25}
.qr{display:inline-block;width:.78in;height:.78in;flex:none}
.title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12pt}
.title-row .qr-wrap{margin:-4pt -6pt 0 0}
.qr svg,.qr-big svg{width:100%;height:100%;display:block}
.cover{padding:.6in}
.cover-frame{flex:1;border:1.5pt solid var(--gold);padding:1.1in .8in .6in;display:flex;flex-direction:column}
.cover .kicker{font-size:10pt}
.cover-title{font:400 92pt/1 "StandSerif";letter-spacing:-.03em;margin:14pt 0 4pt}
.cover-sub{font:italic 20pt/1.3 "StandSerif";margin:0 0 26pt;color:var(--ink)}
.cover-lead{font-size:12.5pt;max-width:5in;line-height:1.5}
.cover-verse{font:italic 13pt/1.5 "StandSerif";border-left:2.5pt solid var(--gold);padding-left:12pt;margin:30pt 0 0;max-width:5in}
.cover-ref{margin-top:2pt}
.fields{margin-top:auto;display:flex;flex-direction:column;gap:22pt;margin-bottom:46pt}
.field{display:flex;align-items:flex-end;gap:10pt;font:400 11pt "StandSerif"}
.cover-foot{display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:var(--muted);border-top:.75pt solid var(--gold);padding-top:10pt}
.steps{margin:2pt 0 6pt;padding-left:18pt;font-size:11pt;line-height:1.6}
.steps b{font-family:"StandSerif";font-weight:600;font-size:12pt;margin-right:4pt}
.two{display:grid;grid-template-columns:1fr 1fr;gap:26pt}
.two p{font-size:10.5pt}
.example{margin-top:2pt}
.qr-big{width:1.35in;height:1.35in;margin:2pt 0 4pt}
.glance{list-style:none;margin:0;padding:0;font-size:9pt;line-height:1.35;border-top:.75pt solid var(--rule)}
.glance li{display:grid;grid-template-columns:2.35in .7in 1fr;gap:8pt;padding:5pt 0;border-bottom:.75pt solid var(--rule)}
.glance-week{font-weight:700;color:var(--gold-text);text-transform:uppercase;letter-spacing:.08em;font-size:7.5pt;padding-top:1pt}
.glance-days{font-weight:700}
.glance-titles{color:var(--muted)}
.dots{display:inline-flex;gap:5pt;vertical-align:middle}
.dot{width:16pt;height:16pt;border:.9pt solid var(--ink);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:700 8pt "StandSans";color:var(--ink)}
.tick{display:inline-flex;align-items:center;gap:5pt;font-size:7.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:4pt}
.box{width:10pt;height:10pt;border:.9pt solid var(--ink);display:inline-block;flex:none}
.run{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8pt}
.date{font-size:8.5pt;color:var(--muted);display:inline-flex;align-items:flex-end;gap:6pt}
.card{border:1.25pt solid var(--gold);padding:.24in .32in .2in}
.card .label:first-of-type{margin-top:10pt}
.title{font:400 30pt/1.05 "StandSerif";letter-spacing:-.02em;margin:0 0 9pt}
.verse{font:italic 12.5pt/1.45 "StandSerif";border-left:2.5pt solid var(--gold);padding-left:11pt;margin:0}
.ref{font-weight:700;font-size:8.5pt;color:var(--muted);padding:3pt 0 0 13.5pt;margin:0}
.reflection{font-size:10.5pt;line-height:1.5;margin:0}
.prayer{font:400 11.5pt/1.5 "StandSerif";padding:8pt 11pt;border:1pt solid var(--gold);background:var(--tint);margin:0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:18pt}
.pair .label{margin-top:10pt}
.declare{font:600 11pt/1.4 "StandSerif";margin:0}
.practice{font-size:10pt;line-height:1.45;margin:0}
.checkin{display:flex;align-items:center;flex-wrap:wrap;gap:6pt 14pt;margin-top:9pt;padding:7pt 11pt;background:var(--sage);border-radius:3pt;font-size:9pt}
.checkin .label{margin:0}
.pair-in{display:inline-flex;align-items:center;gap:6pt}
.legend{font-size:7.5pt;color:var(--muted);margin-left:auto}
.checkin.solo{margin:6pt 0 10pt}
.write{flex:1;min-height:0;display:flex;flex-direction:column;gap:6pt;margin-top:8pt}
.prompt{flex:1 1 0;min-height:0;display:flex;flex-direction:column}
.q{font:600 10pt/1.3 "StandSerif";margin:4pt 0 0}
.lines{flex:1;min-height:0;overflow:hidden}
.rule{height:.3in;border-bottom:.6pt solid var(--rule)}
.when{display:flex;align-items:flex-end;gap:10pt;margin:6pt 0 2pt}
.when .label{margin:0}
.pause{margin:4pt 0 4pt;padding-left:18pt;font-size:11pt;line-height:1.55}
.pause li{margin-bottom:8pt}
.pause b{font-family:"StandSerif";font-weight:600;font-size:12pt}
.verse-inline{font:italic 12pt "StandSerif"}
.ref-inline{font-weight:700;font-size:8.5pt;color:var(--muted)}
.breaths{display:inline-flex;gap:8pt;margin-left:8pt;vertical-align:middle}
.breath{width:13pt;height:13pt;border-radius:50%;border:1pt solid var(--gold)}
.inline-checkin{display:flex;align-items:center;gap:8pt;margin-top:6pt;font-size:9pt}
.gap{width:10pt}
.steadies{flex:1;margin-top:0}
.support{margin-top:10pt;border:1.25pt solid var(--gold);padding:12pt 16pt 8pt;font-size:10pt}
.support-intro{font-family:"StandSerif";font-weight:600;font-size:11pt}
.support ul{margin:0 0 6pt;padding-left:14pt;line-height:1.55}
.support .fine{font-size:9pt;color:var(--muted);margin:0}
.grid30{display:grid;grid-template-columns:repeat(6,1fr);border-top:.75pt solid var(--rule);border-left:.75pt solid var(--rule);margin:6pt 0 4pt}
.cell{border-right:.75pt solid var(--rule);border-bottom:.75pt solid var(--rule);padding:5pt 6pt 6pt;height:.98in;display:flex;flex-direction:column}
.cell-n{font:400 15pt/1 "StandSerif"}
.cell-t{font-size:7.5pt;line-height:1.25;color:var(--muted);margin-top:2pt}
.cell-ticks{margin-top:auto;display:flex;flex-direction:column;gap:2pt}
.cell .tick{margin:0;font-size:6.5pt}
.cell .box{width:8pt;height:8pt}
.chart{width:100%;height:auto;display:block;margin:2pt 0 6pt}
.chart .grid,.chart .divide{stroke:#d9dfe2;stroke-width:.5}
.chart .pip{fill:none;stroke:#7d8b93;stroke-width:.6}
.chart .axis{font:400 7px "StandSans";fill:#5b6b75}
.chart .day{font-weight:700;fill:#132a3a}
.chart .sub{font:700 6px "StandSans";fill:#8a6420}
.decls{list-style:none;margin:0;padding:0;font-size:10pt;line-height:1.35}
.decls li{display:flex;align-items:baseline;gap:8pt;padding:2.5pt 0}
.ring{width:9pt;height:9pt;border:.9pt solid var(--ink);border-radius:50%;flex:none;transform:translateY(1pt)}
.decl-n{font-size:7.5pt;font-weight:700;color:var(--gold-text);letter-spacing:.08em;text-transform:uppercase;flex:0 0 .45in}
.next{border:1.25pt solid var(--gold);padding:8pt 14pt 6pt;margin-top:10pt;font-size:10pt}
.next .label{margin-top:2pt}
.notes .write{margin-top:6pt}
.about p:not(.kicker):not(.fine):not(.support-intro){font-size:10.5pt;max-width:6.4in}
.about .support{margin-top:auto}
.about footer{margin-top:0}
`;

/** Prints the workbook to a PDF; fails, naming the page, if anything runs off one. */
async function build({ out = OUT_FILE, log = console.log } = {}) {
  const { chromium } = require("playwright");
  const qr = await makeQr();
  const { html } = buildHtml({ qr });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const htmlFile = out.replace(/\.pdf$/, ".html");
  fs.writeFileSync(htmlFile, html);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const tab = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await tab.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    // The rules: as many as fit in each writing area, so a page ends on a whole line.
    const report = await tab.evaluate(() => {
      const line = 0.3 * 96;
      for (const el of document.querySelectorAll(".lines")) {
        el.innerHTML = '<div class="rule"></div>'.repeat(Math.max(1, Math.floor(el.clientHeight / line)));
      }
      return [...document.querySelectorAll(".page")].map((p, i) => {
        const box = p.getBoundingClientRect();
        // Anything past the page's own margins (0.4in at the foot, 0.5in at the side).
        const overflow = [...p.querySelectorAll("*")].filter(e => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && !e.closest("footer") && (r.bottom > box.bottom - 0.4 * 96 + 1 || r.right > box.right - 0.5 * 96 + 1);
        }).map(e => e.className || e.tagName).slice(0, 3);
        return { page: i + 1, kind: p.className.replace("page ", ""), overflow, clipped: p.scrollHeight > p.clientHeight + 1, rules: p.querySelectorAll(".rule").length };
      });
    });
    await tab.pdf({ path: out, width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true });
    fs.rmSync(htmlFile, { force: true });
    const bad = report.filter(r => r.overflow.length || r.clipped);
    for (const r of bad) log(`✗ page ${r.page} (${r.kind}) runs off the page: ${r.overflow.join(", ") || "clipped"}`);
    const thin = report.filter(r => r.kind === "day" && r.rules < 6);
    for (const r of thin) log(`• page ${r.page}: only ${r.rules} writing lines`);
    log(bad.length ? `✗ ${bad.length} of ${report.length} pages overflow` : `✓ ${report.length} pages, nothing runs off a page → ${path.relative(ROOT, out)}`);
    return { ok: !bad.length, report, out };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  build({ out: process.argv[2] ? path.resolve(process.argv[2]) : OUT_FILE })
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { SITE, EDITION, OUT_FILE, days, weekGroups, qrTargets, makeQr, buildHtml, build };
