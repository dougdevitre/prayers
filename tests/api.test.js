// Tests for the calendar feed in api/calendar.js: the query is validated,
// the body is the same file the app builds, and the handler speaks plain
// Node (req, res) so the smoke server can route to it the way Vercel does.
//
//   npm run test:unit

const assert = require("assert");
const http = require("http");
const { tracks } = require("../content.js");
const handler = require("../api/calendar.js");
const { parseQuery, feedFor } = handler;

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const unfold = s => s.replace(/\r\n /g, "");
const request = (server, path, method = "GET") => new Promise((resolve, reject) => {
  const port = server.address().port;
  const req = http.request({ host: "localhost", port, path, method }, res => {
    let body = "";
    res.on("data", c => body += c);
    res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on("error", reject);
  req.end();
});

(async () => {
  await test("a valid query parses to its parts, with defaults for what is omitted", () => {
    const p = parseQuery("?start=2026-09-26");
    assert.strictEqual(p.trackId, "core");
    assert.strictEqual(p.from, 1);
    assert.strictEqual(p.time, "07:00");
    assert.strictEqual(p.lang, "en");
    assert.strictEqual(p.weekdays, false);
    assert.strictEqual(p.lead, 0);
    assert.strictEqual(p.evening, null);
    assert.strictEqual(p.startDate.getDate(), 26);
    const full = parseQuery("?track=furnace&from=2&start=2026-09-26&time=21:30&lang=es&weekdays=1&lead=30&evening=21:00");
    assert.strictEqual(full.trackId, "furnace");
    assert.strictEqual(full.track.short, "El horno");
    assert.deepStrictEqual([full.from, full.time, full.lang, full.weekdays, full.lead, full.evening], [2, "21:30", "es", true, 30, "21:00"]);
  });

  await test("every bad parameter is named, and nothing else is guessed", () => {
    const cases = {
      "": "start", "?start=2026-13-01": "start", "?start=2026-02-30": "start", "?start=tomorrow": "start",
      "?start=2026-09-26&track=nope": "track", "?start=2026-09-26&track=furnace&from=5": "from", "?start=2026-09-26&from=0": "from", "?start=2026-09-26&from=1.5": "from",
      "?start=2026-09-26&time=7:00": "time", "?start=2026-09-26&time=24:00": "time",
      "?start=2026-09-26&lead=15": "lead", "?start=2026-09-26&evening=9pm": "evening"
    };
    for (const [q, error] of Object.entries(cases)) assert.strictEqual(parseQuery(q).error, error, `for ${JSON.stringify(q)}`);
  });

  await test("the feed starts on the start date at the chosen time and runs to the end of the journey", () => {
    const ics = unfold(feedFor(parseQuery("?track=core&from=7&start=2026-09-26&time=21:30"), "https://prayers.dougdevitre.org"));
    assert.ok(ics.includes("DTSTART:20260926T213000"));
    assert.ok(ics.includes("RRULE:FREQ=DAILY;COUNT=24"));
    assert.strictEqual(ics.split("RECURRENCE-ID:").length - 1, 24);
    assert.ok(ics.includes("SUMMARY:Stand · Day 7 · The Word"));
    assert.ok(ics.includes("URL:https://prayers.dougdevitre.org/app#7"));
    assert.ok(!ics.includes("stand-evening-checkin@"));
  });

  await test("the options carry through: weekdays, lead and the evening series", () => {
    const ics = unfold(feedFor(parseQuery("?track=furnace&from=1&start=2026-09-26&time=07:00&weekdays=1&lead=10&evening=21:00"), "https://prayers.dougdevitre.org"));
    assert.ok(ics.includes("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=4"));
    assert.ok(ics.includes("DTSTART:20260928T070000"), "Saturday the 26th moves to Monday the 28th");
    assert.ok(ics.includes("TRIGGER:-PT10M") && !ics.includes("TRIGGER:PT0S"));
    assert.strictEqual(ics.split("UID:stand-evening-checkin@").length - 1, 5, "one evening master and four overrides");
    assert.ok(ics.includes("DTSTART:20260928T210000"));
  });

  await test("the feed is a pure function of its query", () => {
    const a = feedFor(parseQuery("?track=night&start=2026-10-01&time=22:00"), "https://x");
    const b = feedFor(parseQuery("?track=night&start=2026-10-01&time=22:00"), "https://x");
    assert.strictEqual(a, b);
    assert.ok(a.includes("DTSTAMP:20261001T000000"), "DTSTAMP comes from the start date, not the clock, so the CDN can cache the body");
  });

  await test("over HTTP the handler serves text/calendar with a day of CDN cache, and rejects bad input", async () => {
    const server = http.createServer(handler);
    await new Promise(r => server.listen(0, r));
    try {
      const ok = await request(server, "/calendar.ics?track=core&from=1&start=2026-09-26&time=07:00");
      assert.strictEqual(ok.status, 200);
      assert.ok(ok.headers["content-type"].startsWith("text/calendar"));
      assert.strictEqual(ok.headers["cache-control"], "public, max-age=3600, s-maxage=86400");
      assert.ok(ok.body.startsWith("BEGIN:VCALENDAR\r\n") && ok.body.endsWith("END:VCALENDAR\r\n"));
      assert.ok(ok.body.includes("http://localhost:"), "links follow the request host");
      const bad = await request(server, "/calendar.ics?track=core&start=nope");
      assert.strictEqual(bad.status, 400);
      assert.strictEqual(bad.body, "Bad request: start");
      const head = await request(server, "/calendar.ics?start=2026-09-26", "HEAD");
      assert.strictEqual(head.status, 200);
      assert.strictEqual(head.body, "");
      const post = await request(server, "/calendar.ics?start=2026-09-26", "POST");
      assert.strictEqual(post.status, 405);
    } finally { server.close(); }
  });

  await test("every journey in both languages serves a valid feed", () => {
    for (const lang of ["en", "es"]) {
      for (const id of Object.keys(tracks)) {
        const ics = feedFor(parseQuery(`?track=${id}&start=2026-09-26&lang=${lang}&evening=20:00`), "https://prayers.dougdevitre.org");
        for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `${lang}/${id}: over-long line`);
        assert.strictEqual(unfold(ics).split("RECURRENCE-ID:").length - 1, tracks[id].days.length * 2, `${lang}/${id}: override count`);
      }
    }
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll feed tests passed.");
})();
