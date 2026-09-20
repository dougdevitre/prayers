const themes = [
  ["Stand","Ephesians 6:10–13","Be strong in the Lord and in his mighty power.","The first command of spiritual combat is not attack. It is to stand. Standing means refusing to let fear, anger, pressure, accusation, or uncertainty dictate who you become.","Father, establish me within before I attempt to change anything around me. Where I am frightened, give me courage. Where I am confused, give me clarity. Where I am angry, give me discipline. Where I am exhausted, renew my strength. I will not surrender my character to my circumstances. Help me stand.","I will stand in truth, walk in peace, and keep my character.","When something triggers you, pause and ask: What would standing in truth look like right now?"],
  ["Truth","Ephesians 6:14","Stand firm then, with the belt of truth buckled around your waist.","Truth is the first piece of armor. Spiritual combat begins with intellectual honesty: separating what you know, what you believe, what you assume, and what you fear.","God of truth, remove deception from around me and self-deception from within me. Do not merely show me the truths I want to discover. Show me truth itself. Give me courage to change my mind when evidence requires it. Let truth matter more than winning.","Truth matters more than my need to be right.","Divide one difficult situation into three columns: known, believed, and unknown."],
  ["Righteousness","Ephesians 6:14","Stand firm, with the breastplate of righteousness in place.","Spiritual warfare is not only about identifying wrongdoing in others. It asks whether your own conduct matches the standard you expect from everyone else.","Lord, search my motives. Expose hypocrisy, correct pride, remove vengeance, and strengthen integrity. Let my private character match my public words. May the right thing remain right even when nobody sees it.","My character is measured by what I practice, not what I proclaim.","Do one right thing today when nobody is watching."],
  ["Peace","Ephesians 6:15","Have your feet fitted with the readiness that comes from the gospel of peace.","Peace is not passivity. It can require boundaries, hard conversations, repair, or walking away. Peace refuses unnecessary chaos without hiding from necessary truth.","Prince of Peace, make me an instrument of peace without making me afraid of necessary conflict. Help me know when to speak, when to listen, when to act, and when to walk away.","I can carry peace into a place without surrendering truth.","Remove one unnecessary source of conflict from your day."],
  ["Faith","Ephesians 6:16","Take up the shield of faith, with which you can extinguish all the flaming arrows.","Faith does not pretend difficulty is unreal. Faith refuses to give difficulty ultimate authority. It makes room for a next faithful step before the whole path is visible.","God, there are outcomes I cannot control, questions I cannot answer, and people I cannot change. I place them before You. Give me enough faith to take the next faithful step.","This difficulty is real, but it does not control my character.","Name one uncontrollable outcome and release it aloud."],
  ["Guard the Mind","Ephesians 6:17","Take the helmet of salvation.","Rumination can turn one painful moment into hundreds of imagined ones. Guarding the mind means deciding which thoughts deserve continued attention.","God, protect my mind. Interrupt obsessive fear, challenge catastrophic thinking, and expose false narratives. Return me to what is true, useful, honorable, and within my responsibility.","My mind does not need to solve everything today.","Test one recurring thought: Is it true, known, useful, and actionable?"],
  ["The Word","Ephesians 6:17","Take the sword of the Spirit, which is the word of God.","Words shape interpretation, and interpretation shapes action. Sacred words can return you to courage when noise pulls you toward panic.","Lord, place words of truth within me before the world fills me with noise. Let Scripture challenge fear, pride, hatred, despair, and temptation.","Truth will remain after today's noise disappears.","Choose one short verse and return to it three times today."],
  ["Fear","Psalm 27:1","The Lord is my light and my salvation—whom shall I fear?","Fear predicts futures that have not happened. Courage returns to the responsibility directly in front of you.","Lord, bring me back to today. Give me courage for today's responsibility rather than anxiety about tomorrow's possibilities. I will prepare wisely, but I will not worship fear.","Fear may speak, but it does not get the final word.","Do one thing fear has persuaded you to postpone."],
  ["Anger","James 1:19–20","Be quick to listen, slow to speak and slow to become angry.","Anger can carry information about a wound, boundary, injustice, or fear. It becomes dangerous when it moves from messenger to master.","God, let anger become information rather than my master. Show me what lies beneath it, then teach me to respond with clarity and proportion.","I can feel anger without surrendering my conduct to it.","Delay an angry response until your body becomes calm."],
  ["Resentment","Romans 12:21","Do not be overcome by evil, but overcome evil with good.","Resentment keeps another person's wrongdoing active inside you. Releasing it does not excuse harm; it refuses to let harm reproduce itself.","Lord, I refuse to carry another person's wrongdoing inside me indefinitely. Help me pursue accountability without revenge. Let evil stop with me.","What harmed me will not determine what I become.","Name one resentment you are ready to begin releasing."],
  ["Pride","Proverbs 16:18","Pride goes before destruction, a haughty spirit before a fall.","Pride turns uncertainty into performance and correction into threat. Humility creates freedom to learn, repair, and receive help.","God, protect me from needing to win every argument. Give me freedom to say: I was wrong. I do not know. I need help. Please forgive me.","I do not lose dignity when I become teachable.","Admit one thing you do not know."],
  ["Temptation","Matthew 4:10","Worship the Lord your God, and serve him only.","Temptation often becomes powerful through rationalization. Freedom grows when you notice the decision point before it becomes a habit.","Lord, help me recognize temptation before I rename or excuse it. Give me strength during the few moments when a decision becomes a pattern.","I can choose what strengthens the person I am becoming.","Remove one environmental trigger connected to a recurring temptation."],
  ["Despair","Psalm 42:11","Put your hope in God, for I will yet praise him.","Feelings are powerful witnesses, but imperfect prophets. Despair speaks in absolutes; hope looks for the next constructive step.","God, when my feelings tell me nothing will improve, remind me that this moment is not the whole story. Give me enough hope for one more faithful step.","I do not need all the hope—only enough for the next step.","Do one constructive thing for your future self."],
  ["Rest","Matthew 11:28","Come to me, all you who are weary and burdened, and I will give you rest.","Exhaustion is not proof of faithfulness. Rest restores perspective, restraint, attention, and the ability to love well.","Lord, I surrender the belief that exhaustion proves devotion. Teach me to rest without guilt. Restore my body, quiet my mind, and renew my spirit.","Rest is part of faithfulness, not a departure from it.","Protect a period of genuine rest today."],
  ["Guard Your Words","James 3:5","The tongue is a small part of the body, but it makes great boasts.","Words can clarify or inflame, defend dignity or destroy it. Spiritual discipline places a guard between emotional impulse and lasting speech.","God, put a guard over my mouth. Let my words be truthful without cruelty, strong without abuse, and clear without manipulation.","My words will serve truth, repair, and necessary boundaries.","Read an emotional message twice before sending it."],
  ["Discernment","James 1:5","If any of you lacks wisdom, you should ask God.","Discernment separates observable behavior from stories about motives. It holds alertness and humility together.","Lord, give me discernment without suspicion, alertness without paranoia, confidence without arrogance, and compassion without gullibility.","I can observe carefully without pretending to know every motive.","Write the facts of one situation separately from your interpretation."],
  ["Boundaries","Proverbs 4:23","Above all else, guard your heart, for everything you do flows from it.","Forgiveness does not require unlimited access. A healthy boundary protects peace and responsibility; punishment tries to control another person's pain.","God, teach me to establish boundaries without hatred. Remove bitterness without removing discernment. Let forgiveness free my heart while wisdom guards the door.","I can love someone without granting unsafe access.","Name one boundary that protects peace without punishing."],
  ["False Accusations","Psalm 37:6","He will make your righteous reward shine like the dawn.","You can answer falsehood with calm facts without making every opinion your assignment. Document what matters; release what you cannot control.","Lord, when misunderstood, keep me from destroying my peace trying to control every perception. Help me speak truth, correct what is false, accept what is mine, and release the rest.","An accusation does not define my identity.","Replace repeated self-defense with one clear factual statement."],
  ["Forgiveness","Colossians 3:13","Forgive as the Lord forgave you.","Forgiveness can be a process. It releases the desire for revenge; it does not erase memory, accountability, consequences, or wise distance.","God, begin the work of forgiveness within me. Remove my desire to see another suffer merely because I suffered. Keep wisdom and boundaries intact.","I release vengeance while preserving truth and responsibility.","Pray for freedom from resentment, not forced reconciliation."],
  ["Love Your Enemy","Matthew 5:44","Love your enemies and pray for those who persecute you.","Loving an enemy does not mean calling harm good. It means refusing dehumanization while seeking protection, truth, and accountability.","Lord, teach me to oppose harmful behavior without dehumanizing the person responsible. Protect my heart from becoming what hurt me.","I can seek accountability without hatred.","Refuse dehumanizing language about someone you oppose."],
  ["Protect the Vulnerable","Isaiah 1:17","Seek justice. Defend the oppressed.","Strength becomes holy when it protects rather than dominates. Advocacy serves another person's dignity instead of using their pain for recognition.","God, make my strength useful to someone vulnerable. Give me courage to protect without controlling, advocate without exploiting, and serve without needing recognition.","My strength is entrusted to me for service.","Help someone who cannot repay you."],
  ["Courage","Joshua 1:9","Be strong and courageous. Do not be afraid.","Courage is not the absence of fear. It is faithful movement while fear is present.","God, give me enough courage to move while fear is present. Keep me from waiting for perfect confidence before doing what is right.","I can be afraid and still be faithful.","Take one action you have been avoiding."],
  ["Wisdom","Proverbs 3:5–6","Trust in the Lord with all your heart and lean not on your own understanding.","Urgency can impersonate wisdom. Wise decisions create room for counsel, consequences, conscience, and time.","Lord, slow me down enough to see clearly. Keep urgency from making choices that wisdom would refuse.","I am permitted to pause before a non-emergency decision.","Delay one decision long enough to consider its consequences."],
  ["Justice","Micah 6:8","Act justly and love mercy and walk humbly with your God.","Justice is not favoritism for our own side. It applies the same dignity, evidence, and standard even to people we dislike.","God, give me a love for justice that includes justice for people I oppose. Protect me from demanding standards for others that I reject for myself.","Truth and fairness do not change sides to favor me.","Apply to yourself the standard you apply to another."],
  ["Mercy","Luke 6:36","Be merciful, just as your Father is merciful.","Mercy makes room for human weakness and repair without erasing responsibility. It is neither denial nor enabling.","Lord, let mercy temper judgment without hiding truth. Teach me the difference between compassion and enabling.","I can make room for repair while keeping healthy limits.","Give someone room to correct a genuine mistake."],
  ["Humility","Philippians 2:3","In humility value others above yourselves.","Humility is accurate self-knowledge: neither self-exaltation nor self-erasure. It listens for truth even when correction feels uncomfortable.","God, make me teachable. When correction comes, help me examine it before rejecting it. Keep me secure enough to learn.","Correction can refine me without defining me.","Ask someone trustworthy: What am I not seeing?"],
  ["Perseverance","Romans 5:4","Perseverance produces character; and character, hope.","Some battles are won through endurance rather than dramatic victory. Small faithful acts compound when visible results are slow.","Lord, give me strength to continue doing what is right when results are delayed. Protect me from confusing slow progress with failure.","Faithfulness still counts when nobody applauds it.","Complete one small task connected to a long-term goal."],
  ["Surrender","Matthew 6:34","Do not worry about tomorrow, for tomorrow will worry about itself.","Surrender releases outcomes while retaining responsibility. It is not giving up; it is returning each burden to its proper owner.","Father, I surrender outcomes while retaining responsibility. I will do what belongs to me and release what does not.","I am responsible for faithfulness, not control of every outcome.","Write what you cannot control and physically put the paper away."],
  ["Become the Light","Matthew 5:14","You are the light of the world.","Healing becomes service when your presence offers courage, truth, stability, compassion, and hope to someone else.","God, do more than deliver me from darkness. Teach me to carry light. Make my presence a source of courage, truth, stability, compassion, and hope.","What I have survived can become light for someone else.","Encourage one person who is struggling."],
  ["Character","Ephesians 6:18","Pray in the Spirit on all occasions with all kinds of prayers and requests.","The deepest victory may not be defeating an enemy. It may be that hatred did not make you hateful, deception dishonest, fear cowardly, or suffering cruel.","Father, clothe me in truth, guard my heart, direct my feet toward peace, strengthen my faith, protect my mind, and place Your Word within me. When I have done everything I know how to do, teach me to stand.","Darkness around me will not become darkness within me.","Review the journey. Choose one practice to carry into the next thirty days."]
];

