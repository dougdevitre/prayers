// Unit tests for the calendar reminder in reminder.js. No browser, no
// network: the file is built with an injected "now", a fixed origin and the
// real string tables, then parsed line by line.
//
//   npm run test:unit
//
// The daylight-saving cases run in child processes with TZ set, the way
// logic.test.js does, because process.env.TZ cannot be changed mid-run.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { tracks } = require("../content.js");
const { esTracks } = require("../content.es.js");
const { appUi } = require("../ui.js");
const { slugify } = require("../logic.js");
const {
  REMINDER_UID, EVENING_UID, REMINDER_TIPS, GUARDRAIL_TIPS, icsText, icsFold, dayPagePath, appDayLink,
  REMINDER_LEADS, reminderSchedule, tipKeyFor, weekLabel, reminderEntry, eveningEntry, buildReminderIcs
} = require("../reminder.js");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://prayers.dougdevitre.org";

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS " + name);
  } catch (e) {
    failures++;
    console.log("FAIL " + name);
    console.log("     " + (e && e.message ? e.message.split("\n")[0] : e));
  }
}

// The same lookup app.js has, minus the DOM.
const tFor = lang => (key, vars) => {
  let out = appUi[lang][key] !== undefined ? appUi[lang][key] : (appUi.en[key] !== undefined ? appUi.en[key] : key);
  if (vars) for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(value);
  return out;
};

// A Thursday evening; the chosen time in most tests is later the same day.
const NOW = new Date(2026, 8, 25, 19, 0, 0);

function build(overrides = {}) {
  const trackId = overrides.trackId || "core";
  const lang = overrides.lang || "en";
  return buildReminderIcs({
    track: lang === "es" ? esTracks[trackId] : tracks[trackId],
    trackId, lang, time: "21:30", seq: 3, now: NOW, origin: ORIGIN, t: tFor(lang), completed: [],
    ...overrides
  });
}

// Unfold (drop CRLF + one space) and split into components.
function parse(ics) {
  const lines = ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
  const events = [];
  let current = null;
  let inAlarm = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = { alarm: {} };
    else if (line === "END:VEVENT") { events.push(current); current = null; }
    else if (line === "BEGIN:VALARM") inAlarm = true;
    else if (line === "END:VALARM") inAlarm = false;
    else if (current) {
      const i = line.indexOf(":");
      const key = line.slice(0, i), value = line.slice(i + 1);
      if (inAlarm) current.alarm[key] = value; else current[key] = value;
    }
  }
  const morning = events.filter(e => e.UID === REMINDER_UID);
  const evening = events.filter(e => e.UID === EVENING_UID);
  return { lines, master: morning[0], overrides: morning.slice(1), events, evening: { master: evening[0], overrides: evening.slice(1) } };
}

/* ---------- text escaping and folding ---------- */

test("icsText escapes backslash, semicolon, comma and newline", () => {
  assert.strictEqual(icsText("a\\b;c,d\ne\r\nf"), "a\\\\b\\;c\\,d\\ne\\nf");
});

test("icsFold keeps every line within 75 octets and round-trips", () => {
  const input = "DESCRIPTION:" + "—".repeat(60) + "x".repeat(60);
  const folded = icsFold(input);
  const lines = folded.split("\r\n");
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `over-long: ${line}`);
  for (const line of lines.slice(1)) assert.ok(line.startsWith(" "));
  assert.strictEqual(folded.replace(/\r\n /g, ""), input);
});

/* ---------- links ---------- */

test("dayPagePath follows the generator's URL scheme in both languages", () => {
  assert.strictEqual(dayPagePath("core", tracks.core, 6, "en"), "/day/07-the-word");
  assert.strictEqual(dayPagePath("furnace", tracks.furnace, 0, "en"), "/track/furnace/01-the-decree");
  assert.strictEqual(dayPagePath("core", esTracks.core, 6, "es"), "/es/day/07-la-palabra");
  assert.strictEqual(dayPagePath("furnace", esTracks.furnace, 0, "es"), "/es/track/furnace/01-el-decreto");
});

