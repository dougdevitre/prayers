// Keeps the traditional prayers in prayers.js tied to their source, REMAM's
// corpus (dougdevitre/remam, packages/data/content/prayers.json), so the two
// apps pray the same words unless a difference was chosen on purpose.
//
//   node scripts/remam-sync.js check
//   node scripts/remam-sync.js sync <remam checkout> [--write]
//   node scripts/remam-sync.js override <id> <field> "<reason>"
//
// `check` runs in CI (npm run verify:remam) and needs no network: the lock,
// scripts/remam-lock.json, records the REMAM commit the prayers were last
// synced from and a hash of every field there. Each traditional prayer's
// name, text (per language) and audio pacing must hash the same as REMAM's
// did, or carry an override naming Stand's value and the reason for it. An
// edit to a prayer therefore fails CI until it is either made in REMAM first
// and synced, or recorded here as a deliberate difference.
//
// `sync` reads a local REMAM checkout and reports what changed there since the
// lock. With --write it copies those changes into prayers.js, except to a
// field Stand overrides (reported as a conflict), and moves the lock to the
// checkout's commit. It never adds or removes a prayer; new ones upstream are
// listed for review, since each needs a tradition tag Stand assigns.
//
// `override` records the current value of one field as a deliberate
// difference from REMAM. Use it only when the change should not go upstream.
//
// The composer corpus (modes, intentions, slots) is not compared: Stand's is a
// fork (no Laudato Si' slot or creation/defenders intentions; fear and courage
// added). The lock keeps a hash of REMAM's modes only so `sync` can say when
// they changed, in case something there is worth porting by hand.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const LOCK_FILE = path.join(__dirname, "remam-lock.json");
const PRAYERS_FILE = path.join(ROOT, "prayers.js");
const FIELDS = ["name.en", "name.es", "text.en", "text.es", "audio"];

/** Objects with their keys sorted, all the way down; arrays keep their order. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value === undefined ? null : value))).digest("hex").slice(0, 16);
}

/** One of FIELDS from a Stand item ({ name, text, audio }). */
function standField(item, field) {
  const [a, b] = field.split(".");
  return b ? (item[a] || {})[b] : item[a];
}

/** One of FIELDS from a REMAM item ({ name, en, es, audio }). */
function remamField(item, field) {
  const [a, b] = field.split(".");
  if (a === "text") return item[b];
  return b ? (item[a] || {})[b] : item[a];
}

/** `incoming`, with its object keys in the order `existing` already uses, so a sync does not reorder prayers.js. */
function inShapeOf(existing, incoming) {
  const plain = x => x && typeof x === "object" && !Array.isArray(x);
  if (!plain(existing) || !plain(incoming)) return incoming === undefined ? undefined : JSON.parse(JSON.stringify(incoming));
  const keys = [...Object.keys(existing).filter(k => k in incoming), ...Object.keys(incoming).filter(k => !(k in existing))];
  return Object.fromEntries(keys.map(k => [k, inShapeOf(existing[k], incoming[k])]));
}

function setStandField(item, field, value) {
  const [a, b] = field.split(".");
  const copy = inShapeOf(standField(item, field), value);
  if (b) item[a][b] = copy;
  else if (copy === undefined) delete item[a];
  else item[a] = copy;
}

/** { id: { field: hash } } for REMAM's traditional prayers, limited to `ids` when given. */
function remamHashes(remam, ids) {
  const out = {};
  for (const item of remam.traditional.items) {
    if (ids && !ids.includes(item.id)) continue;
    out[item.id] = Object.fromEntries(FIELDS.map(f => [f, hash(remamField(item, f))]));
  }
  return out;
}

/**
 * Every way the traditional prayers differ from the lock that the lock does
 * not explain. An empty list means Stand prays what REMAM prayed at the
 * locked commit, apart from the recorded overrides.
 */
