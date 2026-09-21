const STORAGE_KEY = "stand-state";
const $ = id => document.getElementById(id);
const canSpeak = "speechSynthesis" in window;

/* ---------- Tracks ---------- */

// Devotional content in the reader's language. Spanish lives in content.es.js
// as a parallel structure with the same day indices, so switching language
// swaps the words without touching progress, favourites or notes — those are
// keyed by track and day number, not by text.
function localizedTrack(id) {
  const base = tracks[id] || tracks.core;
  if (state.lang !== "es" || typeof esTracks === "undefined") return base;
  const es = esTracks[id];
  if (!es || !Array.isArray(es.days) || es.days.length !== base.days.length) return base;
  return { ...base, name: es.name, short: es.short, weeks: es.weeks, days: es.days,
           group: (typeof esGroups !== "undefined" && esGroups[base.group]) || base.group };
}
const localizedTracks = () => Object.keys(tracks).map(localizedTrack);
const activeTrack = () => localizedTrack(state.track);
const DAYS = () => activeTrack().days.length;

// The core track keeps its data in the legacy top-level state fields so
// existing users lose nothing; other tracks live under state.tracks[id].
function tdata() {
  const id = state.track || "core";
  if (id === "core" || !tracks[id]) return state;
  if (!state.tracks[id]) state.tracks[id] = { completed: [], favorites: [], notes: {}, completedDates: {} };
  return state.tracks[id];
}

/* ---------- Persistent state ---------- */

function loadState() {
  const fallback = { completed: [], favorites: [], notes: {}, completedDates: {}, checkins: [], sos: [], track: "core", tracks: {}, theme: null, lang: "en", bilingual: false, welcomed: false, installHintDismissed: false };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== "object") return fallback;
    // Migrate the pre-1.1 "dark" boolean: an explicit dark choice is kept,
    // otherwise the theme follows the device setting until the user toggles.
    if (raw.theme === undefined) raw.theme = raw.dark ? "dark" : null;
    return { ...fallback, ...raw };
  } catch {
    return fallback;
  }
}

const state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Theme ---------- */

const systemDark = matchMedia("(prefers-color-scheme: dark)");
const prefersDark = () => (state.theme ? state.theme === "dark" : systemDark.matches);

function applyTheme() {
  document.documentElement.classList.toggle("dark", prefersDark());
}

systemDark.addEventListener("change", applyTheme);
$("themeButton").onclick = () => {
  state.theme = prefersDark() ? "light" : "dark";
  save();
  applyTheme();
};

/* ---------- Progress & streak ---------- */

function currentStreak() {
  return streakFrom(completedDatesOf(state), new Date());
}

/* ---------- Current day ---------- */

function dayFromHash() {
  const n = Number(location.hash.slice(1));
  return Number.isInteger(n) && n >= 1 && n <= DAYS() ? n - 1 : null;
}

function firstIncompleteDay() {
  for (let i = 0; i < DAYS(); i++) if (!tdata().completed.includes(i)) return i;
  return DAYS() - 1;
}

// A ?track= link (from a track's static page or a share) switches journeys on load.
{
  const requested = new URLSearchParams(location.search).get("track");
  if (requested && tracks[requested] && (state.track || "core") !== requested) {
    state.track = requested;
    save();
  }
}

let day = dayFromHash() ?? firstIncompleteDay();

function go(n) {
  day = Math.max(0, Math.min(DAYS() - 1, n));
  location.hash = String(day + 1);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Narration ---------- */

function fullScript(d) {
  const x = activeTrack().days[d];
  return `Day ${d + 1}. ${x[0]}. Scripture, ${x[1]}. ${x[2]} Pause and breathe in slowly. Breathe out. Let your shoulders soften. Reflection. ${x[3]} Prayer. ${x[4]} Amen. Declaration. ${x[5]} Today's practice. ${x[6]} Closing blessing. May truth steady your mind, peace guard your heart, courage guide your next step, and grace carry what you cannot. Go in peace.`;
}

const player = { status: "idle", keepAlive: 0, repeat: false, sleepTimer: 0, mode: "tts" };
// Composer narration state; declared here because stopAudio() runs on first render.
const prayerAudio = { timer: 0, playing: false };
let narrationVoice = null;

// Recorded narration (preferred when a file exists for the day).
const audioEl = new Audio();
audioEl.preload = "none";

const recordedFor = d => recordedAudio.days[`${state.track || "core"}-${d}`] || null;

audioEl.addEventListener("timeupdate", () => {
  if (player.mode === "rec" && audioEl.duration) {
    $("audioProgress").style.width = `${Math.min(100, (audioEl.currentTime / audioEl.duration) * 100)}%`;
  }
});

audioEl.addEventListener("ended", () => {
  if (player.repeat && player.status === "playing") {
    audioEl.currentTime = 0;
    audioEl.play().catch(stopAudio);
  } else {
    stopAudio();
  }
});

function setMediaSession(title) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "Stand",
      artwork: [{ src: "icon-512.png", sizes: "512x512", type: "image/png" }]
    });
    navigator.mediaSession.setActionHandler("play", () => $("playButton").click());
    navigator.mediaSession.setActionHandler("pause", () => $("playButton").click());
  } catch { /* older browsers */ }
}

function playRecorded(src) {
  player.mode = "rec";
  audioEl.src = src;
  audioEl.playbackRate = Number($("voiceRate").value);
  audioEl.currentTime = 0;
  audioEl.play().then(() => {
    setPlayerStatus("playing");
    setMediaSession(document.title);
  }).catch(() => {
    // File missing or blocked — fall back to device narration.
    player.mode = "tts";
    speakDay();
  });
  setPlayerStatus("playing");
}

function pickVoice() {
  const english = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  if (!english.length) return null;
  const preferred = ["Samantha", "Daniel", "Karen", "Moira", "Google US English", "Google UK English Female", "Aria", "Sonia"];
  for (const name of preferred) {
    const match = english.find(v => v.name.includes(name));
    if (match) return match;
  }
  return english.find(v => v.localService) || english[0];
}

