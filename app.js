const STORAGE_KEY = "stand-state";
const $ = id => document.getElementById(id);
const canSpeak = "speechSynthesis" in window;

/* ---------- Interface language ---------- */

// One lookup for every string in the shell. English is also written into the
// markup so the page reads before any script runs; applyUi() replaces it when
// the reader has chosen Spanish. Missing keys fall back to English rather than
// rendering blank, and scripts/verify-ui.js fails the build if a key is
// missing from either table.
function t(key, vars) {
  const table = appUi[state.lang] || appUi.en;
  // The key itself is the last resort: a missing string should read oddly, not
  // blank out a button. verify-ui.js makes it unreachable in a shipped build.
  let out = table[key] !== undefined ? table[key] : (appUi.en[key] !== undefined ? appUi.en[key] : key);
  if (vars) for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(value);
  return out;
}

// Walks the annotated markup. Attributes rather than a list of ids: there are
// eighty-odd strings in the shell and hand-wiring each one is how half of them
// end up forgotten.
function applyUi() {
  document.documentElement.lang = state.lang === "es" ? "es" : "en";
  // data-i18n-n carries the one substitution the static shell needs (the sleep
  // timer's "{n} min"); everything else in the markup is a fixed string.
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n, el.dataset.i18nN ? { n: el.dataset.i18nN } : null);
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  }
}

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

// The words the reader hears come from narration.js, shared with the build
// that renders the recordings, so the device's own voice says exactly what a
// recording says. A recording is preferred when the manifest has one for this
// day in this language; ?tts=1 forces the device voice (a kill switch for the
// recordings that needs no deploy to try).
const narrationScript = d => dayScript(activeTrack().days[d], d, state.lang);
const ttsOnly = new URLSearchParams(location.search).get("tts") === "1";

/** The CDN URL of a recording by manifest id, or null when there is none. */
function recordedUrl(id) {
  if (ttsOnly || !audioManifest.enabled) return null;
  const item = audioManifest.items[id];
  return item ? `${audioManifest.base}/${item.key}` : null;
}

const player = { status: "idle", keepAlive: 0, repeat: false, sleepTimer: 0, mode: "tts" };
// Composer narration state; declared here because stopAudio() runs on first render.
const prayerAudio = { timer: 0, playing: false, recorded: false };
let narrationVoice = null;

// Recorded narration (preferred when a file exists for the day).
const audioEl = new Audio();
audioEl.preload = "none";

const recordedFor = d => recordedUrl(dayItemId(state.lang, state.track || "core", d));

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
    t(status === "playing" ? "audio.pause" : status === "paused" ? "audio.resume" : "audio.play"));
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
  const script = narrationScript(day);
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = Number($("voiceRate").value);
  utterance.pitch = 0.96;
  utterance.lang = state.lang === "es" ? "es-ES" : "en-US";
  // The chosen fallback voice is English; Spanish is left to the device's own
  // voice for the language rather than read with an English one.
  if (narrationVoice && state.lang === "en") utterance.voice = narrationVoice;
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
    $("audioTime").textContent = t("audio.unsupported");
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

// The English SOS sets are `sosSetsEn` in content.js; the Spanish ones are
// `esSos` in content.es.js. See sosSets() below.
// The active set is held as an index, not a reference: switching language swaps
// the whole array, and an index survives that where an object reference would not.
const sosSets = () => (state.lang === "es" && typeof esSos !== "undefined" ? esSos : sosSetsEn);
const sosSet = () => sosSets()[sos.i] || sosSets()[0];

const sos = { i: 0, before: null, recorded: false, timers: [] };

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
  const stage = sosStageEl(t("sos.kicker"), t(kind === "before" ? "sos.before" : "sos.after"));
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
  note.textContent = t("checkin.scale");
  const skip = document.createElement("button");
  skip.className = "text-button";
  skip.textContent = t("sos.skip");
  skip.onclick = () => { if (kind === "before") sosBreathing(); else { sosRecord(null); sosDone(null); } };
  stage.append(note, skip);
}

const breathsLeft = n => t(n === 1 ? "sos.breathsLeft" : "sos.breathsLeftPlural", { n });

