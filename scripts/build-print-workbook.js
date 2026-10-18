#!/usr/bin/env node
// The printable workbook for the 30-day journey: US Letter portrait, in two
// editions per language. The print edition is for a reader to print and write
// in by hand; the fillable edition has the same pages, with boxes in place of
// the ruled lines and real form fields to type in, tick and choose on screen
// (scripts/workbook-form.js). (Not the pastoral review workbook,
// scripts/build-review-workbook.js, which is for the reviewer.)
//
//   npm run build:workbook                  → all four, in .workbook/
//   npm run build:workbook -- --lang es     → the Spanish ones only
//   CHROMIUM_PATH=/path/to/chrome npm run build:workbook
//
// Every devotional word comes from content.js (content.es.js in Spanish) and
// every help line from ui.js, so the workbook says what the app says; rebuild
// it after the content changes (after the pastoral review, for one). Scripture
// is the World English Bible in English and the Reina-Valera 1909 in Spanish,
// as in the app. Each day carries a QR code that opens that day in the app,
// where it can be read aloud: a plain link, with no parameter but the
// language. The draft note on the last page follows the app's own draft
// label (meta.reviewNote in prayers.js) and goes when that does.
//
// Pages are fixed-size boxes printed by Chromium; the writing lines are drawn
// as real rules after layout, so they print crisp. The build fails, naming the
// page, if anything runs off a page: a longer prayer after an edit gets a look
// at the layout instead of a clipped line.
//
// In the fillable edition each place to write, tick or choose carries
// data-field attributes; the build measures them on the laid-out page and
// lays a form field over each. A day's check-in is one field shown in three
// places (the day, the tracker's chart, the week's chart), so the charts fill
// in on their own. The codes there are also links, for a reader on a tablet.
// The form runs no script and sends nothing anywhere.
//
// The PDFs are written to .workbook/ (ignored by git, never deployed).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const { tracks, sosSetsEn } = require("../content.js");
const { esTracks, esSos } = require("../content.es.js");
const { appUi } = require("../ui.js");
const { prayerCorpus } = require("../prayers.js");
const { weekLabel } = require("../reminder.js");
const web = require("./web-source.json");
const rv = require("./es-source.json");

const SITE = "https://prayers.dougdevitre.org";
const LANGS = ["en", "es"];
const OUT_DIR = path.join(ROOT, ".workbook");

