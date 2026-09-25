// The daily calendar reminder (.ics), as pure functions so the file can be
// built and checked in Node without a browser. Nothing here touches the DOM,
// storage or globals: the track, the strings, the origin and "now" are all
// arguments. Shared the way logic.js is: globals in the browser, CommonJS in
// Node.
//
// The shape of the file matters, so it is documented here rather than in
// the code that emits it.
//
// One recurring master event, with the UID the app has always used, plus one
// RECURRENCE-ID override per remaining day of the journey (RFC 5545 §3.8.4.4).
// An override shares the master's UID and names the occurrence it replaces,
// which is exactly how Apple Calendar, Google Calendar and Outlook store a
// modified instance themselves, so import support is the best-trodden path
// there is. Every override carries that day's title, scripture, practice,
// declaration, a tip and a link straight to the day.
//
// Why a series rather than thirty independent events:
//   - the master keeps the legacy UID, so a reader who exported the old
//     single reminder gets it replaced by the series on re-import through the
//     SEQUENCE bump the app already does — no migration, no cancel component;
//   - it is one thing to delete in the calendar, not thirty;
//   - a client that ignores overrides still shows the master's generic
//     summary and a description that links into the app.
//
// Times are deliberately FLOATING (no Z, no TZID): the reminder fires at the
// chosen wall-clock time wherever the reader happens to be. Do not "fix" this
// into UTC. The chosen HH:MM is printed literally and only the calendar day
// is computed, so a daylight-saving jump can never shift a RECURRENCE-ID off
// the occurrence it names.

const REMINDER_UID = "stand-daily-reminder@prayers.dougdevitre.org";

// slugify lives in logic.js: a global in the browser, a require in Node. Not
// named `slugify` here because a top-level const would collide with the
// global function declaration when both scripts share the page.
const slugOf = (typeof module !== "undefined" && module.exports) ? require("./logic.js").slugify : title => slugify(title);

// RFC 5545 §3.3.11: TEXT values escape backslash, semicolon, comma and
// newline. The verses are full of commas, so this is load-bearing now.
const icsText = v => String(v).replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1").replace(/\r?\n/g, "\\n");

// RFC 5545 §3.1: content lines are at most 75 OCTETS, continued with CRLF and
// one leading space. Octets, not characters — an em dash is three bytes — and
// a multi-byte character must never be split across a fold.
function icsFold(line) {
  const octets = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
  const out = [];
  let current = "", used = 0;
  for (const ch of line) {            // by code point, so surrogate pairs stay whole
    const n = octets(ch);
    if (used + n > 75) { out.push(current); current = " "; used = 1; }
    current += ch;
    used += n;
  }
  out.push(current);
  return out.join("\r\n");
}

const pad2 = n => String(n).padStart(2, "0");

/** The crawlable page for a day, e.g. "/day/07-the-word",
 * "/track/furnace/01-the-decree" or "/es/day/07-la-palabra". `track` is the
 * track in the language the page is wanted in, because the slug comes from
 * its title. Must agree with scripts/build-day-pages.js, which shares
 * slugify; the unit tests check every path against the generated files. */
function dayPagePath(trackId, track, index, lang) {
  const name = `${pad2(index + 1)}-${slugOf(track.days[index][0])}`;
  const prefix = lang === "es" ? "/es" : "";
  return trackId === "core" ? `${prefix}/day/${name}` : `${prefix}/track/${trackId}/${name}`;
}

/** The deep link into the app for a day. Mirrors the static pages: the core
 * journey needs no ?track=, every other journey names itself. */
function appDayLink(origin, trackId, index) {
  return `${origin}/app${trackId === "core" ? "" : `?track=${trackId}`}#${index + 1}`;
}

/**
 * Which days to schedule and when the first one lands.
 *   fromDay    first incomplete day; 0 when the journey is finished
 *   count      days from fromDay to the end of the journey
 *   offset     0 when the chosen time is still ahead today, else 1 (tomorrow)
 *   restarted  true when the journey was complete and starts over
 */
function reminderSchedule({ dayCount, completed, time, now }) {
  const done = new Set(completed || []);
  let fromDay = 0;
  while (fromDay < dayCount && done.has(fromDay)) fromDay++;
  const restarted = fromDay >= dayCount;
  if (restarted) fromDay = 0;
  const [h, m] = time.split(":").map(Number);
  const chosenToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return { fromDay, count: dayCount - fromDay, offset: chosenToday > now ? 0 : 1, restarted };
}

// Every tip is a literal here so scripts/verify-ui.js can see it is used.
const REMINDER_TIPS = ["reminder.tipStreak", "reminder.tipAudio", "reminder.tipNotes", "reminder.tipSos", "reminder.tipCard", "reminder.tipBilingual"];

// The journeys whose content carries a guardrail (ROADMAP: prayer is never an
// alternative to medical care; Zarephath is not a technique for money). The
// reminder repeats it early, so the calendar never says less than the app.
const GUARDRAIL_TIPS = { turning: "reminder.tipHealth", hem: "reminder.tipHealth", zarephath: "reminder.tipMoney" };

/** The tip for one reminder. `position` is where the day sits in this export
 * (0 = the first reminder the reader will receive); `dayIndex` is its place
 * in the journey. First-of-export, a journey's guardrail, halfway and last
 * are fixed; the rest rotate by day so a day keeps its tip across re-exports. */