function sosBreathing() {
  const stage = sosStageEl(t("sos.breathe"));
  const circle = document.createElement("div");
  circle.className = "breath-circle";
  const word = document.createElement("span");
  word.setAttribute("aria-live", "polite");
  circle.append(word);
  const note = document.createElement("p");
  note.className = "checkin-note";
  const next = document.createElement("button");
  next.className = "complete-button";
  next.textContent = t("sos.continue");
  next.onclick = sosAnchor;
  stage.append(circle, note, next);

  const phases = [["sos.in", 4000], ["sos.hold", 4000], ["sos.out", 6000]];
  const cycles = 3;
  let elapsed = 0;
  for (let c = 0; c < cycles; c++) {
    for (const [key, ms] of phases) {
      const cycle = c;
      sos.timers.push(setTimeout(() => {
        word.textContent = t(key);
        note.textContent = breathsLeft(cycles - cycle);
      }, elapsed));
      elapsed += ms;
    }
  }
  sos.timers.push(setTimeout(sosAnchor, elapsed + 400));
  word.textContent = t("sos.in");
  note.textContent = breathsLeft(cycles);
}

function sosAnchor() {
  const stage = sosStageEl(t("sos.anchor"));
  const quote = document.createElement("blockquote");
  quote.className = "scripture";
  const verse = document.createElement("p");
  verse.textContent = `“${sosSet().verse}”`;
  const cite = document.createElement("cite");
  cite.textContent = sosSet().ref;
  quote.append(verse, cite);

  const prayer = document.createElement("p");
  prayer.className = "sos-prayer";
  prayer.textContent = `${sosSet().prayer} ${t("section.amen")}`;
  const decl = document.createElement("p");
  decl.className = "sos-decl";
  decl.textContent = sosSet().declaration;

  const listen = document.createElement("button");
  listen.className = "text-button";
  listen.textContent = t("sos.listen");
  listen.onclick = () => {
    stopAudio();
    const src = recordedUrl(sosItemId(state.lang, sos.i));
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
    const utterance = new SpeechSynthesisUtterance(sosScript(sosSet(), state.lang));
    utterance.rate = 0.95;
    utterance.pitch = 0.96;
    utterance.lang = state.lang === "es" ? "es-ES" : "en-US";
    // The recorded narration voice is English; Spanish falls back to the device's
    // own voice for the language rather than reading Spanish with an English one.
    if (narrationVoice && state.lang === "en") utterance.voice = narrationVoice;
    speechSynthesis.speak(utterance);
  }

  const actions = document.createElement("div");
  actions.className = "sos-actions";
  const steadier = document.createElement("button");
  steadier.className = "complete-button";
  steadier.textContent = t("sos.steadier");
  steadier.onclick = () => sosCheckin("after");
  const more = document.createElement("button");
  more.className = "text-button";
  more.textContent = t("sos.another");
  more.onclick = () => {
    sos.i = (sos.i + 1) % sosSets().length;
    sosBreathing();
  };
  actions.append(steadier, more);
  stage.append(quote, prayer, decl, listen, actions);
}

function sosDone(after) {
  const stage = sosStageEl(t("sos.wellStood"),
    sos.before != null && after != null && after < sos.before
      ? t("sos.drop", { before: sos.before, after })
      : t("sos.stood"));
  const line = document.createElement("p");
  line.textContent = t("sos.closing");
  const close = document.createElement("button");
  close.className = "complete-button";
  close.textContent = t("sos.close");
  close.onclick = closeSos;
  const again = document.createElement("button");
  again.className = "text-button";
  again.textContent = t("sos.oneMore");
  again.onclick = () => {
    sos.i = (sos.i + 1) % sosSets().length;
    sos.before = after;
    sos.recorded = false;
    sosBreathing();
  };
  stage.append(line, close, again);
}

