// Renders a day's share card as a PNG.
//
//   GET /cards/{lang}/{track}/{slug}.{hash}.{post|og}.png
//     (vercel.json rewrites it to /api/card?lang=&track=&file=)
//
//   200  image/png, cached for a year: the hash in the address changes
//        whenever anything on the card does, so a cached copy is never stale
//   308  the hash is out of date: redirects to the card's current address,
//        so a link shared before an edit still shows an image
//   404  no such day, or not a card address
//   405  anything but GET or HEAD
//
// Only published day content is drawn, looked up by address. Nothing from the
// request is ever rendered as text, so this cannot be used to make an image
// saying something else, and a reader's own notes never reach it.
//
// Rendering: satori lays the card out as SVG, resvg (WebAssembly) turns it
// into a PNG. Both are set up once, on the first request; the fonts are the
// bundled OFL files in fonts/. (Not @vercel/og, which wraps the same two:
// 0.x pulls in sharp and its native image codecs, which a card never needs,
// and 1.0.2-1.0.3 ship without a WebAssembly file they load.)

const fs = require("fs");
const path = require("path");
const { FORMATS, cardForSlug, cardPath, parseCardFile } = require("../cards.js");

const FONT_DIR = path.join(__dirname, "..", "fonts");
const font = (file, name, weight, style = "normal") =>
  ({ name, weight, style, data: fs.readFileSync(path.join(FONT_DIR, file)) });
const FONTS = [
  font("source-serif-4-latin-400-normal.woff", "Serif", 400),
  font("source-serif-4-latin-400-italic.woff", "Serif", 400, "italic"),
  font("source-serif-4-latin-600-normal.woff", "Serif", 600),
  font("source-sans-3-latin-400-normal.woff", "Sans", 400),
  font("source-sans-3-latin-700-normal.woff", "Sans", 700)
];

// The app's light palette (styles.css :root), kept literal like
// scripts/build-og-card.js: a card must not restyle itself when a token moves.
const INK = "#132a3a", PAPER = "#f7f4ec", SURFACE = "#fffdf7", GOLD = "#b88732",
  GOLD_TEXT = "#8a6420", GOLD_LIGHT = "#f1c879", MUTED = "#60717b";

// satori takes React-shaped objects; this is all of React it needs.
const h = (type, style, ...children) => ({ type, props: { style, children: children.length === 1 ? children[0] : children } });
const star = color => ({
  type: "svg",
  props: { width: 22, height: 22, viewBox: "0 0 24 24", children: { type: "path", props: { fill: color, d: "M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" } } }
});
// Non-breaking spaces: with letter-spacing, satori drops a plain space that
// follows a hyphen ("30-DAY JOURNEY" rendered as "30-DAYJOURNEY"). A kicker
// is one short line, so it never needs to wrap.
const kicker = (text, color, size) => h("div", { display: "flex", fontFamily: "Sans", fontWeight: 700, fontSize: size, letterSpacing: 4, color }, text.replace(/ /g, "\u00a0"));
const footer = (card, brandColor, siteColor) => h("div", { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" },
  h("div", { display: "flex", alignItems: "center", gap: 16 }, star(brandColor),
    h("div", { display: "flex", fontFamily: "Sans", fontWeight: 700, fontSize: 26, letterSpacing: 8, color: brandColor }, "STAND")),
  h("div", { display: "flex", fontFamily: "Sans", fontSize: 22, color: siteColor }, card.site));

/** 1080x1350: the whole day, for posting as an image. */
function postCard(card) {
  const L = card.labels;
  const label = text => h("div", { display: "flex", fontFamily: "Sans", fontWeight: 700, fontSize: 20, letterSpacing: 4, color: GOLD_TEXT, marginBottom: 8 }, text);
  return h("div", { display: "flex", width: "100%", height: "100%", padding: 56, backgroundColor: PAPER, color: INK },
    h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "60px 72px", border: `3px solid ${GOLD}`, backgroundColor: SURFACE },
      kicker(`${L.day} ${card.number} · ${card.journey.toUpperCase()}`, GOLD_TEXT, 24),
      h("div", { display: "flex", fontFamily: "Serif", fontSize: 80, lineHeight: 1.05, letterSpacing: -2, margin: "14px 0 26px" }, card.title),
      h("div", { display: "flex", fontFamily: "Serif", fontStyle: "italic", fontSize: 31, lineHeight: 1.45, borderLeft: `4px solid ${GOLD}`, paddingLeft: 24 }, `“${card.verse}”`),
      h("div", { display: "flex", fontFamily: "Sans", fontWeight: 700, fontSize: 22, color: MUTED, padding: "10px 0 30px 28px" }, card.ref),
      label(L.reflection),
      h("div", { display: "flex", fontFamily: "Sans", fontSize: 28, lineHeight: 1.45, marginBottom: 28 }, card.reflection),
      label(L.prayer),
      h("div", { display: "flex", fontFamily: "Serif", fontSize: 30, lineHeight: 1.45, padding: "24px 30px", border: `2px solid ${GOLD}`, backgroundImage: `linear-gradient(135deg, #f3e6c8, ${SURFACE})` }, card.prayer),
      footer(card, INK, MUTED)));
}