test("every page link resolves to a generated file, every day, both languages", () => {
  let checked = 0;
  for (const [lang, set] of [["en", tracks], ["es", esTracks]]) {
    for (const [id, track] of Object.entries(set)) {
      for (let i = 0; i < track.days.length; i++) {
        const file = path.join(ROOT, dayPagePath(id, track, i, lang) + ".html");
        assert.ok(fs.existsSync(file), `missing ${file}`);
        checked++;
      }
    }
  }
  assert.strictEqual(checked, 216);
});

test("slugify folds accents and punctuation the way the pages are named", () => {
  assert.strictEqual(slugify("La Palabra"), "la-palabra");
  assert.strictEqual(slugify("¿Y si no?"), "y-si-no");
  assert.strictEqual(slugify("Guard the Mind"), "guard-the-mind");
});

test("appDayLink mirrors the static pages: no ?track= for core, named otherwise", () => {
  assert.strictEqual(appDayLink(ORIGIN, "core", 6), `${ORIGIN}/app#7`);
  assert.strictEqual(appDayLink(ORIGIN, "furnace", 0), `${ORIGIN}/app?track=furnace#1`);
});

/* ---------- schedule ---------- */

// The shape without the dates, which the date tests check on their own.
const summary = ({ fromDay, count, offset, restarted, weekdays }) => ({ fromDay, count, offset, restarted, weekdays });

test("the schedule starts at the first incomplete day", () => {
  const s = reminderSchedule({ dayCount: 30, completed: [0, 1, 2, 4], time: "21:30", now: NOW });
  assert.deepStrictEqual(summary(s), { fromDay: 3, count: 27, offset: 0, restarted: false, weekdays: false });
  assert.strictEqual(s.dates.length, 27);
  assert.strictEqual(s.dates[0].getDate(), NOW.getDate());
  assert.strictEqual(s.dates[1].getDate(), NOW.getDate() + 1);
});

test("a numeric start day is used as given, clamped to the journey, ignoring progress", () => {
  const s = reminderSchedule({ dayCount: 30, completed: [0, 1, 2, 4], time: "21:30", now: NOW, from: 6 });
  assert.deepStrictEqual(summary(s), { fromDay: 6, count: 24, offset: 0, restarted: false, weekdays: false });
  assert.strictEqual(reminderSchedule({ dayCount: 4, completed: [], time: "21:30", now: NOW, from: 99 }).fromDay, 3);
  assert.strictEqual(reminderSchedule({ dayCount: 4, completed: [0, 1, 2, 3], time: "21:30", now: NOW, from: 0 }).restarted, false);
});

test("\"Day 1\" starts the journey over regardless of progress", () => {
  const s = reminderSchedule({ dayCount: 30, completed: [0, 1, 2, 4], time: "21:30", now: NOW, from: "start" });
  assert.deepStrictEqual(summary(s), { fromDay: 0, count: 30, offset: 0, restarted: false, weekdays: false });
});

// NOW is a Friday evening. With a time still ahead, the first reminder is
// today (Friday), then Monday; with a time already past it would be Saturday,
// so it moves to Monday.
test("weekdays only skips Saturday and Sunday, in the rule and in every date", () => {
  assert.strictEqual(NOW.getDay(), 5, "the fixture is a Friday");
  const s = reminderSchedule({ dayCount: 30, completed: [], time: "21:30", now: NOW, weekdays: true });
  assert.strictEqual(s.offset, 0);
  assert.strictEqual(s.dates[0].getDay(), 5);
  assert.strictEqual(s.dates[1].getDay(), 1);
  assert.strictEqual(s.dates.length, 30);
  for (const d of s.dates) assert.ok(d.getDay() >= 1 && d.getDay() <= 5, `${d} is a weekend`);
  // Friday plus 29 more weekdays: five full weeks and four days, so the
  // last reminder is 41 calendar days after the first.
  assert.strictEqual(Math.round((s.dates[29] - s.dates[0]) / 86400000), 41);
  const later = reminderSchedule({ dayCount: 4, completed: [], time: "07:00", now: NOW, weekdays: true });
  assert.strictEqual(later.offset, 3, "Saturday morning moves to Monday");
  assert.strictEqual(later.dates[0].getDay(), 1);
});