function openSos() {
  if (canSpeak) speechSynthesis.cancel();
  sos.i = state.sos.length % sosSets().length;
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
  $("checkinNote").textContent = latest ? t("checkin.noted", { n: latest.v }) : t("checkin.scale");
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
  kicker.textContent = t("ledger.kicker");
  el.append(kicker);

  if (avgDrop === null && avgWeek === null) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = t("ledger.empty");
    el.append(empty);
    return;
  }
  if (avgDrop !== null) {
    const p = document.createElement("p");
    p.className = "ledger-line";
    const label = t(sessions.length === 1 ? "ledger.session" : "ledger.sessions");
    p.textContent = t(avgDrop > 0 ? "ledger.drop" : "ledger.early",
      { avg: avgDrop.toFixed(1), n: sessions.length, sessions: label });
    el.append(p);
  }
  if (avgWeek !== null) {
    const p = document.createElement("p");
    p.className = "ledger-line";
    p.textContent = t("ledger.week", {
      avg: avgWeek.toFixed(1), n: week.length,
      checkins: t(week.length === 1 ? "ledger.checkin" : "ledger.checkins")
    });
    el.append(p);
  }
}

/* ---------- Library ---------- */

let libraryFilter = "all";

// The grid is built as one innerHTML string for speed; day titles and the
// interface strings around them go through here so a stray & or < in either
// cannot break the markup.
const escapeHtml = v => String(v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

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
      escapeHtml(t(libraryFilter === "favorites" ? "library.emptyFavorites" : "library.emptyCompleted"))
    }</p>`;
    return;
  }

  $("dayGrid").innerHTML = visible.map(({ title, i }) => `
    <button class="day-card ${data.completed.includes(i) ? "done" : ""}" data-day="${i}">
      ${data.favorites.includes(i) ? '<span class="fav-mark" aria-hidden="true">♥</span>' : ""}
      <small>${escapeHtml(t("day.number", { n: String(i + 1).padStart(2, "0") }))}${data.completed.includes(i) ? escapeHtml(t("library.cardComplete")) : ""}</small>
      <strong>${escapeHtml(title)}</strong>
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
    meta.textContent = t("library.dayCount", { done: data.completed.length, total: track.days.length });
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

const weekLabelFor = d => weekLabel(activeTrack().weeks, d);

