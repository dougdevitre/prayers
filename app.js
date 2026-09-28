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
  // The library's links out go to the site's pages in the same language.
  const es = state.lang === "es";
  $("libraryFears").href = es ? "/es/fears" : "/fears";
  $("libraryAbout").href = es ? "/es" : "/";
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
  const fallback = { completed: [], favorites: [], notes: {}, completedDates: {}, checkins: [], sos: [], track: "core", tracks: {}, prayerFavorites: [], rosary: null, rosaryFatima: true, theme: null, lang: "en", bilingual: false, welcomed: false, installHintDismissed: false, voiceRate: 1 };
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

// The Spanish journeys and SOS sets (content.es.js, ~28 KB gzipped) load only
// when Spanish is wanted: at startup for a Spanish reader, or on switching.
// Until then every lookup falls back to the English text (activeTrack,
// sosSets and the fear finder all check typeof), so a failed load leaves the
// app working in English rather than broken. The service worker still
// precaches the file, so switching works offline.
// The Rosary (rosary.js) loads the same way, the first time the Prayer Book
// opens. A script loaded here resolves either way; the caller checks that
// what it needs arrived.
const scriptLoads = {};
function loadScript(src, ready) {
  if (ready()) return Promise.resolve();
  scriptLoads[src] = scriptLoads[src] || new Promise(resolve => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => { delete scriptLoads[src]; resolve(); };
    document.head.append(script);
  });
  return scriptLoads[src];
}
const loadSpanish = () => loadScript("/content.es.js", () => typeof esTracks !== "undefined");
const loadRosary = () => loadScript("/rosary.js", () => typeof rosarySteps !== "undefined");
const languageReady = () => (state.lang === "es" ? loadSpanish() : Promise.resolve());

// A ?lang= link (from a Spanish Prayer Book page) opens the app in that
// language, and keeps it, as choosing it in the app would.
{
  const requested = new URLSearchParams(location.search).get("lang");
  if ((requested === "en" || requested === "es") && state.lang !== requested) {
    state.lang = requested;
    save();
  }
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

// Recordings saved for offline listening, as blob: URLs keyed by their CDN
// URL. Filled by syncOfflineAudio() (below) only when the reader has turned
// offline listening on; empty otherwise, so playback streams as it always has.
const offlineBlobs = new Map();

/** The URL to play a recording from by manifest id: the saved copy when the
 * device holds one, else the CDN, or null when there is no recording. */
function recordedUrl(id) {
  if (ttsOnly || !audioManifest.enabled) return null;
  const item = audioManifest.items[id];
  if (!item) return null;
  const url = `${audioManifest.base}/${item.key}`;
  return offlineBlobs.get(url) || url;
}

const player = { status: "idle", keepAlive: 0, repeat: false, sleepTimer: 0, mode: "tts" };
// Composer narration state; declared here because stopAudio() runs on first render.
// onEnd, when set, is told how the prayer playing now ended: true when it
// played to its end, false when it was stopped (praying the Rosary along).
const prayerAudio = { timer: 0, playing: false, recorded: false, onEnd: null };
// The Prayer Book reader: its list filter, the prayer open in it, and the
// prayer it is playing (see "Prayer Book" below).
const book = { filter: "all", open: null, playing: null };
let narrationVoice = null;

// Recorded narration (preferred when a file exists for the day).
const audioEl = new Audio();
audioEl.preload = "none";

const recordedFor = d => recordedUrl(dayItemId(state.lang, state.track || "core", d));

audioEl.addEventListener("timeupdate", () => {
  if (player.mode === "rec" && audioEl.duration) {
    $("audioProgress").style.width = `${Math.min(100, (audioEl.currentTime / audioEl.duration) * 100)}%`;
  }
  if (book.playing && prayerAudio.recorded) paintBookProgress();
  updatePositionState();
});
// The Prayer Book's play button follows the element, so a pause from the
// lock screen shows as a pause in the reader too.
for (const event of ["play", "pause"]) {
  audioEl.addEventListener(event, () => { if (book.playing && prayerAudio.recorded) paintBookPlay(); });
}

audioEl.addEventListener("ended", () => {
  if (player.repeat && player.status === "playing") {
    audioEl.currentTime = 0;
    audioEl.play().catch(stopAudio);
  } else {
    const then = prayerAudio.recorded ? prayerAudio.onEnd : null;
    prayerAudio.onEnd = null;
    stopAudio();
    if (then) then(true);
  }
});

// Lock-screen and notification controls. Every call is feature-detected and
// guarded: a browser without the Media Session API, without setPositionState,
// or without a given action simply keeps its default controls.
for (const event of ["loadedmetadata", "ratechange", "seeked"]) {
  audioEl.addEventListener(event, updatePositionState);
}

const SEEK_STEP_SECONDS = 10;

function mediaSessionApi() {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
}

function setMediaAction(action, handler) {
  const session = mediaSessionApi();
  if (!session) return;
  try { session.setActionHandler(action, handler); } catch { /* action not supported */ }
}

/** "playing", "paused" or "none" on the lock screen. */
function setMediaPlaybackState(value) {
  const session = mediaSessionApi();
  if (!session) return;
  try { session.playbackState = value; } catch { /* older browsers */ }
}

// The shared audio element is what the lock screen shows while it plays day
// narration from a recording or a prayer's recording (the Prayer Book, the
// composer, the Rosary and SOS all play prayers the same way).
function recordingInSession() {
  return (player.mode === "rec" && player.status !== "idle") || inPlaceRecording();
}

// A prayer's recording plays through the shared element while the day player
// stays idle.
const inPlaceRecording = () => prayerAudio.recorded;

function updatePositionState() {
  const session = mediaSessionApi();
  if (!session || typeof session.setPositionState !== "function" || !recordingInSession()) return;
  const duration = audioEl.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    session.setPositionState({
      duration,
      playbackRate: audioEl.playbackRate || 1,
      position: Math.min(Math.max(0, audioEl.currentTime), duration)
    });
  } catch { /* older browsers */ }
}

