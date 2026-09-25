// Unit tests for the pure logic in logic.js — streak arithmetic, backup
// sanitizing, and calm-ledger aggregation. No browser, no network.
//
//   npm run test:unit
//
// Most date tests are written relative to an injected "now" using local date
// arithmetic, so they hold in whatever zone the machine runs in. The
// daylight-saving cases need specific zones, so they run in child processes
// with TZ set rather than relying on changing process.env.TZ mid-run.

const assert = require("assert");
const path = require("path");
const { execFileSync } = require("child_process");
const { tracks, themes } = require("../content.js");
const { localISO, completedDatesOf, streakFrom, ledgerStats, sanitizeTrackData, sanitizeBackup } = require("../logic.js");

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

/* ---------- streaks ---------- */

const NOW = new Date(2026, 8, 21, 9, 15); // 21 Sep 2026, local
/** The local date n days before `now`. */
const back = (now, n) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  d.setDate(d.getDate() - n);
  return localISO(d);
};
/** A run of n consecutive local dates ending `offset` days before `now`. */
const run = (now, n, offset = 0) =>
  new Set(Array.from({ length: n }, (_, i) => back(now, i + offset)));

test("no completed days is no streak", () => {
  assert.strictEqual(streakFrom(new Set(), NOW), 0);
});

test("finishing today is a streak of one", () => {
  assert.strictEqual(streakFrom(run(NOW, 1), NOW), 1);
});

test("consecutive days accumulate", () => {
  assert.strictEqual(streakFrom(run(NOW, 5), NOW), 5);
});

test("a streak survives until a full day is missed", () => {
  // finished yesterday, not yet today
  assert.strictEqual(streakFrom(run(NOW, 3, 1), NOW), 3);
});

test("missing both today and yesterday ends the streak", () => {
  assert.strictEqual(streakFrom(run(NOW, 3, 2), NOW), 0);
});

test("a gap is not counted through", () => {
  const days = new Set([back(NOW, 0), back(NOW, 2), back(NOW, 3)]);
  assert.strictEqual(streakFrom(days, NOW), 1);
});

test("streaks cross a month boundary", () => {
  const now = new Date(2026, 9, 2, 8, 0); // 2 Oct
  assert.strictEqual(streakFrom(run(now, 4), now), 4); // back into September
});

test("streaks cross a year boundary", () => {
  const now = new Date(2027, 0, 2, 8, 0); // 2 Jan
  const days = run(now, 4);
  assert.ok(days.has("2026-12-31"), "run should reach into the previous year");
  assert.strictEqual(streakFrom(days, now), 4);
});

test("an array of dates works as well as a Set", () => {
  assert.strictEqual(streakFrom([...run(NOW, 2)], NOW), 2);
});

test("future dates do not extend the streak", () => {
  const days = run(NOW, 2);
  days.add(back(NOW, -1)); // tomorrow
  assert.strictEqual(streakFrom(days, NOW), 2);
});

test("completedDatesOf merges every journey", () => {
  const state = {
    completedDates: { 0: "2026-09-21" },
    tracks: {
      den: { completedDates: { 0: "2026-09-20" } },
      storm: { completedDates: { 0: "2026-09-21", 1: "2026-09-19" } }
    }
  };
  assert.deepStrictEqual([...completedDatesOf(state)].sort(), ["2026-09-19", "2026-09-20", "2026-09-21"]);
});

test("completedDatesOf tolerates missing fields", () => {
  assert.strictEqual(completedDatesOf({}).size, 0);
  assert.strictEqual(completedDatesOf({ tracks: { den: {} } }).size, 0);
});

test("a day completed on any journey keeps the one streak alive", () => {
  const state = {
    completedDates: { 0: back(NOW, 0) },
    tracks: { den: { completedDates: { 0: back(NOW, 1) } } }
  };
  assert.strictEqual(streakFrom(completedDatesOf(state), NOW), 2);
});

/* ---------- streaks across daylight saving, in real zones ---------- */

