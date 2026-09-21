const STORAGE_KEY = "stand-state";
const $ = id => document.getElementById(id);
const canSpeak = "speechSynthesis" in window;

/* ---------- Tracks ---------- */

const activeTrack = () => tracks[state.track] || tracks.core;
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
  const fallback = { completed: [], favorites: [], notes: {}, completedDates: {}, checkins: [], sos: [], track: "core", tracks: {}, theme: null, welcomed: false, installHintDismissed: false };
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

const localISO = date => date.toLocaleDateString("en-CA");

function currentStreak() {
  // Completing a day on any track keeps the streak alive.
  const days = new Set(Object.values(state.completedDates));
  for (const t of Object.values(state.tracks)) {
    for (const d of Object.values(t.completedDates || {})) days.add(d);
  }
  if (!days.size) return 0;
  let streak = 0;
  const cursor = new Date();
  // A streak survives until a full calendar day is missed.
  if (!days.has(localISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
  { ref: "Psalm 27:1", verse: "The Lord is my light and my salvation—whom shall I fear?",
    prayer: "Lord, bring me back to this moment. Slow my heart, steady my breath, and stand with me here. I hand You what I cannot control.",
    declaration: "Fear may speak, but it does not get the final word." },
  { ref: "Joshua 1:9", verse: "Be strong and courageous. Do not be afraid.",
    prayer: "God, give me courage for the next few minutes—nothing more is asked of me right now. Be near, and steady my steps.",
    declaration: "I can be afraid and still be faithful." },
  { ref: "Matthew 6:34", verse: "Do not worry about tomorrow, for tomorrow will worry about itself.",
    prayer: "Father, I release the futures my fear keeps writing. Keep me in today, in this breath, in Your hands.",
    declaration: "I am responsible for faithfulness, not control of every outcome." },
  { ref: "Psalm 42:11", verse: "Put your hope in God, for I will yet praise him.",
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
  const sessions = state.sos.filter(s => s.before != null && s.after != null);
  const avgDrop = sessions.length
    ? sessions.reduce((sum, s) => sum + (s.before - s.after), 0) / sessions.length
    : null;
  const weekAgo = Date.now() - 7 * 86400000;
  const week = state.checkins.filter(c => new Date(c.t).getTime() >= weekAgo);
  const avgWeek = week.length ? week.reduce((sum, c) => sum + c.v, 0) / week.length : null;

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

function renderTrackPicker() {
  const el = $("trackPicker");
  el.textContent = "";
  let group = null;
  for (const track of Object.values(tracks)) {
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
    meta.textContent = `${data.completed.length} of ${track.days.length} days`;
    chip.append(name, meta);
    chip.onclick = () => {
      if ((state.track || "core") !== track.id) {
        state.track = track.id;
        save();
        libraryFilter = "all";
        document.querySelectorAll(".filter-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === "all"));
        $("libraryDialog").close();
        go(firstIncompleteDay());
      } else {
        $("libraryDialog").close();
      }
    };
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
$("libraryButton").onclick = () => { renderTrackPicker(); $("libraryDialog").showModal(); };
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

function sanitizeTrackData(raw, length) {
  const validDay = d => Number.isInteger(d) && d >= 0 && d < length;
  const clean = { completed: [], favorites: [], notes: {}, completedDates: {} };
  if (!raw || typeof raw !== "object") return clean;
  if (Array.isArray(raw.completed)) clean.completed = raw.completed.filter(validDay);
  if (Array.isArray(raw.favorites)) clean.favorites = raw.favorites.filter(validDay);
  if (raw.notes && typeof raw.notes === "object") {
    for (const [key, value] of Object.entries(raw.notes)) {
      if (validDay(Number(key)) && typeof value === "string") clean.notes[key] = value;
    }
  }
  if (raw.completedDates && typeof raw.completedDates === "object") {
    for (const [key, value] of Object.entries(raw.completedDates)) {
      if (validDay(Number(key)) && typeof value === "string") clean.completedDates[key] = value;
    }
  }
  return clean;
}

function sanitizeBackup(raw) {
  if (!raw || typeof raw !== "object") return null;
  // The legacy top-level fields identify a Stand backup.
  if (!Array.isArray(raw.completed) || !Array.isArray(raw.favorites) || !raw.notes || typeof raw.notes !== "object") return null;
  const core = sanitizeTrackData(raw, themes.length);

  const trackData = {};
  if (raw.tracks && typeof raw.tracks === "object") {
    for (const [id, sub] of Object.entries(raw.tracks)) {
      if (id !== "core" && tracks[id]) trackData[id] = sanitizeTrackData(sub, tracks[id].days.length);
    }
  }

  const validLevel = v => Number.isInteger(v) && v >= 1 && v <= 5;
  const checkins = Array.isArray(raw.checkins)
    ? raw.checkins
        .filter(c => {
          if (!c || typeof c !== "object" || typeof c.t !== "string" || !validLevel(c.v)) return false;
          const length = tracks[c.track || "core"] ? tracks[c.track || "core"].days.length : 0;
          return Number.isInteger(c.day) && c.day >= 0 && c.day < length;
        })
        .map(c => ({ t: c.t, track: tracks[c.track] ? c.track : "core", day: c.day, v: c.v }))
    : [];
  const sosSessions = Array.isArray(raw.sos)
    ? raw.sos
        .filter(s => s && typeof s === "object" && typeof s.t === "string"
          && (s.before == null || validLevel(s.before)) && (s.after == null || validLevel(s.after)))
        .map(s => ({ t: s.t, before: s.before ?? null, after: s.after ?? null }))
    : [];
  return {
    ...core,
    checkins,
    sos: sosSessions,
    track: tracks[raw.track] ? raw.track : "core",
    tracks: trackData,
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : null,
    welcomed: true,
    installHintDismissed: raw.installHintDismissed === true
  };
}

$("backupButton").onclick = () =>
  downloadFile("stand-backup.json", JSON.stringify(state, null, 2), "application/json");

$("restoreInput").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  let clean = null;
  try {
    clean = sanitizeBackup(JSON.parse(await file.text()));
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
  navigator.serviceWorker.register("sw.js").catch(() => {});
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

$("reminderButton").onclick = () => {
  const [h, m] = ($("reminderTime").value || "07:00").split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  if (start <= new Date()) start.setDate(start.getDate() + 1);
  const pad = n => String(n).padStart(2, "0");
  const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stand//Daily Prayer//EN",
    "BEGIN:VEVENT",
    `UID:stand-daily-${Date.now()}@stand.app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    "DURATION:PT10M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Stand — daily prayer",
    `DESCRIPTION:A few minutes to stand. Open the app: ${location.origin}`,
    "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY", "DESCRIPTION:Time to stand", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  downloadFile("stand-daily-reminder.ics", ics, "text/calendar");
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

applyTheme();
if (dayFromHash() === null) history.replaceState(null, "", `${location.search}#${day + 1}`);
render();
if (new URLSearchParams(location.search).has("sos")) {
  state.welcomed = true;
  save();
  openSos();
} else if (!state.welcomed) {
  $("welcomeDialog").showModal();
}
