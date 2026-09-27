// Applies the pastoral review's decisions to the content.
//
//   node scripts/apply-review.js <decisions.json | dir>           # plan only
//   node scripts/apply-review.js <decisions.json | dir> --write   # edit files
//
// Decisions are the review workbook's db documents (reviews/<item id>):
// { status: "approved" | "change" | null, note, hash }. Pass them as one JSON
// file ({ "<id>": {...} } or [{ id, ... }]) or as a directory of <id>.json
// files, each the document itself or { data: {...} }.
//
// A "change" decision's note holds one line per chosen wording, written by the
// workbook as  Change “<sentence>” → “<new sentence>”.  Each such line is
// applied to the field that contains the sentence: the field's whole string
// literal is found in content.js, content.es.js or prayers.js (exactly once,
// or the swap is not made) and rewritten. Anything else in a note, a decision
// made on text that has since changed, a traditional prayer (kept identical to
// REMAM) and a text that appears in more than one place are listed for a
// person to handle. Nothing is written without --write.
//
// After --write: npm run build:seo, npm run bump:sw, then the audio check lists
// exactly which recordings the new text makes stale.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FILES = { en: ["content.js", "prayers.js"], es: ["content.es.js", "prayers.js"] };
const CHANGE = /^Change “(.+)” → “(.+)”$/;

/** { id: decision } from a JSON file or a directory of <id>.json files. */
function readDecisions(input) {
  const unwrap = d => (d && typeof d === "object" && d.data && typeof d.data === "object" ? d.data : d);
  if (fs.statSync(input).isDirectory()) {
    const out = {};
    for (const f of fs.readdirSync(input).filter(f => f.endsWith(".json"))) out[f.slice(0, -5)] = unwrap(JSON.parse(fs.readFileSync(path.join(input, f), "utf8")));
    return out;
  }
  const raw = JSON.parse(fs.readFileSync(input, "utf8"));
  if (Array.isArray(raw)) return Object.fromEntries(raw.map(d => [d.id, unwrap(d)]));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, unwrap(v)]));
}

/** What the decisions ask for, against the content as it is now. Pure: reads files, writes nothing. */
function plan(root, decisions) {
  root = path.resolve(root);
  const { collect } = require(path.join(root, "scripts", "build-review-workbook.js"));
  const items = new Map(collect(root).items.map(i => [i.id, i]));
  const src = {};
  const read = f => (src[f] ??= fs.readFileSync(path.join(root, f), "utf8"));
  const out = { counts: { approved: 0, change: 0, stale: 0, pending: 0, unknown: 0 }, edits: [], manual: [], stale: [] };

  for (const [id, d] of Object.entries(decisions)) {
    const it = items.get(id);
    if (!it) { out.counts.unknown++; out.manual.push({ id, reason: "no such item (renamed or removed)", note: d && d.note }); continue; }
    if (!d || !d.status) { out.counts.pending++; if (d && d.note) out.manual.push({ id, reason: "note without a decision", note: d.note }); continue; }
    if (d.hash !== it.hash) { out.counts.stale++; out.stale.push({ id, status: d.status, note: d.note }); continue; }
    if (d.status === "approved") { out.counts.approved++; if (d.note) out.manual.push({ id, reason: "approved with a note", note: d.note }); continue; }
    out.counts.change++;
    const lines = String(d.note || "").split("\n").map(l => l.trim()).filter(Boolean);
    const rest = [];
    for (const line of lines) {
      const m = line.match(CHANGE);
      if (!m) { rest.push(line); continue; }
      const [, from, to] = m;
      const hit = [];
      for (const f of it.fields) for (const lang of ["en", "es"]) if (!f.scripture && (f[lang] || "").includes(from)) hit.push({ f, lang });
      const why = reason => out.manual.push({ id, reason, note: line });
      if (id.startsWith("trad.")) { why("traditional prayers stay word for word with REMAM; change them there and sync"); continue; }
      if (hit.length !== 1) { why(hit.length ? "the sentence is in more than one field" : "the sentence is no longer in this item"); continue; }
      const { f, lang } = hit[0];
      if (f[lang].split(from).length !== 2) { why("the sentence appears more than once in the field"); continue; }
      const oldLit = JSON.stringify(f[lang]);
      const next = f[lang].replace(from, () => to);
      const where = FILES[lang].filter(file => read(file).includes(oldLit));
      const count = where.reduce((n, file) => n + read(file).split(oldLit).length - 1, 0);
      if (count !== 1) { why(count ? `the ${f.label.toLowerCase()} text appears ${count} times in the content (shared with another item)` : "the field's text was not found as written in the content files"); continue; }
      out.edits.push({ id, lang, field: f.label, file: where[0], from, to, oldLit, newLit: JSON.stringify(next) });
    }
    if (rest.length) out.manual.push({ id, reason: "note to act on", note: rest.join("\n") });
  }
  return out;
}