// The workbook's own words, in both languages. Everything else on its pages is
// the app's text. Spanish follows the app's glossary: camino, Calma ahora, el
// Devocionario, el Rosario; and it addresses the reader without gender.
const COPY = {
  en: {
    file: "Stand-30-Day-Workbook.pdf",
    docTitle: "Stand — 30-Day Workbook",
    edition: "First printed edition, October 2026.", // update with each printed edition
    draft: "The devotional text is a draft awaiting review by a pastoral advisor; later editions will follow that review.",
    coverKicker: "A prayer workbook",
    coverLead: "Thirty days of Scripture, prayer and one small practice, with room to write down what you notice along the way.",
    epigraph: { source: web["Ephesians 6:10–13"], from: "Therefore", ref: "Ephesians 6:13" },
    belongs: "This workbook belongs to", began: "I began on",
    howKicker: "Before you start", howTitle: "How to use this workbook",
    howLead: "Each day takes about ten minutes, at the kitchen table, before work or last thing at night. There is no wrong way to do it.",
    rhythm: "The daily rhythm",
    steps: [["Read", "the verse and the reflection, slowly."], ["Pray", "the day’s prayer, aloud if you can."], ["Declare", "speak the declaration, then tick the box."],
      ["Practice", "one small, concrete step for the day."], ["Check in", "circle where your fear is, before and after you pray."], ["Write", "a few lines. A sentence is enough."]],
    checkinTitle: "The fear check-in",
    checkinBody: "It isn’t a score. It simply records where you are, so you can look back later and see what happened.",
    missTitle: "If you miss a day", missBody: "Pick up where you left off. Missing a day does not erase your progress.",
    weeklyTitle: "Look back each week",
    weeklyBody: (list, last, total) => `After Days ${list} and ${last} there is a page for looking back on the week, and after Day ${total}, one for the whole journey.`,
    listenTitle: "Listen along",
    listenBody: "Every day can be read aloud to you in the Stand app, which is free and needs no account. Scan the code beside any day’s title to open that day. This one opens the app.",
    privateTitle: "Keep it private", privateBody: "This workbook is yours. What you write here is for you, so keep it somewhere you trust.",
    glanceTitle: "The journey at a glance",
    day: n => `Day ${n}`, days: (a, b) => `Days ${a}–${b}`, dayOf: (n, total) => `Day ${n} of ${total}`,
    steadyKicker: "When fear spikes", steadyTitle: ui => ui["sos.button"],
    steadyLead: "A ninety-second pause for when fear will not sit still. The same steps are one tap away in the app.",
    breathe: ["Breathe.", "In for four, hold for four, out for six. Three slow breaths."],
    anchor: "Anchor.", pray: "Pray.", declare: "Declare.", checkIn: ["Check in.", "Steadier? If not, take another round."],
    before: "Before", after: "After",
    steadiesTitle: "What steadies me",
    steadies: ["People I can call or text", "A verse or phrase that steadies me", "Something I can do with my hands or feet"],
    beginKicker: "Before Day 1", beginTitle: "Where are you right now?",
    afraid: "What am I afraid of? Name it plainly.", today: "Where is my fear today?", hoping: "What am I hoping for in these thirty days?",
    walking: "Who is walking with me? (Initials are enough.)", when: "When I’ll pray each day", where: "Where",
    trackerKicker: "At a glance", trackerTitle: "My thirty days", trackerLead: "Tick each day as you go. Missing a day does not erase your progress.",
    prayed: "Prayed", practiced: "Practice",
    chartTitle: "Where my fear was each day, before I prayed", chartHint: "Fill one circle a day.",
    chartLabel: "Thirty-day fear chart, one column per day", high: "5 overwhelming", low: "1 calm",
    date: "Date", scan: n => `Scan to listen to Day ${n}`,
    reflection: "Reflection", prayer: "Prayer", declareLabel: "Declare", practiceLabel: "Today’s practice", saidAloud: "Said aloud", done: "Done",
    fearCheckin: "Fear check-in", beforePrayed: "Before I prayed",
    prompts: ["What is fear telling me today? What is true instead?", "Where did I notice help today, from God or from someone?", "One thing I want to carry into tomorrow"],
    weekTitle: week => `Looking back on ${week}`,
    weekChecks: (a, b) => `My check-ins, Days ${a}–${b}`,
    weekHint: "For each day, fill the circle for your fear before (B) and after (A) you prayed.", sub: ["B", "A"],
    weekChartLabel: (a, b) => `Fear check-ins for Days ${a} to ${b}`,
    decls: "The declarations", declsHint: "Circle the one you most want to keep.",
    weekPrompts: ["What shifted this week, even a little?", "Where was it hardest?", "What do I want to bring into next week?"],
    finalTitle: "Looking back on thirty days",
    finalPrompts: ["Read what you wrote before Day 1. What do you notice now?", "What has changed, in me or around me?", "Which declaration will I keep?", "What comes next?"],
    nextTitle: "Where to go from here",
    next: ({ fear, stories, first, last }) => `In the Stand app: ${fear.join(" · ")} · ${stories} four-day courage stories, from ${first} to ${last} · the Prayer Book and the Rosary · Steady me now, any time. Or begin these thirty days again; the second time through often reads differently.`,
    daysWord: "days",
    notes: "Notes",
    aboutKicker: "About", aboutTitle: "About this workbook",
    about: "Stand is a free prayer companion for fear, with no account, no advertising and no tracking. Every day in this workbook is also in the app, where it can be read aloud:",
    scriptureTitle: "Scripture", scripture: "Scripture quotations are from the World English Bible, which is in the public domain.",
    isntTitle: "What Stand is, and isn’t",
    isnt: page => `Stand offers spiritual encouragement and prayer. It is not medical, mental health, legal or financial advice, and it is not a substitute for a licensed professional. If you need help now, the numbers are on page ${page}.`,
    useTitle: "Using this workbook",
    use: "The text and prayers in Stand belong to the Stand project. You are welcome to print this workbook for your own personal, non-commercial prayer, and to share the link with anyone.",
    editionTitle: "This edition",
    breath: (n, total) => `Breath ${n} of ${total}`, // tooltips (fillable edition)
    // The fillable edition: only what differs from the print one.
    fill: {
      file: "Stand-30-Day-Workbook-Fillable.pdf",
      docTitle: "Stand — 30-Day Workbook (fillable)",
      edition: "First fillable edition, October 2026.", // update with each fillable edition
      coverKicker: "A prayer workbook to fill in on screen",
      howLead: "Each day takes about ten minutes. Open this file in a PDF app that can fill in forms; type in the boxes, tap or click the circles and squares, and save after each day. There is no wrong way to do it.",
      steps: [["Read", "the verse and the reflection, slowly."], ["Pray", "the day’s prayer, aloud if you can."], ["Declare", "speak the declaration, then tick the box."],
        ["Practice", "one small, concrete step for the day."], ["Check in", "mark where your fear is, before and after you pray."], ["Write", "a few lines. A sentence is enough."]],
      scan: n => `Tap or scan to listen to Day ${n}`,
      listenBody: "Every day can be read aloud to you in the Stand app, which is free and needs no account. Tap or scan the code beside any day’s title to open that day. This one opens the app.",
      privateBody: "This workbook is yours. What you type is kept in this file, which sends none of it anywhere. If you share or upload the file, what you wrote goes with it.",
      chartHint: "It fills in from each day’s check-in.",
      weekHint: "It fills in from each day’s check-ins: your fear before (B) and after (A) you prayed.",
      declsHint: "Mark the one you most want to keep.",
      use: "The text and prayers in Stand belong to the Stand project. You are welcome to fill in and print this workbook for your own personal, non-commercial prayer, and to share the link with anyone."
    }
  },
  es: {
    file: "Stand-Cuaderno-30-Dias.pdf",
    docTitle: "Stand — Cuaderno de 30 días",
    edition: "Primera edición impresa, octubre de 2026.", // actualizar en cada edición impresa
    draft: "El texto devocional es un borrador pendiente de revisión por un asesor pastoral; las próximas ediciones seguirán esa revisión.",
    coverKicker: "Un cuaderno de oración",
    coverLead: "Treinta días de Escritura, oración y una pequeña práctica, con espacio para escribir lo que vas notando en el camino.",
    epigraph: { source: rv["Ephesians 6:10–13"], from: "Por tanto", ref: "Efesios 6:13" },
    belongs: "Este cuaderno pertenece a", began: "Comencé el",
    howKicker: "Antes de empezar", howTitle: "Cómo usar este cuaderno",
    howLead: "Cada día toma unos diez minutos: en la mesa de la cocina, antes del trabajo o justo antes de dormir. No hay una manera equivocada de hacerlo.",
    rhythm: "El ritmo diario",
    steps: [["Lee", "el versículo y la reflexión, despacio."], ["Ora", "la oración del día, en voz alta si puedes."], ["Declara", "di la declaración y marca la casilla."],
      ["Practica", "un paso pequeño y concreto para el día."], ["Registra", "marca dónde está tu miedo, antes y después de orar."], ["Escribe", "unas líneas. Con una frase basta."]],
    checkinTitle: "El registro del miedo",
    checkinBody: "No es una calificación. Solo anota dónde estás, para que más adelante puedas mirar atrás y ver qué pasó.",
    missTitle: "Si te saltas un día", missBody: "Retoma donde lo dejaste. Saltarte un día no borra tu progreso.",
    weeklyTitle: "Repasa cada semana",
    weeklyBody: (list, last, total) => `Después de los días ${list} y ${last} hay una página para repasar la semana, y después del día ${total}, una para todo el camino.`,
    listenTitle: "Escucha",
    listenBody: "Cada día se puede escuchar en voz alta en la app Stand, que es gratuita y no necesita cuenta. Escanea el código junto al título de cualquier día para abrir ese día. Este abre la app.",
    privateTitle: "Mantenlo en privado", privateBody: "Este cuaderno es tuyo. Lo que escribas aquí es para ti, así que guárdalo en un lugar de confianza.",
    glanceTitle: "El camino de un vistazo",
    day: n => `Día ${n}`, days: (a, b) => `Días ${a}–${b}`, dayOf: (n, total) => `Día ${n} de ${total}`,
    steadyKicker: "Cuando el miedo se dispara", steadyTitle: ui => ui["sos.button"],
    steadyLead: "Una pausa de noventa segundos para cuando el miedo no se queda quieto. Los mismos pasos están a un toque en la app.",
    breathe: ["Respira.", "Inhala contando cuatro, mantén el aire contando cuatro y exhala contando seis. Tres respiraciones lentas."],
    anchor: "Ancla.", pray: "Ora.", declare: "Declara.", checkIn: ["Registra.", "¿Más en calma? Si no, haz otra ronda."],
    before: "Antes", after: "Después",
    steadiesTitle: "Lo que me da calma",
    steadies: ["Personas a las que puedo llamar o escribir", "Un versículo o una frase que me da calma", "Algo que puedo hacer con las manos o los pies"],
    beginKicker: "Antes del día 1", beginTitle: "¿Dónde estás ahora mismo?",
    afraid: "¿Qué me da miedo? Nómbralo con sencillez.", today: "¿Dónde está mi miedo hoy?", hoping: "¿Qué espero de estos treinta días?",
    walking: "¿Quién camina conmigo? (Bastan las iniciales).", when: "Cuándo oraré cada día", where: "Dónde",
    trackerKicker: "De un vistazo", trackerTitle: "Mis treinta días", trackerLead: "Marca cada día a medida que avanzas. Saltarte un día no borra tu progreso.",
    prayed: "Oré", practiced: "Práctica",
    chartTitle: "Dónde estaba mi miedo cada día, antes de orar", chartHint: "Rellena un círculo por día.",
    chartLabel: "Gráfico del miedo de treinta días, una columna por día", high: "5 abrumador", low: "1 en calma",
    date: "Fecha", scan: n => `Escanea para escuchar el día ${n}`,
    reflection: "Reflexión", prayer: "Oración", declareLabel: "Declara", practiceLabel: "Práctica de hoy", saidAloud: "Dicha en voz alta", done: "Hecha",
    fearCheckin: "Registro del miedo", beforePrayed: "Antes de orar",
    prompts: ["¿Qué me dice hoy el miedo? ¿Qué es verdad?", "¿Dónde noté ayuda hoy, de Dios o de alguien?", "Algo que quiero llevar a mañana"],
    weekTitle: week => `Repaso de la ${week}`,
    weekChecks: (a, b) => `Mis registros, días ${a}–${b}`,
    weekHint: "Para cada día, rellena el círculo de tu miedo antes (A) y después (D) de orar.", sub: ["A", "D"],
    weekChartLabel: (a, b) => `Registros del miedo de los días ${a} a ${b}`,
    decls: "Las declaraciones", declsHint: "Encierra en un círculo la que más quieras conservar.",
    weekPrompts: ["¿Qué cambió esta semana, aunque sea un poco?", "¿Dónde fue más difícil?", "¿Qué quiero llevar a la próxima semana?"],
    finalTitle: "Repaso de los treinta días",
    finalPrompts: ["Lee lo que escribiste antes del día 1. ¿Qué notas ahora?", "¿Qué ha cambiado, en mí o a mi alrededor?", "¿Qué declaración voy a conservar?", "¿Qué sigue?"],
    nextTitle: "Hacia dónde seguir",
    next: ({ fear, stories, first, last }) => `En la app Stand: ${fear.join(" · ")} · ${stories} historias de valor de cuatro días, desde ${first} hasta ${last} · el Devocionario y el Rosario · Calma ahora, cuando quieras. O vuelve a empezar estos treinta días; la segunda vez suele leerse distinto.`,
    daysWord: "días",
    notes: "Notas",
    aboutKicker: "Acerca de", aboutTitle: "Acerca de este cuaderno",
    about: "Stand es un compañero de oración gratuito para el miedo: sin cuenta, sin publicidad y sin rastreo. Cada día de este cuaderno también está en la app, donde se puede escuchar en voz alta:",
    scriptureTitle: "La Escritura", scripture: "Las citas bíblicas son de la Reina-Valera 1909, que es de dominio público.",
    isntTitle: "Qué es Stand, y qué no es",
    isnt: page => `Stand ofrece acompañamiento espiritual y oración. No es consejo médico, de salud mental, legal ni financiero, y no sustituye a un profesional con licencia. Si necesitas ayuda ahora, los números están en la página ${page}.`,
    useTitle: "Uso de este cuaderno",
    use: "Los textos y las oraciones de Stand pertenecen al proyecto Stand. Puedes imprimir este cuaderno para tu oración personal, sin fines comerciales, y compartir el enlace con quien quieras.",
    editionTitle: "Esta edición",
    breath: (n, total) => `Respiración ${n} de ${total}`, // descripciones de los campos (edición rellenable)
    // La edición rellenable: solo lo que cambia respecto de la impresa.
    fill: {
      file: "Stand-Cuaderno-30-Dias-Rellenable.pdf",
      docTitle: "Stand — Cuaderno de 30 días (rellenable)",
      edition: "Primera edición rellenable, octubre de 2026.", // actualizar en cada edición rellenable
      coverKicker: "Un cuaderno de oración para rellenar en pantalla",
      howLead: "Cada día toma unos diez minutos. En una app de PDF que permita rellenar formularios, escribe en los recuadros, marca los círculos y las casillas, y guarda después de cada día. No hay una manera equivocada de hacerlo.",
      scan: n => `Toca o escanea para escuchar el día ${n}`,
      listenBody: "Cada día se puede escuchar en voz alta en la app Stand, que es gratuita y no necesita cuenta. Toca o escanea el código junto al título de cualquier día para abrir ese día. Este abre la app.",
      privateBody: "Este cuaderno es tuyo. Lo que escribas se guarda en este archivo, que no lo envía a ninguna parte. Si compartes o subes el archivo, lo que escribiste va con él.",
      chartHint: "Se rellena con el registro de cada día.",
      weekHint: "Se rellena con los registros de cada día: tu miedo antes (A) y después (D) de orar.",
      declsHint: "Marca la que más quieras conservar.",
      use: "Los textos y las oraciones de Stand pertenecen al proyecto Stand. Puedes rellenar e imprimir este cuaderno para tu oración personal, sin fines comerciales, y compartir el enlace con quien quieras."
    }
  }
};

