<title>Stand Pastoral Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
:root{
  --paper:#f7f4ec;--surface:#fffdf8;--ink:#132a3a;--muted:#56666f;--line:#dcd7ca;--soft:#efe9dc;
  --gold:#b88732;--gold-text:#7f5b1a;
  --ok:#276148;--ok-bg:#e1eee5;--warn:#96431b;--warn-bg:#f7e5d8;--flag:#6d5314;--flag-bg:#fbf1d6;
  --focus:#b88732;
  --serif:"Source Serif 4",Georgia,"Times New Roman",serif;
  --sans:"Source Sans 3",system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;--paper:#0d1b24;--surface:#142833;--ink:#edf4f4;--muted:#a9b9bd;--line:#2c4450;--soft:#1b3340;
  --gold:#f1c879;--gold-text:#f1c879;--ok:#93d4b1;--ok-bg:#1c3a2f;--warn:#f2b08c;--warn-bg:#3e2a20;--flag:#f1d38a;--flag-bg:#3a3223;--focus:#f1c879}}
:root[data-theme="dark"]{
  color-scheme:dark;--paper:#0d1b24;--surface:#142833;--ink:#edf4f4;--muted:#a9b9bd;--line:#2c4450;--soft:#1b3340;
  --gold:#f1c879;--gold-text:#f1c879;--ok:#93d4b1;--ok-bg:#1c3a2f;--warn:#f2b08c;--warn-bg:#3e2a20;--flag:#f1d38a;--flag-bg:#3a3223;--focus:#f1c879}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font:16px/1.55 var(--sans);padding-inline:16px}
.wrap{max-width:1040px;margin:0 auto;padding-block:28px 64px}
.kicker{margin:0;color:var(--gold-text);font-size:.74rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
h1{margin:6px 0 10px;font:600 clamp(1.9rem,4.5vw,2.6rem)/1.1 var(--serif);text-wrap:balance}
.intro{display:grid;gap:10px;max-width:68ch;color:var(--ink)}
.intro p{margin:0}
.intro .muted{color:var(--muted);font-size:.92rem}
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0 0;padding:0;list-style:none}
.how li{padding:12px 14px;border-left:3px solid var(--gold);background:var(--surface)}
.how b{display:block;font-size:.88rem}
.how span{color:var(--muted);font-size:.9rem}

.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;margin:24px -16px 0;padding:12px 16px;background:var(--paper);border-bottom:1px solid var(--line);display:grid;gap:10px}
.progress{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;font-size:.9rem}
.meter{flex:1 1 220px;height:8px;border-radius:99px;background:var(--soft);overflow:hidden;display:flex}
.meter i{display:block;height:100%}
.meter .m-ok{background:var(--ok)}.meter .m-change{background:var(--warn)}
.count{font-variant-numeric:tabular-nums;white-space:nowrap}
.count b{font-weight:700}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:1px}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{min-height:36px;padding:0 14px;border:1px solid var(--line);border-radius:99px;background:var(--surface);color:var(--ink);font:600 .85rem var(--sans);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}
select.chip{padding-right:10px}
.spacer{flex:1}
.status-line{margin:0;font-size:.85rem;color:var(--muted)}
.status-line.error{color:var(--warn)}

.section-head{margin:34px 0 10px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.section-head h2{margin:0;font:600 1.45rem/1.2 var(--serif)}
.section-head span{color:var(--muted);font-size:.9rem}
.group-head{margin:22px 0 8px;font:700 .78rem var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text)}