if (canSpeak) {
  narrationVoice = pickVoice();
  speechSynthesis.addEventListener("voiceschanged", () => { narrationVoice = pickVoice(); });
}

function setPlayerStatus(status) {
  player.status = status;
  $("playIcon").textContent = status === "playing" ? "❚❚" : "▶";
  $("playButton").setAttribute("aria-label",
    status === "playing" ? "Pause daily prayer"
    : status === "paused" ? "Resume daily prayer"
    : "Play daily prayer");
  if (status === "idle") $("audioProgress").style.width = "0";
}

function stopAudio() {
  clearInterval(player.keepAlive);
  clearTimeout(player.sleepTimer);
  // The composer shares this one speech synthesiser, so day narration always
  // takes it back cleanly.
  stopPrayerNarration();
  // Go idle before cancel(): cancel can fire onend synchronously, and repeat
  // mode must not treat that as a natural end and restart.
  setPlayerStatus("idle");
  audioEl.pause();
  if (canSpeak) speechSynthesis.cancel();
}

function speakDay() {
  player.mode = "tts";
  const script = fullScript(day);
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = Number($("voiceRate").value);
  utterance.pitch = 0.96;
  if (narrationVoice) utterance.voice = narrationVoice;
  // Repeat mode re-speaks the same day until the sleep timer or the user stops it.
  utterance.onend = () => { player.repeat && player.status === "playing" ? speakDay() : stopAudio(); };
  utterance.onerror = stopAudio;
  utterance.onboundary = e => {
    $("audioProgress").style.width = `${Math.min(100, (e.charIndex / script.length) * 100)}%`;
  };
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  setPlayerStatus("playing");
  // Chromium silently stops utterances longer than ~15 seconds unless nudged.
  clearInterval(player.keepAlive);
  player.keepAlive = setInterval(() => {
    if (player.status === "playing" && speechSynthesis.speaking) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);
}

function armSleepTimer() {
  clearTimeout(player.sleepTimer);
  const minutes = Number($("sleepTimer").value);
  if (minutes > 0) {
    player.sleepTimer = setTimeout(() => {
      stopAudio();
      $("sleepTimer").value = "0";
    }, minutes * 60000);
  }
}

function startAudio() {
  const src = recordedFor(day);
  if (src) playRecorded(src);
  else speakDay();
  armSleepTimer();
}

$("playButton").onclick = () => {
  if (!canSpeak && !recordedFor(day)) {
    $("audioTime").textContent = "Audio is not supported on this device";
    return;
  }
  if (player.status === "playing") {
    player.mode === "rec" ? audioEl.pause() : speechSynthesis.pause();
    setPlayerStatus("paused");
  } else if (player.status === "paused") {
    player.mode === "rec" ? audioEl.play().catch(stopAudio) : speechSynthesis.resume();
    setPlayerStatus("playing");
  } else {
    startAudio();
  }
};

$("voiceRate").onchange = () => {
  if (player.mode === "rec" && player.status !== "idle") {
    audioEl.playbackRate = Number($("voiceRate").value);
  } else if (player.status !== "idle") {
    startAudio();
  }
};

$("repeatButton").onclick = () => {
  player.repeat = !player.repeat;
  $("repeatButton").classList.toggle("active", player.repeat);
  $("repeatButton").setAttribute("aria-pressed", String(player.repeat));
};

$("sleepTimer").onchange = () => {
  if (player.status !== "idle") armSleepTimer();
};

/* ---------- SOS mode ---------- */

// Verses reuse the day excerpts already in `themes`, keeping one translation surface.
const sosSets = [
  { ref: "Psalm 27:1", verse: "The LORD is my light and my salvation. Whom shall I fear?",
    prayer: "Lord, bring me back to this moment. Slow my heart, steady my breath, and stand with me here. I hand You what I cannot control.",
    declaration: "Fear may speak, but it does not get the final word." },
  { ref: "Joshua 1:9", verse: "Be strong and courageous. Don’t be afraid. Don’t be dismayed, for the LORD your God is with you wherever you go.",
    prayer: "God, give me courage for the next few minutes—nothing more is asked of me right now. Be near, and steady my steps.",
    declaration: "I can be afraid and still be faithful." },
  { ref: "Matthew 6:34", verse: "Don’t be anxious for tomorrow, for tomorrow will be anxious for itself.",
    prayer: "Father, I release the futures my fear keeps writing. Keep me in today, in this breath, in Your hands.",
    declaration: "I am responsible for faithfulness, not control of every outcome." },
  { ref: "Psalm 42:11", verse: "Hope in God! For I shall still praise him.",
    prayer: "God, when my feelings shout in absolutes, remind me this moment is not the whole story. Give me hope enough for one step.",
    declaration: "I do not need all the hope—only enough for the next step." }
];

const sos = { set: sosSets[0], before: null, recorded: false, timers: [] };

function sosClearTimers() {
  sos.timers.forEach(clearTimeout);
  sos.timers = [];
}

function sosRecord(after) {
  if (sos.recorded) return;
  sos.recorded = true;
  state.sos.push({ t: new Date().toISOString(), before: sos.before, after });
  save();
}

function scaleButtons(onPick) {
  const row = document.createElement("div");
  row.className = "checkin-scale";
  for (let v = 1; v <= 5; v++) {
    const button = document.createElement("button");
    button.textContent = String(v);
    button.onclick = () => onPick(v);
    row.append(button);
  }
  return row;
}

function sosStageEl(kicker, heading) {
  sosClearTimers();
  const stage = $("sosStage");
  stage.textContent = "";
  const k = document.createElement("p");
  k.className = "section-kicker";
  k.textContent = kicker;
  stage.append(k);
  if (heading) {
    const h = document.createElement("h2");
    h.textContent = heading;
    stage.append(h);
  }
  return stage;
}

function sosCheckin(kind) {
  const stage = sosStageEl("STEADY ME", kind === "before" ? "Where is your fear right now?" : "And now — where is it?");
  stage.append(scaleButtons(v => {
    if (kind === "before") {
      sos.before = v;
      sosBreathing();
    } else {
      sosRecord(v);
      sosDone(v);
    }
  }));
  const note = document.createElement("p");
  note.className = "checkin-note";
  note.textContent = "1 = calm · 5 = overwhelming";
  const skip = document.createElement("button");
  skip.className = "text-button";
  skip.textContent = "Skip";
  skip.onclick = () => { if (kind === "before") sosBreathing(); else { sosRecord(null); sosDone(null); } };
  stage.append(note, skip);
}

function sosBreathing() {
  const stage = sosStageEl("BREATHE");
  const circle = document.createElement("div");
  circle.className = "breath-circle";
  const word = document.createElement("span");
  word.setAttribute("aria-live", "polite");
  circle.append(word);
  const note = document.createElement("p");
  note.className = "checkin-note";
  const next = document.createElement("button");
  next.className = "complete-button";
  next.textContent = "Continue";
  next.onclick = sosAnchor;
  stage.append(circle, note, next);

  const phases = [["Breathe in…", 4000], ["Hold…", 4000], ["Breathe out…", 6000]];
  const cycles = 3;
  let elapsed = 0;
  for (let c = 0; c < cycles; c++) {
    for (const [label, ms] of phases) {
      const cycle = c;
      sos.timers.push(setTimeout(() => {
        word.textContent = label;
        note.textContent = `${cycles - cycle} slow breath${cycles - cycle > 1 ? "s" : ""} to go`;
      }, elapsed));
      elapsed += ms;
    }
  }
  sos.timers.push(setTimeout(sosAnchor, elapsed + 400));
  word.textContent = "Breathe in…";
  note.textContent = "3 slow breaths to go";
}

function sosAnchor() {
  const stage = sosStageEl("ANCHOR");
  const quote = document.createElement("blockquote");
  quote.className = "scripture";
  const verse = document.createElement("p");
  verse.textContent = `“${sos.set.verse}”`;
  const cite = document.createElement("cite");
  cite.textContent = sos.set.ref;
  quote.append(verse, cite);

  const prayer = document.createElement("p");
  prayer.className = "sos-prayer";
  prayer.textContent = sos.set.prayer + " Amen.";
  const decl = document.createElement("p");
  decl.className = "sos-decl";
  decl.textContent = sos.set.declaration;

  const listen = document.createElement("button");
  listen.className = "text-button";
  listen.textContent = "▶ Hear this prayed";
  listen.onclick = () => {
    stopAudio();
    const src = recordedAudio.sos[sosSets.indexOf(sos.set)];
    if (src) {
      player.mode = "rec";
      audioEl.src = src;
      audioEl.playbackRate = 1;
      audioEl.currentTime = 0;
      audioEl.play().catch(() => { player.mode = "tts"; sosSpeak(); });
      return;
    }
    sosSpeak();
  };

  function sosSpeak() {
    if (!canSpeak) return;
    const utterance = new SpeechSynthesisUtterance(
      `${sos.set.verse} ${sos.set.ref}. ${sos.set.prayer} Amen. ${sos.set.declaration}`);
    utterance.rate = 0.95;
    utterance.pitch = 0.96;
    if (narrationVoice) utterance.voice = narrationVoice;
    speechSynthesis.speak(utterance);
  }

  const actions = document.createElement("div");
  actions.className = "sos-actions";
  const steadier = document.createElement("button");
  steadier.className = "complete-button";
  steadier.textContent = "I'm steadier";
  steadier.onclick = () => sosCheckin("after");
  const more = document.createElement("button");
  more.className = "text-button";
  more.textContent = "I need another round";
  more.onclick = () => {
    sos.set = sosSets[(sosSets.indexOf(sos.set) + 1) % sosSets.length];
    sosBreathing();
  };
  actions.append(steadier, more);
  stage.append(quote, prayer, decl, listen, actions);
}

function sosDone(after) {
  const stage = sosStageEl("WELL STOOD",
    sos.before != null && after != null && after < sos.before
      ? `Fear ${sos.before} → ${after}. You stood.`
      : "You stood through it.");
  const line = document.createElement("p");
  line.textContent = "Whatever the next hour holds, this moment was faithfulness. Go gently.";
  const close = document.createElement("button");
  close.className = "complete-button";
  close.textContent = "Close";
  close.onclick = closeSos;
  const again = document.createElement("button");
  again.className = "text-button";
  again.textContent = "One more round";
  again.onclick = () => {
    sos.set = sosSets[(sosSets.indexOf(sos.set) + 1) % sosSets.length];
    sos.before = after;
    sos.recorded = false;
    sosBreathing();
  };
  stage.append(line, close, again);
}

function openSos() {
  if (canSpeak) speechSynthesis.cancel();
  sos.set = sosSets[state.sos.length % sosSets.length];
  sos.before = null;
  sos.recorded = false;
  $("sosResources").hidden = true;
  $("sosSupport").setAttribute("aria-expanded", "false");
  sosCheckin("before");
  $("sosDialog").showModal();
}

function closeSos() {
  sosClearTimers();
  if (canSpeak) speechSynthesis.cancel();
  $("sosDialog").close();
}

$("sosButton").onclick = openSos;
$("closeSos").onclick = closeSos;
$("sosDialog").addEventListener("cancel", sosClearTimers);
$("sosSupport").onclick = () => {
  const resources = $("sosResources");
  resources.hidden = !resources.hidden;
  $("sosSupport").setAttribute("aria-expanded", String(!resources.hidden));
};

/* ---------- Day check-in ---------- */

function todaysCheckinFor(d) {
  const today = localISO(new Date());
  const trackId = state.track || "core";
  return [...state.checkins].reverse()
    .find(c => c.day === d && (c.track || "core") === trackId && localISO(new Date(c.t)) === today) || null;
}

function renderDayCheckin() {
  const latest = todaysCheckinFor(day);
  document.querySelectorAll("#dayCheckin button").forEach(button => {
    const active = latest !== null && Number(button.dataset.v) === latest.v;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("checkinNote").textContent = latest ? `Noted — ${latest.v} of 5 today` : "1 = calm · 5 = overwhelming";
}

$("dayCheckin").addEventListener("click", event => {
  const v = Number(event.target.dataset.v);
  if (!v) return;
  state.checkins.push({ t: new Date().toISOString(), track: state.track || "core", day, v });
  save();
  renderDayCheckin();
});

/* ---------- Calm ledger ---------- */

function renderLedger() {
  const el = $("ledger");
  el.textContent = "";
  const { sessions, avgDrop, week, avgWeek } = ledgerStats(state.sos, state.checkins, Date.now());

  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent = "CALM LEDGER";
  el.append(kicker);

  if (avgDrop === null && avgWeek === null) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "Your calm ledger appears here after your first fear check-in.";
    el.append(empty);
    return;
  }
  if (avgDrop !== null) {
    const p = document.createElement("p");
    p.className = "ledger-line";
    p.textContent = avgDrop > 0
      ? `After prayer, your fear drops an average of ${avgDrop.toFixed(1)} points (${sessions.length} SOS ${sessions.length === 1 ? "session" : "sessions"}).`
      : `${sessions.length} SOS ${sessions.length === 1 ? "session" : "sessions"} recorded — keep standing; the trend takes a few sessions to show.`;
    el.append(p);
  }
  if (avgWeek !== null) {
    const p = document.createElement("p");
    p.className = "ledger-line";
    p.textContent = `Average check-in this week: ${avgWeek.toFixed(1)} of 5 (${week.length} ${week.length === 1 ? "check-in" : "check-ins"}).`;
    el.append(p);
  }
}

/* ---------- Library ---------- */

let libraryFilter = "all";

function renderGrid() {
  const data = tdata();
  const visible = activeTrack().days
    .map((entry, i) => ({ title: entry[0], i }))
    .filter(({ i }) =>
      libraryFilter === "favorites" ? data.favorites.includes(i)
      : libraryFilter === "completed" ? data.completed.includes(i)
      : true);

  if (!visible.length) {
    $("dayGrid").innerHTML = `<p class="empty-note">${
      libraryFilter === "favorites"
        ? "Tap the heart on any day to save it here."
        : "No days completed yet — your journey starts today."
    }</p>`;
    return;
  }

  $("dayGrid").innerHTML = visible.map(({ title, i }) => `
    <button class="day-card ${data.completed.includes(i) ? "done" : ""}" data-day="${i}">
      ${data.favorites.includes(i) ? '<span class="fav-mark" aria-hidden="true">♥</span>' : ""}
      <small>DAY ${String(i + 1).padStart(2, "0")}${data.completed.includes(i) ? " · COMPLETE" : ""}</small>
      <strong>${title}</strong>
    </button>`).join("");

  document.querySelectorAll(".day-card").forEach(button => {
    button.onclick = () => {
      $("libraryDialog").close();
      go(Number(button.dataset.day));
    };
  });
}

// Switch to a journey and open it at the first day the user has not finished.
// Selecting the journey already open just closes the library.
function openTrack(id) {
  if ((state.track || "core") !== id) {
    state.track = id;
    save();
    libraryFilter = "all";
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === "all"));
    $("libraryDialog").close();
    go(firstIncompleteDay());
  } else {
    $("libraryDialog").close();
  }
}