function clearPositionState() {
  const session = mediaSessionApi();
  if (!session || typeof session.setPositionState !== "function") return;
  try { session.setPositionState(); } catch { /* older browsers */ }
}

function seekRecording(seconds) {
  if (!recordingInSession() || !Number.isFinite(audioEl.duration) || !Number.isFinite(seconds)) return;
  audioEl.currentTime = Math.min(Math.max(0, seconds), audioEl.duration);
  updatePositionState();
}

// Device speech has no position to report, so it gets no scrubber.
function speechMediaSession() {
  clearPositionState();
  for (const action of ["seekbackward", "seekforward", "seekto"]) setMediaAction(action, null);
}

// A prayer's recording pauses and resumes in place; the day player's button
// would start the day instead. A prayer read by the device voice cannot pause
// reliably, so the lock screen's pause stops it, as its own button does.
function mediaPlay() {
  if (inPlaceRecording()) {
    audioEl.play().then(() => setMediaPlaybackState("playing")).catch(stopPrayerNarration);
  } else if (prayerAudio.playing) {
    return;
  } else if (player.status !== "playing") {
    $("playButton").click();
  }
}

function mediaPause() {
  if (inPlaceRecording()) {
    audioEl.pause();
    setMediaPlaybackState("paused");
  } else if (prayerAudio.playing) {
    stopPrayerNarration();
  } else if (player.status === "playing") {
    $("playButton").click();
  }
}

// Called once a recording is playing: title, artwork, and the transport and
// seek controls a recording can honour.
function setMediaSession(title) {
  if (!mediaSessionApi()) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "Stand",
      artwork: [
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" }
      ]
    });
  } catch { /* older browsers */ }
  setMediaAction("play", mediaPlay);
  setMediaAction("pause", mediaPause);
  setMediaAction("stop", stopAudio);
  setMediaAction("seekbackward", () => seekRecording(audioEl.currentTime - SEEK_STEP_SECONDS));
  setMediaAction("seekforward", () => seekRecording(audioEl.currentTime + SEEK_STEP_SECONDS));
  setMediaAction("seekto", details => seekRecording(details && details.seekTime));
  updatePositionState();
}

function playRecorded(src) {
  player.mode = "rec";
  audioEl.src = src;
  audioEl.playbackRate = voiceRate();
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
  setMediaPlaybackState(status === "playing" ? "playing" : status === "paused" ? "paused" : "none");
  if (status === "idle") clearPositionState();
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
  setMediaSession(document.title);
  speechMediaSession();
  const script = narrationScript(day);
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = voiceRate();
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

/** The chosen narration speed; every voice in the app reads it here. */
function voiceRate() {
  const rate = Number($("voiceRate").value);
  return VOICE_RATES.includes(rate) ? rate : 1;
}

// One saved speed for every voice in the app: the day, the prayers, the
// Rosary and SOS. A recording changes speed as it plays; the device voice
// restarts the day at the new speed, and a prayer picks it up next time.
$("voiceRate").onchange = () => {
  state.voiceRate = voiceRate();
  save();
  if (recordingInSession()) {
    audioEl.playbackRate = voiceRate();
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

// recorded: the check-in was saved. audio: the SOS recording is playing.
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
  stopPrayerNarration();
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

  // The same player as every other prayer: recording first, else the device
  // voice; the button toggles to Stop; the saved speed and the lock-screen
  // title apply. Moving to another step stops it (sosStageEl).
  const listen = document.createElement("button");
  listen.className = "text-button";
  listen.id = "sosListen";
  listen.dataset.listen = t("sos.listen");
  listen.textContent = t("sos.listen");
  listen.onclick = () => {
    const title = `${t("sos.button")} · ${sosSet().ref}`;
    const speak = () => speakPrayer([{ text: sosScript(sosSet(), state.lang), pause: 0 }], listen, title);
    const src = recordedUrl(sosItemId(state.lang, sos.i));
    if (src) playPrayerRecording(src, listen, speak, title);
    else speak();
  };

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
  const actions = document.createElement("div");
  actions.className = "sos-actions";
  actions.append(close, again);
  stage.append(line, actions);
}

function openSos() {
  // Nothing plays underneath: the day's narration or a prayer stops here.
  stopAudio();
  sos.i = state.sos.length % sosSets().length;
  sos.before = null;
  sos.recorded = false;
  $("sosResources").hidden = true;
  $("sosSupport").setAttribute("aria-expanded", "false");
  sosCheckin("before");
  $("sosDialog").showModal();
}

// The SOS voice, recorded or spoken, ends with the screen. Closing it used to
// cancel device speech but leave a recording talking, and Escape stopped
// neither.
function sosStopVoice() {
  stopPrayerNarration();
}

function closeSos() {
  sosClearTimers();
  sosStopVoice();
  $("sosDialog").close();
}

$("sosButton").onclick = openSos;
$("closeSos").onclick = closeSos;
$("sosDialog").addEventListener("cancel", () => { sosClearTimers(); sosStopVoice(); });
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
    document.querySelectorAll("#libraryDialog .filter-tab").forEach(t => t.classList.toggle("active", t.dataset.filter === "all"));
    $("libraryDialog").close();
    go(firstIncompleteDay());
  } else {
    $("libraryDialog").close();
  }
}

