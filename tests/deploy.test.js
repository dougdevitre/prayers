// Tests for scripts/verify-deploy.js, against a local server rather than the
// real site: one serving this checkout (must pass), one serving a tampered
// copy (must name exactly what is behind), and one polling until it catches up.
//
//   npm run test:unit

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { FILES, checkOnce, verifyDeploy } = require("../scripts/verify-deploy.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

// The same cleanUrls behaviour as production: /x -> x.html, /dir -> dir/index.html.
function serve(root) {
  const server = http.createServer((req, res) => {
    let file = req.url.split("?")[0];
    if (file === "/") file = "/index.html";
    let full = path.join(root, file);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      for (const c of [full + ".html", path.join(full, "index.html")]) if (fs.existsSync(c)) { full = c; break; }
    }
    let body;
    try { body = fs.readFileSync(full); } catch { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200); res.end(body);
  });
  return new Promise(resolve => server.listen(0, () => resolve({ server, url: `http://localhost:${server.address().port}` })));
}

// A copy of just the checked files, so it can be tampered with.
function copyChecked() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-deploy-"));
  for (const [file] of FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }
  return dir;
}

(async () => {
  await test("every checked file exists in the repository", () => {
    for (const [file] of FILES) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing`);
    assert.ok(FILES.some(([f]) => f === "sw.js") && FILES.some(([f]) => f === "app/index.html"));
  });

  await test("a site serving this checkout passes", async () => {
    const { server, url } = await serve(ROOT);
    try {
      const r = await checkOnce(url);
      assert.deepStrictEqual(r.behind, []);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.checked, FILES.length);
    } finally { server.close(); }
  });

  await test("a site behind by one file and missing another names both, and nothing else", async () => {
    const dir = copyChecked();
    fs.appendFileSync(path.join(dir, "sw.js"), "\n// stale\n");
    fs.unlinkSync(path.join(dir, "reminder.js"));
    const { server, url } = await serve(dir);
    try {
      const r = await checkOnce(url);
      assert.strictEqual(r.ok, false);
      assert.deepStrictEqual(r.behind.map(b => b.path).sort(), ["/reminder.js", "/sw.js"]);
      assert.ok(r.behind.find(b => b.path === "/reminder.js").reason.startsWith("HTTP 404"));
      assert.ok(/differs at byte \d+/.test(r.behind.find(b => b.path === "/sw.js").reason));
    } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await test("an unreachable site is reported, not thrown", async () => {
    const r = await checkOnce("http://localhost:1", { files: FILES.slice(0, 1) });
    assert.strictEqual(r.ok, false);
    assert.ok(r.behind[0].reason.startsWith("fetch failed"));
  });

  await test("polling keeps trying until the site catches up, then stops", async () => {
    const dir = copyChecked();
    fs.appendFileSync(path.join(dir, "app.js"), "\n// stale\n");
    const { server, url } = await serve(dir);
    const log = [];
    try {
      // The second attempt finds the file caught up.
      setTimeout(() => fs.copyFileSync(path.join(ROOT, "app.js"), path.join(dir, "app.js")), 150);
      const r = await verifyDeploy(url, { attempts: 5, delayMs: 200, log: m => log.push(m) });
      assert.strictEqual(r.ok, true);
      assert.ok(r.attempts >= 2 && r.attempts <= 3, `caught up on attempt ${r.attempts}`);
      assert.strictEqual(log.length, r.attempts - 1);
    } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await test("polling gives up after the last attempt with the site still behind", async () => {
    const dir = copyChecked();
    fs.appendFileSync(path.join(dir, "app.js"), "\n// stale\n");
    const { server, url } = await serve(dir);
    try {
      const r = await verifyDeploy(url, { attempts: 2, delayMs: 10 });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.attempts, 2);
      assert.deepStrictEqual(r.behind.map(b => b.path), ["/app.js"]);
    } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
  console.log("\nAll deploy-check tests passed.");
})();