/** 1200x630: the link preview. The full prayer would be unreadable at feed size. */
function ogCard(card) {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 72px", backgroundColor: INK, color: PAPER },
    kicker(`${card.labels.day} ${card.number} · ${card.ref}`, GOLD, 22),
    h("div", { display: "flex", fontFamily: "Serif", fontSize: 72, lineHeight: 1.05, letterSpacing: -2, margin: "12px 0 20px" }, card.title),
    h("div", { display: "flex", fontFamily: "Sans", fontSize: 28, lineHeight: 1.4, color: "#e9e4d6", marginBottom: 16 }, card.reflection),
    h("div", { display: "flex", fontFamily: "Serif", fontStyle: "italic", fontSize: 30, lineHeight: 1.35, color: GOLD_LIGHT }, `“${card.prayerLead}”`),
    footer(card, GOLD, "#d9d4c6"));
}

let engines = null;
function setUp() {
  engines = engines || (async () => {
    // satori shapes text with harfbuzzjs, which loads hb.wasm from its own
    // folder at run time, and resvg's index_bg.wasm is read below. Neither is
    // a require(), and Vercel's bundler left both out of the function even
    // though a local @vercel/nft trace found them (production answered
    // "Cannot find module .../index_bg.wasm"), so vercel.json names both in
    // includeFiles. Checking here makes a missing file fail with its name.
    fs.accessSync(require.resolve("harfbuzzjs/hb.wasm"));
    const satori = require("satori").default;
    const resvg = require("@resvg/resvg-wasm");
    await resvg.initWasm(fs.readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    return { satori, Resvg: resvg.Resvg };
  })();
  return engines;
}

/** The PNG bytes for one card in one format. */
async function render(card, format) {
  const { satori, Resvg } = await setUp();
  const { width, height } = FORMATS[format];
  const svg = await satori(format === "og" ? ogCard(card) : postCard(card), { width, height, fonts: FONTS });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end();
  }
  const q = new URL(req.url, "http://localhost").searchParams;
  const want = parseCardFile(q.get("lang"), q.get("track"), q.get("file"));
  const card = want && cardForSlug(want.lang, want.track, want.slug);
  if (!card) {
    res.statusCode = 404;
    res.setHeader("Cache-Control", "no-store");
    return res.end();
  }
  if (card.hash !== want.hash) {
    res.statusCode = 308;
    res.setHeader("Location", cardPath(card, want.format));
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.end();
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  if (req.method === "HEAD") return res.end();
  try {
    const png = await render(card, want.format);
    res.statusCode = 200;
    res.end(png);
  } catch (e) {
    console.error(JSON.stringify({ event: "card-render-failed", path: cardPath(card, want.format), error: String(e && e.message || e) }));
    res.statusCode = 500;
    res.setHeader("Cache-Control", "no-store");
    res.removeHeader("Content-Type");
    res.end();
  }
}

handler.render = render;
module.exports = handler;