test("weekdays only writes a weekly Monday-to-Friday rule and every override is a weekday", () => {
  const { master, overrides } = parse(build({ schedule: reminderSchedule({ dayCount: 30, completed: [], time: "21:30", now: NOW, weekdays: true }) }));
  assert.strictEqual(master.RRULE, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=30");
  assert.strictEqual(overrides.length, 30);
  assert.strictEqual(overrides[1].DTSTART, "20260928T213000", "Monday follows Friday");
  overrides.forEach(ev => {
    const d = new Date(+ev.DTSTART.slice(0, 4), +ev.DTSTART.slice(4, 6) - 1, +ev.DTSTART.slice(6, 8), 12);
    assert.ok(d.getDay() >= 1 && d.getDay() <= 5, `${ev.DTSTART} is a weekend`);
    assert.strictEqual(ev["RECURRENCE-ID"], ev.DTSTART);
  });
});

test("an alarm lead fires the alarm before the time, on the master and every override", () => {
  assert.deepStrictEqual(REMINDER_LEADS, [0, 10, 30]);
  const none = parse(build());
  assert.strictEqual(none.master.alarm.TRIGGER, "PT0S");
  assert.ok(none.overrides.every(ev => ev.alarm.TRIGGER === "PT0S"));
  const ten = parse(build({ lead: 10 }));
  assert.strictEqual(ten.master.alarm.TRIGGER, "-PT10M");
  assert.ok(ten.overrides.every(ev => ev.alarm.TRIGGER === "-PT10M"));
  assert.strictEqual(ten.master.DTSTART, none.master.DTSTART, "the lead moves the alarm, not the event");
});

test("a chosen time already past starts tomorrow", () => {
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "07:00", now: NOW }).offset, 1);
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "19:00", now: NOW }).offset, 1);
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "19:01", now: NOW }).offset, 0);
});

test("a finished journey starts again from Day 1", () => {
  const s = reminderSchedule({ dayCount: 4, completed: [0, 1, 2, 3], time: "21:30", now: NOW });
  assert.deepStrictEqual(summary(s), { fromDay: 0, count: 4, offset: 0, restarted: true, weekdays: false });
});

test("only the last day left yields a single reminder", () => {
  const s = reminderSchedule({ dayCount: 4, completed: [0, 1, 2], time: "21:30", now: NOW });
  assert.strictEqual(s.fromDay, 3);
  assert.strictEqual(s.count, 1);
});

/* ---------- tips ---------- */

test("the first reminder in an export explains how it works", () => {
  assert.strictEqual(tipKeyFor({ position: 0, dayIndex: 6, total: 30, trackId: "core" }), "reminder.tipFirst");
});

test("the Night track's first reminder mentions the sleep timer", () => {
  assert.strictEqual(tipKeyFor({ position: 0, dayIndex: 0, total: 5, trackId: "night" }), "reminder.tipNight");
});

test("the last day of the journey hands off to the library, even when it is the only day", () => {
  assert.strictEqual(tipKeyFor({ position: 23, dayIndex: 29, total: 30, trackId: "core" }), "reminder.tipLast");
  assert.strictEqual(tipKeyFor({ position: 0, dayIndex: 3, total: 4, trackId: "furnace" }), "reminder.tipLast");
});

test("halfway is marked on long journeys only", () => {
  assert.strictEqual(tipKeyFor({ position: 5, dayIndex: 15, total: 30, trackId: "core" }), "reminder.tipHalfway");
  assert.notStrictEqual(tipKeyFor({ position: 1, dayIndex: 2, total: 4, trackId: "furnace" }), "reminder.tipHalfway");
});