// The finder's phrases are in the reader's language (esFearIndex maps each
// Spanish phrase to the same journey), rebuilt when the language changes.
function renderFearFinder() {
  const el = $("fearFinder");
  const lang = state.lang === "es" && typeof esFearIndex !== "undefined" ? "es" : "en";
  if (el.dataset.lang === lang) return;
  el.dataset.lang = lang;
  while (el.options.length > 1) el.remove(1);
  for (const [label, id] of lang === "es" ? esFearIndex : fearIndex) {
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

document.querySelectorAll("#libraryDialog .filter-tab").forEach(tab => {
  tab.onclick = () => {
    libraryFilter = tab.dataset.filter;
    document.querySelectorAll("#libraryDialog .filter-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderGrid();
  };
});

/* ---------- Rendering ---------- */

const weekLabelFor = d => weekLabel(activeTrack().weeks, d);

// What render() last painted. Narration stops only when that changes (another
// day, journey or language); marking the day complete or ♡ repaints the same
// day and leaves the prayer being read undisturbed.
let renderedFor = null;

function render() {
  scheduleOfflineSync();
  scheduleProtect();
  const showing = `${state.lang}|${state.track || "core"}|${day}`;
  if (showing !== renderedFor) {
    stopAudio();
    renderedFor = showing;
  }
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

// The link a share carries is the day's crawlable page, not the app's hash
// route: /day/07-the-word previews with that day's title and description,
// /app#7 only ever previews as the app. dayPagePath (reminder.js) is the same
// function the calendar reminders use, and the unit tests check every path it
// builds against the generated pages.
const sharePageUrl = () => location.origin + dayPagePath(state.track || "core", activeTrack(), day, state.lang);
const shareCardName = () => `stand-day-${String(day + 1).padStart(2, "0")}.png`;

// The share card from the site (api/card.js): for a day, its verse,
// reflection and prayer, the same image the day's page shows; for a Prayer
// Book prayer, the whole prayer. The ".latest." address redirects to the
// current card, since the app knows the page but not the card's hash.
// Offline, slow or failing, a day's verse card is drawn here instead, and a
// prayer is shared as a link. A share sheet must open soon after the tap, so
// the fetch starts on pointerdown and the click reuses it.
let cardFetch = null;
function shareCardUrl() {
  const slug = dayPagePath(state.track || "core", activeTrack(), day, state.lang).split("/").pop();
  return `/cards/${state.lang === "es" ? "es" : "en"}/${state.track || "core"}/${slug}.latest.post.png`;
}
function fetchShareCard(url = shareCardUrl()) {
  if (cardFetch && cardFetch.url === url) return cardFetch.blob;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller && setTimeout(() => controller.abort(), 4000);
  const blob = fetch(url, controller ? { signal: controller.signal } : {})
    .then(res => res.ok && (res.headers.get("content-type") || "").startsWith("image/png") ? res.blob() : null)
    .catch(() => null)
    .finally(() => timer && clearTimeout(timer));
  cardFetch = { url, blob };
  // A failed fetch is not remembered, so the next tap tries again.
  blob.then(b => { if (!b && cardFetch && cardFetch.url === url) cardFetch = null; });
  return blob;
}
async function shareCardBlob(item = dayShare()) {
  return (await fetchShareCard(item.cardUrl)) || (item.fallbackCard ? item.fallbackCard() : null);
}

// What a share carries, for the day open now or for a Prayer Book prayer:
// the page to link to, the title and caption, and the card.
function dayShare() {
  const [title, ref, verse] = activeTrack().days[day];
  return {
    kind: "day", url: sharePageUrl(), heading: t("share.title", { n: day + 1, title }),
    caption: t("share.caption", { verse, ref }),
    cardUrl: shareCardUrl(), cardName: shareCardName(), fallbackCard: buildVerseCard
  };
}
function prayerShare(id) {
  const item = prayerBook.byId(id);
  const lang = state.lang === "es" ? "es" : "en";
  const slug = prayerBook.prayerSlug(lang, id);
  const text = item.text[lang].trim();
  const lead = (text.match(/^.+?[.!?](?=\s|$)/) || [text])[0];
  return {
    kind: "prayer", url: location.origin + prayerBook.prayerPath(lang, id), heading: `${item.name[lang]} — Stand`,
    caption: `“${lead}”`,
    cardUrl: `/cards/${lang}/prayers/${slug}.latest.post.png`, cardName: `stand-${lang === "es" ? "oracion" : "prayer"}-${slug}.png`, fallbackCard: null
  };
}
// A set of the Rosary's mysteries: its page on the site and its card, which
// numbers the five mysteries. rosary.js is loaded by then (the button is in
// the Rosary view).
function rosaryShare(setId) {
  const lang = rosaryLang();
  const set = setById(setId);
  return {
    kind: "rosary", url: location.origin + rosaryPagePath(lang, setId), heading: `${set.name[lang]} — Stand`,
    caption: set.mysteries.map(m => m.name[lang]).join(" · "),
    cardUrl: `/cards/${lang}/rosary/${set.slug[lang]}.latest.post.png`, cardName: `stand-${lang === "es" ? "rosario" : "rosary"}-${set.slug[lang]}.png`, fallbackCard: null
  };
}
// The item the share dialog is showing, for its Save button.
let sharing = null;

$("shareButton").addEventListener("pointerdown", () => { fetchShareCard(); });
$("shareButton").onclick = () => shareItem(dayShare());

async function shareItem(item) {
  const { url, heading, caption } = item;
  try {
    // A phone that can share files gets the card with the link in the text;
    // one that can share only links gets the link; everything else (most
    // desktops) gets the dialog below.
    if (navigator.share) {
      const blob = await shareCardBlob(item);
      const file = blob ? new File([blob], item.cardName, { type: "image/png" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: heading, text: `${caption}\n${url}` });
      } else {
        await navigator.share({ title: heading, text: caption, url });
      }
      return;
    }
  } catch (e) {
    // AbortError is the reader closing the sheet; anything else falls
    // through to the dialog so the share still happens.
    if (e && e.name === "AbortError") return;
  }
  openShareDialog(item);
}

// The desktop share sheet: copy the link, save the verse card, or hand the
// page to a platform through its intent URL. No platform scripts, no
// tracking parameters; the links and icons come from share.js, the same
// ones every day page carries.
function openShareDialog(item) {
  const { url, heading, caption } = item;
  sharing = item;
  const links = shareLinks({ url, title: heading, text: caption });
  const set = (id, name) => { const a = $(id); a.href = links[name]; a.innerHTML = shareIcons[name]; a.title = t(`share.${name}`); };
  set("shareX", "x");
  set("shareFacebook", "facebook");
  set("shareWhatsapp", "whatsapp");
  set("shareEmail", "email");
  $("shareCopyIcon").innerHTML = shareIcons.link;
  $("shareCopyLabel").textContent = t("share.copy");
  $("shareCaption").textContent = caption;
  const keys = { prayer: ["book.share", "book.saveCard"], rosary: ["rosary.share", "rosary.saveCard"] }[item.kind] || ["share.heading", "share.saveCard"];
  $("shareHeading").textContent = t(keys[0]);
  $("shareSaveCard").textContent = t(keys[1]);
  $("shareUrl").value = url;
  $("shareUrl").hidden = true;
  $("shareStatus").textContent = "";
  $("shareDialog").showModal();
}

$("shareCopy").onclick = async () => {
  const url = $("shareUrl").value;
  try {
    await navigator.clipboard.writeText(url);
    $("shareCopyLabel").textContent = t("share.copied");
    $("shareCopy").classList.add("is-copied");
    setTimeout(() => { $("shareCopyLabel").textContent = t("share.copy"); $("shareCopy").classList.remove("is-copied"); }, 1600);
  } catch {
    // No clipboard (older browser, or permission refused): show the link
    // selected, so one keystroke or a long-press copies it.
    $("shareUrl").hidden = false;
    $("shareUrl").focus();
    $("shareUrl").select();
    $("shareStatus").textContent = t("share.manual");
  }
};

$("shareSaveCard").onclick = async () => {
  const item = sharing || dayShare();
  const blob = await shareCardBlob(item);
  if (blob) downloadFile(item.cardName, blob, "image/png");
  else $("shareStatus").textContent = t("share.cardOffline");
};

$("closeShare").onclick = () => $("shareDialog").close();

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
$("libraryButton").onclick = () => { renderFearFinder(); renderTrackPicker(); renderOfflineRow(); renderBookEntry(); $("libraryDialog").showModal(); };
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
    langs: Object.keys(prayerUi),
    prayerIds: prayerCorpus.traditional.map(p => p.id),
    rosarySets: typeof rosary !== "undefined" ? rosary.sets.map(s => s.id) : []
  });
}