// Each case: zone, a date just after a DST transition, and the run length.
// Run in a child process so the zone is set before any Date work happens.
const DST_CASES = [
  ["America/New_York", "2026-03-09", 5, "spring forward at 02:00"],
  ["America/New_York", "2026-11-02", 5, "fall back at 02:00"],
  ["America/Santiago", "2026-09-07", 5, "DST jump deletes local midnight"],
  ["Australia/Lord_Howe", "2026-10-05", 5, "30-minute shift"],
  ["Pacific/Auckland", "2026-09-28", 5, "southern-hemisphere spring forward"]
];

for (const [tz, date, length, why] of DST_CASES) {
  for (const hour of [0, 12, 23]) {
    test(`streak counts through DST — ${tz}, ${why}, ${hour}:30`, () => {
      const script = `
        const { localISO, streakFrom } = require(${JSON.stringify(path.join(__dirname, "..", "logic.js"))});
        const [y, m, d] = ${JSON.stringify(date)}.split("-").map(Number);
        const now = new Date(y, m - 1, d, ${hour}, 30);
        const days = new Set();
        const c = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
        for (let i = 0; i < ${length}; i++) { days.add(localISO(c)); c.setDate(c.getDate() - 1); }
        process.stdout.write(String(streakFrom(days, now)));
      `;
      const out = execFileSync(process.execPath, ["-e", script], {
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
        timeout: 20000
      });
      assert.strictEqual(out, String(length), `expected ${length} consecutive days, got ${out}`);
    });
  }
}

/* ---------- calm ledger ---------- */

const NOW_MS = Date.parse("2026-09-21T12:00:00Z");
const daysAgo = n => new Date(NOW_MS - n * 86400000).toISOString();

test("an empty ledger averages nothing", () => {
  const stats = ledgerStats([], [], NOW_MS);
  assert.strictEqual(stats.avgDrop, null);
  assert.strictEqual(stats.avgWeek, null);
});

test("ledger tolerates missing arrays", () => {
  const stats = ledgerStats(undefined, undefined, NOW_MS);
  assert.strictEqual(stats.avgDrop, null);
  assert.strictEqual(stats.avgWeek, null);
});

test("average drop is the mean of before minus after", () => {
  const sos = [
    { t: daysAgo(1), before: 5, after: 2 },  // 3
    { t: daysAgo(2), before: 4, after: 3 }   // 1
  ];
  assert.strictEqual(ledgerStats(sos, [], NOW_MS).avgDrop, 2);
});

test("unfinished SOS sessions are left out of the average", () => {
  const sos = [
    { t: daysAgo(1), before: 5, after: 1 },  // 4
    { t: daysAgo(1), before: 5, after: null },
    { t: daysAgo(1), before: null, after: 2 }
  ];
  const stats = ledgerStats(sos, [], NOW_MS);
  assert.strictEqual(stats.sessions.length, 1);
  assert.strictEqual(stats.avgDrop, 4);
});

test("a drop of zero still reports, rather than reading as no data", () => {
  const stats = ledgerStats([{ t: daysAgo(1), before: 3, after: 3 }], [], NOW_MS);
  assert.strictEqual(stats.avgDrop, 0);
  assert.notStrictEqual(stats.avgDrop, null);
});

test("the weekly average covers only the last seven days", () => {
  const checkins = [
    { t: daysAgo(1), v: 2 },
    { t: daysAgo(6), v: 4 },
    { t: daysAgo(8), v: 5 }   // outside the window
  ];
  const stats = ledgerStats([], checkins, NOW_MS);
  assert.strictEqual(stats.week.length, 2);
  assert.strictEqual(stats.avgWeek, 3);
});

test("a check-in exactly seven days old is still inside the window", () => {
  const stats = ledgerStats([], [{ t: daysAgo(7), v: 4 }], NOW_MS);
  assert.strictEqual(stats.week.length, 1);
});

/* ---------- backup sanitizing ---------- */

const DEPS = { coreDays: themes.length, tracks, langs: ["en", "es"] };
const validBackup = extra => ({ completed: [], favorites: [], notes: {}, ...extra });

test("rubbish is not a backup", () => {
  for (const bad of [null, undefined, 42, "text", [], {}]) {
    assert.strictEqual(sanitizeBackup(bad, DEPS), null, `${JSON.stringify(bad)} should be rejected`);
  }
});

