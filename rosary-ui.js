// The guided Rosary's interface: stepping through it, praying it along
// hands-free, keeping the screen on, and sharing a set. It loads on demand
// with rosary.js (loadRosary() in app.js), after app.js, whose globals it
// uses: nothing here runs until the Prayer Book is opened or a ?rosary= link
// arrives, so a first visit does not pay for it. sw.js precaches it for
// offline use.

/* ---------- The Rosary ----------
   A guided Rosary inside the Prayer Book: one step at a time, in the order
   rosary.js gives (rosarySteps), with a bead counter for the Hail Marys.
   Today's mysteries are the default (setForDate); any set can be chosen.
   Every prayer but the mysteries and the Fatima Prayer is the Prayer Book's
   own, so a step shows and plays exactly what the Prayer Book does. Where a
   reader is is saved (state.rosary), so closing the app mid-decade and coming
   back resumes there, for twelve hours; after that it starts fresh. */

const ROSARY_RESUME_MS = 12 * 60 * 60 * 1000;
const rosaryRun = { set: null, fatima: true, steps: [], index: 0, bead: 0, done: false };
const rosaryLang = () => (state.lang === "es" ? "es" : "en");

/** The saved Rosary, if there is one still worth resuming. */
function savedRosary() {
  const r = state.rosary;
  if (!r || !setById(r.set) || !Number.isFinite(r.started) || Date.now() - r.started > ROSARY_RESUME_MS) return null;
  return r;
}

// The Prayer Book list's Rosary entry: today's mysteries, or where the reader
// left off. (This file arrives on the Prayer Book's first opening; a failed
// load leaves the entry as its title alone.)
function renderRosaryEntry() {
  const lang = rosaryLang();
  const saved = savedRosary();
  if (saved) {
    const total = rosarySteps(saved.set, { fatima: saved.fatima !== false }).length;
    $("rosaryEntryMeta").textContent = t("rosary.entryContinue", { set: setById(saved.set).name[lang], n: Math.min(saved.step + 1, total), total });
  } else {
    $("rosaryEntryMeta").textContent = t("rosary.entryToday", { set: setForDate(new Date()).name[lang] });
  }
}

function saveRosary() {
  if (rosaryRun.done) state.rosary = null;
  else {
    const started = state.rosary && state.rosary.set === rosaryRun.set && Number.isFinite(state.rosary.started) ? state.rosary.started : Date.now();
    state.rosary = { set: rosaryRun.set, step: rosaryRun.index, bead: rosaryRun.bead, fatima: rosaryRun.fatima, started };
  }
  save();
}

function startRosary(setId) {
  Object.assign(rosaryRun, { set: setId, fatima: state.rosaryFatima !== false, index: 0, bead: 0, done: false });
  rosaryRun.steps = rosarySteps(setId, { fatima: rosaryRun.fatima });
  state.rosary = null;
  saveRosary();
}

/** Open the Rosary in the Prayer Book: where the reader left off, or a set. */
async function openRosary(setId) {
  await loadRosary();
  if (typeof rosarySteps === "undefined") return; // offline before it was ever saved
  const saved = savedRosary();
  if (setId && setById(setId) && !(saved && saved.set === setId)) startRosary(setId);
  else if (saved) {
    Object.assign(rosaryRun, { set: saved.set, fatima: saved.fatima !== false, done: false });
    rosaryRun.steps = rosarySteps(saved.set, { fatima: rosaryRun.fatima });
    rosaryRun.index = Math.min(Math.max(0, saved.step | 0), rosaryRun.steps.length - 1);
    const step = rosaryRun.steps[rosaryRun.index];
    rosaryRun.bead = step.count ? Math.min(Math.max(0, saved.bead | 0), step.count - 1) : 0;
  } else startRosary(setForDate(new Date()).id);
  stopPrayerNarration();
  book.open = null;
  $("bookList").hidden = true;
  $("bookReader").hidden = true;
  $("rosaryView").hidden = false;
  if (!$("bookDialog").open) $("bookDialog").showModal();
  renderRosary();
  syncWakeLock();
  $("bookDialog").scrollTop = 0;
  focusView($("rosaryHeading"));
}