$("backupButton").onclick = () => { saveBackup(); protectData(); };

$("restoreInput").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  let clean = null;
  // A backup may hold a Rosary in progress, checked against rosary.js.
  await loadRosary();
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
  $("voiceRate").value = String(state.voiceRate);
  await languageReady();
  day = Math.max(0, Math.min(day, DAYS() - 1));
  location.hash = String(day + 1);
  applyTheme();
  applyUi();
  renderLedger();
  renderJournal();
  renderTrackPicker();
  render();
};

$("eraseButton").onclick = async () => {
  if (!confirm(t("erase.confirm"))) return;
  try { for (const key of [STORAGE_KEY, OFFLINE_KEY, BACKUP_AT_KEY, BACKUP_SNOOZE_KEY]) localStorage.removeItem(key); } catch { /* nothing to remove */ }
  try { if (typeof caches !== "undefined") await caches.delete(OFFLINE_CACHE); } catch { /* no saved audio */ }
  location.reload();
};

/* ---------- Keeping the reader's data ---------- */

// Everything a reader keeps lives in this browser's storage, and a browser
// may clear it: Safari deletes a website's storage after about a week
// without a visit unless the site was added to the Home Screen, and any
// browser may evict it under storage pressure. Two defences. Once there is
// something worth keeping, ask the browser to keep this site's storage
// (granted or refused silently in most browsers; Firefox asks). And when the
// data is still at risk, offer a backup, gently: at most once a month, never
// before there are three days done or a note, and never in an installed
// copy. The two timestamps are this device's, kept outside the backup.
const BACKUP_AT_KEY = "stand-backup-at";
const BACKUP_SNOOZE_KEY = "stand-backup-snooze";
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
let persistRequested = false;
let protectTimer = 0;

const readTime = key => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
const stampTime = key => { try { localStorage.setItem(key, String(Date.now())); } catch { /* private mode */ } };
const installedCopy = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const onIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** What this device holds that would hurt to lose. */
function keptData() {
  const others = Object.values(state.tracks || {}).filter(Boolean);
  const completed = (state.completed || []).length + others.reduce((n, t) => n + (t.completed || []).length, 0);
  const notes = [state.notes || {}, ...others.map(t => t.notes || {})].some(n => Object.values(n).some(v => String(v).trim()));
  return { completed, notes, checkins: (state.checkins || []).length + (state.sos || []).length };
}