/** The workbook's own words for one edition: the print wording, with the fillable edition's changes over it. */
const copyFor = (lang, fillable = false) => fillable ? { ...COPY[lang], ...COPY[lang].fill } : COPY[lang];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The journey in a language: the English track, with Spanish text over it. */
const coreFor = lang => lang === "es" ? { ...tracks.core, ...esTracks.core } : tracks.core;
/** The app, or a day in it, in the workbook's language (/app#7, /app?lang=es#7). */
const appLink = (lang, n) => `${SITE}/app${lang === "es" ? "?lang=es" : ""}${n ? `#${n}` : ""}`;

/** The thirty days in a language, each with its week label and its link. */
function daysFor(lang = "en") {
  const core = coreFor(lang);
  return core.days.map(([title, ref, verse, reflection, prayer, declaration, practice], i) => ({
    n: i + 1, title, ref, verse, reflection, prayer, declaration, practice,
    week: weekLabel(core.weeks, i), url: appLink(lang, i + 1)
  }));
}

/** The days grouped by the journey's own week labels (reminder.js weekLabel). */
function weekGroups(lang = "en") {
  const groups = [];
  for (const d of daysFor(lang)) {
    if (!groups.length || groups[groups.length - 1][0].week !== d.week) groups.push([]);
    groups[groups.length - 1].push(d);
  }
  return groups;
}

