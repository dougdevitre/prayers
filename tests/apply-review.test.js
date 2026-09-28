// Tests for scripts/apply-review.js, the step that turns the pastoral
// review's decisions into content edits. Every test works on a temporary copy
// of the content, so the checkout is never touched.
//
//   npm run test:unit

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDecisions, plan, apply } = require("../scripts/apply-review.js");
const { collect } = require("../scripts/build-review-workbook.js");

const ROOT = path.join(__dirname, "..");
const COPY = ["content.js", "content.es.js", "prayers.js", "rosary.js", "logic.js", "scripts/build-review-workbook.js", "scripts/review-workbook.tpl", "scripts/review-suggestions.json"];

let failures = 0;
function test(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name); console.log("     " + (e && e.message ? e.message.split("\n")[0] : e)); }
}

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-review-"));
  for (const f of COPY) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  return dir;
}
const items = new Map(collect().items.map(i => [i.id, i]));
const field = (id, label) => items.get(id).fields.find(f => f.label === label);
const firstSentence = s => s.match(/^[^.!?]+[.!?]/)[0];
const change = (id, lines) => ({ status: "change", note: lines.join("\n"), hash: items.get(id).hash });

test("a Spanish and an English wording are applied to exactly their fields, and nothing else changes", () => {
  const dir = sandbox();
  const es = firstSentence(field("day.core.02", "Prayer").es);
  const en = firstSentence(field("day.core.03", "Reflection").en);
  const p = plan(dir, {
    "day.core.02": change("day.core.02", [`Change “${es}” → “Nueva frase de prueba.”`]),
    "day.core.03": change("day.core.03", [`Change “${en}” → “A test sentence.”`])
  });
  assert.strictEqual(p.edits.length, 2);
  assert.deepStrictEqual(p.manual, []);
  const before = Object.fromEntries(["content.js", "content.es.js"].map(f => [f, fs.readFileSync(path.join(dir, f), "utf8")]));
  apply(dir, p.edits);
  for (const k of Object.keys(require.cache)) if (k.startsWith(dir)) delete require.cache[k];
  const after = collect(dir).items;
  const changed = after.filter(it => it.hash !== items.get(it.id).hash).map(it => it.id).sort();
  assert.deepStrictEqual(changed, ["day.core.02", "day.core.03"]);
  const es2 = fs.readFileSync(path.join(dir, "content.es.js"), "utf8");
  assert.ok(es2.includes("Nueva frase de prueba.") && !es2.includes(JSON.stringify(field("day.core.02", "Prayer").es)));
  assert.strictEqual(es2.length - before["content.es.js"].length, "Nueva frase de prueba.".length - es.length);
});

test("two wordings in the same field both apply", () => {
  const dir = sandbox();
  const text = field("day.core.01", "Prayer").es;
  const [a, b] = ["Donde estoy confundido, dame claridad.", "Donde estoy agotado, renueva mis fuerzas."];
  assert.ok(text.includes(a) && text.includes(b), "fixture sentences moved; update the test");
  const p = plan(dir, { "day.core.01": change("day.core.01", [`Change “${a}” → “Uno.”`, `Change “${b}” → “Dos.”`]) });
  apply(dir, p.edits);
  const s = fs.readFileSync(path.join(dir, "content.es.js"), "utf8");
  assert.ok(s.includes(JSON.stringify(text.replace(a, "Uno.").replace(b, "Dos."))));
});

test("approvals, older decisions, free-text notes and unknown items are never applied", () => {
  const dir = sandbox();
  const s = firstSentence(field("day.core.05", "Prayer").en);
  const p = plan(dir, {
    "day.core.04": { status: "approved", note: "", hash: items.get("day.core.04").hash },
    "day.core.05": { status: "change", note: `Change “${s}” → “X.”`, hash: "000000000000" },
    "day.core.06": change("day.core.06", ["Please soften the second sentence."]),
    "day.gone.01": { status: "change", note: "x", hash: "x" },
    "day.core.07": { status: null, note: "", hash: items.get("day.core.07").hash }
  });
  assert.deepStrictEqual(p.edits, []);
  assert.deepStrictEqual(p.counts, { approved: 1, change: 1, stale: 1, pending: 1, unknown: 1 });
  assert.deepStrictEqual(p.stale.map(x => x.id), ["day.core.05"]);
  assert.deepStrictEqual(p.manual.map(m => m.id).sort(), ["day.core.06", "day.gone.01"]);
});

test("text shared between items, and traditional prayers, go to a person instead", () => {
  const dir = sandbox();
  const shared = field("sos.1", "Declaration").en;
  const trad = [...items.values()].find(i => i.id.startsWith("trad."));
  const tradSentence = firstSentence(trad.fields[0].en);
  const p = plan(dir, {
    "sos.1": change("sos.1", [`Change “${shared}” → “Y.”`]),
    [trad.id]: change(trad.id, [`Change “${tradSentence}” → “Z.”`])
  });
  assert.deepStrictEqual(p.edits, []);
  assert.match(p.manual.find(m => m.id === "sos.1").reason, /appears 2 times/);
  assert.match(p.manual.find(m => m.id === trad.id).reason, /REMAM/);
});

test("planning writes nothing", () => {
  const dir = sandbox();
  const before = fs.readFileSync(path.join(dir, "content.es.js"), "utf8");
  plan(dir, { "day.core.01": change("day.core.01", ["Change “Donde estoy confundido, dame claridad.” → “Uno.”"]) });
  assert.strictEqual(fs.readFileSync(path.join(dir, "content.es.js"), "utf8"), before);
});

test("decisions read from one file (object or array) or a directory of documents", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-decisions-"));
  const doc = { status: "approved", note: "", hash: "h" };
  fs.writeFileSync(path.join(dir, "obj.json"), JSON.stringify({ "day.core.01": doc }));
  fs.writeFileSync(path.join(dir, "arr.json"), JSON.stringify([{ id: "day.core.01", ...doc }]));
  fs.mkdirSync(path.join(dir, "docs"));
  fs.writeFileSync(path.join(dir, "docs", "day.core.01.json"), JSON.stringify({ data: doc }));
  for (const f of ["obj.json", "arr.json", "docs"]) assert.strictEqual(readDecisions(path.join(dir, f))["day.core.01"].status, "approved", f);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log("\nAll apply-review tests passed.");