test("other days rotate by day so a re-export keeps each day's tip", () => {
  const a = tipKeyFor({ position: 1, dayIndex: 8, total: 30, trackId: "core" });
  const b = tipKeyFor({ position: 4, dayIndex: 8, total: 30, trackId: "core" });
  assert.strictEqual(a, b);
  assert.ok(REMINDER_TIPS.includes(a));
  const seen = new Set();
  for (let d = 7; d < 13; d++) seen.add(tipKeyFor({ position: d, dayIndex: d, total: 30, trackId: "core" }));
  assert.strictEqual(seen.size, REMINDER_TIPS.length, "six consecutive ordinary days use six different tips");
});

test("every tip key exists in both languages", () => {
  for (const key of [...REMINDER_TIPS, "reminder.tipFirst", "reminder.tipNight", "reminder.tipHalfway", "reminder.tipLast"]) {
    assert.ok(appUi.en[key], `en missing ${key}`);
    assert.ok(appUi.es[key], `es missing ${key}`);
  }
});

test("weekLabel picks the core week and a short journey's banner", () => {
  assert.strictEqual(weekLabel(tracks.core.weeks, 6), tracks.core.weeks[0]);
  assert.strictEqual(weekLabel(tracks.core.weeks, 7), tracks.core.weeks[1]);
  assert.strictEqual(weekLabel(tracks.core.weeks, 29), tracks.core.weeks[4]);
  assert.strictEqual(weekLabel(tracks.furnace.weeks, 3), tracks.furnace.weeks[0]);
  assert.strictEqual(weekLabel([], 0), "");
});

/* ---------- the file ---------- */

test("the master keeps the legacy UID, the generic summary and a COUNT of the remaining days", () => {
  const { master } = parse(build({ completed: [0, 1, 2, 3, 4, 5] }));
  assert.strictEqual(master.UID, REMINDER_UID);
  assert.strictEqual(master.SEQUENCE, "3");
  assert.strictEqual(master.RRULE, "FREQ=DAILY;COUNT=24");
  assert.strictEqual(master.SUMMARY, "Stand — daily prayer");
  assert.strictEqual(master.DTSTART, "20260925T213000");
  assert.strictEqual(master.TRANSP, "TRANSPARENT");
  assert.ok(master.DESCRIPTION.includes(`${ORIGIN}/app`));
  assert.strictEqual(master.URL, `${ORIGIN}/app`);
  assert.strictEqual(master.alarm.DESCRIPTION, "Time to stand");
});

test("one override per remaining day, each naming its own occurrence", () => {
  const { master, overrides } = parse(build({ completed: [0, 1, 2, 3, 4, 5] }));
  assert.strictEqual(overrides.length, 24);
  overrides.forEach((ev, k) => {
    assert.strictEqual(ev.UID, REMINDER_UID);
    assert.strictEqual(ev.SEQUENCE, master.SEQUENCE);
    assert.strictEqual(ev["RECURRENCE-ID"], ev.DTSTART, `override ${k} names a different occurrence`);
    assert.ok(ev.DTSTART.endsWith("T213000"), `override ${k} is not at the chosen time`);
    assert.strictEqual(ev.DURATION, "PT10M");
    assert.strictEqual(ev.TRANSP, "TRANSPARENT");
  });
  // Consecutive calendar days, starting on the master's DTSTART.
  assert.strictEqual(overrides[0].DTSTART, master.DTSTART);
  assert.strictEqual(overrides[1].DTSTART, "20260926T213000");
  assert.strictEqual(overrides[5].DTSTART, "20260930T213000");
  assert.strictEqual(overrides[6].DTSTART, "20261001T213000");
});