function render() {
  stopAudio();
  const [title, ref, verse, reflection, prayer, declaration, action] = activeTrack().days[day];
  const done = tdata().completed.includes(day);
  const fav = tdata().favorites.includes(day);

  $("weekLabel").textContent = weekLabelFor(day);
  $("dayNumber").textContent = t("day.number", { n: String(day + 1).padStart(2, "0") });
  $("dayTitle").textContent = title;
  $("scriptureRef").textContent = ref;
  $("scriptureText").textContent = `“${verse}”`;
  $("reflection").textContent = reflection;
  $("prayer").textContent = prayer;
  $("declaration").textContent = declaration;
  $("action").textContent = action;
  $("notes").value = tdata().notes[day] || "";
  $("audioTime").textContent = t(recordedFor(day) ? "audio.recorded" : "audio.length");

  const streak = currentStreak();
  $("progressLabel").textContent = t("progress.day", { n: day + 1, total: DAYS() });
  $("progressPercent").textContent =
    t("progress.completeCount", { done: tdata().completed.length, total: DAYS() })
    + (streak > 1 ? t("progress.streak", { n: streak }) : "");
  $("progressBar").style.width = `${Math.round((tdata().completed.length / DAYS()) * 100)}%`;

  $("favoriteButton").textContent = fav ? "♥" : "♡";
  $("favoriteButton").classList.toggle("active", fav);
  $("favoriteButton").setAttribute("aria-pressed", String(fav));
  $("favoriteButton").setAttribute("aria-label", t(fav ? "day.unfavorite" : "day.favorite"));
  $("completeButton").textContent = t(done ? "day.completed" : "day.complete");
  $("completeButton").classList.toggle("completed", done);
  $("completeButton").setAttribute("aria-pressed", String(done));
  $("prevButton").disabled = day === 0;
  $("nextButton").disabled = day === DAYS() - 1;
  document.title = t("share.title", { n: day + 1, title });
  renderDayCheckin();
  renderGrid();
  renderReminder();
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
  ctx.fillText(`${t("share.cardDay")}   ${day + 1}   ·   ${title.toUpperCase().split("").join(" ")}`, 540, 265);

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
  const text = t("share.caption", { verse, ref });
  try {
    const blob = await buildVerseCard();
    const file = blob ? new File([blob], `stand-day-${String(day + 1).padStart(2, "0")}.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: t("share.title", { n: day + 1, title }), text });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: t("share.title", { n: day + 1, title }), text, url: location.href });
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
  $("saveStatus").textContent = t("notes.saving");
  noteTimer = setTimeout(() => {
    tdata().notes[day] = event.target.value;
    $("saveStatus").textContent = t(save() ? "notes.saved" : "notes.failed");
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
    empty.textContent = t("journal.empty");
    list.append(empty);
    return;
  }
  for (const d of entries) {
    const entry = document.createElement("article");
    entry.className = "journal-entry";
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = `${t("day.number", { n: String(d + 1).padStart(2, "0") })} · ${activeTrack().days[d][0].toUpperCase()}`;
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
  const lines = [t("journal.exportTitle"), t("journal.exported", { date: localISO(new Date()) }), ""];
  for (const d of daysWithNotes()) {
    lines.push(`${t("day.number", { n: String(d + 1).padStart(2, "0") })} · ${activeTrack().days[d][0]}`,
      tdata().notes[d].trim(), "");
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
    alert(t("backup.bad"));
    return;
  }
  if (!confirm(t("backup.confirm"))) return;
  Object.assign(state, clean);
  save();
  day = Math.max(0, Math.min(day, DAYS() - 1));
  location.hash = String(day + 1);
  applyTheme();
  applyUi();
  renderLedger();
  renderJournal();
  renderTrackPicker();
  render();
};

$("eraseButton").onclick = () => {
  if (!confirm(t("erase.confirm"))) return;
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

// The file itself is built in reminder.js, which is pure so it can be tested
// in Node: one recurring master (the UID the app has always used) plus one
// override per remaining day of the journey, each carrying that day's title,
// scripture, practice, declaration, a tip and a link straight to the day.
// A fixed UID plus a SEQUENCE that only ever increases means a re-import
// updates the existing series instead of adding a second one.

// The export options. Read through here rather than off state directly so a
// state saved before the options existed, or a hand-edited one, still yields
// a usable value.
const reminderOptions = () => ({
  from: state.reminderFrom === "start" ? "start" : "current",
  weekdays: state.reminderWeekdays === true,
  lead: REMINDER_LEADS.includes(state.reminderLead) ? state.reminderLead : 0,
  evening: /^\d{2}:\d{2}$/.test(state.reminderEvening || "") ? state.reminderEvening : null
});

function initReminder() {
  const field = $("reminderTime");
  if (/^\d{2}:\d{2}$/.test(state.reminderTime || "")) field.value = state.reminderTime;
  const options = reminderOptions();
  $("reminderFrom").value = options.from;
  $("reminderLead").value = String(options.lead);
  $("reminderWeekdays").checked = options.weekdays;
  const changed = () => { save(); $("reminderStatus").textContent = ""; renderReminder(); };
  field.onchange = () => {
    if (/^\d{2}:\d{2}$/.test(field.value)) state.reminderTime = field.value;
    changed();
  };
  $("reminderFrom").onchange = () => { state.reminderFrom = $("reminderFrom").value === "start" ? "start" : "current"; changed(); };
  $("reminderLead").onchange = () => { state.reminderLead = Number($("reminderLead").value); changed(); };
  $("reminderWeekdays").onchange = () => { state.reminderWeekdays = $("reminderWeekdays").checked; changed(); };
  // The evening time field is live only while the check-in is on; its value
  // is kept either way so turning it back on remembers the time.
  const eveningTime = $("reminderEveningTime");
  $("reminderEvening").checked = Boolean(options.evening);
  if (options.evening) eveningTime.value = options.evening;
  eveningTime.disabled = !options.evening;
  const syncEvening = () => {
    const on = $("reminderEvening").checked;
    eveningTime.disabled = !on;
    state.reminderEvening = on && /^\d{2}:\d{2}$/.test(eveningTime.value) ? eveningTime.value : null;
    changed();
  };
  $("reminderEvening").onchange = syncEvening;
  eveningTime.onchange = syncEvening;
}

$("reminderButton").onclick = async () => {
  const chosen = /^\d{2}:\d{2}$/.test($("reminderTime").value) ? $("reminderTime").value : "07:00";
  state.reminderTime = chosen;
  // Each export must out-rank the last or calendars ignore the update.
  state.reminderSeq = Number.isInteger(state.reminderSeq) ? state.reminderSeq + 1 : 0;
  save();

  const { trackId, track, lang, schedule } = reminderContext(chosen);
  const options = reminderOptions();
  // A reader who had the evening series and turned it off gets it cancelled
  // once; after that the flag clears so the file stays lean.
  const cancelEvening = !options.evening && state.reminderEveningExported === true;
  const ics = buildReminderIcs({ track, trackId, lang, time: chosen, seq: state.reminderSeq, now: new Date(), origin: location.origin, t, lead: options.lead, evening: options.evening, cancelEvening, schedule });
  state.reminderEveningExported = Boolean(options.evening);
  save();
  const eveningNote = options.evening ? " " + t("reminder.eveningOn", { time: options.evening }) : (cancelEvening ? " " + t("reminder.eveningCancelled") : "");
  const vars = {
    count: schedule.count, from: schedule.fromDay + 1, to: track.days.length, track: track.short,
    time: chosen, start: reminderStartLabel(schedule), cadence: t(schedule.weekdays ? "reminder.cadenceWeekdays" : "reminder.cadenceDaily")
  };
  const one = schedule.count === 1;

  // On a phone, a downloaded .ics lands in Files and the reader has to go and
  // find it; the share sheet puts Calendar one tap away. Feature-detected, so
  // desktop browsers and older phones still get the download.
  const file = new File([ics], "stand-daily-reminder.ics", { type: "text/calendar" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t("reminder.summary") });
      $("reminderStatus").textContent = t(one ? "reminder.sharedOne" : "reminder.shared", vars) + eveningNote;
      return;
    } catch (error) {
      // The reader closed the sheet: nothing to add, nothing to report.
      if (error && error.name === "AbortError") return;
      // Anything else falls through to the download.
    }
  }

  downloadFile("stand-daily-reminder.ics", ics, "text/calendar");
  const key = state.reminderSeq === 0 ? (one ? "reminder.savedOne" : "reminder.savedPlan") : (one ? "reminder.updatedOne" : "reminder.updatedPlan");
  $("reminderStatus").textContent =
    (schedule.restarted ? t("reminder.restarted", { track: track.short }) + " " : "") + t(key, vars) + eveningNote;
};

// What an export would contain right now, for the button label, the preview
// and the export itself, so the three can never disagree.
function reminderContext(time) {
  // activeTrack() already falls back to core for an id it does not know; the
  // id must fall back with it or the links would name a journey that is not there.
  const trackId = tracks[state.track] ? state.track : "core";
  const track = activeTrack();
  return {
    trackId, track,
    // localizedTrack() hands back the English object itself when no Spanish
    // version exists, and the page links must follow the titles they carry.
    lang: track === tracks[trackId] ? "en" : "es",
    schedule: reminderSchedule({ dayCount: track.days.length, completed: tdata().completed, time, now: new Date(), ...reminderOptions() })
  };
}

// "today", "tomorrow", or the day itself when a weekend was skipped.
function reminderStartLabel(schedule) {
  if (schedule.offset === 0) return t("reminder.today");
  if (schedule.offset === 1) return t("reminder.tomorrow");
  return schedule.dates[0].toLocaleDateString(state.lang === "es" ? "es" : "en", { weekday: "long", day: "numeric", month: "long" });
}

// The button says what it will add, and the preview shows the first reminder
// as the calendar will. Re-run on every render: completing a day changes both.
function renderReminder() {
  const time = /^\d{2}:\d{2}$/.test($("reminderTime").value) ? $("reminderTime").value : "07:00";
  const { trackId, track, lang, schedule } = reminderContext(time);
  const vars = { count: schedule.count, from: schedule.fromDay + 1, to: track.days.length };
  $("reminderButton").textContent = t(schedule.count === 1 ? "reminder.buttonOne" : "reminder.buttonPlan", vars);
  const entry = reminderEntry({ track, trackId, lang, origin: location.origin, t, dayIndex: schedule.fromDay, position: 0 });
  $("reminderPreviewTitle").textContent = entry.summary;
  $("reminderPreviewBody").textContent = entry.description;
  renderSubscribe(time, { trackId, lang, schedule });
}

// The subscription feed: the same file, served from a URL a calendar app
// polls. The URL carries only the journey, the day to start on, the date of
// that first reminder, the time, the language and the option flags —
// nothing a reader would mind in a calendar's settings.
function subscribeUrl(time, { trackId, lang, schedule }) {
  const options = reminderOptions();
  const first = schedule.dates[0];
  const pad = n => String(n).padStart(2, "0");
  const q = new URLSearchParams({
    track: trackId, from: String(schedule.fromDay + 1),
    start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`,
    time, lang
  });
  if (options.weekdays) q.set("weekdays", "1");
  if (options.lead) q.set("lead", String(options.lead));
  if (options.evening) q.set("evening", options.evening);
  return `${location.host}/calendar.ics?${q}`;
}