function renderFearFinder() {
  const el = $("fearFinder");
  if (el.options.length > 1) return;
  for (const [label, id] of fearIndex) {
    if (!tracks[id]) continue;
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    el.append(option);
  }
  el.onchange = () => {
    const id = el.value;
    el.value = "";
    if (tracks[id]) openTrack(id);
  };
}

function renderTrackPicker() {
  const el = $("trackPicker");
  el.textContent = "";
  let group = null;
  for (const track of localizedTracks()) {
    if (track.group && track.group !== group) {
      group = track.group;
      const heading = document.createElement("p");
      heading.className = "track-group-label";
      heading.textContent = group;
      el.append(heading);
    }
    const data = track.id === "core" ? state : (state.tracks[track.id] || { completed: [] });
    const chip = document.createElement("button");
    chip.className = "track-chip" + (track.id === (state.track || "core") ? " active" : "");
    chip.dataset.track = track.id;
    const name = document.createElement("strong");
    name.textContent = track.short;
    const meta = document.createElement("small");
    meta.textContent = state.lang === "es"
      ? `${data.completed.length} de ${track.days.length} días`
      : `${data.completed.length} of ${track.days.length} days`;
    chip.append(name, meta);
    chip.onclick = () => openTrack(track.id);
    el.append(chip);
  }
}