const weeks = [
  "WEEK ONE · ESTABLISH THE GROUND",
  "WEEK TWO · CONFRONT THE INNER BATTLE",
  "WEEK THREE · COMBAT IN RELATIONSHIPS",
  "WEEK FOUR · TRANSFORMATION",
  "DAY THIRTY · THE FINAL BATTLE IS CHARACTER"
];

const TOTAL_DAYS = themes.length;
const STORAGE_KEY = "stand-state";
const $ = id => document.getElementById(id);
const canSpeak = "speechSynthesis" in window;

/* ---------- Persistent state ---------- */

function loadState() {
  const fallback = { completed: [], favorites: [], notes: {}, completedDates: {}, checkins: [], sos: [], theme: null, welcomed: false };
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
  const days = new Set(Object.values(state.completedDates));
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
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_DAYS ? n - 1 : null;
}

function firstIncompleteDay() {
  for (let i = 0; i < TOTAL_DAYS; i++) if (!state.completed.includes(i)) return i;
  return TOTAL_DAYS - 1;
}

let day = dayFromHash() ?? firstIncompleteDay();

function go(n) {
  day = Math.max(0, Math.min(TOTAL_DAYS - 1, n));
  location.hash = String(day + 1);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Narration ---------- */

function fullScript(d) {
  const x = themes[d];
  return `Day ${d + 1}. ${x[0]}. Scripture, ${x[1]}. ${x[2]} Pause and breathe in slowly. Breathe out. Let your shoulders soften. Reflection. ${x[3]} Prayer. ${x[4]} Amen. Declaration. ${x[5]} Today's practice. ${x[6]} Closing blessing. May truth steady your mind, peace guard your heart, courage guide your next step, and grace carry what you cannot. Go in peace.`;
}

const player = { status: "idle", keepAlive: 0 };
let narrationVoice = null;

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
  if (!canSpeak) return;
  clearInterval(player.keepAlive);
  speechSynthesis.cancel();
  setPlayerStatus("idle");
}