function renderRosary() {
  const lang = rosaryLang();
  const set = setById(rosaryRun.set);
  $("rosaryHeading").textContent = set.name[lang];
  const today = setForDate(new Date()).id;
  const select = $("rosarySet");
  select.textContent = "";
  for (const s of rosary.sets) {
    select.append(new Option(s.id === today ? t("rosary.today", { set: s.name[lang] }) : s.name[lang], s.id, false, s.id === set.id));
  }
  $("rosaryFatima").checked = rosaryRun.fatima;
  $("rosaryBoth").checked = state.bilingual;

  const done = rosaryRun.done;
  $("rosaryDone").hidden = !done;
  for (const id of ["rosaryStep", "rosaryProgress", "rosaryDecades"]) $(id).hidden = done;
  $("rosaryPrev").closest(".rosary-actions").hidden = done;
  if (done) { $("rosaryAgain").focus(); return; }

  const steps = rosaryRun.steps;
  const step = steps[rosaryRun.index];
  $("rosaryProgress").textContent = t("rosary.progress", { n: rosaryRun.index + 1, total: steps.length });

  // Five marks for the decades: done, current, still to come.
  const current = step.decade || (rosaryRun.index < 5 ? 0 : 6);
  const decades = $("rosaryDecades");
  decades.textContent = "";
  for (let d = 1; d <= 5; d++) {
    const mark = document.createElement("span");
    mark.className = `rosary-decade${d < current ? " done" : d === current ? " current" : ""}`;
    decades.append(mark);
  }

  let kicker, title, text = "", verse = "", note = "", other = "";
  const o = otherLang();
  const where = step.decade ? t("rosary.decade", { n: step.decade }) : t(rosaryRun.index < 5 ? "rosary.opening" : "rosary.closing");
  if (step.kind === "mystery") {
    const m = set.mysteries[step.decade - 1];
    const ordinal = t("rosary.ordinals").split("|")[step.decade - 1];
    kicker = where;
    title = t("rosary.mysteryHeading", { ordinal, adjective: set.adjective[lang] });
    text = m.name[lang];
    verse = `“${m.verse[lang]}” (${mysteryRef(m, lang)})`;
    note = m.note ? m.note[lang] : "";
    other = `${m.name[o]}. “${m.verse[o]}” (${mysteryRef(m, o)})`;
  } else if (step.kind === "fatima") {
    kicker = where;
    title = rosary.fatima.name[lang];
    text = rosary.fatima.text[lang];
    other = rosary.fatima.text[o];
  } else {
    const item = prayerBook.byId(step.prayer);
    kicker = step.label === "virtues" ? `${where} · ${rosary.virtues[lang]}` : where;
    title = item.name[lang];
    text = item.text[lang].trim();
    other = item.text[o].trim();
  }
  $("rosaryStepKicker").textContent = kicker;
  $("rosaryStepTitle").textContent = title;
  $("rosaryStepText").textContent = text;
  $("rosaryStepText").classList.toggle("rosary-mystery-name", step.kind === "mystery");
  $("rosaryStepVerse").hidden = !verse;
  $("rosaryStepVerse").textContent = verse;
  $("rosaryStepNote").hidden = !note;
  $("rosaryStepNote").textContent = note;
  // "Show both languages" applies here as in the reader: the other language
  // beneath, marked as such.
  $("rosaryStepOther").hidden = !state.bilingual;
  $("rosaryStepOther").lang = o;
  $("rosaryStepOther").textContent = state.bilingual ? other : "";

  // The bead counter: one bead per Hail Mary of this step, filled as they
  // are prayed, and a count a screen reader announces.
  const beads = $("rosaryBeads");
  beads.hidden = !step.count;
  beads.textContent = "";
  $("rosaryCount").textContent = "";
  if (step.count) {
    for (let b = 0; b < step.count; b++) {
      const bead = document.createElement("span");
      bead.className = `rosary-bead${b < rosaryRun.bead ? " done" : b === rosaryRun.bead ? " current" : ""}`;
      beads.append(bead);
    }
    $("rosaryCount").textContent = t("rosary.bead", { prayer: title, n: rosaryRun.bead + 1, total: step.count });
  }

  const last = rosaryRun.index === steps.length - 1;
  const moreBeads = step.count && rosaryRun.bead < step.count - 1;
  $("rosaryNext").textContent = t(moreBeads ? "rosary.nextBead" : last ? "rosary.finish" : "rosary.next");
  $("rosaryPrev").disabled = rosaryRun.index === 0 && rosaryRun.bead === 0;
  updatePrayerButton($("rosaryListen"), false);
  paintAlong();
}

function rosaryNext() {
  stopPrayerNarration();
  const step = rosaryRun.steps[rosaryRun.index];
  if (step.count && rosaryRun.bead < step.count - 1) rosaryRun.bead++;
  else if (rosaryRun.index < rosaryRun.steps.length - 1) { rosaryRun.index++; rosaryRun.bead = 0; }
  else rosaryRun.done = true;
  saveRosary();
  renderRosary();
}