.item{margin:0 0 12px;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.item[data-status="approved"]{border-left:4px solid var(--ok)}
.item[data-status="change"]{border-left:4px solid var(--warn)}
.item-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;padding:14px 16px 6px}
.item-head h3{margin:0;font:600 1.08rem/1.3 var(--serif)}
.item-head .es-title{color:var(--muted);font:italic 400 .98rem var(--serif)}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{padding:1px 8px;border-radius:99px;background:var(--soft);font-size:.74rem;font-weight:600;color:var(--muted)}
.pill{margin-left:auto;padding:2px 10px;border-radius:99px;font-size:.78rem;font-weight:700;white-space:nowrap}
.pill.pending{background:var(--soft);color:var(--muted)}
.pill.approved{background:var(--ok-bg);color:var(--ok)}
.pill.change{background:var(--warn-bg);color:var(--warn)}
.pill.stale{background:var(--flag-bg);color:var(--flag)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;padding:4px 16px 8px}
.col-h{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding-bottom:4px;border-bottom:1px solid var(--line)}
.field{display:contents}
.f-label{grid-column:1/-1;margin:12px 0 2px;font-size:.74rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text)}
.f-text{margin:0;font:400 1.02rem/1.6 var(--serif);white-space:pre-line}
.f-text.scripture{font-style:italic;color:var(--muted);font-size:.95rem}
.f-text .lang{display:none}
.f-text.missing{color:var(--warn);font:italic .9rem var(--sans)}
.flag{margin:8px 16px 0;padding:10px 12px;border-radius:4px;background:var(--flag-bg);color:var(--flag);font-size:.9rem}
.flag b{font-weight:700}
.suggest{margin:8px 16px 0;padding:10px 12px;border:1px solid var(--line);border-radius:4px;display:grid;gap:6px;font-size:.9rem}
.suggest .from{margin:0;color:var(--muted)}
.suggest .from q{font:italic 400 .98rem var(--serif);color:var(--ink)}
.opt{display:flex;gap:10px;align-items:center;justify-content:space-between;text-align:left;width:100%;min-height:44px;padding:8px 12px;border-radius:6px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:400 .98rem/1.4 var(--serif);cursor:pointer}
.opt::after{content:"Use this";flex:none;font:600 .8rem var(--sans);color:var(--gold-text)}
.opt[aria-pressed="true"]{border-color:var(--warn);background:var(--warn-bg)}
.opt[aria-pressed="true"]::after{content:"Chosen";color:var(--warn)}
.opt:disabled{opacity:.5;cursor:not-allowed}
.decide{display:grid;grid-template-columns:auto auto 1fr;gap:8px 10px;align-items:start;padding:12px 16px 14px;border-top:1px solid var(--line);margin-top:10px}
.btn{min-height:40px;padding:0 16px;border-radius:6px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:600 .92rem var(--sans);cursor:pointer}
.btn[aria-pressed="true"].approve{background:var(--ok);border-color:var(--ok);color:var(--surface)}
.btn[aria-pressed="true"].change{background:var(--warn);border-color:var(--warn);color:var(--surface)}
.btn:disabled{opacity:.5;cursor:not-allowed}
textarea{width:100%;min-height:40px;resize:vertical;padding:9px 11px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);font:400 .95rem/1.4 var(--sans)}
.who{grid-column:1/-1;margin:0;font-size:.8rem;color:var(--muted)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.empty{padding:28px;text-align:center;color:var(--muted)}
@media (max-width:640px){
  .bar{position:static}
  .cols{grid-template-columns:1fr}
  .col-h{display:none}
  .f-text .lang{display:inline;margin-right:6px;font:700 .68rem var(--sans);letter-spacing:.12em;color:var(--muted)}
  .f-text + .f-text{margin-top:6px}
  .decide{grid-template-columns:1fr 1fr}
  .decide textarea{grid-column:1/-1}
  .pill{margin-left:0}
}
@media (prefers-reduced-motion:no-preference){.meter i{transition:width .3s ease}}
</style>

<div class="wrap">
  <header>
    <p class="kicker">Stand · prayers.dougdevitre.org</p>
    <h1>Pastoral review of Stand’s prayers</h1>
    <div class="intro">
      <p>Stand is a free prayer companion for people living with fear, in English and Spanish. Every word it prays with a reader is below: the daily journeys, the “Steady me now” rescue, the blocks the prayer composer draws on, and the traditional prayers.</p>
      <p>Until this review is complete, the app tells every reader: <em id="reviewNote"></em></p>
      <p class="muted">Scripture is checked automatically against the World English Bible and the Reina-Valera 1909, so those lines are shown for context only. The traditional prayers are shared word for word with REMAM’s corpus; a change to one goes to both apps.</p>
    </div>
    <ul class="how">
      <li><b>Approve</b><span>when the text is faithful and fit to pray as written, in both languages.</span></li>
      <li><b>Needs change</b><span>and say what, in the note. Wording suggestions are welcome.</span></li>
      <li><b>Your decisions save as you go</b><span>and anyone reviewing with you sees them live. Come back any time.</span></li>
    </ul>
  </header>

  <div class="bar" id="bar">
    <div class="progress">
      <div class="meter" aria-hidden="true"><i class="m-ok" id="mOk"></i><i class="m-change" id="mChange"></i></div>
      <span class="count"><span class="dot" style="background:var(--ok)"></span><b id="cOk">0</b> approved</span>
      <span class="count"><span class="dot" style="background:var(--warn)"></span><b id="cChange">0</b> need change</span>
      <span class="count"><b id="cPending">0</b> of <b id="cTotal">0</b> to review</span>
    </div>
    <div class="controls">
      <button class="chip" type="button" data-filter="all" aria-pressed="true">All</button>
      <button class="chip" type="button" data-filter="pending" aria-pressed="false">To review</button>
      <button class="chip" type="button" data-filter="change" aria-pressed="false">Needs change</button>
      <button class="chip" type="button" data-filter="approved" aria-pressed="false">Approved</button>
      <button class="chip" type="button" data-filter="flagged" aria-pressed="false">Flagged</button>
      <span class="spacer"></span>
      <label for="jump" class="sr-only" hidden>Jump to section</label>
      <select class="chip" id="jump" aria-label="Jump to section"></select>
      <button class="chip" type="button" id="copySummary">Copy notes</button>
    </div>
    <p class="status-line" id="statusLine" role="status">Connecting…</p>
  </div>

  <main id="list"></main>
  <p class="empty" id="empty" hidden>Nothing matches this filter.</p>
</div>

<script type="application/json" id="data">__DATA__</script>
<script>
(() => {
  const { meta, items } = JSON.parse(document.getElementById("data").textContent);
  const SECTIONS = [
    ["journey", "The 30-day journey", "30 days, each with a reflection, prayer, declaration and practice."],
    ["fear", "Fear tracks", "Five-day tracks for fear of the unknown and fear at night."],
    ["courage", "Courage stories", "Four-day tracks, each built on one biblical account."],
    ["sos", "Steady me now", "The 90-second rescue: a verse, a short spoken prayer, a declaration."],
    ["composer", "Prayer composer", "Every block the composer can combine. A composed prayer is one block per slot."],
    ["traditional", "Traditional prayers", "Shared word for word with REMAM."],
    ["finder", "Fear finder", "The sentences a reader picks from to find where to start."]
  ];
  const $ = id => document.getElementById(id);
  $("reviewNote").textContent = `“${meta.reviewNote.en}”`;
  $("cTotal").textContent = items.length;

  let db = null, user = null, myId = null, canWrite = true, filter = "all";
  const reviews = new Map();         // id -> doc data
  const cards = new Map();           // id -> {el, pill, approve, change, note, who}
  const queues = new Map();          // id -> promise chain (one write at a time)
  const byId = new Map(items.map(i => [i.id, i]));

  // ---- render the content once ----
  const list = $("list");
  const jump = $("jump");
  jump.append(new Option("Jump to section…", ""));
  for (const [key, title, blurb] of SECTIONS) {
    const inSec = items.filter(i => i.section === key);
    if (!inSec.length) continue;
    const sec = document.createElement("section");
    sec.id = "s-" + key;
    sec.dataset.section = key;
    const head = document.createElement("div");
    head.className = "section-head";
    const h2 = document.createElement("h2"); h2.textContent = title;
    const sp = document.createElement("span"); sp.textContent = `${inSec.length} items · ${blurb}`;
    head.append(h2, sp);
    sec.append(head);
    jump.append(new Option(title, "s-" + key));
    let group = null;
    for (const it of inSec) {
      if (it.group !== group) {
        group = it.group;
        const gh = document.createElement("h3");
        gh.className = "group-head";
        gh.textContent = it.groupEs && it.groupEs !== it.group ? `${it.group} · ${it.groupEs}` : it.group;
        gh.dataset.group = group;
        sec.append(gh);
      }
      sec.append(renderItem(it));
    }
    list.append(sec);
  }

  function renderItem(it) {
    const el = document.createElement("article");
    el.className = "item";
    el.id = "i-" + it.id.replace(/[^a-z0-9-]/gi, "-");
    el.dataset.id = it.id;
    const head = document.createElement("div");
    head.className = "item-head";
    const h = document.createElement("h3"); h.textContent = it.label;
    head.append(h);
    if (it.labelEs && it.labelEs !== it.label) { const s = document.createElement("span"); s.className = "es-title"; s.textContent = it.labelEs; head.append(s); }
    if (it.tags && it.tags.length) { const t = document.createElement("span"); t.className = "tags"; for (const x of it.tags) { const b = document.createElement("span"); b.className = "tag"; b.textContent = x; t.append(b); } head.append(t); }
    const pill = document.createElement("span"); pill.className = "pill pending"; pill.textContent = "To review";
    head.append(pill);
    el.append(head);

    const cols = document.createElement("div");
    cols.className = "cols";
    const hEn = document.createElement("div"); hEn.className = "col-h"; hEn.textContent = "English";
    const hEs = document.createElement("div"); hEs.className = "col-h"; hEs.textContent = "Español";
    cols.append(hEn, hEs);
    for (const f of it.fields) {
      const lab = document.createElement("div"); lab.className = "f-label"; lab.textContent = f.scripture ? `${f.label} · checked automatically` : f.label;
      cols.append(lab, text(f.en, "EN", f.scripture), text(f.es, "ES", f.scripture));
    }
    el.append(cols);

    for (const fl of it.flags) {
      const d = document.createElement("div"); d.className = "flag";
      const b = document.createElement("b"); b.textContent = "Question for the reviewer: ";
      d.append(b, document.createTextNode(fl.text + (it.suggestions ? " Approve to keep it as written, or choose a wording below." : " Keep it, or suggest a form that reads for any reader?")));
      el.append(d);
    }
    const opts = [];
    for (const sg of it.suggestions || []) {
      const box = document.createElement("div"); box.className = "suggest"; box.lang = sg.lang;
      const from = document.createElement("p"); from.className = "from"; from.lang = "en";
      const q = document.createElement("q"); q.lang = sg.lang; q.textContent = sg.from;
      from.append(document.createTextNode("Instead of "), q, document.createTextNode(":"));
      box.append(from);
      for (const o of sg.options) {
        const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = o;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => choose(it, sg.from, o));
        b.dataset.line = changeLine(sg.from, o);
        box.append(b); opts.push(b);
      }
      el.append(box);
    }

    const decide = document.createElement("div");
    decide.className = "decide";
    const approve = button("Approve", "approve");
    const change = button("Needs change", "change");
    const note = document.createElement("textarea");
    note.id = "n-" + el.id;
    note.placeholder = "Note (what to change, or anything else)";
    note.setAttribute("aria-label", `Note for ${it.label}`);
    const who = document.createElement("p"); who.className = "who"; who.hidden = true;
    decide.append(approve, change, note, who);
    el.append(decide);

    approve.addEventListener("click", () => decideStatus(it, "approved"));
    change.addEventListener("click", () => decideStatus(it, "change"));
    let t = null;
    note.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => saveNote(it), 900); });
    note.addEventListener("blur", () => { clearTimeout(t); saveNote(it); });
    cards.set(it.id, { el, pill, approve, change, note, who, opts });
    return el;
  }
  function text(s, lang, scripture) {
    const p = document.createElement("p");
    p.className = "f-text" + (scripture ? " scripture" : "") + (s ? "" : " missing");
    const l = document.createElement("span"); l.className = "lang"; l.textContent = lang;
    p.append(l, document.createTextNode(s || "Missing in this language."));
    if (lang === "ES") p.lang = "es";
    return p;
  }
  function button(label, cls) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.setAttribute("aria-pressed", "false");
    return b;
  }

  // ---- state ----
  function statusOf(it) {
    const r = reviews.get(it.id);
    if (!r || !r.status) return "pending";
    if (r.hash !== it.hash) return "stale";
    return r.status;
  }
  const PILL = { pending: "To review", approved: "Approved", change: "Needs change", stale: "Text changed since review" };
  async function paint(ids) {
    const people = [...new Set([...reviews.values()].map(r => r.by).filter(Boolean))];
    const ps = user && people.length ? await user.profiles(people) : {};
    for (const id of ids) {
      const it = byId.get(id), c = cards.get(id); if (!it || !c) continue;
      const st = statusOf(it), r = reviews.get(id) || {};
      c.el.dataset.status = st === "stale" ? "pending" : st;
      c.pill.className = "pill " + st; c.pill.textContent = PILL[st];
      c.approve.setAttribute("aria-pressed", String(st === "approved"));
      c.change.setAttribute("aria-pressed", String(st === "change"));
      if (document.activeElement !== c.note) c.note.value = r.note || "";
      const lines = (r.note || "").split("\n");
      for (const b of c.opts) b.setAttribute("aria-pressed", String(st === "change" && lines.includes(b.dataset.line)));
      if (r.by && r.at) {
        const name = ps[r.by] ? (ps[r.by].isMe ? "you" : ps[r.by].name || "a reviewer") : "a reviewer";
        c.who.textContent = `${PILL[r.status] || "Note"} by ${name}, ${new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        c.who.hidden = false;
      } else c.who.hidden = true;
    }
    counts(); applyFilter();
  }
  function counts() {
    let ok = 0, ch = 0;
    for (const it of items) { const s = statusOf(it); if (s === "approved") ok++; else if (s === "change") ch++; }
    const pend = items.length - ok - ch;
    $("cOk").textContent = ok; $("cChange").textContent = ch; $("cPending").textContent = pend;
    $("mOk").style.width = (ok / items.length * 100) + "%";
    $("mChange").style.width = (ch / items.length * 100) + "%";
  }
  function applyFilter() {
    let shown = 0;
    for (const it of items) {
      const s = statusOf(it);
      const vis = filter === "all" || (filter === "pending" && (s === "pending" || s === "stale")) || filter === s || (filter === "flagged" && it.flags.length);
      cards.get(it.id).el.hidden = !vis;
      if (vis) shown++;
    }
    for (const sec of list.children) {
      const any = [...sec.querySelectorAll(".item")].some(x => !x.hidden);
      sec.hidden = !any;
      for (const gh of sec.querySelectorAll(".group-head")) {
        let n = gh.nextElementSibling, v = false;
        while (n && n.classList.contains("item")) { if (!n.hidden) v = true; n = n.nextElementSibling; }
        gh.hidden = !v;
      }
    }
    $("empty").hidden = shown > 0;
  }
  for (const b of document.querySelectorAll("[data-filter]")) {
    b.addEventListener("click", () => {
      filter = b.dataset.filter;
      for (const x of document.querySelectorAll("[data-filter]")) x.setAttribute("aria-pressed", String(x === b));
      applyFilter();
    });
  }
  jump.addEventListener("change", () => {
    const t = document.getElementById(jump.value); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    jump.value = "";
  });

  // ---- writes: one at a time per item ----
  function status(msg, error) { const s = $("statusLine"); s.textContent = msg; s.classList.toggle("error", !!error); }
  function write(it, body) {
    if (!db || !canWrite) return;
    const prev = queues.get(it.id) || Promise.resolve();
    const next = prev.then(async () => {
      const ref = db.doc("reviews/" + it.id);
      try {
        if (!body.status && !body.note) await ref.delete(); else await ref.set(body);
        status("Saved.");
      } catch (e) {
        if (e && e.code === "invalid_argument") { canWrite = false; lock("You can read this workbook but not record decisions. Ask the owner for Editor access."); }
        else status("That decision didn't save. Check your connection and try again.", true);
      }
    });
    queues.set(it.id, next);
  }
  function current(it) { return reviews.get(it.id) || {}; }
  function decideStatus(it, s) {
    const r = current(it), c = cards.get(it.id);
    const on = statusOf(it) === s;
    const body = { status: on ? null : s, note: c.note.value.trim(), hash: it.hash, by: myId, at: new Date().toISOString() };
    reviews.set(it.id, body); paint([it.id]); write(it, body);
    void r;
  }
  function saveNote(it) {
    const c = cards.get(it.id), r = current(it), note = c.note.value.trim();
    if ((r.note || "") === note) return;
    const body = { status: r.status && r.hash === it.hash ? r.status : null, note, hash: it.hash, by: myId, at: new Date().toISOString() };
    reviews.set(it.id, body); paint([it.id]); write(it, body);
  }
  // Choosing a wording marks the item Needs change and records the swap as one
  // line of the note; choosing again for the same sentence replaces that line,
  // and choosing the chosen one again takes it back out.
  function changeLine(from, to) { return `Change “${from}” → “${to}”`; }
  function choose(it, from, to) {
    const c = cards.get(it.id), line = changeLine(from, to), prefix = `Change “${from}” → `;
    const had = c.note.value.split("\n").includes(line);
    const lines = c.note.value.split("\n").filter(l => l.trim() && !l.startsWith(prefix));
    if (!had) lines.push(line);
    c.note.value = lines.join("\n");
    const note = c.note.value.trim();
    const r = current(it), was = r.status && r.hash === it.hash ? r.status : null;
    const status = !had ? "change" : was === "change" && !note ? null : was;
    const body = { status, note, hash: it.hash, by: myId, at: new Date().toISOString() };
    reviews.set(it.id, body); paint([it.id]); write(it, body);
  }
  function lock(msg) {
    for (const c of cards.values()) { c.approve.disabled = true; c.change.disabled = true; c.note.disabled = true; for (const b of c.opts) b.disabled = true; }
    status(msg, true);
  }

  // ---- copy the notes for the author ----
  $("copySummary").addEventListener("click", async () => {
    const lines = [];
    for (const it of items) {
      const s = statusOf(it), r = reviews.get(it.id);
      if (s === "change" || (r && r.note)) lines.push(`${PILL[s]} · ${it.group} · ${it.label} [${it.id}]${r && r.note ? "\n  " + r.note : ""}`);
    }
    const text = lines.length ? lines.join("\n") : "No notes or requested changes yet.";
    try { await navigator.clipboard.writeText(text); status(`Copied ${lines.length} item${lines.length === 1 ? "" : "s"}.`); }
    catch { status("Copy isn't available here. Use the Needs change filter to see them.", true); }
  });

  // ---- connect ----
  paint(items.map(i => i.id));
  (async () => {
    const cl = window.claude;
    db = cl && cl.use ? await cl.use("db") : null;
    user = cl && cl.use ? await cl.use("user") : null;
    if (!db) { lock("Decisions can't be saved in this view. Open the workbook on claude.ai while signed in."); return; }
    if (user) {
      myId = await user.id();
      const w = await user.can("data.write");
      if (w === false) { canWrite = false; lock("You can read this workbook but not record decisions. Ask the owner for Editor access."); }
    }
    let first = true;
    db.collection("reviews").onSnapshot(snap => {
      const changed = [];
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === "removed") reviews.delete(id); else reviews.set(id, ch.doc.data());
        changed.push(id);
      }
      paint(first ? items.map(i => i.id) : changed);
      if (first && canWrite) status(`Built from the live content on ${meta.built}. Decisions save automatically.`);
      first = false;
    }, () => { status("Live updates stopped. Reload the page to reconnect.", true); });
  })();
})();
</script>