/** Write the planned edits. Edits to the same literal are applied in order. */
function apply(root, edits) {
  root = path.resolve(root);
  const byFile = new Map();
  for (const e of edits) (byFile.get(e.file) || byFile.set(e.file, []).get(e.file)).push(e);
  for (const [file, list] of byFile) {
    const p = path.join(root, file);
    let s = fs.readFileSync(p, "utf8");
    const current = new Map();
    for (const e of list) {
      const lit = current.get(e.oldLit) || e.oldLit;
      const text = JSON.parse(lit).replace(e.from, () => e.to);
      const next = JSON.stringify(text);
      if (s.split(lit).length !== 2) throw new Error(`${file}: ${e.id} ${e.field} is no longer unique; nothing further written to this file`);
      s = s.replace(lit, () => next);
      current.set(e.oldLit, next);
    }
    fs.writeFileSync(p, s);
  }
}

function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--"));
  if (!input) { console.error("usage: node scripts/apply-review.js <decisions.json | dir> [--write]"); process.exit(2); }
  const root = path.join(__dirname, "..");
  const write = args.includes("--write");
  const p = plan(root, readDecisions(input));
  const c = p.counts;
  console.log(`Decisions: ${c.approved} approved, ${c.change} need change, ${c.stale} made on older text, ${c.pending} without a decision${c.unknown ? `, ${c.unknown} for unknown items` : ""}.`);
  console.log(`\n${write ? "Applying" : "Would apply"} ${p.edits.length} wording change${p.edits.length === 1 ? "" : "s"}:`);
  for (const e of p.edits) console.log(`  ${e.id} · ${e.field} (${e.lang}) · ${e.file}\n    − ${e.from}\n    + ${e.to}`);
  if (p.manual.length) {
    console.log(`\nFor a person (${p.manual.length}):`);
    for (const m of p.manual) console.log(`  ${m.id} — ${m.reason}${m.note ? "\n    " + String(m.note).replace(/\n/g, "\n    ") : ""}`);
  }
  if (p.stale.length) {
    console.log(`\nMade on text that has since changed; ask the reviewer to look again (${p.stale.length}):`);
    for (const s of p.stale) console.log(`  ${s.id} (${s.status})${s.note ? ": " + s.note.replace(/\n/g, " / ") : ""}`);
  }
  if (!write) { console.log(`\nNothing written. Add --write to apply.`); return; }
  apply(root, p.edits);
  console.log(`\nWritten. Recordings the new text makes stale:`);
  try { process.stdout.write(execFileSync(process.execPath, [path.join(root, "scripts", "verify-audio.js"), "--allow-stale"], { encoding: "utf8" })); }
  catch (e) { process.stdout.write(String(e.stdout || e.message)); }
  console.log(`\nNext: npm run build:seo && npm run bump:sw, then the usual checks.`);
}

if (require.main === module) main();
module.exports = { readDecisions, plan, apply, CHANGE };
