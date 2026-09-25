// Pure logic, extracted from app.js so it can be tested without a browser:
// streak arithmetic, backup sanitizing, and calm-ledger aggregation. Nothing
// here touches the DOM, storage, or globals — every dependency is an argument,
// and "now" is always injected so date maths can be tested across time zones
// and daylight-saving boundaries.
//
// Shared the way content.js is: globals in the browser, CommonJS in Node.

/** A date as the local calendar day, e.g. "2026-09-21". */
function localISO(date) {
  return date.toLocaleDateString("en-CA");
}

/** A title as a URL slug: "The Word" -> "the-word", "La Palabra" -> "la-palabra".
 * NFD + stripping combining marks folds á->a and ñ->n, so Spanish titles
 * produce ASCII slugs. Shared by the page generator and the calendar
 * reminder, so the links the app writes match the pages that exist. */
function slugify(title) {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Every local date on which a day was completed, on any journey — completing
 * a day on any track keeps the one streak alive. */
function completedDatesOf(state) {
  const days = new Set(Object.values(state.completedDates || {}));
  for (const track of Object.values(state.tracks || {})) {
    for (const date of Object.values(track.completedDates || {})) days.add(date);
  }
  return days;
}

/**
 * Consecutive days completed, counting back from `now`.
 * A streak survives until a full calendar day is missed, so finishing
 * yesterday but not yet today still counts.
 */
function streakFrom(dates, now) {
  const days = dates instanceof Set ? dates : new Set(dates);
  if (!days.size) return 0;
  let streak = 0;
  // Anchored at noon rather than carrying `now`'s time of day. This is
  // hardening, not a fix: a sweep of 13,140 combinations (9 zones x every day
  // of a year x four times of day, including zones whose DST jump deletes
  // local midnight) found no case where the two disagree, because JS
  // normalizes a deleted wall-clock time forward within the same calendar day.
  // Noon simply removes the need to re-derive that each time this is read.
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!days.has(localISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Calm-ledger figures: the average fear drop across completed SOS sessions,
 * and the average check-in over the last seven days. Either can be null when
 * there is nothing yet to average. */
function ledgerStats(sos, checkins, nowMs) {
  const sessions = (sos || []).filter(s => s && s.before != null && s.after != null);
  const avgDrop = sessions.length
    ? sessions.reduce((sum, s) => sum + (s.before - s.after), 0) / sessions.length
    : null;
  const weekAgo = nowMs - 7 * 86400000;
  const week = (checkins || []).filter(c => c && new Date(c.t).getTime() >= weekAgo);
  const avgWeek = week.length ? week.reduce((sum, c) => sum + c.v, 0) / week.length : null;
  return { sessions, avgDrop, week, avgWeek };
}

/** One journey's slice of a backup, with anything malformed dropped. */
function sanitizeTrackData(raw, length) {
  const validDay = d => Number.isInteger(d) && d >= 0 && d < length;
  const clean = { completed: [], favorites: [], notes: {}, completedDates: {} };
  if (!raw || typeof raw !== "object") return clean;
  if (Array.isArray(raw.completed)) clean.completed = raw.completed.filter(validDay);
  if (Array.isArray(raw.favorites)) clean.favorites = raw.favorites.filter(validDay);
  if (raw.notes && typeof raw.notes === "object") {
    for (const [key, value] of Object.entries(raw.notes)) {
      if (validDay(Number(key)) && typeof value === "string") clean.notes[key] = value;
    }
  }
  if (raw.completedDates && typeof raw.completedDates === "object") {
    for (const [key, value] of Object.entries(raw.completedDates)) {
      if (validDay(Number(key)) && typeof value === "string") clean.completedDates[key] = value;
    }
  }
  return clean;
}

/**
 * A restored backup, or null when the file is not a Stand backup.
 * Everything is validated against the content that exists now: a backup from a
 * newer build can name journeys or days this one does not have, and those are
 * dropped rather than trusted.
 *
 * deps: { coreDays, tracks, langs }
 */
function sanitizeBackup(raw, deps) {
  const { coreDays, tracks, langs } = deps;
  if (!raw || typeof raw !== "object") return null;
  // The legacy top-level fields identify a Stand backup.
  if (!Array.isArray(raw.completed) || !Array.isArray(raw.favorites) || !raw.notes || typeof raw.notes !== "object") return null;
  const core = sanitizeTrackData(raw, coreDays);

  const trackData = {};
  if (raw.tracks && typeof raw.tracks === "object") {
    for (const [id, sub] of Object.entries(raw.tracks)) {
      if (id !== "core" && tracks[id]) trackData[id] = sanitizeTrackData(sub, tracks[id].days.length);
    }
  }

  const validLevel = v => Number.isInteger(v) && v >= 1 && v <= 5;
  const checkins = Array.isArray(raw.checkins)
    ? raw.checkins
        .filter(c => {
          if (!c || typeof c !== "object" || typeof c.t !== "string" || !validLevel(c.v)) return false;
          const length = tracks[c.track || "core"] ? tracks[c.track || "core"].days.length : 0;
          return Number.isInteger(c.day) && c.day >= 0 && c.day < length;
        })
        .map(c => ({ t: c.t, track: tracks[c.track] ? c.track : "core", day: c.day, v: c.v }))
    : [];
  const sosSessions = Array.isArray(raw.sos)
    ? raw.sos
        .filter(s => s && typeof s === "object" && typeof s.t === "string"
          && (s.before == null || validLevel(s.before)) && (s.after == null || validLevel(s.after)))
        .map(s => ({ t: s.t, before: s.before ?? null, after: s.after ?? null }))
    : [];

  return {
    ...core,
    checkins,
    sos: sosSessions,
    track: tracks[raw.track] ? raw.track : "core",
    tracks: trackData,
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : null,
    lang: langs.includes(raw.lang) ? raw.lang : "en",
    bilingual: raw.bilingual === true,
    welcomed: true,
    installHintDismissed: raw.installHintDismissed === true,
    // The reminder settings are whitelisted like everything else, so a
    // restore keeps the chosen time. reminderSeq has to survive too: it is
    // what makes a re-exported .ics out-rank the one already in the calendar,
    // and a reset to 0 would leave the update silently ignored.
    reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderTime) ? raw.reminderTime : null,
    reminderSeq: Number.isInteger(raw.reminderSeq) && raw.reminderSeq >= 0 ? raw.reminderSeq : 0,
    // The export options, each reduced to its default when malformed.
    reminderFrom: raw.reminderFrom === "start" ? "start" : "current",
    reminderWeekdays: raw.reminderWeekdays === true,
    reminderLead: [0, 10, 30].includes(raw.reminderLead) ? raw.reminderLead : 0,
    reminderEvening: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderEvening) ? raw.reminderEvening : null,
    // Whether an evening series has been exported, so turning it off can
    // cancel it once.
    reminderEveningExported: raw.reminderEveningExported === true
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { localISO, slugify, completedDatesOf, streakFrom, ledgerStats, sanitizeTrackData, sanitizeBackup };
}