test("a file missing the identifying fields is rejected", () => {
  assert.strictEqual(sanitizeBackup({ completed: [], favorites: [] }, DEPS), null);
  assert.strictEqual(sanitizeBackup({ completed: [], notes: {} }, DEPS), null);
});

test("a minimal backup restores", () => {
  const clean = sanitizeBackup(validBackup(), DEPS);
  assert.ok(clean);
  assert.deepStrictEqual(clean.completed, []);
  assert.strictEqual(clean.track, "core");
  assert.strictEqual(clean.welcomed, true);
});

test("days outside the journey are dropped", () => {
  const clean = sanitizeBackup(validBackup({
    completed: [0, 29, 30, -1, 1.5, "2", null],
    favorites: [5, 999]
  }), DEPS);
  assert.deepStrictEqual(clean.completed, [0, 29]);
  assert.deepStrictEqual(clean.favorites, [5]);
});

test("notes survive only for real days and real text", () => {
  const clean = sanitizeBackup(validBackup({ notes: { 0: "kept", 99: "dropped", 1: 42 } }), DEPS);
  assert.deepStrictEqual(clean.notes, { 0: "kept" });
});

test("a journey this build does not have is dropped", () => {
  const clean = sanitizeBackup(validBackup({
    tracks: { den: { completed: [0] }, "not-a-track": { completed: [0] }, core: { completed: [0] } }
  }), DEPS);
  assert.deepStrictEqual(Object.keys(clean.tracks), ["den"]);
});

test("track days are validated against that track's own length", () => {
  const clean = sanitizeBackup(validBackup({ tracks: { den: { completed: [0, 3, 4, 27] } } }), DEPS);
  assert.deepStrictEqual(clean.tracks.den.completed, [0, 3], "The Den has four days, so 4 and 27 are out of range");
});

test("check-ins are dropped unless the level and day are real", () => {
  const clean = sanitizeBackup(validBackup({
    checkins: [
      { t: "2026-09-21T10:00:00Z", track: "core", day: 0, v: 3 },
      { t: "2026-09-21T10:00:00Z", track: "core", day: 0, v: 6 },
      { t: "2026-09-21T10:00:00Z", track: "core", day: 99, v: 3 },
      { t: "2026-09-21T10:00:00Z", track: "ghost", day: 0, v: 3 },
      { t: 12345, track: "core", day: 0, v: 3 },
      null
    ]
  }), DEPS);
  assert.strictEqual(clean.checkins.length, 1);
  assert.strictEqual(clean.checkins[0].v, 3);
});

test("an SOS session keeps a missing before or after as null", () => {
  const clean = sanitizeBackup(validBackup({
    sos: [
      { t: "2026-09-21T10:00:00Z", before: 5, after: 2 },
      { t: "2026-09-21T10:00:00Z", before: 4 },
      { t: "2026-09-21T10:00:00Z", before: 9, after: 1 },
      { before: 3, after: 1 }
    ]
  }), DEPS);
  assert.strictEqual(clean.sos.length, 2);
  assert.strictEqual(clean.sos[1].after, null);
});

test("theme, language and the side-by-side flag are validated", () => {
  const clean = sanitizeBackup(validBackup({ theme: "chartreuse", lang: "fr", bilingual: "yes" }), DEPS);
  assert.strictEqual(clean.theme, null);
  assert.strictEqual(clean.lang, "en");
  assert.strictEqual(clean.bilingual, false);

  const good = sanitizeBackup(validBackup({ theme: "dark", lang: "es", bilingual: true }), DEPS);
  assert.strictEqual(good.theme, "dark");
  assert.strictEqual(good.lang, "es");
  assert.strictEqual(good.bilingual, true);
});

test("restoring a backup does not replay the welcome screen", () => {
  assert.strictEqual(sanitizeBackup(validBackup({ welcomed: false }), DEPS).welcomed, true);
});

test("sanitizeTrackData returns empty structure for rubbish", () => {
  assert.deepStrictEqual(sanitizeTrackData(null, 5), { completed: [], favorites: [], notes: {}, completedDates: {} });
  assert.deepStrictEqual(sanitizeTrackData("nope", 5).completed, []);
});