test("a core day carries its title, week, scripture, practice, declaration, tip and links", () => {
  const { overrides } = parse(build({ completed: [0, 1, 2, 3, 4, 5] }));
  const day7 = overrides[0];
  const d = day7.DESCRIPTION.split("\\n");
  assert.strictEqual(day7.SUMMARY, "Stand · Day 7 · The Word");
  assert.strictEqual(d[0], "Day 7 of 30 · The Word");
  assert.strictEqual(d[1], "WEEK ONE · ESTABLISH THE GROUND");
  assert.strictEqual(d[2], "Ephesians 6:17 — “The sword of the Spirit\\, which is the word of God.”");
  assert.strictEqual(d[4], "Today’s practice: Choose one short verse and return to it three times today.");
  assert.strictEqual(d[6], "Declare: Truth will remain after today's noise disappears.");
  assert.ok(d[8].startsWith("Tip: Set aside ten minutes."));
  assert.strictEqual(d[10], `Open Day 7 in the app: ${ORIGIN}/app#7`);
  assert.strictEqual(d[11], `Read it on the web: ${ORIGIN}/day/07-the-word#practice`);
  assert.strictEqual(day7.URL, `${ORIGIN}/app#7`);
  assert.strictEqual(day7.alarm.DESCRIPTION, "Time to stand — Day 7: The Word");
});

test("a courage-story day names its journey and links with ?track=", () => {
  const { master, overrides } = parse(build({ trackId: "furnace" }));
  assert.strictEqual(master.RRULE, "FREQ=DAILY;COUNT=4");
  assert.strictEqual(overrides[0].SUMMARY, "Stand · The Furnace · Day 1 · The Decree");
  assert.strictEqual(overrides[0].URL, `${ORIGIN}/app?track=furnace#1`);
  assert.ok(overrides[0].DESCRIPTION.includes(`Read it on the web: ${ORIGIN}/track/furnace/01-the-decree#practice`));
  assert.ok(overrides[0].DESCRIPTION.includes("COURAGE STORY · THE FURNACE"));
  assert.ok(overrides[3].DESCRIPTION.includes("Tip: This is the last day of this journey."));
});

test("a Spanish export is Spanish throughout and links to the Spanish pages", () => {
  const { master, overrides } = parse(build({ trackId: "furnace", lang: "es" }));
  assert.strictEqual(master.SUMMARY, "Stand — oración diaria");
  assert.strictEqual(master.alarm.DESCRIPTION, "Hora de estar firme");
  assert.strictEqual(overrides[0].SUMMARY, "Stand · El horno · Día 1 · El decreto");
  assert.ok(overrides[0].DESCRIPTION.startsWith("Día 1 de 4 · El decreto"));
  assert.ok(overrides[0].DESCRIPTION.includes("Práctica de hoy:"));
  assert.ok(overrides[0].DESCRIPTION.includes(`Léelo en la web: ${ORIGIN}/es/track/furnace/01-el-decreto#practice`));
  assert.strictEqual(overrides[0].alarm.DESCRIPTION, "Hora de estar firme — Día 1: El decreto");
});

test("a finished journey exports the whole journey again", () => {
  const { master, overrides } = parse(build({ trackId: "unknown", completed: [0, 1, 2, 3, 4] }));
  assert.strictEqual(master.RRULE, "FREQ=DAILY;COUNT=5");
  assert.strictEqual(overrides.length, 5);
  assert.strictEqual(overrides[0].SUMMARY, "Stand · Fear of the Unknown · Day 1 · The Unwritten Page");
});

test("a chosen time already past puts the first reminder on tomorrow", () => {
  const { master } = parse(build({ time: "07:00" }));
  assert.strictEqual(master.DTSTART, "20260926T070000");
});

test("times are floating: no Z and no TZID anywhere", () => {
  const ics = build();
  assert.ok(!/(DTSTART|RECURRENCE-ID|DTSTAMP)[^\r\n]*Z\r\n/.test(ics));
  assert.ok(!/TZID/.test(ics));
});