function checkLock(traditional, lock) {
  const problems = [];
  const at = `REMAM ${lock.commit.slice(0, 7)}`;
  const standIds = traditional.map(t => t.id);
  const overrides = lock.overrides || [];
  const overrideFor = (id, field) => overrides.find(o => o.id === id && o.field === field);

  for (const o of overrides) {
    if (!lock.traditional[o.id]) problems.push(`override ${o.id} ${o.field}: no such prayer in the lock`);
    else if (!FIELDS.includes(o.field)) problems.push(`override ${o.id} ${o.field}: field must be one of ${FIELDS.join(", ")}`);
    if (!o.reason || !String(o.reason).trim()) problems.push(`override ${o.id} ${o.field}: give a reason`);
  }
  for (const id of Object.keys(lock.traditional)) {
    if (!standIds.includes(id)) problems.push(`${id}: in ${at} but not in prayers.js`);
  }
  for (const item of traditional) {
    const locked = lock.traditional[item.id];
    if (!locked) {
      if (!(lock.standOnly || []).some(s => s.id === item.id)) {
        problems.push(`${item.id}: not in ${at}; add it there first and sync, or list it under standOnly with a reason`);
      }
      continue;
    }
    for (const field of FIELDS) {
      const mine = hash(standField(item, field));
      const o = overrideFor(item.id, field);
      if (o) {
        if (mine === locked[field]) problems.push(`${item.id} ${field}: matches ${at} again; remove its override`);
        else if (mine !== o.stand) problems.push(`${item.id} ${field}: changed since its override was recorded; if this is still meant to differ from REMAM, run: node scripts/remam-sync.js override ${item.id} ${field} "<reason>"`);
      } else if (mine !== locked[field]) {
        problems.push(`${item.id} ${field}: differs from ${at}. Make the change in REMAM and sync it, or, if it should differ, run: node scripts/remam-sync.js override ${item.id} ${field} "<reason>"`);
      }
    }
  }
  return problems;
}

/**
 * Compare a REMAM corpus with the lock and with Stand. Returns what changed
 * upstream, what can be applied, and what conflicts; with `write`, applies it
 * to `traditional` in place and returns the new lock.
 */
function syncFrom(remam, commit, traditional, lock, { write = false } = {}) {
  const upstream = Object.fromEntries(remam.traditional.items.map(i => [i.id, i]));
  const standIds = traditional.map(t => t.id);
  const overrides = lock.overrides || [];
  const report = { changed: [], applied: [], conflicts: [], newUpstream: [], goneUpstream: [], modesChanged: hash(remam.modes) !== lock.modes };

  for (const id of Object.keys(upstream)) {
    if (!standIds.includes(id) && !lock.traditional[id]) report.newUpstream.push(id);
  }
  for (const id of Object.keys(lock.traditional)) {
    if (!upstream[id]) report.goneUpstream.push(id);
  }

  for (const item of traditional) {
    const up = upstream[item.id];
    const locked = lock.traditional[item.id];
    if (!up || !locked) continue;
    for (const field of FIELDS) {
      const now = hash(remamField(up, field));
      if (now === locked[field]) continue;
      report.changed.push({ id: item.id, field });
      const mine = hash(standField(item, field));
      // Stand already has REMAM's new value (an override REMAM adopted, or the
      // same fix made in both): nothing to copy, the lock just moves.
      if (mine === now) continue;
      const overridden = overrides.some(o => o.id === item.id && o.field === field);
      if (overridden) report.conflicts.push({ id: item.id, field, why: "Stand overrides this field" });
      else if (mine !== locked[field]) report.conflicts.push({ id: item.id, field, why: "Stand's value differs from the lock; run check first" });
      else report.applied.push({ id: item.id, field });
    }
  }

  if (!write) return { report, lock };
  if (report.conflicts.length) return { report, lock, refused: "conflicts" };
  for (const { id, field } of report.applied) {
    const item = traditional.find(t => t.id === id);
    setStandField(item, field, remamField(upstream[id], field));
  }
  const kept = standIds.filter(id => upstream[id]);
  const next = {
    ...lock,
    commit,
    modes: hash(remam.modes),
    traditional: remamHashes(remam, kept),
    // An override whose value REMAM has now adopted is no longer a difference.
    overrides: overrides.filter(o => {
      const item = traditional.find(t => t.id === o.id);
      return !(item && upstream[o.id] && hash(standField(item, o.field)) === hash(remamField(upstream[o.id], o.field)));
    })
  };
  return { report, lock: next };
}

/** Record Stand's current value of one field as a deliberate difference. */
function recordOverride(traditional, lock, id, field, reason) {
  const item = traditional.find(t => t.id === id);
  if (!item) throw new Error(`no traditional prayer "${id}" in prayers.js`);
  if (!FIELDS.includes(field)) throw new Error(`field must be one of ${FIELDS.join(", ")}`);
  if (!lock.traditional[id]) throw new Error(`"${id}" is not in the lock; list it under standOnly instead`);
  if (!reason || !reason.trim()) throw new Error("give a reason");
  const stand = hash(standField(item, field));
  if (stand === lock.traditional[id][field]) throw new Error(`${id} ${field} matches REMAM; nothing to override`);
  const overrides = (lock.overrides || []).filter(o => !(o.id === id && o.field === field));
  overrides.push({ id, field, stand, reason: reason.trim() });
  overrides.sort((a, b) => (a.id + a.field).localeCompare(b.id + b.field));
  return { ...lock, overrides };
}