async function storagePersisted() {
  try { return Boolean(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch { return false; }
}

function saveBackup() {
  downloadFile("stand-backup.json", JSON.stringify(state, null, 2), "application/json");
  stampTime(BACKUP_AT_KEY);
}

function scheduleProtect() {
  clearTimeout(protectTimer);
  protectTimer = setTimeout(protectData, 500);
}

async function protectData() {
  const kept = keptData();
  if (!kept.completed && !kept.notes && !kept.checkins) { $("backupNudge").hidden = true; return; }
  let persisted = await storagePersisted();
  if (!persisted && !persistRequested && navigator.storage && navigator.storage.persist) {
    persistRequested = true;
    try { persisted = Boolean(await navigator.storage.persist()); } catch { /* not offered */ }
  }
  const now = Date.now();
  const due = now - readTime(BACKUP_AT_KEY) > MONTH_MS && now - readTime(BACKUP_SNOOZE_KEY) > MONTH_MS;
  const enough = kept.completed >= 3 || kept.notes;
  // An installed copy keeps its storage; elsewhere, iPhone is at risk even
  // with persistence granted, and other browsers only when it was refused.
  const atRisk = !installedCopy() && (onIPhone() || !persisted);
  const show = enough && due && atRisk;
  if (show) {
    $("backupNudgeText").textContent = t(onIPhone() ? "backup.nudgeIos" : "backup.nudge");
    $("backupNudgeActions").hidden = false;
  }
  $("backupNudge").hidden = !show;
}

$("backupNudgeSave").onclick = () => {
  saveBackup();
  $("backupNudgeText").textContent = t("backup.nudgeSaved");
  $("backupNudgeActions").hidden = true;
  setTimeout(() => { $("backupNudge").hidden = true; }, 6000);
};

$("backupNudgeLater").onclick = () => {
  stampTime(BACKUP_SNOOZE_KEY);
  $("backupNudge").hidden = true;
};

/* ---------- Offline listening ---------- */

// Opt-in and per device: the preference lives under its own key, outside the
// backup, because a cache belongs to one phone. When on, the recordings for
// the week ahead in the reader's journey and language, and the SOS sets, are
// fetched into the Cache API (offline-audio.js decides which) and played from
// blob: URLs, so a lost connection changes nothing. Anything not saved still
// streams. Nothing is fetched when the device asks to save data.
const OFFLINE_KEY = "stand-offline-audio";
let offlineRun = 0;
let offlineTimer = 0;

const offlineSupported = () => typeof caches !== "undefined" && typeof fetch === "function" && !ttsOnly
  && audioManifest.enabled !== false && Boolean(audioManifest.base);
function offlineOn() {
  try { return localStorage.getItem(OFFLINE_KEY) === "1"; } catch { return false; }
}
const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);

function renderOfflineRow() {
  $("offlineRow").hidden = !offlineSupported();
  $("offlineAudio").checked = offlineOn();
}

function scheduleOfflineSync() {
  if (!offlineOn()) return;
  clearTimeout(offlineTimer);
  offlineTimer = setTimeout(syncOfflineAudio, 800);
}

// Forgets a saved copy. Its blob URL is revoked too, unless the player is
// using it right now (revoking that would cut the recording off mid-prayer).
function releaseOfflineBlob(url) {
  const blobUrl = offlineBlobs.get(url);
  offlineBlobs.delete(url);
  if (blobUrl && audioEl.src !== blobUrl) URL.revokeObjectURL(blobUrl);
}

async function syncOfflineAudio() {
  const run = ++offlineRun;
  if (!offlineOn() || !offlineSupported()) return;
  const status = $("offlineStatus");
  const plan = offlinePlan(audioManifest, offlineIds({
    lang: state.lang, track: state.track || "core", day, days: DAYS(), sosCount: sosSets().length,
    prayers: prayerFavorites()
  }));
  let cache;
  try { cache = await caches.open(OFFLINE_CACHE); } catch { return; }
  const wanted = new Set(plan.keep.map(k => k.url));
  // The window moved (a new day, journey or language): drop what fell out.
  try {
    for (const request of await cache.keys()) if (!wanted.has(request.url)) await cache.delete(request);
  } catch { /* storage refused; keep going */ }
  for (const url of [...offlineBlobs.keys()]) if (!wanted.has(url)) releaseOfflineBlob(url);

  let saved = 0, bytes = 0;
  for (const [i, item] of plan.keep.entries()) {
    if (run !== offlineRun) return; // a newer sync took over
    let response = null;
    try { response = await cache.match(item.url); } catch { /* treat as missing */ }
    if (!response && navigator.onLine !== false && !saveData()) {
      status.textContent = t("offline.saving", { n: i + 1, total: plan.keep.length });
      try {
        const fetched = await fetch(item.url, { mode: "cors", credentials: "omit" });
        if (fetched.status === 200) { await cache.put(item.url, fetched.clone()); response = fetched; }
      } catch { /* offline, blocked, or out of space: try again next time */ }
    }
    if (!response) continue;
    saved++;
    bytes += item.bytes;
    if (!offlineBlobs.has(item.url)) {
      try { offlineBlobs.set(item.url, URL.createObjectURL(await response.blob())); } catch { /* unreadable copy */ }
    }
  }
  if (run !== offlineRun) return;
  status.textContent = saved === plan.keep.length
    ? t("offline.saved", { n: saved, mb: megabytes(bytes) })
    : t("offline.partial", { n: saved, total: plan.keep.length });
}

$("offlineAudio").onchange = async () => {
  const on = $("offlineAudio").checked;
  try { if (on) localStorage.setItem(OFFLINE_KEY, "1"); else localStorage.removeItem(OFFLINE_KEY); } catch { /* private mode */ }
  if (on) { syncOfflineAudio(); return; }
  offlineRun++;
  for (const url of [...offlineBlobs.keys()]) releaseOfflineBlob(url);
  try { await caches.delete(OFFLINE_CACHE); } catch { /* nothing saved */ }
  $("offlineStatus").textContent = t("offline.off");
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
    const speak = () => speakPrayer(narrationSegments(item.text[state.lang], item.audio, state.lang), listen, item.name[state.lang]);
    if (src) playPrayerRecording(src, listen, speak, item.name[state.lang]);
    else speak();
  };
  card.append(listen);
}