test("the file is CRLF-terminated, folded at 75 octets and unfolds cleanly", () => {
  const ics = build();
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "a bare LF");
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `over-long line: ${line}`);
  }
  // Every unfolded line is NAME:VALUE with an upper-case property name.
  for (const line of parse(ics).lines) assert.ok(/^[A-Z-]+[:;]/.test(line), `not a property: ${line}`);
});

test("every day of every journey in both languages builds a valid file", () => {
  for (const [lang, set] of [["en", tracks], ["es", esTracks]]) {
    for (const [id, track] of Object.entries(set)) {
      const ics = build({ trackId: id, lang });
      const { overrides } = parse(ics);
      assert.strictEqual(overrides.length, track.days.length, `${lang}/${id}: override count`);
      for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `${lang}/${id}: over-long line`);
      overrides.forEach((ev, i) => {
        // TEXT values must not carry an unescaped comma or semicolon, and the
        // description must end with the two links.
        for (const key of ["SUMMARY", "DESCRIPTION"]) {
          assert.ok(!/(^|[^\\])[,;]/.test(ev[key]), `${lang}/${id} day ${i + 1}: unescaped separator in ${key}`);
        }
        assert.ok(ev.DESCRIPTION.includes(track.days[i][6].replace(/([;,])/g, "\\$1")), `${lang}/${id} day ${i + 1}: practice missing`);
        assert.ok(ev.DESCRIPTION.endsWith(`${ORIGIN}${dayPagePath(id, track, i, lang)}#practice`), `${lang}/${id} day ${i + 1}: page link`);
        assert.strictEqual(ev.URL, appDayLink(ORIGIN, id, i));
      });
    }
  }
});

test("the page link lands on the practice section, which every generated page carries", () => {
  const { pageUrl } = reminderEntry({ track: tracks.core, trackId: "core", lang: "en", origin: ORIGIN, t: tFor("en"), dayIndex: 6, position: 0 });
  assert.strictEqual(pageUrl, `${ORIGIN}/day/07-the-word#practice`);
  for (const [lang, set] of [["en", tracks], ["es", esTracks]]) {
    for (const [id, track] of Object.entries(set)) {
      for (let i = 0; i < track.days.length; i++) {
        const html = fs.readFileSync(path.join(ROOT, dayPagePath(id, track, i, lang) + ".html"), "utf8");
        assert.ok(html.includes(' id="practice"'), `${lang}/${id} day ${i + 1} has no #practice anchor`);
      }
    }
  }
});

test("the preview entry is exactly what the file carries", () => {
  const { overrides } = parse(build({ completed: [0, 1, 2, 3, 4, 5] }));
  const entry = reminderEntry({ track: tracks.core, trackId: "core", lang: "en", origin: ORIGIN, t: tFor("en"), dayIndex: 6, position: 0 });
  assert.strictEqual(overrides[0].SUMMARY, icsText(entry.summary));
  assert.strictEqual(overrides[0].DESCRIPTION, icsText(entry.description));
  assert.strictEqual(overrides[0].URL, entry.url);
  assert.strictEqual(overrides[0].alarm.DESCRIPTION, icsText(entry.alarm));
});

test("the calendar is published under its own name", () => {
  const ics = build();
  assert.ok(ics.includes("\r\nMETHOD:PUBLISH\r\n"));
  assert.ok(ics.includes("\r\nX-WR-CALNAME:Stand\r\n"));
  assert.ok(ics.indexOf("METHOD:PUBLISH") < ics.indexOf("BEGIN:VEVENT"), "calendar properties come before the components");
});