function renderSubscribe(time, context) {
  const url = subscribeUrl(time, context);
  // webcal: is what makes Apple Calendar (and Outlook) open a subscription
  // dialog straight from the tap; the copy button carries the https form
  // for Google Calendar's "From URL".
  $("subscribeLink").href = `webcal://${url}`;
  $("subscribeLink").dataset.https = `${location.protocol}//${url}`;
}

$("subscribeCopy").onclick = async () => {
  const url = $("subscribeLink").dataset.https;
  try {
    await navigator.clipboard.writeText(url);
    $("reminderStatus").textContent = t("reminder.subscribeCopied");
  } catch {
    // No clipboard (older browser, or permission refused): show the link
    // itself so it can be selected by hand.
    $("reminderStatus").textContent = url;
  }
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
  listen.onclick = () => {
    const src = recordedUrl(prayerItemId(state.lang, item.id));
    if (src) playPrayerRecording(src, listen, () => speakPrayer(narrationSegments(item.text[state.lang], item.audio, state.lang), listen));
    else speakPrayer(narrationSegments(item.text[state.lang], item.audio, state.lang), listen);
  };
  card.append(listen);
}

function updatePrayerButton(button, playing) {
  if (button) button.textContent = playing ? ui().stop : ui().listen;
}

function stopPrayerNarration() {
  clearTimeout(prayerAudio.timer);
  if (prayerAudio.playing && canSpeak) speechSynthesis.cancel();
  if (prayerAudio.recorded) { prayerAudio.recorded = false; audioEl.pause(); }
  prayerAudio.playing = false;
  for (const id of ["prayerListen", "traditionalListen"]) updatePrayerButton($(id), false);
}

// Plays a prayer's recording through the shared audio element. The day
// player's own state is left idle, so its progress bar and Media Session stay
// out of it; the element's "ended" handler stops everything, which resets
// the button. A file that will not play falls back to the device voice.
function playPrayerRecording(src, button, fallback) {
  if (prayerAudio.playing) { stopPrayerNarration(); return; }
  stopAudio();
  prayerAudio.playing = true;
  prayerAudio.recorded = true;
  updatePrayerButton(button, true);
  audioEl.src = src;
  audioEl.playbackRate = Number($("voiceRate").value);
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {
    if (!prayerAudio.recorded) return;
    prayerAudio.recorded = false;
    prayerAudio.playing = false;
    fallback();
  });
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
  // The choice is app-wide: the interface, the devotional day, the week label
  // and the library all follow it, so repaint them behind the open dialog.
  applyUi();
  render();
  renderTrackPicker();
  renderFearFinder();
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
  applyUi();
  initReminder();
  if (dayFromHash() === null) history.replaceState(null, "", `${location.search}#${day + 1}`);
  render();
  // The evening calendar check-in links here: land on the fear check-in.
  if (new URLSearchParams(location.search).has("checkin")) {
    $("dayCheckin").scrollIntoView({ block: "center" });
  }
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
