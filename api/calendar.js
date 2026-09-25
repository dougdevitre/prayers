// The calendar feed: the same file the app downloads, served from a URL a
// calendar app can subscribe to and poll, so the reader never re-exports.
//
//   GET /calendar.ics?track=core&from=7&start=2026-09-26&time=07:00&lang=en
//       [&weekdays=1][&lead=10|30][&evening=21:00]
//
// Everything is in the query and nothing is stored: journey id, the day to
// start on, the date of that first reminder, the time, the language, and
// the option flags. Completion never leaves the device, so the feed is
// date-anchored rather than progress-anchored; a reader who falls behind
// re-subscribes from the app, which builds the URL from where they are.
//
// This is the product's only server code. It is a pure function of the
// query over the committed content, runs on Vercel's Node runtime, and can
// be exercised by the test server the same way (it is a plain Node
// (req, res) handler that reads req.url).

const { tracks } = require("../content.js");
const { esTracks } = require("../content.es.js");
const { appUi } = require("../ui.js");
const { REMINDER_LEADS, reminderSchedule, buildReminderIcs } = require("../reminder.js");

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// The same lookup app.js has, minus the DOM.
const tFor = lang => (key, vars) => {
  let out = appUi[lang][key] !== undefined ? appUi[lang][key] : (appUi.en[key] !== undefined ? appUi.en[key] : key);
  if (vars) for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(value);
  return out;
};

/** The validated parameters, or { error } naming the first bad one. */
function parseQuery(search) {
  const q = new URLSearchParams(search);
  const trackId = q.get("track") || "core";
  if (!tracks[trackId]) return { error: "track" };
  const lang = q.get("lang") === "es" ? "es" : "en";
  const track = lang === "es" && esTracks[trackId] ? { ...tracks[trackId], ...esTracks[trackId] } : tracks[trackId];
  const from = q.has("from") ? Number(q.get("from")) : 1;
  if (!Number.isInteger(from) || from < 1 || from > track.days.length) return { error: "from" };
  const time = q.get("time") || "07:00";
  if (!TIME.test(time)) return { error: "time" };
  const start = q.get("start");
  const m = start ? start.match(DATE) : null;
  if (!m) return { error: "start" };
  const startDate = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  if (startDate.getFullYear() !== +m[1] || startDate.getMonth() !== +m[2] - 1 || startDate.getDate() !== +m[3]) return { error: "start" };
  const lead = q.has("lead") ? Number(q.get("lead")) : 0;
  if (!REMINDER_LEADS.includes(lead)) return { error: "lead" };
  const evening = q.get("evening") || null;
  if (evening && !TIME.test(evening)) return { error: "evening" };
  return { trackId, track, lang, from, time, startDate, weekdays: q.get("weekdays") === "1", lead, evening };
}

/** The .ics for a parsed query. Exported so it can be tested without HTTP. */
function feedFor(p, origin) {
  // The first reminder lands on the start date itself: "now" is that
  // morning at midnight, so the chosen time is still ahead.
  const schedule = reminderSchedule({ dayCount: p.track.days.length, time: p.time, now: p.startDate, from: p.from - 1, weekdays: p.weekdays });
  return buildReminderIcs({
    track: p.track, trackId: p.trackId, lang: p.lang, time: p.time, seq: 0, now: p.startDate, origin,
    t: tFor(p.lang), lead: p.lead, evening: p.evening, schedule
  });
}

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end("Method Not Allowed");
  }
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const p = parseQuery(search);
  if (p.error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(`Bad request: ${p.error}`);
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host || "prayers.dougdevitre.org";
  const proto = req.headers["x-forwarded-proto"] || (host.startsWith("localhost") ? "http" : "https");
  const body = feedFor(p, `${proto}://${host}`);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="stand.ics"');
  // The body is a pure function of the query, so the CDN may keep it for a
  // day; a client that polls sees a change only when the content changes.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.end(req.method === "HEAD" ? undefined : body);
};
module.exports.parseQuery = parseQuery;
module.exports.feedFor = feedFor;