function rosaryPrev() {
  stopPrayerNarration();
  if (rosaryRun.bead > 0) rosaryRun.bead--;
  else if (rosaryRun.index > 0) {
    rosaryRun.index--;
    const step = rosaryRun.steps[rosaryRun.index];
    rosaryRun.bead = step.count ? step.count - 1 : 0;
  }
  saveRosary();
  renderRosary();
}

// Turning the Fatima Prayer on or off keeps the reader's place: the position
// is counted in steps that are not the Fatima Prayer, which both lists share.
function setRosaryFatima(on) {
  state.rosaryFatima = on;
  const before = rosaryRun.steps.slice(0, rosaryRun.index).filter(s => s.kind !== "fatima").length;
  rosaryRun.fatima = on;
  rosaryRun.steps = rosarySteps(rosaryRun.set, { fatima: on });
  let seen = 0;
  rosaryRun.index = rosaryRun.steps.findIndex(s => s.kind !== "fatima" && seen++ === before);
  if (rosaryRun.index < 0) rosaryRun.index = rosaryRun.steps.length - 1;
  const step = rosaryRun.steps[rosaryRun.index];
  if (!step.count) rosaryRun.bead = 0;
  saveRosary();
  renderRosary();
}

// Next and Back while praying along move the place and carry on from there.
function rosaryMove(move) {
  const again = along.on;
  stopAlong();
  move();
  if (again && !rosaryRun.done) startAlong();
}

$("rosaryBack").onclick = () => { stopAlong(); stopPrayerNarration(); showBookList(); };
$("rosaryNext").onclick = () => rosaryMove(rosaryNext);
$("rosaryPrev").onclick = () => rosaryMove(rosaryPrev);
$("rosarySet").onchange = () => { stopAlong(); stopPrayerNarration(); startRosary($("rosarySet").value); renderRosary(); };
$("rosaryFatima").onchange = () => setRosaryFatima($("rosaryFatima").checked);
$("rosaryBoth").onchange = () => {
  state.bilingual = $("rosaryBoth").checked;
  save();
  renderRosary();
};
$("rosaryAgain").onclick = () => { startRosary(rosaryRun.set); renderRosary(); $("rosaryNext").focus(); };
$("rosaryToBook").onclick = showBookList;
$("rosaryAlong").onclick = () => (along.on ? stopAlong() : startAlong());

// ← and → move a bead or a step, for a keyboard or a switch, whatever has
// focus in the Rosary (except its own menu and checkbox).
$("bookDialog").addEventListener("keydown", event => {
  if ($("rosaryView").hidden || rosaryRun.done || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest("input, select, textarea")) return;
  if (event.key === "ArrowRight") { event.preventDefault(); $("rosaryNext").click(); }
  else if (event.key === "ArrowLeft") { event.preventDefault(); if (!$("rosaryPrev").disabled) $("rosaryPrev").click(); }
});

/* ---------- Praying the Rosary along ----------
   Each step is read aloud in turn, as Listen reads it, and when it ends the
   Rosary moves on by itself: bead by bead through the Hail Marys, with a
   longer pause after each mystery to dwell on it. A stop from anywhere (the
   button, Listen, other audio, closing the book) ends it; Next and Back carry
   on from the new place. */
const along = { on: false, timer: 0 };
const alongPause = { step: 800, mystery: 5000 };

function paintAlong() {
  const button = $("rosaryAlong");
  button.textContent = t(along.on ? "rosary.alongStop" : "rosary.along");
  button.setAttribute("aria-pressed", String(along.on));
}

function startAlong() {
  if (rosaryRun.done || along.on) return;
  along.on = true;
  paintAlong();
  alongPlay();
}

function stopAlong() {
  if (!along.on) return;
  along.on = false;
  clearTimeout(along.timer);
  stopPrayerNarration();
  paintAlong();
}

function alongPlay() {
  playRosaryStep(finished => {
    if (!along.on) return;
    if (!finished) { stopAlong(); return; }
    const step = rosaryRun.steps[rosaryRun.index];
    along.timer = setTimeout(() => {
      if (!along.on) return;
      rosaryNext();
      if (rosaryRun.done) { stopAlong(); return; }
      alongPlay();
    }, step.kind === "mystery" ? alongPause.mystery : alongPause.step);
  });
}

