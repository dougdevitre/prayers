// Tests for error reports: report.js (what is kept, what is scrubbed) and
// api/report.js (the endpoint refuses what is not a report, logs only what
// is kept, and answers 204).
//
//   npm run test:unit

const assert = require("assert");
const http = require("http");
const { scrubMessage, pathOnly, cleanReport, REPORT_LIMIT } = require("../report.js");
const handler = require("../api/report.js");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

const post = (server, body, method = "POST") => new Promise((resolve, reject) => {
  const req = http.request({ host: "localhost", port: server.address().port, path: "/api/report", method, headers: { "Content-Type": "application/json" } }, res => {
    res.resume();
    res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
  });
  req.on("error", reject);
  if (body !== undefined) req.write(body);
  req.end();
});

(async () => {
  await test("quoted text is removed from messages, whatever the quote", () => {
    assert.strictEqual(scrubMessage('Unexpected token "my note about court" in JSON'), 'Unexpected token "…" in JSON');
    assert.strictEqual(scrubMessage("Cannot read properties of null (reading 'days')"), "Cannot read properties of null (reading '…')");
    assert.strictEqual(scrubMessage("bad `template ${x}` here"), "bad `…` here");
    assert.strictEqual(scrubMessage("  lots   of\n space "), "lots of space");
    assert.strictEqual(scrubMessage("x".repeat(500)).length, 200);
    assert.strictEqual(scrubMessage(undefined), "");
  });

  await test("only paths on this site survive", () => {
    assert.strictEqual(pathOnly("https://prayers.dougdevitre.org/app.js?v=1#x", "https://prayers.dougdevitre.org"), "/app.js");
    assert.strictEqual(pathOnly("chrome-extension://abc/content.js", "https://prayers.dougdevitre.org"), null);
    assert.strictEqual(pathOnly("https://evil.example/app.js", "https://prayers.dougdevitre.org"), null);
  });

  await test("a report keeps six fields and refuses everything else", () => {
    const kept = cleanReport({ name: "TypeError", message: "x is 'secret'", file: "/app.js", line: 12, col: 3, page: "/app", notes: "never", ua: "never" });
    assert.deepStrictEqual(kept, { name: "TypeError", message: "x is '…'", file: "/app.js", line: 12, col: 3, page: "/app" });
    const odd = cleanReport({ name: "<script>", message: "m", file: "https://x/app.js", line: -1, col: 1.5, page: "/app?id=42" });
    assert.deepStrictEqual(odd, { name: "Error", message: "m", file: "", line: 0, col: 0, page: "" });
    assert.strictEqual(cleanReport({ message: "" }), null);
    assert.strictEqual(cleanReport([]), null);
    assert.strictEqual(cleanReport("text"), null);
    assert.strictEqual(REPORT_LIMIT, 3);
  });

  await test("the endpoint logs a cleaned report and answers 204", async () => {
    const lines = [];
    handler.log = line => lines.push(JSON.parse(line));
    const server = http.createServer(handler);
    await new Promise(r => server.listen(0, r));
    const ok = await post(server, JSON.stringify({ name: "TypeError", message: 'bad "words"', file: "/app.js", line: 3, col: 1, page: "/app", extra: "dropped" }));
    assert.strictEqual(ok.status, 204);
    assert.strictEqual(ok.headers["cache-control"], "no-store");
    assert.deepStrictEqual(lines, [{ event: "client-error", name: "TypeError", message: 'bad "…"', file: "/app.js", line: 3, col: 1, page: "/app" }]);
    assert.strictEqual((await post(server, undefined, "GET")).status, 405);
    assert.strictEqual((await post(server, "not json")).status, 400);
    assert.strictEqual((await post(server, JSON.stringify({ name: "Error" }))).status, 400);
    assert.strictEqual((await post(server, JSON.stringify({ message: "x".repeat(3000) }))).status, 413);
    assert.strictEqual(lines.length, 1, "nothing refused was logged");
    server.close();
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll error report tests passed.");
})();