document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.onclick = () => {
    libraryFilter = tab.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderGrid();
  };
});

/* ---------- Rendering ---------- */

function weekLabelFor(d) {
  const w = activeTrack().weeks;
  if (w.length < 5) return w[0];
  if (d < 7) return w[0];
  if (d < 14) return w[1];
  if (d < 21) return w[2];
  if (d < 29) return w[3];
  return w[4];
}

function render() {
  stopAudio();
  const [title, ref, verse, reflection, prayer, declaration, action] = activeTrack().days[day];
  const done = tdata().completed.includes(day);
  const fav = tdata().favorites.includes(day);

  $("weekLabel").textContent = weekLabelFor(day);
  $("dayNumber").textContent = `DAY ${String(day + 1).padStart(2, "0")}`;
  $("dayTitle").textContent = title;
  $("scriptureRef").textContent = ref;
  $("scriptureText").textContent = `“${verse}”`;
  $("reflection").textContent = reflection;
  $("prayer").textContent = prayer;
  $("declaration").textContent = declaration;
  $("action").textContent = action;
  $("notes").value = tdata().notes[day] || "";
  $("audioTime").textContent = recordedFor(day) ? "Recorded narration · about 3 minutes" : "About 3 minutes";

  const streak = currentStreak();
  $("progressLabel").textContent = `Day ${day + 1} of ${DAYS()}`;
  $("progressPercent").textContent =
    `${tdata().completed.length} of ${DAYS()} complete${streak > 1 ? ` · ${streak}-day streak` : ""}`;
  $("progressBar").style.width = `${Math.round((tdata().completed.length / DAYS()) * 100)}%`;

  $("favoriteButton").textContent = fav ? "♥" : "♡";
  $("favoriteButton").classList.toggle("active", fav);
  $("favoriteButton").setAttribute("aria-pressed", String(fav));
  $("favoriteButton").setAttribute("aria-label", fav ? "Remove this day from favorites" : "Save this day to favorites");
  $("completeButton").textContent = done ? "✓ Day complete" : "Mark day complete";
  $("completeButton").classList.toggle("completed", done);
  $("completeButton").setAttribute("aria-pressed", String(done));
  $("prevButton").disabled = day === 0;
  $("nextButton").disabled = day === DAYS() - 1;
  document.title = `Day ${day + 1}: ${title} — Stand`;
  renderDayCheckin();
  renderGrid();
}