// A button may carry its own resting label (SOS says "Hear this prayed");
// every prayer button reads the same Stop while it plays.
function updatePrayerButton(button, playing) {
  if (button) button.textContent = playing ? ui().stop : button.dataset.listen || ui().listen;
}

function stopPrayerNarration() {
  const then = prayerAudio.onEnd;
  prayerAudio.onEnd = null;
  clearTimeout(prayerAudio.timer);
  if (prayerAudio.playing && canSpeak) speechSynthesis.cancel();
  if (prayerAudio.playing) setMediaPlaybackState("none");
  if (prayerAudio.recorded) {
    prayerAudio.recorded = false;
    audioEl.pause();
    clearPositionState();
  }
  prayerAudio.playing = false;
  for (const id of ["prayerListen", "traditionalListen", "rosaryListen", "sosListen"]) updatePrayerButton($(id), false);
  book.playing = null;
  paintBookPlay();
  $("bookProgress").style.width = "0";
  if (then) then(false);
}

// A prayer read to its end by the device voice: whatever asked to hear when
// it ended is told it finished, not that it was stopped.
function finishPrayerNarration() {
  const then = prayerAudio.onEnd;
  prayerAudio.onEnd = null;
  stopPrayerNarration();
  if (then) then(true);
}

// Plays a prayer's recording through the shared audio element. The day
// player's own state is left idle, so its progress bar stays out of it; the
// Media Session shows the prayer's title with its own position and controls.
// The element's "ended" handler stops everything, which resets the button.
// A file that will not play falls back to the device voice.
function playPrayerRecording(src, button, fallback, title) {
  if (prayerAudio.playing) { stopPrayerNarration(); return; }
  stopAudio();
  prayerAudio.playing = true;
  prayerAudio.recorded = true;
  updatePrayerButton(button, true);
  audioEl.src = src;
  audioEl.playbackRate = voiceRate();
  audioEl.currentTime = 0;
  audioEl.play().then(() => {
    if (!prayerAudio.recorded) return;
    setMediaSession(title || document.title);
    setMediaPlaybackState("playing");
  }).catch(() => {
    if (!prayerAudio.recorded) return;
    prayerAudio.recorded = false;
    prayerAudio.playing = false;
    // The fallback starts afresh (and sets its own onEnd), so starting it is
    // not a stop.
    prayerAudio.onEnd = null;
    fallback();
  });
}