test("a restored backup is shaped like live state", () => {
  const clean = sanitizeBackup(validBackup({ completed: [0], completedDates: { 0: "2026-09-21" } }), DEPS);
  for (const key of ["completed", "favorites", "notes", "completedDates", "checkins", "sos", "track", "tracks", "theme", "lang", "bilingual", "welcomed", "installHintDismissed", "reminderTime", "reminderSeq", "reminderFrom", "reminderWeekdays", "reminderLead", "reminderEvening", "reminderEveningExported"]) {
    assert.ok(key in clean, `restored state is missing ${key}`);
  }
  // and it feeds the streak maths without further massaging
  assert.strictEqual(completedDatesOf(clean).size, 1);
});

test("a restored backup keeps a valid reminder time", () => {
  const clean = sanitizeBackup(validBackup({ reminderTime: "21:30", reminderSeq: 4 }), DEPS);
  assert.strictEqual(clean.reminderTime, "21:30");
  assert.strictEqual(clean.reminderSeq, 4);
});

test("a restored backup drops a reminder time that is not HH:MM", () => {
  for (const bad of ["7am", "25:00", "07:60", "7:00", "", "07:00:00", null, 700, {}]) {
    assert.strictEqual(sanitizeBackup(validBackup({ reminderTime: bad }), DEPS).reminderTime, null, `accepted ${JSON.stringify(bad)}`);
  }
});

test("a restored backup accepts the edges of the clock", () => {
  for (const good of ["00:00", "23:59", "09:05"]) {
    assert.strictEqual(sanitizeBackup(validBackup({ reminderTime: good }), DEPS).reminderTime, good);
  }
});

// The sequence is what makes a re-exported .ics out-rank the one already in
// the calendar, so a nonsense value must floor at 0 rather than propagate.
test("a restored backup keeps the reminder options and defaults anything malformed", () => {
  const kept = sanitizeBackup(validBackup({ reminderFrom: "start", reminderWeekdays: true, reminderLead: 30 }), DEPS);
  assert.strictEqual(kept.reminderFrom, "start");
  assert.strictEqual(kept.reminderWeekdays, true);
  assert.strictEqual(kept.reminderLead, 30);
  const bad = sanitizeBackup(validBackup({ reminderFrom: "yesterday", reminderWeekdays: "yes", reminderLead: 15 }), DEPS);
  assert.strictEqual(bad.reminderFrom, "current");
  assert.strictEqual(bad.reminderWeekdays, false);
  assert.strictEqual(bad.reminderLead, 0);
  const missing = sanitizeBackup(validBackup({}), DEPS);
  assert.strictEqual(missing.reminderFrom, "current");
  assert.strictEqual(missing.reminderWeekdays, false);
  assert.strictEqual(missing.reminderLead, 0);
});

test("a restored backup keeps the evening check-in time and the exported flag, or drops them", () => {
  const kept = sanitizeBackup(validBackup({ reminderEvening: "21:30", reminderEveningExported: true }), DEPS);
  assert.strictEqual(kept.reminderEvening, "21:30");
  assert.strictEqual(kept.reminderEveningExported, true);
  for (const bad of ["9pm", "25:00", 2130, null, undefined]) {
    assert.strictEqual(sanitizeBackup(validBackup({ reminderEvening: bad }), DEPS).reminderEvening, null, `accepted ${String(bad)}`);
  }
  assert.strictEqual(sanitizeBackup(validBackup({ reminderEveningExported: "yes" }), DEPS).reminderEveningExported, false);
});

test("a restored backup floors a bad reminder sequence at zero", () => {
  for (const bad of [-3, 1.5, "4", null, undefined, NaN]) {
    assert.strictEqual(sanitizeBackup(validBackup({ reminderSeq: bad }), DEPS).reminderSeq, 0, `accepted ${String(bad)}`);
  }
});

if (failures) {
  console.log(`\n${failures} unit test(s) failed`);
  process.exit(1);
}
console.log("\nall unit tests passed");