/* ---------- Interactions ---------- */

$("completeButton").onclick = () => {
  const data = tdata();
  const i = data.completed.indexOf(day);
  if (i < 0) {
    data.completed.push(day);
    data.completedDates[day] = localISO(new Date());
  } else {
    data.completed.splice(i, 1);
    delete data.completedDates[day];
  }
  save();
  render();
};

/* ---------- Verse cards ---------- */

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// A 1080x1350 (4:5) card in the app's light palette, for social sharing.
function buildVerseCard() {
  const [title, ref, verse] = activeTrack().days[day];
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const ink = "#132a3a", gold = "#b88732", muted = "#60717b";

  ctx.fillStyle = "#f7f4ec";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 50, 980, 1250);

  ctx.textAlign = "center";
  ctx.fillStyle = gold;
  ctx.font = "700 44px Georgia, serif";
  ctx.fillText("✦", 540, 175);
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText(`D A Y   ${day + 1}   ·   ${title.toUpperCase().split("").join(" ")}`, 540, 265);

  ctx.fillStyle = ink;
  ctx.font = "italic 58px Georgia, serif";
  const lines = wrapText(ctx, `“${verse}”`, 820);
  const start = 675 - ((lines.length - 1) * 82) / 2;
  lines.forEach((line, i) => ctx.fillText(line, 540, start + i * 82));

  ctx.fillStyle = muted;
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillText(ref.toUpperCase(), 540, start + lines.length * 82 + 40);

  ctx.fillStyle = ink;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText("S T A N D", 540, 1215);

  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}

$("shareButton").onclick = async () => {
  const [title, ref, verse] = activeTrack().days[day];
  const text = `“${verse}” — ${ref}`;
  try {
    const blob = await buildVerseCard();
    const file = blob ? new File([blob], `stand-day-${String(day + 1).padStart(2, "0")}.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Day ${day + 1}: ${title} — Stand`, text });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `Day ${day + 1}: ${title} — Stand`, text, url: location.href });
      return;
    }
    // Desktop fallback: save the verse card and copy the text.
    if (file) downloadFile(file.name, blob, "image/png");
    await navigator.clipboard.writeText(`${text}\n${location.href}`).catch(() => {});
    $("shareButton").textContent = "✓";
    setTimeout(() => { $("shareButton").textContent = "↗"; }, 1200);
  } catch {
    // The user closed the share sheet, or clipboard access was denied.
  }
};

$("favoriteButton").onclick = () => {
  const data = tdata();
  const i = data.favorites.indexOf(day);
  i < 0 ? data.favorites.push(day) : data.favorites.splice(i, 1);
  save();
  render();
};

let noteTimer;
$("notes").oninput = event => {
  clearTimeout(noteTimer);
  $("saveStatus").textContent = "Saving…";
  noteTimer = setTimeout(() => {
    tdata().notes[day] = event.target.value;
    $("saveStatus").textContent = save()
      ? "Saved on this device"
      : "Could not save — storage is unavailable in this browser";
  }, 350);
};

$("prevButton").onclick = () => go(day - 1);
$("nextButton").onclick = () => go(day + 1);
$("libraryButton").onclick = () => { renderFearFinder(); renderTrackPicker(); $("libraryDialog").showModal(); };
$("closeLibrary").onclick = () => $("libraryDialog").close();

/* ---------- Journal ---------- */

const daysWithNotes = () =>
  Object.keys(tdata().notes).map(Number).filter(d => (tdata().notes[d] || "").trim()).sort((a, b) => a - b);

function renderJournal() {
  const list = $("journalList");
  list.textContent = "";
  const entries = daysWithNotes();
  $("exportButton").disabled = !entries.length;
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No reflections yet — notes you write on any day will appear here.";
    list.append(empty);
    return;
  }
  for (const d of entries) {
    const entry = document.createElement("article");
    entry.className = "journal-entry";
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = `DAY ${String(d + 1).padStart(2, "0")} · ${activeTrack().days[d][0].toUpperCase()}`;
    const body = document.createElement("p");
    body.textContent = tdata().notes[d];
    entry.append(kicker, body);
    list.append(entry);
  }
}

$("journalButton").onclick = () => { renderLedger(); renderJournal(); $("journalDialog").showModal(); };
$("closeJournal").onclick = () => $("journalDialog").close();

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

$("exportButton").onclick = () => {
  const lines = ["STAND — MY REFLECTIONS", `Exported ${localISO(new Date())}`, ""];
  for (const d of daysWithNotes()) {
    lines.push(`DAY ${String(d + 1).padStart(2, "0")} · ${activeTrack().days[d][0]}`, tdata().notes[d].trim(), "");
  }
  downloadFile("stand-reflections.txt", lines.join("\n"), "text/plain");
};

/* ---------- Backup, restore, erase ---------- */

// Backups are sanitized against the content this build actually has; the
// validation itself lives in logic.js so it can be unit tested.
function restoreFromBackup(raw) {
  return sanitizeBackup(raw, {
    coreDays: themes.length,
    tracks,
    langs: Object.keys(prayerUi)
  });
}

$("backupButton").onclick = () =>
  downloadFile("stand-backup.json", JSON.stringify(state, null, 2), "application/json");