// --- files ------------------------------------------------------------------

function readLock(file = LOCK_FILE) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeLock(lock, file = LOCK_FILE) {
  fs.writeFileSync(file, JSON.stringify(lock, null, 2) + "\n");
}

/** Rewrite the traditional array in prayers.js; it is the corpus's last key and is kept in JSON.stringify's layout. */
function writeTraditional(traditional, file = PRAYERS_FILE) {
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf('\n  "traditional": [');
  const end = src.indexOf("\n};\n", start);
  if (start < 0 || end < 0) throw new Error("could not find the traditional array in prayers.js");
  const body = '\n  "traditional": ' + JSON.stringify(traditional, null, 2).replace(/\n/g, "\n  ");
  fs.writeFileSync(file, src.slice(0, start) + body + src.slice(end));
}

function loadTraditional() {
  delete require.cache[require.resolve(PRAYERS_FILE)];
  return require(PRAYERS_FILE).prayerCorpus.traditional;
}

module.exports = { FIELDS, hash, canonical, remamHashes, checkLock, syncFrom, recordOverride, writeTraditional };

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const lock = readLock();
  const traditional = loadTraditional();

  if (!cmd || cmd === "check") {
    const problems = checkLock(traditional, lock);
    if (problems.length) {
      console.error(`✗ ${problems.length} traditional prayer difference(s) from REMAM that the lock does not explain:`);
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    const o = (lock.overrides || []).length;
    console.log(`✓ ${traditional.length} traditional prayers match REMAM ${lock.commit.slice(0, 7)}${o ? `, apart from ${o} recorded override(s)` : ""}`);
  } else if (cmd === "sync") {
    const dir = args.find(a => !a.startsWith("--"));
    if (!dir) { console.error("usage: node scripts/remam-sync.js sync <remam checkout> [--write]"); process.exit(2); }
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
    if (git("status", "--porcelain", "--", lock.path)) {
      console.error(`✗ ${lock.path} has uncommitted changes in ${dir}; the lock must name a commit that contains what it hashes`);
      process.exit(1);
    }
    const commit = git("rev-parse", "HEAD");
    const remam = JSON.parse(fs.readFileSync(path.join(dir, lock.path), "utf8"));
    const write = args.includes("--write");
    const { report, lock: next, refused } = syncFrom(remam, commit, traditional, lock, { write });
    console.log(`REMAM ${lock.commit.slice(0, 7)} → ${commit.slice(0, 7)}`);
    for (const c of report.changed) console.log(`  changed upstream: ${c.id} ${c.field}`);
    for (const c of report.conflicts) console.log(`  conflict: ${c.id} ${c.field} (${c.why})`);
    for (const id of report.newUpstream) console.log(`  new in REMAM, not imported: ${id} (add it to prayers.js with a tradition tag, then sync again)`);
    for (const id of report.goneUpstream) console.log(`  removed from REMAM: ${id} (decide whether Stand keeps it)`);
    if (report.modesChanged) console.log("  REMAM's composer corpus (modes) changed; Stand's is a fork, so review it by hand for anything worth porting");
    if (!report.changed.length && !report.newUpstream.length && !report.goneUpstream.length && !report.modesChanged) console.log("  no changes to the traditional prayers");
    if (!write) { console.log("Dry run. Add --write to apply."); return; }
    if (refused) { console.error("✗ conflicts; nothing written"); process.exit(1); }
    if (report.applied.length) writeTraditional(traditional);
    writeLock(next);
    console.log(`Applied ${report.applied.length} change(s); the lock now names ${commit.slice(0, 7)}. Run npm run verify:audio to see which recordings to re-render.`);
  } else if (cmd === "override") {
    const [id, field, reason] = args;
    writeLock(recordOverride(traditional, lock, id, field, reason));
    console.log(`Recorded ${id} ${field} as a deliberate difference from REMAM.`);
  } else {
    console.error(`unknown command "${cmd}"; use check, sync or override`);
    process.exit(2);
  }
}