function tipKeyFor({ position, dayIndex, total, trackId }) {
  if (dayIndex === total - 1) return "reminder.tipLast";
  if (position === 0) return trackId === "night" ? "reminder.tipNight" : "reminder.tipFirst";
  if (position === 1 && GUARDRAIL_TIPS[trackId]) return GUARDRAIL_TIPS[trackId];
  if (total >= 8 && dayIndex === Math.floor(total / 2)) return "reminder.tipHalfway";
  return REMINDER_TIPS[dayIndex % REMINDER_TIPS.length];
}

/** The week label for a day: the five core labels by week, or a short
 * journey's single banner. */
function weekLabel(weeks, d) {
  if (!weeks || !weeks.length) return "";
  if (weeks.length < 5) return weeks[0];
  if (d < 7) return weeks[0];
  if (d < 14) return weeks[1];
  if (d < 21) return weeks[2];
  if (d < 29) return weeks[3];
  return weeks[4];
}

/**
 * One day's reminder as the calendar will show it: summary, notes, link and
 * alarm text. Shared by the file and by the in-app preview, so what the
 * reader sees before tapping is exactly what lands in the calendar.
 *   dayIndex  the day in the journey; position  where it sits in this export
 */
function reminderEntry({ track, trackId, lang, origin, t, dayIndex, position }) {
  const total = track.days.length;
  const [title, ref, verse, , , declaration, practice] = track.days[dayIndex];
  const n = dayIndex + 1;
  const appLink = appDayLink(origin, trackId, dayIndex);
  // #practice lands the page on the action itself rather than the top.
  const pageLink = `${origin}${dayPagePath(trackId, track, dayIndex, lang)}#practice`;
  const summary = trackId === "core"
    ? t("reminder.daySummary", { n, title })
    : t("reminder.trackDaySummary", { n, title, track: track.short });
  const week = weekLabel(track.weeks, dayIndex);
  const description = [
    t("reminder.dayOf", { n, total, title }),
    ...(week ? [week] : []),
    `${ref} — “${verse}”`,
    "",
    t("reminder.practice", { text: practice }),
    "",
    t("reminder.declare", { text: declaration }),
    "",
    t("reminder.tipLabel", { text: t(tipKeyFor({ position, dayIndex, total, trackId })) }),
    "",
    t("reminder.openDay", { n, url: appLink }),
    t("reminder.readWeb", { url: pageLink })
  ].join("\n");
  return { summary, description, url: appLink, pageUrl: pageLink, alarm: t("reminder.alarmDay", { n, title }) };
}

/**
 * The .ics file.
 *   track     the journey in the reader's language
 *   trackId   its id ("core", "furnace", ...)
 *   lang      "en" or "es" — the language `track` is in, which picks the page prefix
 *   time      "HH:MM"
 *   seq       the SEQUENCE for every component; the caller bumps it per export
 *   now       the moment of export (DTSTAMP and the first date)
 *   origin    e.g. "https://prayers.dougdevitre.org"
 *   t         the string lookup, t(key, vars)
 *   schedule  from reminderSchedule(); computed here when omitted
 */
function buildReminderIcs({ track, trackId, lang, time, seq, now, origin, t, completed, schedule }) {
  const plan = schedule || reminderSchedule({ dayCount: track.days.length, completed, time, now });
  const [hh, mm] = time.split(":");
  const dayStamp = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${hh}${mm}00`;
  // Noon-anchored, like the streak cursor: adding days at noon can never land
  // in a deleted or repeated hour.
  const dateAt = k => new Date(now.getFullYear(), now.getMonth(), now.getDate() + plan.offset + k, 12);
  const dtstamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}T${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stand//Daily Prayer//EN", "CALSCALE:GREGORIAN",
    // PUBLISH: an import with nobody to reply to. The name is what Apple and
    // Outlook offer when the reader files the import as its own calendar,
    // which is also the cleanest way to delete the whole series later.
    "METHOD:PUBLISH", "X-WR-CALNAME:Stand",
    // The master. Its summary and description are the generic ones the app
    // has always written, so a client that ignores overrides degrades to the
    // old behaviour rather than to nothing.
    "BEGIN:VEVENT",
    `UID:${REMINDER_UID}`,
    `SEQUENCE:${seq}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dayStamp(dateAt(0))}`,
    "DURATION:PT10M",
    `RRULE:FREQ=DAILY;COUNT=${plan.count}`,
    // A prayer is not "busy": it must not block the reader's free/busy view.
    "TRANSP:TRANSPARENT",
    `SUMMARY:${icsText(t("reminder.summary"))}`,
    // /app, not the origin: the origin is the landing page, and someone
    // tapping this at 7am wants the prayer, not a page describing it.
    `DESCRIPTION:${icsText(t("reminder.description", { url: `${origin}/app` }))}`,
    `URL:${origin}/app`,
    "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY", `DESCRIPTION:${icsText(t("reminder.alarm"))}`, "END:VALARM",
    "END:VEVENT"
  ];

  for (let k = 0; k < plan.count; k++) {
    const when = dayStamp(dateAt(k));
    const entry = reminderEntry({ track, trackId, lang, origin, t, dayIndex: plan.fromDay + k, position: k });
    lines.push(
      "BEGIN:VEVENT",
      `UID:${REMINDER_UID}`,
      `RECURRENCE-ID:${when}`,
      `SEQUENCE:${seq}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${when}`,
      "DURATION:PT10M",
      "TRANSP:TRANSPARENT",
      `SUMMARY:${icsText(entry.summary)}`,
      `DESCRIPTION:${icsText(entry.description)}`,
      `URL:${entry.url}`,
      "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(entry.alarm)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { REMINDER_UID, REMINDER_TIPS, GUARDRAIL_TIPS, icsText, icsFold, dayPagePath, appDayLink, reminderSchedule, tipKeyFor, weekLabel, reminderEntry, buildReminderIcs };
}