$("restoreInput").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  let clean = null;
  try {
    clean = restoreFromBackup(JSON.parse(await file.text()));
  } catch { /* unreadable or invalid JSON */ }
  if (!clean) {
    alert("That file doesn't look like a Stand backup.");
    return;
  }
  if (!confirm("Replace the data on this device with this backup?")) return;
  Object.assign(state, clean);
  save();
  day = Math.max(0, Math.min(day, DAYS() - 1));
  location.hash = String(day + 1);
  applyTheme();
  renderLedger();
  renderJournal();
  renderTrackPicker();
  render();
};

$("eraseButton").onclick = () => {
  if (!confirm("Erase all notes, favorites, and progress from this device? This cannot be undone.")) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to remove */ }
  location.reload();
};

addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest("input, textarea, select") || document.querySelector("dialog[open]")) return;
  if (event.key === "ArrowLeft") go(day - 1);
  if (event.key === "ArrowRight") go(day + 1);
});

window.onhashchange = () => {
  const fromHash = dayFromHash();
  if (fromHash !== null && fromHash !== day) {
    day = fromHash;
    render();
  }
};

/* ---------- Startup ---------- */

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

document.querySelectorAll(".path-button").forEach(button => {
  button.onclick = () => {
    const id = button.dataset.track;
    if (tracks[id] && (state.track || "core") !== id) {
      state.track = id;
      state.welcomed = true;
      save();
      $("welcomeDialog").close();
      go(firstIncompleteDay());
      return;
    }
    $("welcomeDialog").close();
  };
});
$("welcomeDialog").addEventListener("close", () => {
  if (!state.welcomed) {
    state.welcomed = true;
    save();
  }
});

/* ---------- Daily reminder (.ics) ---------- */

// One calendar entry, updated in place. The UID used to be regenerated on
// every export, so tapping the button twice left two daily alarms running
// forever with no way to tell them apart. A fixed UID plus a SEQUENCE that
// only ever increases means a re-import updates the existing event instead.
const REMINDER_UID = "stand-daily-reminder@prayers.dougdevitre.org";

// RFC 5545 §3.3.11: TEXT values escape backslash, semicolon, comma and
// newline. Nothing in the current strings needs it — this is here so that
// editing the summary later cannot quietly produce an invalid file.
const icsText = v => String(v).replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1").replace(/\r?\n/g, "\\n");

// RFC 5545 §3.1: content lines are at most 75 OCTETS, continued with CRLF and
// one leading space. Octets, not characters — the em dash in the summary is
// three bytes — and a multi-byte character must never be split across a fold.
function icsFold(line) {
  const octets = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
  const out = [];
  let current = "", used = 0;
  for (const ch of line) {            // by code point, so surrogate pairs stay whole
    const n = octets(ch);
    if (used + n > 75) { out.push(current); current = " "; used = 1; }
    current += ch;
    used += n;
  }
  out.push(current);
  return out.join("\r\n");
}

function initReminder() {
  const field = $("reminderTime");
  if (/^\d{2}:\d{2}$/.test(state.reminderTime || "")) field.value = state.reminderTime;
  field.onchange = () => {
    if (/^\d{2}:\d{2}$/.test(field.value)) { state.reminderTime = field.value; save(); }
    $("reminderStatus").textContent = "";
  };
}