test("the health and financial journeys repeat their guardrail on the second reminder", () => {
  assert.strictEqual(tipKeyFor({ position: 1, dayIndex: 1, total: 4, trackId: "turning" }), "reminder.tipHealth");
  assert.strictEqual(tipKeyFor({ position: 1, dayIndex: 1, total: 4, trackId: "hem" }), "reminder.tipHealth");
  assert.strictEqual(tipKeyFor({ position: 1, dayIndex: 1, total: 4, trackId: "zarephath" }), "reminder.tipMoney");
  assert.notStrictEqual(tipKeyFor({ position: 1, dayIndex: 1, total: 4, trackId: "furnace" }), "reminder.tipHealth");
  // The last day still hands off to the library, even on those journeys.
  assert.strictEqual(tipKeyFor({ position: 1, dayIndex: 3, total: 4, trackId: "hem" }), "reminder.tipLast");
  for (const key of new Set(Object.values(GUARDRAIL_TIPS))) {
    assert.ok(appUi.en[key] && appUi.es[key], `${key} missing from a language`);
  }
  const { overrides } = parse(build({ trackId: "zarephath" }));
  assert.ok(overrides[1].DESCRIPTION.includes("not a technique for producing money"));
});

/* ---------- the evening check-in ---------- */

test("without the option there is no evening series and no cancellation", () => {
  const { evening } = parse(build());
  assert.strictEqual(evening.master, undefined);
});

test("the evening check-in is its own series on the same days, at its own time", () => {
  const plan = reminderSchedule({ dayCount: 30, completed: [0, 1, 2, 3, 4, 5], time: "07:00", now: NOW, weekdays: true });
  const { master, overrides, evening } = parse(build({ time: "07:00", evening: "21:00", lead: 10, schedule: plan }));
  assert.strictEqual(evening.master.UID, EVENING_UID);
  assert.notStrictEqual(evening.master.UID, master.UID);
  assert.strictEqual(evening.master.RRULE, master.RRULE, "same cadence and count");
  assert.strictEqual(evening.master.SEQUENCE, master.SEQUENCE);
  assert.strictEqual(evening.master.DURATION, "PT5M");
  assert.strictEqual(evening.master.alarm.TRIGGER, "-PT10M", "the lead applies to both series");
  assert.strictEqual(evening.overrides.length, overrides.length);
  evening.overrides.forEach((ev, k) => {
    assert.strictEqual(ev.DTSTART.slice(0, 8), overrides[k].DTSTART.slice(0, 8), `evening ${k} is on a different day`);
    assert.ok(ev.DTSTART.endsWith("T210000"), `evening ${k} at ${ev.DTSTART}`);
    assert.strictEqual(ev["RECURRENCE-ID"], ev.DTSTART);
  });
  const first = evening.overrides[0];
  assert.strictEqual(first.SUMMARY, "Stand · Day 7 · How did it go?");
  assert.ok(first.DESCRIPTION.startsWith("Day 7 of 30 · The Word\\n\\nThis morning’s practice: Choose one short verse"));
  assert.ok(first.DESCRIPTION.includes("How did it go? Open the day\\, mark it complete\\, and note where your fear is now."));
  assert.strictEqual(first.URL, `${ORIGIN}/app?checkin=1#7`);
  assert.strictEqual(first.alarm.DESCRIPTION, "How did Day 7 go? — The Word");
});

test("the evening link keeps the journey query on other tracks", () => {
  const e = eveningEntry({ track: tracks.furnace, trackId: "furnace", lang: "en", origin: ORIGIN, t: tFor("en"), dayIndex: 1 });
  assert.strictEqual(e.url, `${ORIGIN}/app?checkin=1&track=furnace#2`);
});

test("turning the evening check-in off cancels the series once, with a higher sequence and no overrides", () => {
  const { evening, master } = parse(build({ seq: 4, cancelEvening: true }));
  assert.strictEqual(evening.master.UID, EVENING_UID);
  assert.strictEqual(evening.master.STATUS, "CANCELLED");
  assert.strictEqual(evening.master.SEQUENCE, "4");
  assert.strictEqual(evening.overrides.length, 0);
  assert.strictEqual(master.RRULE, "FREQ=DAILY;COUNT=30", "the morning series is untouched");
});