function startAudio() {
  const script = fullScript(day);
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = Number($("voiceRate").value);
  utterance.pitch = 0.96;
  if (narrationVoice) utterance.voice = narrationVoice;
  utterance.onend = stopAudio;
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

$("playButton").onclick = () => {
  if (!canSpeak) {
    $("audioTime").textContent = "Audio is not supported on this device";
    return;
  }
  if (player.status === "playing") {
    speechSynthesis.pause();
    setPlayerStatus("paused");
  } else if (player.status === "paused") {
    speechSynthesis.resume();
    setPlayerStatus("playing");
  } else {
    startAudio();
  }
};

$("voiceRate").onchange = () => {
  if (player.status !== "idle") startAudio();
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
    if (!canSpeak) return;
    stopAudio();
    const utterance = new SpeechSynthesisUtterance(
      `${sos.set.verse} ${sos.set.ref}. ${sos.set.prayer} Amen. ${sos.set.declaration}`);
    utterance.rate = 0.95;
    utterance.pitch = 0.96;
    if (narrationVoice) utterance.voice = narrationVoice;
    speechSynthesis.speak(utterance);
  };

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
  return [...state.checkins].reverse().find(c => c.day === d && localISO(new Date(c.t)) === today) || null;
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
  state.checkins.push({ t: new Date().toISOString(), day, v });
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
  const visible = themes
    .map((entry, i) => ({ title: entry[0], i }))
    .filter(({ i }) =>
      libraryFilter === "favorites" ? state.favorites.includes(i)
      : libraryFilter === "completed" ? state.completed.includes(i)
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
    <button class="day-card ${state.completed.includes(i) ? "done" : ""}" data-day="${i}">
      ${state.favorites.includes(i) ? '<span class="fav-mark" aria-hidden="true">♥</span>' : ""}
      <small>DAY ${String(i + 1).padStart(2, "0")}${state.completed.includes(i) ? " · COMPLETE" : ""}</small>
      <strong>${title}</strong>
    </button>`).join("");

  document.querySelectorAll(".day-card").forEach(button => {
    button.onclick = () => {
      $("libraryDialog").close();
      go(Number(button.dataset.day));
    };
  });
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
  if (d < 7) return weeks[0];
  if (d < 14) return weeks[1];
  if (d < 21) return weeks[2];
  if (d < 29) return weeks[3];
  return weeks[4];
}

function render() {
  stopAudio();
  const [title, ref, verse, reflection, prayer, declaration, action] = themes[day];
  const done = state.completed.includes(day);
  const fav = state.favorites.includes(day);

  $("weekLabel").textContent = weekLabelFor(day);
  $("dayNumber").textContent = `DAY ${String(day + 1).padStart(2, "0")}`;
  $("dayTitle").textContent = title;
  $("scriptureRef").textContent = ref;
  $("scriptureText").textContent = `“${verse}”`;
  $("reflection").textContent = reflection;
  $("prayer").textContent = prayer;
  $("declaration").textContent = declaration;
  $("action").textContent = action;
  $("notes").value = state.notes[day] || "";

  const streak = currentStreak();
  $("progressLabel").textContent = `Day ${day + 1} of ${TOTAL_DAYS}`;
  $("progressPercent").textContent =
    `${state.completed.length} of ${TOTAL_DAYS} complete${streak > 1 ? ` · ${streak}-day streak` : ""}`;
  $("progressBar").style.width = `${Math.round((state.completed.length / TOTAL_DAYS) * 100)}%`;

  $("favoriteButton").textContent = fav ? "♥" : "♡";
  $("favoriteButton").classList.toggle("active", fav);
  $("favoriteButton").setAttribute("aria-pressed", String(fav));
  $("favoriteButton").setAttribute("aria-label", fav ? "Remove this day from favorites" : "Save this day to favorites");
  $("completeButton").textContent = done ? "✓ Day complete" : "Mark day complete";
  $("completeButton").classList.toggle("completed", done);
  $("completeButton").setAttribute("aria-pressed", String(done));
  $("prevButton").disabled = day === 0;
  $("nextButton").disabled = day === TOTAL_DAYS - 1;
  document.title = `Day ${day + 1}: ${title} — Stand`;
  renderDayCheckin();
  renderGrid();
}

/* ---------- Interactions ---------- */

$("completeButton").onclick = () => {
  const i = state.completed.indexOf(day);
  if (i < 0) {
    state.completed.push(day);
    state.completedDates[day] = localISO(new Date());
  } else {
    state.completed.splice(i, 1);
    delete state.completedDates[day];
  }
  save();
  render();
};

$("shareButton").onclick = async () => {
  const [title, ref, verse] = themes[day];
  const text = `“${verse}” — ${ref}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `Day ${day + 1}: ${title} — Stand`, text, url: location.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${location.href}`);
      $("shareButton").textContent = "✓";
      setTimeout(() => { $("shareButton").textContent = "↗"; }, 1200);
    }
  } catch {
    // The user closed the share sheet, or clipboard access was denied.
  }
};

$("favoriteButton").onclick = () => {
  const i = state.favorites.indexOf(day);
  i < 0 ? state.favorites.push(day) : state.favorites.splice(i, 1);
  save();
  render();
};

let noteTimer;
$("notes").oninput = event => {
  clearTimeout(noteTimer);
  $("saveStatus").textContent = "Saving…";
  noteTimer = setTimeout(() => {
    state.notes[day] = event.target.value;
    $("saveStatus").textContent = save()
      ? "Saved on this device"
      : "Could not save — storage is unavailable in this browser";
  }, 350);
};

$("prevButton").onclick = () => go(day - 1);
$("nextButton").onclick = () => go(day + 1);
$("libraryButton").onclick = () => $("libraryDialog").showModal();
$("closeLibrary").onclick = () => $("libraryDialog").close();

/* ---------- Journal ---------- */

const daysWithNotes = () =>
  Object.keys(state.notes).map(Number).filter(d => (state.notes[d] || "").trim()).sort((a, b) => a - b);

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
    kicker.textContent = `DAY ${String(d + 1).padStart(2, "0")} · ${themes[d][0].toUpperCase()}`;
    const body = document.createElement("p");
    body.textContent = state.notes[d];
    entry.append(kicker, body);
    list.append(entry);
  }
}

$("journalButton").onclick = () => { renderLedger(); renderJournal(); $("journalDialog").showModal(); };
$("closeJournal").onclick = () => $("journalDialog").close();

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

$("exportButton").onclick = () => {
  const lines = ["STAND — MY REFLECTIONS", `Exported ${localISO(new Date())}`, ""];
  for (const d of daysWithNotes()) {
    lines.push(`DAY ${String(d + 1).padStart(2, "0")} · ${themes[d][0]}`, state.notes[d].trim(), "");
  }
  downloadFile("stand-reflections.txt", lines.join("\n"), "text/plain");
};

/* ---------- Backup, restore, erase ---------- */

function sanitizeBackup(raw) {
  if (!raw || typeof raw !== "object") return null;
  const validDay = d => Number.isInteger(d) && d >= 0 && d < TOTAL_DAYS;
  if (!Array.isArray(raw.completed) || !Array.isArray(raw.favorites) || !raw.notes || typeof raw.notes !== "object") return null;
  const notes = {};
  for (const [key, value] of Object.entries(raw.notes)) {
    if (validDay(Number(key)) && typeof value === "string") notes[key] = value;
  }
  const completedDates = {};
  if (raw.completedDates && typeof raw.completedDates === "object") {
    for (const [key, value] of Object.entries(raw.completedDates)) {
      if (validDay(Number(key)) && typeof value === "string") completedDates[key] = value;
    }
  }
  const validLevel = v => Number.isInteger(v) && v >= 1 && v <= 5;
  const checkins = Array.isArray(raw.checkins)
    ? raw.checkins
        .filter(c => c && typeof c === "object" && typeof c.t === "string" && validLevel(c.v) && validDay(c.day))
        .map(c => ({ t: c.t, day: c.day, v: c.v }))
    : [];
  const sosSessions = Array.isArray(raw.sos)
    ? raw.sos
        .filter(s => s && typeof s === "object" && typeof s.t === "string"
          && (s.before == null || validLevel(s.before)) && (s.after == null || validLevel(s.after)))
        .map(s => ({ t: s.t, before: s.before ?? null, after: s.after ?? null }))
    : [];
  return {
    completed: raw.completed.filter(validDay),
    favorites: raw.favorites.filter(validDay),
    notes,
    completedDates,
    checkins,
    sos: sosSessions,
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : null,
    welcomed: true
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
  applyTheme();
  renderLedger();
  renderJournal();
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

$("beginButton").onclick = () => $("welcomeDialog").close();
$("welcomeDialog").addEventListener("close", () => {
  if (!state.welcomed) {
    state.welcomed = true;
    save();
  }
});

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
