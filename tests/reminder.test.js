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
  REMINDER_UID, REMINDER_TIPS, icsText, icsFold, dayPagePath, appDayLink,
  reminderSchedule, tipKeyFor, weekLabel, buildReminderIcs
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
  return { lines, master: events[0], overrides: events.slice(1), events };
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

test("the schedule starts at the first incomplete day", () => {
  const s = reminderSchedule({ dayCount: 30, completed: [0, 1, 2, 4], time: "21:30", now: NOW });
  assert.deepStrictEqual(s, { fromDay: 3, count: 27, offset: 0, restarted: false });
});

test("a chosen time already past starts tomorrow", () => {
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "07:00", now: NOW }).offset, 1);
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "19:00", now: NOW }).offset, 1);
  assert.strictEqual(reminderSchedule({ dayCount: 30, completed: [], time: "19:01", now: NOW }).offset, 0);
});

test("a finished journey starts again from Day 1", () => {
  const s = reminderSchedule({ dayCount: 4, completed: [0, 1, 2, 3], time: "21:30", now: NOW });
  assert.deepStrictEqual(s, { fromDay: 0, count: 4, offset: 0, restarted: true });
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
  assert.strictEqual(d[11], `Read it on the web: ${ORIGIN}/day/07-the-word`);
  assert.strictEqual(day7.URL, `${ORIGIN}/app#7`);
  assert.strictEqual(day7.alarm.DESCRIPTION, "Time to stand — Day 7: The Word");
});

test("a courage-story day names its journey and links with ?track=", () => {
  const { master, overrides } = parse(build({ trackId: "furnace" }));
  assert.strictEqual(master.RRULE, "FREQ=DAILY;COUNT=4");
  assert.strictEqual(overrides[0].SUMMARY, "Stand · The Furnace · Day 1 · The Decree");
  assert.strictEqual(overrides[0].URL, `${ORIGIN}/app?track=furnace#1`);
  assert.ok(overrides[0].DESCRIPTION.includes(`Read it on the web: ${ORIGIN}/track/furnace/01-the-decree`));
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
  assert.ok(overrides[0].DESCRIPTION.includes(`Léelo en la web: ${ORIGIN}/es/track/furnace/01-el-decreto`));
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
        assert.ok(ev.DESCRIPTION.endsWith(`${ORIGIN}${dayPagePath(id, track, i, lang)}`), `${lang}/${id} day ${i + 1}: page link`);
        assert.strictEqual(ev.URL, appDayLink(ORIGIN, id, i));
      });
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