test("the evening series is Spanish when the export is", () => {
  const { evening } = parse(build({ trackId: "furnace", lang: "es", evening: "21:30" }));
  assert.strictEqual(evening.master.SUMMARY, "Stand — revisión de la noche");
  assert.strictEqual(evening.overrides[0].SUMMARY, "Stand · Día 1 · ¿Cómo fue?");
  assert.ok(evening.overrides[0].DESCRIPTION.includes("La práctica de esta mañana:"));
});

test("every line of a file with an evening series still folds and escapes cleanly", () => {
  for (const [lang, set] of [["en", tracks], ["es", esTracks]]) {
    for (const [id, track] of Object.entries(set)) {
      const ics = build({ trackId: id, lang, evening: "21:00" });
      for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `${lang}/${id}: over-long line`);
      const { evening } = parse(ics);
      assert.strictEqual(evening.overrides.length, track.days.length);
      for (const ev of evening.overrides) for (const key of ["SUMMARY", "DESCRIPTION"]) {
        assert.ok(!/(^|[^\\])[,;]/.test(ev[key]), `${lang}/${id}: unescaped separator in evening ${key}`);
      }
    }
  }
});

/* ---------- daylight saving ---------- */

// Every calendar day across a DST change must still print the chosen HH:MM,
// and the date must advance by exactly one day each time. The floating time
// is what makes this true; a Date built at the chosen hour would be
// normalised forward on the day the hour is deleted.
if (process.env.STAND_DST_ZONE) {
  const zone = process.env.STAND_DST_ZONE;
  const [y, m, d] = process.env.STAND_DST_START.split("-").map(Number);
  const now = new Date(y, m - 1, d, 1, 0, 0);
  const { overrides } = parse(build({ time: "02:30", now }));
  overrides.forEach((ev, k) => {
    assert.ok(ev.DTSTART.endsWith("T023000"), `${zone}: override ${k} at ${ev.DTSTART}`);
    if (k) {
      const prev = overrides[k - 1].DTSTART.slice(0, 8), cur = ev.DTSTART.slice(0, 8);
      const days = (Date.UTC(+cur.slice(0, 4), +cur.slice(4, 6) - 1, +cur.slice(6, 8))
        - Date.UTC(+prev.slice(0, 4), +prev.slice(4, 6) - 1, +prev.slice(6, 8))) / 86400000;
      assert.strictEqual(days, 1, `${zone}: override ${k} is not the next day`);
    }
  });
  const weekdayPlan = reminderSchedule({ dayCount: 30, completed: [], time: "02:30", now, weekdays: true });
  const weekdayOnly = parse(build({ time: "02:30", now, schedule: weekdayPlan })).overrides;
  weekdayOnly.forEach((ev, k) => {
    assert.ok(ev.DTSTART.endsWith("T023000"), `${zone} weekdays: override ${k} at ${ev.DTSTART}`);
    const d = new Date(+ev.DTSTART.slice(0, 4), +ev.DTSTART.slice(4, 6) - 1, +ev.DTSTART.slice(6, 8), 12);
    assert.ok(d.getDay() >= 1 && d.getDay() <= 5, `${zone} weekdays: ${ev.DTSTART} is a weekend`);
  });
  console.log(`PASS floating times hold across DST in ${zone}`);
} else {
  for (const [zone, start] of [["America/New_York", "2026-03-06"], ["Europe/Madrid", "2026-03-27"], ["America/Santiago", "2026-09-04"], ["Australia/Sydney", "2026-10-02"], ["Asia/Kolkata", "2026-03-06"]]) {
    test(`floating times hold across DST in ${zone}`, () => {
      execFileSync(process.execPath, [__filename], { env: { ...process.env, TZ: zone, STAND_DST_ZONE: zone, STAND_DST_START: start }, stdio: "pipe" });
    });
  }
}

if (!process.env.STAND_DST_ZONE) {
  if (failures) {
    console.log(`\n${failures} failing`);
    process.exit(1);
  }
  console.log("\nAll reminder tests passed.");
}
