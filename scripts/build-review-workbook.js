// Builds the pastoral review workbook: every reviewable line of Stand, in
// English and Spanish, as one page a reviewer marks Approve or Needs change.
//
//   npm run build:review                 -> .review/stand-review.html
//   node scripts/build-review-workbook.js <output.html>
//
// The page is published as a claude.ai artifact with the `db` and `user`
// capabilities; it is never committed or deployed (.review is ignored).
// Every item has a stable id and a hash of its text. Decisions live in the
// artifact's db under reviews/<id> with the hash they were made against, so
// after a text change the page shows that decision as out of date instead of
// carrying an approval over to words the reviewer never saw. Composer blocks
// are numbered by position: moving one changes its id, which reads as
// "to review" again rather than as a stale approval.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(__dirname, "review-workbook.tpl");

const hash = v => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);

// First- and second-person masculine forms in the reader's own voice. Each
// match becomes a question for the reviewer on that item.
const MASC = /\b(estoy|estés|estás|esté|me siento|sentirme|me quedo|quedé|he quedado|llevo mucho tiempo)\s+(?:tan\s+|muy\s+|tiempo\s+)?(cansado|agotado|asustado|abrumado|listo|solo|preparado|perdido|seguro|atrapado|enfermo|dispuesto|herido|avergonzado|confundido|equivocado|frustrado|enojado|resentido|bloqueado)\b/gi;
function flagsFor(fields) {
  const out = [];
  for (const f of fields) {
    for (const m of (f.es || "").matchAll(MASC)) {
      out.push({ kind: "gender", text: `“${m[0]}” (${f.label}) addresses the reader in the masculine.` });
    }
  }
  return out;
}

/** Every reviewable item, in the order the workbook shows them. */
function collect(root = ROOT) {
  const c = require(path.join(root, "content.js"));
  const e = require(path.join(root, "content.es.js"));
  const { prayerCorpus: p } = require(path.join(root, "prayers.js"));

  const items = [];
  function add(item) {
    item.hash = hash(item.fields.map(f => [f.label, f.en, f.es]));
    item.flags = [...(item.flags || []), ...flagsFor(item.fields)];
    items.push(item);
  }

  // 1. Journeys: every day of every track.
  const SECTION_OF = { "THE 30-DAY JOURNEY": "journey", "FEAR TRACKS": "fear", "COURAGE STORIES": "courage" };
  for (const [tid, t] of Object.entries(c.tracks)) {
    const es = e.esTracks[tid];
    t.days.forEach((d, i) => {
      const s = es && es.days[i] || [];
      const n = String(i + 1).padStart(2, "0");
      add({
        id: `day.${tid}.${n}`,
        section: SECTION_OF[t.group] || "journey",
        group: t.name, groupEs: es ? es.name : "",
        label: `Day ${i + 1} · ${d[0]}`, labelEs: s[0] ? `Día ${i + 1} · ${s[0]}` : "",
        fields: [
          { label: "Scripture", en: `${d[2]} (${d[1]})`, es: s[2] ? `${s[2]} (${s[1]})` : "", scripture: true },
          { label: "Reflection", en: d[3], es: s[3] || "" },
          { label: "Prayer", en: d[4], es: s[4] || "" },
          { label: "Declaration", en: d[5], es: s[5] || "" },
          { label: "Practice", en: d[6], es: s[6] || "" }
        ]
      });
    });
  }

  // 2. Steady me now: the SOS sets.
  c.sosSetsEn.forEach((s, i) => {
    const es = e.esSos[i] || {};
    add({
      id: `sos.${i + 1}`, section: "sos", group: "Steady me now", groupEs: "Calma ahora",
      label: `Set ${i + 1} · ${s.ref}`, labelEs: es.ref ? `Serie ${i + 1} · ${es.ref}` : "",
      fields: [
        { label: "Scripture", en: `${s.verse} (${s.ref})`, es: es.verse ? `${es.verse} (${es.ref})` : "", scripture: true },
        { label: "Prayer", en: s.prayer, es: es.prayer || "" },
        { label: "Declaration", en: s.declaration, es: es.declaration || "" }
      ]
    });
  });

  // 3. The prayer composer: every block, by mode and slot.
  const SLOT = { invocation: "Opening", examen: "Examen", body: "Petition", contrition: "Contrition", closing: "Closing" };
  for (const [mid, m] of Object.entries(p.modes)) {
    const intentions = Object.fromEntries(m.intentions.map(x => [x.id, x.label]));
    for (const [sid, slot] of Object.entries(m.slots)) {
      const groups = Array.isArray(slot) ? { "": slot } : slot;
      for (const [gid, blocks] of Object.entries(groups)) {
        blocks.forEach((b, i) => {
          const intent = gid ? ` · ${(intentions[gid] || {}).en || gid}` : "";
          add({
            id: `compose.${mid}.${sid}${gid ? "." + gid : ""}.${i + 1}`,
            section: "composer", group: `Composer · ${m.name.en}`, groupEs: `Compositor · ${m.name.es}`,
            label: `${SLOT[sid] || sid}${intent} · ${i + 1}`, labelEs: "",
            tags: [b.tradition === "roman-catholic" ? "Roman Catholic" : "", b.style || ""].filter(Boolean),
            fields: [{ label: SLOT[sid] || sid, en: b.en, es: b.es }]
          });
        });
      }
    }
    if (m.note) {
      add({
        id: `compose.${mid}.note`, section: "composer", group: `Composer · ${m.name.en}`, groupEs: `Compositor · ${m.name.es}`,
        label: "Note shown with this mode", labelEs: "", fields: [{ label: "Note", en: m.note.en, es: m.note.es }]
      });
    }
  }

  // 4. Traditional prayers (kept identical to REMAM's corpus).
  for (const t of p.traditional) {
    add({
      id: `trad.${t.id}`, section: "traditional", group: "Traditional prayers", groupEs: "Oraciones tradicionales",
      label: t.name.en, labelEs: t.name.es,
      tags: [t.tradition === "roman-catholic" ? "Roman Catholic" : "Shared tradition", "Also in REMAM"],
      fields: [{ label: "Text", en: t.text.en, es: t.text.es }]
    });
  }

  // 5. The fear finder: the sentences a reader picks to start.
  add({
    id: "finder.phrases", section: "finder", group: "Fear finder", groupEs: "Buscador de miedos",
    label: "“Where are you right now?” phrases", labelEs: "",
    fields: c.fearIndex.map(([en, track], i) => ({ label: c.tracks[track] ? c.tracks[track].name : track, en, es: (e.esFearIndex[i] || [])[0] || "" }))
  });

  return { items, meta: { count: items.length, review: p.meta.review, reviewNote: p.meta.reviewNote } };
}

/** The workbook page for these items. */
function render({ items, meta }, built = new Date().toISOString().slice(0, 10)) {
  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  const data = JSON.stringify({ meta: { built, ...meta }, items }).replace(/</g, "\\u003c");
  return tpl.replace("__DATA__", () => data);
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, ".review", "stand-review.html"));
  const workbook = collect();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(workbook));
  const flagged = workbook.items.filter(i => i.flags.length);
  console.log(`${workbook.items.length} items, ${flagged.length} flagged, ${Math.round(fs.statSync(out).size / 1024)} KB -> ${path.relative(process.cwd(), out)}`);
  for (const i of flagged) console.log("  flag", i.id, i.flags.map(f => f.text).join(" | "));
}

module.exports = { collect, render, flagsFor };