$("reminderButton").onclick = () => {
  const chosen = /^\d{2}:\d{2}$/.test($("reminderTime").value) ? $("reminderTime").value : "07:00";
  const [h, m] = chosen.split(":").map(Number);
  state.reminderTime = chosen;
  // Each export must out-rank the last or calendars ignore the update.
  state.reminderSeq = Number.isInteger(state.reminderSeq) ? state.reminderSeq + 1 : 0;
  save();

  const start = new Date();
  start.setHours(h, m, 0, 0);
  if (start <= new Date()) start.setDate(start.getDate() + 1);
  const pad = n => String(n).padStart(2, "0");
  // Deliberately a FLOATING time: no Z and no TZID, so the reminder fires at
  // the chosen wall-clock time wherever the reader happens to be, rather than
  // drifting when they travel. Do not "fix" this into UTC.
  const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stand//Daily Prayer//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${REMINDER_UID}`,
    `SEQUENCE:${state.reminderSeq}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    "DURATION:PT10M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${icsText("Stand — daily prayer")}`,
    // /app, not the origin: the origin is the landing page, and someone
    // tapping this at 7am wants the prayer, not a page describing it.
    `DESCRIPTION:${icsText(`A few minutes to stand. Open the app: ${location.origin}/app`)}`,
    `URL:${location.origin}/app`,
    "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY", `DESCRIPTION:${icsText("Time to stand")}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].map(icsFold).join("\r\n") + "\r\n";

  downloadFile("stand-daily-reminder.ics", ics, "text/calendar");
  $("reminderStatus").textContent = state.reminderSeq === 0
    ? `Saved for ${chosen} daily — open the downloaded file to add it to your calendar.`
    : `Updated to ${chosen} daily — open the downloaded file and your calendar will replace the old reminder.`;
};

/* ---------- iOS install hint ---------- */

{
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInstalled = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (isIOS && !isInstalled && !state.installHintDismissed) $("installHint").hidden = false;
  $("dismissHint").onclick = () => {
    $("installHint").hidden = true;
    state.installHintDismissed = true;
    save();
  };
}


/* ---------- Prayer composer ----------
   Composes from the reviewed corpus in prayers.js (see compose.js). Nothing is
   generated at runtime and nothing leaves the device \u2014 the personal intention is
   inserted into the corpus's own template and never stored. The chosen language
   is app-wide state, so every prayer surface follows it. */

const prayerState = { mode: "prayer", intention: null, seed: 1, openTraditional: null };

// A function declaration, not a const: stopAudio() reaches this via
// stopPrayerNarration() on the first render, before this section is evaluated.
function ui() { return prayerUi[state.lang] || prayerUi.en; }

function prayerOptions() {
  return {
    length: $("prayerLength").value || "full",
    closing: $("prayerClosing").value || "auto",
    petition: $("prayerPetition").value
  };
}

function fillSelect(el, items, keep) {
  const previous = keep && el.value;
  el.textContent = "";
  for (const { value, label } of items) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    el.append(option);
  }
  if (previous && items.some(i => i.value === previous)) el.value = previous;
}

/** Paints every label, option and button in the chosen language. */
function renderPrayerChrome() {
  const t = ui();
  $("prayerEyebrow").textContent = t.eyebrow;
  $("prayerHeading").textContent = t.title;
  $("closePrayer").setAttribute("aria-label", t.close);
  $("prayerLangLabel").textContent = t.language;
  $("prayerModeLabel").textContent = t.kind;
  $("prayerIntentionLabel").textContent = t.intention;
  $("prayerLengthLabel").textContent = t.length;
  $("prayerClosingLabel").textContent = t.closing;
  $("prayerPetitionLabel").textContent = t.petitionLabel;
  $("prayerPetition").placeholder = t.petitionPlaceholder;
  $("prayerBothLabel").textContent = t.both;
  $("prayerBoth").checked = state.bilingual;
  $("prayerAnother").textContent = t.another;
  $("prayerCopy").textContent = t.copy;
  updatePrayerButton($("prayerListen"), prayerAudio.playing);

  fillSelect($("prayerLang"), prayerCorpus.meta.languages.map(l => ({ value: l.id, label: l.label })), true);
  $("prayerLang").value = state.lang;
  fillSelect($("prayerMode"), Object.entries(prayerCorpus.modes).map(([id, m]) => ({ value: id, label: m.name[state.lang] })), true);
  $("prayerMode").value = prayerState.mode;
  fillSelect($("prayerLength"), [{ value: "full", label: t.full }, { value: "short", label: t.short }], true);
  // Closing styles say which tradition they belong to, so a Roman Catholic
  // closing is always chosen knowingly.
  fillSelect($("prayerClosing"), CLOSING_STYLES.map(style => {
    if (style === "auto") return { value: style, label: t.auto };
    const block = prayerCorpus.modes[prayerState.mode].slots.closing.find(c => c.style === style);
    const label = t.styles[style] || style;
    return { value: style, label: block && block.tradition === "roman-catholic" ? `${label} (${t.romanCatholic})` : label };
  }), true);
  renderIntentions(true);
}

function renderIntentions(keep) {
  const mode = prayerCorpus.modes[prayerState.mode];
  fillSelect($("prayerIntention"), mode.intentions.map(i => ({ value: i.id, label: i.label[state.lang] })), keep);
  prayerState.intention = $("prayerIntention").value || mode.intentions[0].id;
  $("prayerIntention").value = prayerState.intention;
}

function currentPrayer() {
  return composePrayer({
    corpus: prayerCorpus,
    mode: prayerState.mode,
    intention: prayerState.intention,
    seed: prayerState.seed,
    lang: state.lang,
    options: prayerOptions()
  });
}

function paintPrayerCard(card, title, lines, note) {
  card.textContent = "";
  const heading = document.createElement("h3");
  heading.className = "prayer-title";
  heading.textContent = title;
  card.append(heading);
  for (const line of lines) {
    const p = document.createElement("p");
    p.className = "prayer-line";
    p.textContent = line;
    card.append(p);
  }
  if (note) {
    const el = document.createElement("p");
    el.className = "prayer-note";
    el.textContent = note;
    card.append(el);
  }
}

/** The language shown alongside the chosen one in side-by-side mode. */
function otherLang() {
  const ids = prayerCorpus.meta.languages.map(l => l.id);
  return ids.find(id => id !== state.lang) || state.lang;
}

/** Paints a card whose lines come in [primary, secondary] pairs. */
function paintBilingualCard(card, titles, pairs, notes) {
  card.textContent = "";
  const heading = document.createElement("h3");
  heading.className = "prayer-title";
  heading.textContent = titles[0];
  const alt = document.createElement("p");
  alt.className = "prayer-title-alt";
  alt.textContent = titles[1];
  card.append(heading, alt);
  for (const [primary, secondary] of pairs) {
    const a = document.createElement("p");
    a.className = "prayer-line";
    a.textContent = primary;
    const b = document.createElement("p");
    b.className = "prayer-line prayer-line-alt";
    b.lang = otherLang();
    b.textContent = secondary;
    card.append(a, b);
  }
  if (notes && notes[0]) {
    const note = document.createElement("p");
    note.className = "prayer-note";
    note.textContent = notes[0];
    card.append(note);
  }
}

function renderPrayer() {
  stopPrayerNarration();
  if (state.bilingual) {
    const both = composeBilingual({
      corpus: prayerCorpus,
      mode: prayerState.mode,
      intention: prayerState.intention,
      seed: prayerState.seed,
      langs: [state.lang, otherLang()],
      options: prayerOptions()
    });
    paintBilingualCard($("prayerCard"), both.titles, both.pairs, both.notes);
  } else {
    const result = currentPrayer();
    paintPrayerCard($("prayerCard"), result.title, result.lines, result.note);
  }
  const combos = prayerCombinations(prayerCorpus, prayerState.mode, prayerState.intention, prayerOptions());
  $("prayerMeta").textContent =
    `${ui().combinations.replace("{n}", combos.toLocaleString(state.lang))} ${prayerCorpus.meta.reviewNote[state.lang]}`;
}

/** Traditional prayers, grouped under their tradition so the Roman Catholic
 * ones are named as such rather than folded in with the rest. */
function renderTraditional() {
  const el = $("traditionalList");
  el.textContent = "";
  for (const tradition of traditionsOf(prayerCorpus)) {
    const heading = document.createElement("p");
    heading.className = "section-kicker";
    heading.textContent = prayerCorpus.meta.traditionLabels[tradition][state.lang];
    const note = document.createElement("p");
    note.className = "tradition-note";
    note.textContent = prayerCorpus.meta.traditionNotes[tradition][state.lang];
    const chips = document.createElement("div");
    chips.className = "traditional-chips";
    chips.dataset.tradition = tradition;
    for (const item of traditionalFor(prayerCorpus, tradition)) {
      const chip = document.createElement("button");
      chip.className = "traditional-chip";
      chip.dataset.prayer = item.id;
      chip.textContent = item.name[state.lang];
      chip.onclick = () => showTraditional(item);
      chips.append(chip);
    }
    el.append(heading, note, chips);
  }
}

function showTraditional(item) {
  stopPrayerNarration();
  prayerState.openTraditional = item.id;
  const card = $("traditionalCard");
  card.hidden = false;
  const note = item.tradition === "roman-catholic"
    ? prayerCorpus.meta.traditionNotes["roman-catholic"][state.lang]
    : undefined;
  if (state.bilingual) {
    paintBilingualCard(card, [item.name[state.lang], item.name[otherLang()]],
      [[item.text[state.lang], item.text[otherLang()]]], [note]);
  } else {
    paintPrayerCard(card, item.name[state.lang], [item.text[state.lang]], note);
  }
  const listen = document.createElement("button");
  listen.className = "text-button";
  listen.id = "traditionalListen";
  listen.textContent = ui().listen;
  // Pacing metadata is per language, so narration pauses where that language's
  // generator run would insert a break.
  listen.onclick = () => speakPrayer(narrationSegments(item.text[state.lang], item.audio, state.lang), listen);
  card.append(listen);
}

function updatePrayerButton(button, playing) {
  if (button) button.textContent = playing ? ui().stop : ui().listen;
}

function stopPrayerNarration() {
  clearTimeout(prayerAudio.timer);
  if (prayerAudio.playing && canSpeak) speechSynthesis.cancel();
  prayerAudio.playing = false;
  for (const id of ["prayerListen", "traditionalListen"]) updatePrayerButton($(id), false);
}

// Speaks segments in order, holding the silence each one asks for afterwards.
function speakPrayer(segments, button) {
  if (prayerAudio.playing) { stopPrayerNarration(); return; }
  if (!canSpeak) return;
  stopAudio();
  prayerAudio.playing = true;
  updatePrayerButton(button, true);

  let i = 0;
  const next = () => {
    if (!prayerAudio.playing) return;
    if (i >= segments.length) { stopPrayerNarration(); return; }
    const segment = segments[i++];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = Number($("voiceRate").value) * 0.95;
    utterance.pitch = 0.96;
    utterance.lang = state.lang === "es" ? "es-ES" : "en-US";
    // The day narration voice is English; Spanish falls back to the device's
    // own default for the language rather than reading Spanish in an English voice.
    if (narrationVoice && state.lang === "en") utterance.voice = narrationVoice;
    utterance.onend = () => {
      if (!prayerAudio.playing) return;
      prayerAudio.timer = setTimeout(next, (segment.pause || 0) * 1000);
    };
    utterance.onerror = stopPrayerNarration;
    speechSynthesis.speak(utterance);
  };
  next();
}

function renderPrayerSurface() {
  renderPrayerChrome();
  renderTraditional();
  renderPrayer();
  const open = prayerState.openTraditional && prayerCorpus.traditional.find(t => t.id === prayerState.openTraditional);
  if (open) showTraditional(open);
}

$("prayerButton").onclick = () => { renderPrayerSurface(); $("prayerDialog").showModal(); };
$("closePrayer").onclick = () => $("prayerDialog").close();
$("prayerDialog").addEventListener("close", stopPrayerNarration);

$("prayerLang").onchange = () => {
  state.lang = $("prayerLang").value;
  save();
  renderPrayerSurface();
  // The choice is app-wide: the devotional day, the week label and the
  // library all follow it, so repaint them behind the open dialog.
  render();
  renderTrackPicker();
};
$("prayerMode").onchange = () => {
  prayerState.mode = $("prayerMode").value;
  renderPrayerChrome();
  renderPrayer();
};
$("prayerIntention").onchange = () => { prayerState.intention = $("prayerIntention").value; renderPrayer(); };
for (const id of ["prayerLength", "prayerClosing"]) $(id).onchange = renderPrayer;
$("prayerPetition").oninput = renderPrayer;
$("prayerBoth").onchange = () => {
  state.bilingual = $("prayerBoth").checked;
  save();
  renderPrayerSurface();
};
$("prayerAnother").onclick = () => { prayerState.seed += 1; renderPrayer(); };
$("prayerListen").onclick = () => speakPrayer(
  currentPrayer().lines.map(text => ({ text, pause: 0.6 })),
  $("prayerListen")
);
$("prayerCopy").onclick = async () => {
  let text = prayerToText(currentPrayer());
  if (state.bilingual) {
    const both = composeBilingual({
      corpus: prayerCorpus, mode: prayerState.mode, intention: prayerState.intention,
      seed: prayerState.seed, langs: [state.lang, otherLang()], options: prayerOptions()
    });
    text = [`${both.titles[0]} / ${both.titles[1]}`, "", ...both.pairs.map(pair => pair.join("\n"))].join("\n\n");
  }
  const reset = () => setTimeout(() => { $("prayerCopy").textContent = ui().copy; }, 1500);
  try {
    await navigator.clipboard.writeText(text);
    $("prayerCopy").textContent = ui().copied;
  } catch {
    $("prayerCopy").textContent = ui().copyFailed;
  }
  reset();
};

/* ---------- Startup ----------
   Everything above is declarations and handler wiring; this is the only code
   that runs on load, and it runs last — after the whole file has evaluated.
   That ordering is deliberate. This file is appended to as features land, and
   twice a new section's `const` (prayerAudio, then ui) was reached by startup
   through stopAudio() before its declaration was evaluated, which throws on a
   temporal-dead-zone access and leaves a blank first paint. Deferring startup
   makes where a section is added irrelevant. */

function start() {
  applyTheme();
  initReminder();
  if (dayFromHash() === null) history.replaceState(null, "", `${location.search}#${day + 1}`);
  render();
  if (new URLSearchParams(location.search).has("sos")) {
    state.welcomed = true;
    save();
    openSos();
  } else if (!state.welcomed) {
    $("welcomeDialog").showModal();
  }
}

// app.js is the last script in the body, so parsing is still in progress and
// DOMContentLoaded has not fired; the microtask is the belt-and-braces path if
// the script is ever moved or given defer.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else queueMicrotask(start);