// Speaks segments in order, holding the silence each one asks for afterwards.
// The lock screen shows the title where the device shows one for speech.
function speakPrayer(segments, button, title) {
  if (prayerAudio.playing) { stopPrayerNarration(); return; }
  if (!canSpeak) return;
  stopAudio();
  prayerAudio.playing = true;
  updatePrayerButton(button, true);
  setMediaSession(title || document.title);
  speechMediaSession();
  setMediaPlaybackState("playing");

  let i = 0;
  const next = () => {
    if (!prayerAudio.playing) return;
    if (i >= segments.length) { finishPrayerNarration(); return; }
    const segment = segments[i++];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.rate = voiceRate() * 0.95;
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
// The composer lists the traditional prayers; the Prayer Book is where they
// are read and prayed, so it opens there, at the prayer open here if any.
$("traditionalBook").onclick = () => {
  const id = prayerState.openTraditional;
  $("prayerDialog").close();
  openBook(id);
};
$("prayerDialog").addEventListener("close", stopPrayerNarration);

$("prayerLang").onchange = () => {
  state.lang = $("prayerLang").value;
  save();
  renderPrayerSurface();
  // The choice is app-wide: the interface, the devotional day, the week label
  // and the library all follow it, so repaint them behind the open dialog.
  const repaintJourneys = () => { render(); renderTrackPicker(); renderFearFinder(); };
  applyUi();
  repaintJourneys();
  // The first switch to Spanish fetches the journeys' Spanish text; the
  // composer and the interface are already bilingual, so they change at
  // once and the day follows a moment later.
  if (state.lang === "es" && typeof esTracks === "undefined") loadSpanish().then(repaintJourneys);
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
  $("prayerListen"),
  $("prayerHeading").textContent
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

/* ---------- Prayer Book ----------
   The traditional prayers as a book to read and pray from, in the order and
   sections prayerbook.js gives them (the same as the Prayer Book pages): a
   list with the library's filter tabs, and a reader with a player, a
   favorite and share, like a day. The words are the corpus's; only the
   chrome is here. Playback goes through the composer's prayer narration, so
   one prayer plays at a time and the lock screen controls work the same. */

const prayerFavorites = () => (state.prayerFavorites = Array.isArray(state.prayerFavorites) ? state.prayerFavorites : []);

/** A prayer's recorded length in seconds, or null when it will not play a
 * recording (none in the manifest, or recordings switched off). */
function bookSeconds(id) {
  const item = audioManifest.items[prayerItemId(state.lang, id)];
  return item && item.seconds && recordedUrl(prayerItemId(state.lang, id)) ? item.seconds : null;
}
const clockTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function renderBookEntry() {
  $("bookEntryMeta").textContent = t("book.entryMeta", { n: prayerBook.prayers().length });
}

function renderBookList() {
  const el = $("bookSections");
  el.textContent = "";
  const favorites = prayerFavorites();
  const sections = book.filter === "favorites" ? [null]
    : prayerBook.sections.filter(s => book.filter === "all" || s === book.filter);
  for (const tradition of sections) {
    const items = prayerBook.prayers().filter(p => tradition ? p.tradition === tradition : favorites.includes(p.id));
    if (tradition) {
      const heading = document.createElement("p");
      heading.className = "section-kicker";
      heading.textContent = prayerBook.label(tradition, state.lang).toLocaleUpperCase(state.lang);
      const note = document.createElement("p");
      note.className = "tradition-note";
      note.textContent = prayerBook.note(tradition, state.lang);
      el.append(heading, note);
    }
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = t("book.emptyFavorites");
      el.append(empty);
      continue;
    }
    const grid = document.createElement("div");
    grid.className = "day-grid book-grid";
    for (const item of items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "day-card";
      card.dataset.prayer = item.id;
      if (favorites.includes(item.id)) {
        const mark = document.createElement("span");
        mark.className = "fav-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = "♥";
        card.append(mark);
      }
      const seconds = bookSeconds(item.id);
      const small = document.createElement("small");
      small.textContent = seconds ? clockTime(seconds) : prayerBook.label(item.tradition, state.lang);
      const name = document.createElement("strong");
      name.textContent = item.name[state.lang];
      card.append(small, name);
      card.onclick = () => showBookPrayer(item.id);
      grid.append(card);
    }
    el.append(grid);
  }
  $("bookWeb").href = prayerBook.bookPath(state.lang);
}

// A recording pauses in place (❚❚); the device voice cannot pause reliably,
// so while it reads the button says, and does, Stop (■).
function paintBookPlay() {
  const playing = Boolean(book.playing) && book.playing === book.open && (!prayerAudio.recorded || !audioEl.paused);
  const pauses = prayerAudio.recorded;
  $("bookPlayIcon").textContent = playing ? (pauses ? "❚❚" : "■") : "▶";
  $("bookPlay").setAttribute("aria-label", t(playing ? (pauses ? "book.pause" : "book.stop") : "book.play"));
}

function paintBookProgress() {
  if (!audioEl.duration || book.playing !== book.open) return;
  $("bookProgress").style.width = `${Math.min(100, (audioEl.currentTime / audioEl.duration) * 100)}%`;
  $("bookPlayInfo").textContent = t("book.recorded", { time: `${clockTime(audioEl.currentTime)} / ${clockTime(audioEl.duration)}` });
}

function paintBookFavorite() {
  const fav = prayerFavorites().includes(book.open);
  $("bookFavorite").textContent = fav ? "♥" : "♡";
  $("bookFavorite").classList.toggle("active", fav);
  $("bookFavorite").setAttribute("aria-pressed", String(fav));
  $("bookFavorite").setAttribute("aria-label", t(fav ? "book.unfavorite" : "book.favorite"));
}

function showBookPrayer(id) {
  const item = prayerBook.byId(id);
  if (!item) return;
  stopAlong();
  if (book.playing && book.playing !== id) stopPrayerNarration();
  book.open = id;
  $("bookList").hidden = true;
  $("rosaryView").hidden = true;
  syncWakeLock();
  $("bookReader").hidden = false;
  $("bookSection").textContent = prayerBook.label(item.tradition, state.lang).toLocaleUpperCase(state.lang);
  $("bookTitle").textContent = item.name[state.lang];
  $("bookNote").textContent = prayerBook.note(item.tradition, state.lang);
  const text = $("bookText");
  text.textContent = "";
  const own = document.createElement("p");
  own.textContent = item.text[state.lang].trim();
  text.append(own);
  // "Show both languages" in the composer applies here too, as in a
  // bilingual prayer book: the other language beneath, marked as such.
  if (state.bilingual) {
    const other = document.createElement("p");
    other.className = "book-other";
    other.lang = otherLang();
    other.textContent = item.text[otherLang()].trim();
    text.append(other);
  }
  const seconds = bookSeconds(id);
  $("bookPlayInfo").textContent = seconds ? t("book.recorded", { time: clockTime(seconds) }) : canSpeak ? t("book.deviceVoice") : t("book.unsupported");
  if (book.playing !== id) $("bookProgress").style.width = "0";
  const all = prayerBook.prayers();
  const i = all.findIndex(p => p.id === id);
  for (const [button, target, label] of [[$("bookPrev"), all[i - 1], n => `← ${n}`], [$("bookNext"), all[i + 1], n => `${n} →`]]) {
    button.hidden = !target;
    if (target) {
      button.textContent = label(target.name[state.lang]);
      button.onclick = () => showBookPrayer(target.id);
    }
  }
  paintBookPlay();
  paintBookFavorite();
  $("bookDialog").scrollTop = 0;
}

function showBookList() {
  book.open = null;
  stopAlong();
  $("bookReader").hidden = true;
  $("rosaryView").hidden = true;
  syncWakeLock();
  $("bookList").hidden = false;
  renderRosaryEntry();
  document.querySelectorAll("#bookDialog .filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.bookFilter === book.filter));
  renderBookList();
}

/** Open the Prayer Book, at one prayer when `id` names one. */
function openBook(id) {
  if ($("libraryDialog").open) $("libraryDialog").close();
  if (id && prayerBook.byId(id)) showBookPrayer(id);
  else showBookList();
  if (!$("bookDialog").open) $("bookDialog").showModal();
}

$("bookEntry").onclick = () => openBook();
$("bookButton").onclick = () => openBook();
$("closeBook").onclick = () => $("bookDialog").close();
$("bookDialog").addEventListener("close", stopPrayerNarration);
$("bookBack").onclick = showBookList;
document.querySelectorAll("#bookDialog .filter-tab").forEach(tab => {
  tab.onclick = () => { book.filter = tab.dataset.bookFilter; showBookList(); };
});

$("bookPlay").onclick = () => {
  const item = prayerBook.byId(book.open);
  if (!item) return;
  // The prayer already playing here pauses and resumes in place (a
  // recording), or stops (the device voice, which cannot pause reliably).
  if (book.playing === item.id) {
    if (prayerAudio.recorded) {
      if (audioEl.paused) audioEl.play().then(() => { setMediaPlaybackState("playing"); paintBookPlay(); }).catch(stopPrayerNarration);
      else { audioEl.pause(); setMediaPlaybackState("paused"); paintBookPlay(); }
    } else stopPrayerNarration();
    return;
  }
  // Both ways of playing stop whatever was playing first, which clears
  // book.playing, so it is set after them.
  const speak = () => {
    speakPrayer(narrationSegments(item.text[state.lang], item.audio, state.lang), null, item.name[state.lang]);
    book.playing = item.id;
    paintBookPlay();
  };
  const src = recordedUrl(prayerItemId(state.lang, item.id));
  if (!src && !canSpeak) { $("bookPlayInfo").textContent = t("book.unsupported"); return; }
  if (prayerAudio.playing) stopPrayerNarration();
  if (src) {
    playPrayerRecording(src, null, speak, item.name[state.lang]);
    book.playing = item.id;
    paintBookPlay();
  } else speak();
};

$("bookFavorite").onclick = () => {
  const favorites = prayerFavorites();
  const i = favorites.indexOf(book.open);
  i < 0 ? favorites.push(book.open) : favorites.splice(i, 1);
  save();
  scheduleProtect();
  paintBookFavorite();
  // A favorite is kept for offline listening, when that is on.
  scheduleOfflineSync();
};

// A prayer shares the way a day does: its card and the link to its page on
// a phone that can, else the share dialog (copy, save the card, platforms).
$("bookShare").addEventListener("pointerdown", () => { if (book.open) fetchShareCard(prayerShare(book.open).cardUrl); });
$("bookShare").onclick = () => { if (book.open) shareItem(prayerShare(book.open)); };
$("rosaryShare").addEventListener("pointerdown", () => { if (rosaryRun.set) fetchShareCard(rosaryShare(rosaryRun.set).cardUrl); });
$("rosaryShare").onclick = () => { if (rosaryRun.set) shareItem(rosaryShare(rosaryRun.set)); };

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

function renderRosaryEntry(retry = true) {
  // rosary.js arrives on the Prayer Book's first opening; the entry fills in
  // then (once: a failed load leaves it as its title alone).
  if (typeof rosarySteps === "undefined") {
    $("rosaryEntryMeta").textContent = "";
    if (retry) loadRosary().then(() => renderRosaryEntry(false));
    return;
  }
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

$("rosaryEntry").onclick = () => openRosary();
$("rosaryBack").onclick = () => { stopAlong(); stopPrayerNarration(); showBookList(); };
$("rosaryNext").onclick = () => rosaryMove(rosaryNext);
$("rosaryPrev").onclick = () => rosaryMove(rosaryPrev);
$("rosarySet").onchange = () => { stopAlong(); stopPrayerNarration(); startRosary($("rosarySet").value); renderRosary(); };
$("rosaryFatima").onchange = () => setRosaryFatima($("rosaryFatima").checked);
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
  $("voiceRate").value = String(VOICE_RATES.includes(state.voiceRate) ? state.voiceRate : 1);
  initReminder();
  if (dayFromHash() === null) history.replaceState(null, "", `${location.search}#${day + 1}`);
  render();
  // The evening calendar check-in links here: land on the fear check-in.
  if (new URLSearchParams(location.search).has("checkin")) {
    $("dayCheckin").scrollIntoView({ block: "center" });
  }
  // A Prayer Book page links here with ?prayer=<id>: open that prayer in the
  // reader, ready to play. The welcome waits for a later visit.
  const prayer = prayerCorpus.traditional.find(t => t.id === new URLSearchParams(location.search).get("prayer"));
  if (new URLSearchParams(location.search).has("sos")) {
    state.welcomed = true;
    save();
    openSos();
  } else if (prayer) {
    openBook(prayer.id);
  } else if (new URLSearchParams(location.search).has("rosary")) {
    // A Rosary page links here with ?rosary=<set>, or ?rosary=today.
    openRosary(new URLSearchParams(location.search).get("rosary"));
  } else if (!state.welcomed) {
    $("welcomeDialog").showModal();
  }
  clearLinkParams();
}

// A link's settings (?lang, ?track, ?prayer, ?rosary, ?sos, ?checkin) are
// applied once, above; left in the address bar, a reload or a bookmark would
// reopen that prayer or switch back that journey. Anything else, such as the
// ?tts=1 kill switch, stays.
function clearLinkParams() {
  const params = new URLSearchParams(location.search);
  const used = ["lang", "track", "prayer", "rosary", "sos", "checkin"].filter(key => params.has(key));
  if (!used.length) return;
  for (const key of used) params.delete(key);
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

// app.js is the last script in the body, so parsing is still in progress and
// DOMContentLoaded has not fired; the microtask is the belt-and-braces path if
// the script is ever moved or given defer. A Spanish reader's first paint
// waits for the Spanish text, so the day never flashes in English.
const boot = () => languageReady().then(start);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else queueMicrotask(boot);