/* ---------- Keeping the screen on ----------
   A Rosary takes twenty minutes, prayed a bead at a time with the phone in
   hand or set down beside you; the screen stays on while it is open, and the
   lock is let go when it closes or the page is hidden (the browser drops it
   then anyway, and it is taken again on return). Where the Screen Wake Lock
   API is missing or refused, the screen behaves as it always has. */
const wake = { lock: null, asking: false };
async function syncWakeLock() {
  const want = () => $("bookDialog").open && !$("rosaryView").hidden && document.visibilityState === "visible";
  if (want() && !wake.lock && !wake.asking && navigator.wakeLock) {
    wake.asking = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { if (wake.lock === lock) wake.lock = null; });
      wake.lock = lock;
    } catch { /* refused (battery saver, no permission): nothing to hold */ }
    wake.asking = false;
  }
  if (!want() && wake.lock) {
    const lock = wake.lock;
    wake.lock = null;
    lock.release().catch(() => {});
  }
}
document.addEventListener("visibilitychange", syncWakeLock);
$("bookDialog").addEventListener("close", () => { stopAlong(); syncWakeLock(); });

// Listen to the step open now: a Prayer Book prayer plays its recording (or
// the device voice, as in the reader); the mystery and the Fatima Prayer are
// read by the device voice until they are recorded.
$("rosaryListen").onclick = () => {
  if (along.on) { stopAlong(); return; }
  if (prayerAudio.playing) { stopPrayerNarration(); return; }
  playRosaryStep(null);
};

// Reads the step open now aloud. onEnd, if given, hears how it ended (see
// prayerAudio). With no device voice, a step with no recording is given the
// time it takes to pray it silently, so praying along still moves on.
function playRosaryStep(onEnd) {
  const button = $("rosaryListen");
  const lang = rosaryLang();
  const step = rosaryRun.steps[rosaryRun.index];
  const speak = segments => {
    if (canSpeak) {
      speakPrayer(segments, button, $("rosaryStepTitle").textContent);
      prayerAudio.onEnd = onEnd;
    } else if (onEnd) {
      const words = segments.map(s => s.text).join(" ").split(/\s+/).length;
      along.timer = setTimeout(() => onEnd(true), Math.max(2500, words * 400));
    }
  };
  if (step.kind === "prayer") {
    const item = prayerBook.byId(step.prayer);
    const segments = narrationSegments(item.text[lang], item.audio, lang);
    const src = recordedUrl(prayerItemId(lang, item.id));
    if (src) {
      playPrayerRecording(src, button, () => speak(segments), item.name[lang]);
      prayerAudio.onEnd = onEnd;
    } else speak(segments);
  } else {
    // The mysteries and the Fatima Prayer have their own recordings
    // (narration.js, rosaryItemId); the device voice reads them until then.
    const mystery = step.kind === "mystery" ? setById(rosaryRun.set).mysteries[step.decade - 1] : null;
    const parts = [$("rosaryStepTitle").textContent, $("rosaryStepText").textContent];
    if (mystery) parts.push(mystery.verse[lang]);
    const segments = parts.map(text => ({ text, pause: 0.6 }));
    const src = recordedUrl(rosaryItemId(lang, mystery ? mystery.id : "fatima"));
    if (src) {
      playPrayerRecording(src, button, () => speak(segments), $("rosaryStepTitle").textContent);
      prayerAudio.onEnd = onEnd;
    } else speak(segments);
  }
}

// A set of the Rosary's mysteries: its page on the site and its card, which
// numbers the five mysteries (drawn on the device when offline). rosary.js is loaded by then.
function rosaryShare(setId) {
  const lang = rosaryLang();
  const set = setById(setId);
  return {
    kind: "rosary", url: location.origin + rosaryPagePath(lang, setId), heading: `${set.name[lang]} — Stand`,
    caption: set.mysteries.map(m => m.name[lang]).join(" · "),
    cardUrl: `/cards/${lang}/rosary/${set.slug[lang]}.latest.post.png`, cardName: `stand-${lang === "es" ? "rosario" : "rosary"}-${set.slug[lang]}.png`, fallbackCard: () => drawCard(spaced(t("rosary.kicker")), set.mysteries.map((m, i) => `${i + 1}. ${m.name[lang]}`), set.name[lang], { italic: false, size: 48 })
  };
}

$("rosaryShare").addEventListener("pointerdown", () => { if (rosaryRun.set) fetchShareCard(rosaryShare(rosaryRun.set).cardUrl); });
$("rosaryShare").onclick = () => { if (rosaryRun.set) shareItem(rosaryShare(rosaryRun.set)); };