/** Every address a QR code in the workbook opens: the app, and each day in it. */
const qrTargets = (lang = "en") => [appLink(lang), ...daysFor(lang).map(d => d.url)];

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
 * The whole workbook in one language as one HTML document. `qr` maps each of
 * qrTargets(lang) to an SVG; `fontBase` is the URL the bundled fonts load from;
 * `fillable` makes the fillable edition, marking each place to write, tick or
 * choose for the form layer. Returns { html, pages } where pages lists each
 * page's kind, in order.
 */
function buildHtml({ qr, lang = "en", fillable = false, fontBase = `file://${path.join(ROOT, "fonts")}/` }) {
  const C = copyFor(lang, fillable);
  const ui = appUi[lang];
  const core = coreFor(lang);
  const days = daysFor(lang);
  const groups = weekGroups(lang);
  const sos = lang === "es" ? esSos[0] : sosSetsEn[0];
  const [coverTitle, coverSub] = core.name.split(" — ");
  const epigraph = C.epigraph.source.slice(C.epigraph.source.indexOf(C.epigraph.from));

  // The fillable edition only: a form field's name, kind and tooltip, and how
  // it sits (scripts/workbook-form.js). `f` is { name, tip }; the print
  // edition gets none of it.
  const field = (f, kind, extra = {}) => !fillable || !f ? ""
    : ` data-field="${f.name}" data-kind="${kind}" data-tip="${esc(f.tip)}"` + Object.entries(extra).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  const markHere = f => fillable && f ? " data-mark" : "";
  const link = (url, svg) => fillable ? `<a href="${esc(url)}">${svg}</a>` : svg;
  // A day's fields. Its check-in and its practice tick show in more than one
  // place, always as the same field.
  const dayField = (d, key, tip) => ({ name: `day-${String(d.n).padStart(2, "0")}-${key}`, tip: `${C.day(d.n)} · ${tip}` });
  const before = d => dayField(d, "before", `${C.fearCheckin} · ${C.beforePrayed}`);
  const after = d => dayField(d, "after", `${C.fearCheckin} · ${C.after}`);
  const done = d => dayField(d, "done", `${C.practiceLabel} · ${C.done}`);

  const STAR = `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z"/></svg>`;
  const box = (label, f) => `<span class="tick"${field(f, "check", { look: "check" })}><span class="box"${markHere(f)}></span>${esc(label)}</span>`;
  const scale = f => `<span class="dots">${[1, 2, 3, 4, 5].map(n => `<span class="dot"${field(f, "radio", { value: n, look: "ring", grow: 3 })}>${n}</span>`).join("")}</span>`;
  const lines = (grow = 1, prompt = "", f) => `<div class="prompt" style="flex-grow:${grow}">${prompt ? `<p class="q">${esc(prompt)}</p>` : ""}<div class="lines"${field(f, "text", { multiline: 1, grow: -3 })}></div></div>`;
  const blank = (cls, f, size) => `<span class="blank${cls ? ` ${cls}` : ""}"${field(f, "text", size ? { size } : {})}></span>`;

  const pages = [];
  const page = (cls, body, { footer = true } = {}) => {
    const n = pages.length + 1;
    const foot = footer ? `<footer>
      <span class="brand">${STAR}<span>Stand</span><span class="sep">·</span><span class="series">${esc(core.short)}</span></span>
      <span class="num">${n}</span>
    </footer>` : "";
    pages.push({ cls, html: `<section class="page ${cls}">${body}${foot}</section>` });
    return n;
  };

  // One column of five circles per mark; 5 (overwhelming) at the top. In the
  // fillable edition, fields[i][k] is the field for column i's mark k.
  const chart = ({ cols, sub = [""], width = 540, height = 150, label, fields = [] }) => {
    const left = 74, bottom = 26, top = 8;
    const plotW = width - left - 6, plotH = height - bottom - top;
    const colW = plotW / cols.length, subW = colW / sub.length;
    const y = level => top + plotH - (level - 0.5) * (plotH / 5);
    let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">`;
    for (const level of [1, 2, 3, 4, 5]) {
      s += `<line x1="${left}" x2="${width - 6}" y1="${y(level)}" y2="${y(level)}" class="grid"/>`;
      const name = level === 5 ? C.high : level === 1 ? C.low : String(level);
      s += `<text x="${left - 8}" y="${y(level) + 3}" text-anchor="end" class="axis">${esc(name)}</text>`;
    }
    const r = Math.min(4.2, subW * 0.32);
    cols.forEach((c, i) => {
      const x0 = left + i * colW;
      if (i) s += `<line x1="${x0}" x2="${x0}" y1="${top}" y2="${top + plotH}" class="divide"/>`;
      sub.forEach((name, k) => {
        const cx = x0 + subW * (k + 0.5);
        for (const level of [1, 2, 3, 4, 5]) s += `<circle cx="${cx}" cy="${y(level)}" r="${r}" class="pip"${field((fields[i] || [])[k], "radio", { value: level, look: "dot", grow: 2.5 })}/>`;
        if (name) s += `<text x="${cx}" y="${top + plotH + 10}" text-anchor="middle" class="sub">${esc(name)}</text>`;
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
    <p class="kicker">${esc(C.coverKicker)}</p>
    <h1 class="cover-title">${esc(coverTitle)}</h1>
    <p class="cover-sub">${esc(coverSub)}</p>
    <p class="cover-lead">${esc(C.coverLead)}</p>
    <blockquote class="cover-verse">“${esc(epigraph)}”</blockquote>
    <p class="ref cover-ref">${esc(C.epigraph.ref)}</p>
    <div class="fields">
      <div class="field"><span>${esc(C.belongs)}</span>${blank("", { name: "cover-name", tip: C.belongs })}</div>
      <div class="field"><span>${esc(C.began)}</span>${blank("", { name: "cover-began", tip: C.began })}</div>
    </div>
    <div class="cover-foot"><span class="brand">${STAR}<span>Stand</span></span><span>prayers.dougdevitre.org</span></div>
  </div>`, { footer: false });

  /* ---------- how to use ---------- */
  const reviews = groups.slice(0, -1).map(g => g[g.length - 1].n);
  page("howto", `
  <p class="kicker">${esc(C.howKicker)}</p>
  <h1 class="page-title">${esc(C.howTitle)}</h1>
  <p class="lead">${esc(C.howLead)}</p>
  <h2 class="label">${esc(C.rhythm)}</h2>
  <ol class="steps">${C.steps.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join("")}</ol>
  <div class="two">
    <div>
      <h2 class="label">${esc(C.checkinTitle)}</h2>
      <p>${esc(ui["checkin.scale"])}. ${esc(C.checkinBody)}</p>
      <p class="example">${scale()}</p>
      <h2 class="label">${esc(C.missTitle)}</h2>
      <p>${esc(C.missBody)}</p>
      <h2 class="label">${esc(C.weeklyTitle)}</h2>
      <p>${esc(C.weeklyBody(reviews.slice(0, -1).join(", "), reviews[reviews.length - 1], days.length))}</p>
    </div>
    <div>
      <h2 class="label">${esc(C.listenTitle)}</h2>
      <p>${esc(C.listenBody)}</p>
      <div class="qr-big">${link(appLink(lang), qr[appLink(lang)])}</div>
      <h2 class="label">${esc(C.privateTitle)}</h2>
      <p>${esc(C.privateBody)}</p>
    </div>
  </div>
  <h2 class="label">${esc(C.glanceTitle)}</h2>
  <ul class="glance">${groups.map(g => `<li><span class="glance-week">${esc(g[0].week)}</span><span class="glance-days">${esc(g.length > 1 ? C.days(g[0].n, g[g.length - 1].n) : C.day(g[0].n))}</span><span class="glance-titles">${g.map(d => esc(d.title)).join(" · ")}</span></li>`).join("")}</ul>`);

  /* ---------- Steady me now ---------- */
  const steadyPage = page("steady", `
  <p class="kicker">${esc(C.steadyKicker)}</p>
  <h1 class="page-title">${esc(C.steadyTitle(ui))}</h1>
  <p class="lead">${esc(C.steadyLead)}</p>
  <ol class="pause">
    <li><b>${esc(C.breathe[0])}</b> ${esc(C.breathe[1])}
      <span class="breaths">${[1, 2, 3].map(k => `<span class="breath"${field({ name: `steady-breath-${k}`, tip: C.breath(k, 3) }, "check", { look: "gold", grow: 2 })}></span>`).join("")}</span></li>
    <li><b>${esc(C.anchor)}</b> <span class="verse-inline">“${esc(sos.verse)}”</span> <span class="ref-inline">${esc(sos.ref)}</span></li>
    <li><b>${esc(C.pray)}</b> <span class="serif">${esc(sos.prayer)}</span></li>
    <li><b>${esc(C.declare)}</b> <span class="serif">${esc(sos.declaration)}</span></li>
    <li><b>${esc(C.checkIn[0])}</b> ${esc(C.checkIn[1])} ${esc(ui["sos.closing"])}
      <span class="inline-checkin">${esc(C.before)} ${scale({ name: "steady-before", tip: `${C.steadyTitle(ui)} · ${C.before}` })} <span class="gap"></span> ${esc(C.after)} ${scale({ name: "steady-after", tip: `${C.steadyTitle(ui)} · ${C.after}` })}</span></li>
  </ol>
  <h2 class="label">${esc(C.steadiesTitle)}</h2>
  <div class="write steadies">
    ${lines(3, C.steadies[0], { name: "steady-1", tip: C.steadies[0] })}
    ${lines(2, C.steadies[1], { name: "steady-2", tip: C.steadies[1] })}
    ${lines(2, C.steadies[2], { name: "steady-3", tip: C.steadies[2] })}
  </div>
  ${support}`);

  /* ---------- before Day 1 ---------- */
  page("begin", `
  <p class="kicker">${esc(C.beginKicker)}</p>
  <h1 class="page-title">${esc(C.beginTitle)}</h1>
  <div class="write">
    ${lines(5, C.afraid, { name: "begin-afraid", tip: C.afraid })}
    <div class="checkin solo"><span class="label">${esc(C.today)}</span>${scale({ name: "begin-fear", tip: C.today })}<span class="legend">${esc(ui["checkin.scale"])}</span></div>
    ${lines(4, C.hoping, { name: "begin-hoping", tip: C.hoping })}
    ${lines(3, C.walking, { name: "begin-walking", tip: C.walking })}
    <div class="when"><span class="label">${esc(C.when)}</span>${blank("short", { name: "begin-when", tip: C.when })}<span class="label">${esc(C.where)}</span>${blank("", { name: "begin-where", tip: C.where })}</div>
  </div>`);

  /* ---------- tracker ---------- */
  page("tracker", `
  <p class="kicker">${esc(C.trackerKicker)}</p>
  <h1 class="page-title">${esc(C.trackerTitle)}</h1>
  <p class="lead">${esc(C.trackerLead)}</p>
  <div class="grid30">${days.map(d => `<div class="cell"><span class="cell-n">${d.n}</span><span class="cell-t">${esc(d.title)}</span><span class="cell-ticks">${box(C.prayed, dayField(d, "prayed", C.prayed))}${box(C.practiced, done(d))}</span></div>`).join("")}</div>
  <h2 class="label">${esc(C.chartTitle)}</h2>
  <p class="hint">${esc(C.chartHint)}</p>
  ${chart({ cols: days.map(d => String(d.n)), label: C.chartLabel, fields: days.map(d => [before(d)]) })}`);

  /* ---------- the days, with a look back after each week ---------- */
  const dayPage = d => page("day", `
    <div class="run"><span class="kicker">${esc(C.dayOf(d.n, days.length))} · ${esc(d.week)}</span><span class="date">${esc(C.date)} ${blank("tiny", dayField(d, "date", C.date), 9.5)}</span></div>
    <div class="card">
      <div class="title-row">
        <h1 class="title">${esc(d.title)}</h1>
        <span class="qr-wrap"><span class="qr-label">${esc(C.scan(d.n))}</span><span class="qr">${link(d.url, qr[d.url])}</span></span>
      </div>
      <blockquote class="verse">“${esc(d.verse)}”</blockquote>
      <p class="ref">${esc(d.ref)}</p>
      <h2 class="label">${esc(C.reflection)}</h2>
      <p class="reflection">${esc(d.reflection)}</p>
      <h2 class="label">${esc(C.prayer)}</h2>
      <p class="prayer">${esc(d.prayer)}</p>
      <div class="pair">
        <div><h2 class="label">${esc(C.declareLabel)}</h2><p class="declare">${esc(d.declaration)}</p>${box(C.saidAloud, dayField(d, "said", `${C.declareLabel} · ${C.saidAloud}`))}</div>
        <div><h2 class="label">${esc(C.practiceLabel)}</h2><p class="practice">${esc(d.practice)}</p>${box(C.done, done(d))}</div>
      </div>
    </div>
    <div class="checkin"><span class="label">${esc(C.fearCheckin)}</span><span class="pair-in">${esc(C.beforePrayed)} ${scale(before(d))}</span><span class="pair-in">${esc(C.after)} ${scale(after(d))}</span><span class="legend">${esc(ui["checkin.scale"])}</span></div>
    <div class="write">
      ${C.prompts.map((q, i) => lines([4, 3, 2][i], q, dayField(d, `q${i + 1}`, q))).join("\n      ")}
    </div>`);

  const weekPage = (group, g) => {
    const label = group[0].week;
    const first = group[0].n, last = group[group.length - 1].n;
    const title = C.weekTitle(label.split(" · ")[0].toLowerCase());
    const keep = { name: `week-${g + 1}-keep`, tip: `${title} · ${C.declsHint.replace(/\.$/, "")}` };
    return page("week", `
    <p class="kicker">${esc(label)}</p>
    <h1 class="page-title">${esc(title)}</h1>
    <h2 class="label">${esc(C.weekChecks(first, last))}</h2>
    <p class="hint">${esc(C.weekHint)}</p>
    ${chart({ cols: group.map(d => C.day(d.n)), sub: C.sub, height: 160, label: C.weekChartLabel(first, last), fields: group.map(d => [before(d), after(d)]) })}
    <h2 class="label">${esc(C.decls)}</h2>
    <p class="hint">${esc(C.declsHint)}</p>
    <ul class="decls">${group.map(d => `<li${field(keep, "radio", { value: d.n, label: C.day(d.n), look: "dot" })}><span class="ring"${markHere(keep)}></span><span class="decl-n">${esc(C.day(d.n))}</span><span class="serif">${esc(d.declaration)}</span></li>`).join("")}</ul>
    <div class="write">
      ${C.weekPrompts.map((q, i) => lines(3, q, { name: `week-${g + 1}-q${i + 1}`, tip: `${title} · ${q}` })).join("\n      ")}
    </div>`);
  };

  groups.forEach((group, g) => {
    for (const d of group) dayPage(d);
    if (g < groups.length - 1) weekPage(group, g);
  });

  /* ---------- the whole journey ---------- */
  const others = Object.keys(tracks).filter(id => id !== "core").map(id => [id, lang === "es" && esTracks[id] ? { ...tracks[id], ...esTracks[id] } : tracks[id]]);
  const fear = others.filter(([, t]) => t.group === "Journeys for fear").map(([, t]) => `${t.short} (${t.days.length} ${C.daysWord})`);
  const stories = others.filter(([, t]) => t.group === "Courage stories");
  page("final", `
  <p class="kicker">${esc(core.weeks[core.weeks.length - 1])}</p>
  <h1 class="page-title">${esc(C.finalTitle)}</h1>
  <div class="write">
    ${C.finalPrompts.map((q, i) => lines([3, 3, 2, 3][i], q, { name: `final-q${i + 1}`, tip: `${C.finalTitle} · ${q}` })).join("\n    ")}
  </div>
  <div class="next">
    <h2 class="label">${esc(C.nextTitle)}</h2>
    <p>${esc(C.next({ fear, stories: stories.length, first: stories[0][1].short.toLowerCase(), last: stories[stories.length - 1][1].short.toLowerCase() }))}</p>
  </div>`);

  /* ---------- notes ---------- */
  for (let k = 0; k < 2; k++) page("notes", `<p class="kicker">${esc(C.notes)}</p><div class="write">${lines(1, "", { name: `notes-${k + 1}`, tip: C.notes })}</div>`);

  /* ---------- about ---------- */
  const draft = prayerCorpus.meta && prayerCorpus.meta.reviewNote ? ` ${C.draft}` : "";
  page("about", `
  <p class="kicker">${esc(C.aboutKicker)}</p>
  <h1 class="page-title">${esc(C.aboutTitle)}</h1>
  <p>${esc(C.about)} <b>prayers.dougdevitre.org</b>.</p>
  <h2 class="label">${esc(C.scriptureTitle)}</h2>
  <p>${esc(C.scripture)}</p>
  <h2 class="label">${esc(C.isntTitle)}</h2>
  <p>${esc(C.isnt(steadyPage))}</p>
  <h2 class="label">${esc(C.useTitle)}</h2>
  <p>${esc(C.use)}</p>
  <h2 class="label">${esc(C.editionTitle)}</h2>
  <p>${esc(C.edition + draft)}</p>
  ${support}`);

  const font = (file, family, weight, style = "normal") =>
    `@font-face{font-family:"${family}";src:url("${fontBase}${file}") format("woff");font-weight:${weight};font-style:${style}}`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(C.docTitle)}</title><style>
${font("source-serif-4-latin-400-normal.woff", "StandSerif", 400)}
${font("source-serif-4-latin-400-italic.woff", "StandSerif", 400, "italic")}
${font("source-serif-4-latin-600-normal.woff", "StandSerif", 600)}
${font("source-sans-3-latin-400-normal.woff", "StandSans", 400)}
${font("source-sans-3-latin-700-normal.woff", "StandSans", 700)}
${CSS}${fillable ? FILL_CSS : ""}</style></head><body${fillable ? ' class="fillable"' : ""}>${pages.map(p => p.html).join("\n")}</body></html>`;
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
.qr-label{font-size:7.5pt;color:var(--muted);text-align:right;max-width:.85in;line-height:1.25}
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

// The fillable edition: a soft box to type in where the print edition rules
// lines (typed text never sits on a ruled line), a date line tall enough for
// a field, and codes that are also links.
const FILL_CSS = `
.fillable .lines{border:.6pt solid var(--rule);border-radius:2pt;background:#fbfcfc}
.fillable .blank.tiny{height:13pt}
.fillable .qr a,.fillable .qr-big a{display:block;width:100%;height:100%}
`;

/**
 * Prints one edition of one language's workbook to a PDF, with its form when
 * it is the fillable one; fails, naming the page, if anything runs off one.
 */
async function build({ lang = "en", fillable = false, out = path.join(OUT_DIR, copyFor(lang, fillable).file), log = console.log } = {}) {
  const { chromium } = require("playwright");
  const name = fillable ? `${lang} (fillable)` : lang;
  const qr = await makeQr(qrTargets(lang));
  const { html } = buildHtml({ qr, lang, fillable });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const htmlFile = out.replace(/\.pdf$/, ".html");
  fs.writeFileSync(htmlFile, html);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  let report, widgets;
  try {
    const tab = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await tab.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    // The rules: as many as fit in each writing area, so a page ends on a whole
    // line. (The fillable edition types into a box instead.)
    report = await tab.evaluate(fillable => {
      const line = 0.3 * 96;
      if (!fillable) {
        for (const el of document.querySelectorAll(".lines")) {
          el.innerHTML = '<div class="rule"></div>'.repeat(Math.max(1, Math.floor(el.clientHeight / line)));
        }
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
    }, fillable);
    // Where each form field goes, in CSS pixels from its page's corner:
    // `hit` is the widget, grown or inset by data-grow; `mark` is the printed
    // box or circle its "on" look fills.
    widgets = !fillable ? [] : await tab.evaluate(() => {
      const pages = [...document.querySelectorAll(".page")];
      return [...document.querySelectorAll("[data-field]")].map(el => {
        const page = el.closest(".page"), corner = page.getBoundingClientRect(), d = el.dataset;
        const rect = (r, grow = 0) => ({ x: r.left - corner.left - grow, y: r.top - corner.top - grow, w: r.width + 2 * grow, h: r.height + 2 * grow });
        return {
          page: pages.indexOf(page), name: d.field, kind: d.kind, tip: d.tip, value: d.value, label: d.label, look: d.look,
          multiline: d.multiline === "1", size: d.size ? Number(d.size) : undefined,
          hit: rect(el.getBoundingClientRect(), Number(d.grow || 0)),
          mark: rect((el.querySelector("[data-mark]") || el).getBoundingClientRect())
        };
      });
    });
    await tab.pdf({ path: out, width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true });
    fs.rmSync(htmlFile, { force: true });
  } finally {
    await browser.close();
  }
  if (fillable) fs.writeFileSync(out, await require("./workbook-form.js").addFields(fs.readFileSync(out), widgets));
  const bad = report.filter(r => r.overflow.length || r.clipped);
  for (const r of bad) log(`✗ ${name} page ${r.page} (${r.kind}) runs off the page: ${r.overflow.join(", ") || "clipped"}`);
  for (const r of report.filter(r => r.kind === "day" && !fillable && r.rules < 6)) log(`• ${name} page ${r.page}: only ${r.rules} writing lines`);
  const fields = fillable ? `, ${new Set(widgets.map(w => w.name)).size} fields` : "";
  log(bad.length ? `✗ ${name}: ${bad.length} of ${report.length} pages overflow` : `✓ ${name}: ${report.length} pages${fields}, nothing runs off a page → ${path.relative(ROOT, out)}`);
  return { ok: !bad.length, report, widgets, out };
}

if (require.main === module) {
  const i = process.argv.indexOf("--lang");
  const langs = i >= 0 ? [process.argv[i + 1]] : LANGS;
  if (!langs.every(l => COPY[l])) { console.error(`--lang must be one of ${LANGS.join(", ")}`); process.exit(2); }
  (async () => {
    let ok = true;
    for (const lang of langs) {
      for (const fillable of [false, true]) ok = (await build({ lang, fillable })).ok && ok;
    }
    process.exit(ok ? 0 : 1);
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { SITE, LANGS, COPY, OUT_DIR, copyFor, daysFor, weekGroups, qrTargets, makeQr, buildHtml, build };
