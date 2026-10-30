// Devotional content for Stand. Shared by the app (as globals) and by
// scripts/build-day-pages.js (as a Node module).
const themes = [
  ["Stand","Ephesians 6:10–13","Be strong in the Lord, and in the strength of his might.","The first command of spiritual combat is not attack. It is to stand. Standing means refusing to let fear, anger, pressure, accusation, or uncertainty dictate who you become.","Father, establish me within before I attempt to change anything around me. Where I am frightened, give me courage. Where I am confused, give me clarity. Where I am angry, give me discipline. Where I am exhausted, renew my strength. I will not surrender my character to my circumstances. Help me stand.","I will stand in truth, walk in peace, and keep my character.","When something triggers you, pause and ask: What would standing in truth look like right now?"],
  ["Truth","Ephesians 6:14","Stand therefore, having the belt of truth buckled around your waist.","Truth is the first piece of armor. Spiritual combat begins with intellectual honesty: separating what you know, what you believe, what you assume, and what you fear.","God of truth, remove deception from around me and self-deception from within me. Do not merely show me the truths I want to discover. Show me truth itself. Give me courage to change my mind when evidence requires it. Let truth matter more than winning.","Truth matters more than my need to be right.","Divide one difficult situation into three columns: known, believed, and unknown."],
  ["Righteousness","Ephesians 6:14","Having put on the breastplate of righteousness.","Spiritual warfare is not only about identifying wrongdoing in others. It asks whether your own conduct matches the standard you expect from everyone else.","Lord, search my motives. Expose hypocrisy, correct pride, remove vengeance, and strengthen integrity. Let my private character match my public words. May the right thing remain right even when nobody sees it.","My character is measured by what I practice, not what I proclaim.","Do one right thing today when nobody is watching."],
  ["Peace","Ephesians 6:15","Having fitted your feet with the preparation of the Good News of peace.","Peace is not passivity. It can require boundaries, hard conversations, repair, or walking away. Peace refuses unnecessary chaos without hiding from necessary truth.","Prince of Peace, make me an instrument of peace without making me afraid of necessary conflict. Help me know when to speak, when to listen, when to act, and when to walk away.","I can carry peace into a place without surrendering truth.","Remove one unnecessary source of conflict from your day."],
  ["Faith","Ephesians 6:16","Taking up the shield of faith, with which you will be able to quench all the fiery darts of the evil one.","Faith does not pretend difficulty is unreal. Faith refuses to give difficulty ultimate authority. It makes room for a next faithful step before the whole path is visible.","God, there are outcomes I cannot control, questions I cannot answer, and people I cannot change. I place them before You. Give me enough faith to take the next faithful step.","This difficulty is real, but it does not control my character.","Name one uncontrollable outcome and release it aloud."],
  ["Guard the Mind","Ephesians 6:17","Take the helmet of salvation.","Rumination can turn one painful moment into hundreds of imagined ones. Guarding the mind means deciding which thoughts deserve continued attention.","God, protect my mind. Interrupt obsessive fear, challenge catastrophic thinking, and expose false narratives. Return me to what is true, useful, honorable, and within my responsibility.","My mind does not need to solve everything today.","Test one recurring thought: Is it true, known, useful, and actionable?"],
  ["The Word","Ephesians 6:17","The sword of the Spirit, which is the word of God.","Words shape interpretation, and interpretation shapes action. Sacred words can return you to courage when noise pulls you toward panic.","Lord, place words of truth within me before the world fills me with noise. Let Scripture challenge fear, pride, hatred, despair, and temptation.","Truth will remain after today's noise disappears.","Choose one short verse and return to it three times today."],
  ["Fear","Psalm 27:1","The LORD is my light and my salvation. Whom shall I fear?","Fear predicts futures that have not happened. Courage returns to the responsibility directly in front of you.","Lord, bring me back to today. Give me courage for today's responsibility rather than anxiety about tomorrow's possibilities. I will prepare wisely, but I will not worship fear.","Fear may speak, but it does not get the final word.","Do one thing fear has persuaded you to postpone."],
  ["Anger","James 1:19–20","Let every man be swift to hear, slow to speak, and slow to anger.","Anger can carry information about a wound, boundary, injustice, or fear. It becomes dangerous when it moves from messenger to master.","God, let anger become information rather than my master. Show me what lies beneath it, then teach me to respond with clarity and proportion.","I can feel anger without surrendering my conduct to it.","Delay an angry response until your body becomes calm."],
  ["Resentment","Romans 12:21","Don’t be overcome by evil, but overcome evil with good.","Resentment keeps another person's wrongdoing active inside you. Releasing it does not excuse harm; it refuses to let harm reproduce itself.","Lord, I refuse to carry another person's wrongdoing inside me indefinitely. Help me pursue accountability without revenge. Let evil stop with me.","What harmed me will not determine what I become.","Name one resentment you are ready to begin releasing."],
  ["Pride","Proverbs 16:18","Pride goes before destruction, and an arrogant spirit before a fall.","Pride turns uncertainty into performance and correction into threat. Humility creates freedom to learn, repair, and receive help.","God, protect me from needing to win every argument. Give me freedom to say: I was wrong. I do not know. I need help. Please forgive me.","I do not lose dignity when I become teachable.","Admit one thing you do not know."],
  ["Temptation","Matthew 4:10","You shall worship the Lord your God, and you shall serve him only.","Temptation often becomes powerful through rationalization. Freedom grows when you notice the decision point before it becomes a habit.","Lord, help me recognize temptation before I rename or excuse it. Give me strength during the few moments when a decision becomes a pattern.","I can choose what strengthens the person I am becoming.","Remove one environmental trigger connected to a recurring temptation."],
  ["Despair","Psalm 42:11","Hope in God! For I shall still praise him.","Feelings are powerful witnesses, but imperfect prophets. Despair speaks in absolutes; hope looks for the next constructive step.","God, when my feelings tell me nothing will improve, remind me that this moment is not the whole story. Give me enough hope for one more faithful step.","I do not need all the hope—only enough for the next step.","Do one constructive thing for your future self."],
  ["Rest","Matthew 11:28","Come to me, all you who labor and are heavily burdened, and I will give you rest.","Exhaustion is not proof of faithfulness. Rest restores perspective, restraint, attention, and the ability to love well.","Lord, I surrender the belief that exhaustion proves devotion. Teach me to rest without guilt. Restore my body, quiet my mind, and renew my spirit.","Rest is part of faithfulness, not a departure from it.","Protect a period of genuine rest today."],
  ["Guard Your Words","James 3:5","So the tongue is also a little member, and boasts great things.","Words can clarify or inflame, defend dignity or destroy it. Spiritual discipline places a guard between emotional impulse and lasting speech.","God, put a guard over my mouth. Let my words be truthful without cruelty, strong without abuse, and clear without manipulation.","My words will serve truth, repair, and necessary boundaries.","Read an emotional message twice before sending it."],
  ["Discernment","James 1:5","If any of you lacks wisdom, let him ask of God, who gives to all liberally.","Discernment separates observable behavior from stories about motives. It holds alertness and humility together.","Lord, give me discernment without suspicion, alertness without paranoia, confidence without arrogance, and compassion without gullibility.","I can observe carefully without pretending to know every motive.","Write the facts of one situation separately from your interpretation."],
  ["Boundaries","Proverbs 4:23","Keep your heart with all diligence, for out of it is the wellspring of life.","Forgiveness does not require unlimited access. A healthy boundary protects peace and responsibility; punishment tries to control another person's pain.","God, teach me to establish boundaries without hatred. Remove bitterness without removing discernment. Let forgiveness free my heart while wisdom guards the door.","I can love someone without granting unsafe access.","Name one boundary that protects peace without punishing."],
  ["False Accusations","Psalm 37:6","He will make your righteousness shine out like light, and your justice as the noon day sun.","You can answer falsehood with calm facts without making every opinion your assignment. Document what matters; release what you cannot control.","Lord, when misunderstood, keep me from destroying my peace trying to control every perception. Help me speak truth, correct what is false, accept what is mine, and release the rest.","An accusation does not define my identity.","Replace repeated self-defense with one clear factual statement."],
  ["Forgiveness","Colossians 3:13","Even as Christ forgave you, so you also do.","Forgiveness can be a process. It releases the desire for revenge; it does not erase memory, accountability, consequences, or wise distance.","God, begin the work of forgiveness within me. Remove my desire to see another suffer merely because I suffered. Keep wisdom and boundaries intact.","I release vengeance while preserving truth and responsibility.","Pray for freedom from resentment, not forced reconciliation."],
  ["Love Your Enemy","Matthew 5:44","Love your enemies, bless those who curse you, do good to those who hate you, and pray for those who mistreat you.","Loving an enemy does not mean calling harm good. It means refusing dehumanization while seeking protection, truth, and accountability.","Lord, teach me to oppose harmful behavior without dehumanizing the person responsible. Protect my heart from becoming what hurt me.","I can seek accountability without hatred.","Refuse dehumanizing language about someone you oppose."],
  ["Protect the Vulnerable","Isaiah 1:17","Learn to do well. Seek justice. Relieve the oppressed.","Strength becomes holy when it protects rather than dominates. Advocacy serves another person's dignity instead of using their pain for recognition.","God, make my strength useful to someone vulnerable. Give me courage to protect without controlling, advocate without exploiting, and serve without needing recognition.","My strength is entrusted to me for service.","Help someone who cannot repay you."],
  ["Courage","Joshua 1:9","Be strong and courageous. Don’t be afraid. Don’t be dismayed, for the LORD your God is with you wherever you go.","Courage is not the absence of fear. It is faithful movement while fear is present.","God, give me enough courage to move while fear is present. Keep me from waiting for perfect confidence before doing what is right.","I can be afraid and still be faithful.","Take one action you have been avoiding."],
  ["Wisdom","Proverbs 3:5–6","Trust in the LORD with all your heart, and don’t lean on your own understanding.","Urgency can impersonate wisdom. Wise decisions create room for counsel, consequences, conscience, and time.","Lord, slow me down enough to see clearly. Keep urgency from making choices that wisdom would refuse.","I am permitted to pause before a non-emergency decision.","Delay one decision long enough to consider its consequences."],
  ["Justice","Micah 6:8","What does the LORD require of you, but to act justly, to love mercy, and to walk humbly with your God?","Justice is not favoritism for our own side. It applies the same dignity, evidence, and standard even to people we dislike.","God, give me a love for justice that includes justice for people I oppose. Protect me from demanding standards for others that I reject for myself.","Truth and fairness do not change sides to favor me.","Apply to yourself the standard you apply to another."],
  ["Mercy","Luke 6:36","Be merciful, even as your Father is also merciful.","Mercy makes room for human weakness and repair without erasing responsibility. It is neither denial nor enabling.","Lord, let mercy temper judgment without hiding truth. Teach me the difference between compassion and enabling.","I can make room for repair while keeping healthy limits.","Give someone room to correct a genuine mistake."],
  ["Humility","Philippians 2:3","In humility, each counting others better than himself.","Humility is accurate self-knowledge: neither self-exaltation nor self-erasure. It listens for truth even when correction feels uncomfortable.","God, make me teachable. When correction comes, help me examine it before rejecting it. Keep me secure enough to learn.","Correction can refine me without defining me.","Ask someone trustworthy: What am I not seeing?"],
  ["Perseverance","Romans 5:4","Perseverance, proven character; and proven character, hope.","Some battles are won through endurance rather than dramatic victory. Small faithful acts compound when visible results are slow.","Lord, give me strength to continue doing what is right when results are delayed. Protect me from confusing slow progress with failure.","Faithfulness still counts when nobody applauds it.","Complete one small task connected to a long-term goal."],
  ["Surrender","Matthew 6:34","Don’t be anxious for tomorrow, for tomorrow will be anxious for itself.","Surrender releases outcomes while retaining responsibility. It is not giving up; it is returning each burden to its proper owner.","Father, I surrender outcomes while retaining responsibility. I will do what belongs to me and release what does not.","I am responsible for faithfulness, not control of every outcome.","Write what you cannot control and physically put the paper away."],
  ["Become the Light","Matthew 5:14","You are the light of the world. A city located on a hill can’t be hidden.","Healing becomes service when your presence offers courage, truth, stability, compassion, and hope to someone else.","God, do more than deliver me from darkness. Teach me to carry light. Make my presence a source of courage, truth, stability, compassion, and hope.","What I have survived can become light for someone else.","Encourage one person who is struggling."],
  ["Character","Ephesians 6:18","Praying at all times in the Spirit, and being watchful to this end in all perseverance.","The deepest victory may not be defeating an enemy. It may be that hatred did not make you hateful, deception dishonest, fear cowardly, or suffering cruel.","Father, clothe me in truth, guard my heart, direct my feet toward peace, strengthen my faith, protect my mind, and place Your Word within me. When I have done everything I know how to do, teach me to stand.","Darkness around me will not become darkness within me.","Review the journey. Choose one practice to carry into the next thirty days."]
];

const weeks = [
  "Week one · Establish the ground",
  "Week two · Confront the inner battle",
  "Week three · Combat in relationships",
  "Week four · Transformation",
  "Day thirty · The final battle is character"
];

// Focused short tracks. Each day follows the same shape as `themes`:
// [title, reference, verse, reflection, prayer, declaration, practice]
//
// Only Stand's days are here. Every other journey's are in
// content-journeys.js, which the app loads the first time one of them is
// open, to keep a first visit small; until then a journey's days are
// pending(n): n empty places, so its length (the library's day count, a
// backup's progress) is right before its words arrive.
const pending = n => Array.from({ length: n });
const tracks = {
  core: {
    id: "core",
    group: "The 30-Day Journey",
    name: "Stand — 30 Days of Spiritual Combat",
    short: "The 30-Day Journey",
    days: themes,
    weeks
  },
  // The second 30-day journey: the Psalms of trust, the other posture to
  // Stand's spiritual combat (World English Bible, as above).
  shelter: {
    id: "shelter",
    group: "The 30-Day Journey",
    name: "Shelter — 30 Days in the Psalms of Trust",
    short: "Shelter",
    weeks: [
      "Week one · Refuge",
      "Week two · Honest lament",
      "Week three · Retraining trust",
      "Week four · From fear to praise",
      "Day thirty · I shall not be moved"
    ],
    days: pending(30)
  },
  unknown: {
    id: "unknown",
    group: "Journeys for fear",
    name: "Fear of the Unknown",
    short: "Fear of the Unknown",
    weeks: ["Fear of the Unknown · Five days"],
    days: pending(5)
  },
  night: {
    id: "night",
    group: "Journeys for fear",
    name: "Night Fear & Sleep",
    short: "Night Fear & Sleep",
    weeks: ["Night Fear & Sleep · Five days"],
    days: pending(5)
  },
  // Courage stories: four-day modules that walk one heroic event through the
  // same four beats — the fear, the choice, the outcome, the carry-forward.
  // Scripture here is public domain (World English Bible, lightly modernized).
  furnace: {
    id: "furnace",
    group: "Courage stories",
    name: "The Furnace — Daniel 3",
    short: "The Furnace",
    weeks: ["Courage story · The Furnace · Daniel 3"],
    days: pending(4)
  },
  giant: {
    id: "giant",
    group: "Courage stories",
    name: "The Giant — 1 Samuel 17",
    short: "The Giant",
    weeks: ["Courage story · The Giant · 1 Samuel 17"],
    days: pending(4)
  },
  den: {
    id: "den",
    group: "Courage stories",
    name: "The Den — Daniel 6",
    short: "The Den",
    weeks: ["Courage story · The Den · Daniel 6"],
    days: pending(4)
  },
  storm: {
    id: "storm",
    group: "Courage stories",
    name: "The Storm — Mark 4",
    short: "The Storm",
    weeks: ["Courage story · The Storm · Mark 4"],
    days: pending(4)
  },
  unseen: {
    id: "unseen",
    group: "Courage stories",
    name: "The Unseen Army — 2 Kings 6",
    short: "The Unseen Army",
    weeks: ["Courage story · The Unseen Army · 2 Kings 6"],
    days: pending(4)
  },
  throne: {
    id: "throne",
    group: "Courage stories",
    name: "The Throne Room — Esther 4–5",
    short: "The Throne Room",
    weeks: ["Courage story · The Throne Room · Esther 4–5"],
    days: pending(4)
  },
  wall: {
    id: "wall",
    group: "Courage stories",
    name: "The Wall — Nehemiah 4, 6",
    short: "The Wall",
    weeks: ["Courage story · The Wall · Nehemiah 4 & 6"],
    days: pending(4)
  },
  water: {
    id: "water",
    group: "Courage stories",
    name: "The Water — Matthew 14",
    short: "The Water",
    weeks: ["Courage story · The Water · Matthew 14"],
    days: pending(4)
  },
  basket: {
    id: "basket",
    group: "Courage stories",
    name: "The Basket — Exodus 2",
    short: "The Basket",
    weeks: ["Courage story · The Basket · Exodus 2"],
    days: pending(4)
  },
  shiloh: {
    id: "shiloh",
    group: "Courage stories",
    name: "Shiloh — 1 Samuel 1",
    short: "Shiloh",
    weeks: ["Courage story · Shiloh · 1 Samuel 1"],
    days: pending(4)
  },
  turning: {
    id: "turning",
    group: "Courage stories",
    name: "Turned to the Wall — Isaiah 38",
    short: "Turned to the Wall",
    weeks: ["Courage story · Turned to the Wall · Isaiah 38"],
    days: pending(4)
  },
  hem: {
    id: "hem",
    group: "Courage stories",
    name: "The Hem — Mark 5",
    short: "The Hem",
    weeks: ["Courage story · The Hem · Mark 5"],
    days: pending(4)
  },
  zarephath: {
    id: "zarephath",
    group: "Courage stories",
    name: "The Last Meal — 1 Kings 17",
    short: "The Last Meal",
    weeks: ["Courage story · The Last Meal · 1 Kings 17"],
    days: pending(4)
  },
  jordan: {
    id: "jordan",
    group: "Courage stories",
    name: "The River — Joshua 3–4",
    short: "The River",
    weeks: ["Courage story · The River · Joshua 3–4"],
    days: pending(4)
  },
  torches: {
    id: "torches",
    group: "Courage stories",
    name: "The Three Hundred — Judges 6–7",
    short: "The Three Hundred",
    weeks: ["Courage story · The Three Hundred · Judges 6–7"],
    days: pending(4)
  },
  shipwreck: {
    id: "shipwreck",
    group: "Courage stories",
    name: "The Shipwreck — Acts 27",
    short: "The Shipwreck",
    weeks: ["Courage story · The Shipwreck · Acts 27"],
    days: pending(4)
  },
  barley: {
    id: "barley",
    group: "Courage stories",
    name: "The Barley Field — Ruth 1–2",
    short: "The Barley Field",
    weeks: ["Courage story · The Barley Field · Ruth 1–2"],
    days: pending(4)
  }
};

// Plain-language entry points into the library: what a person would actually
// say about their fear, mapped to the track that meets it. Rendered by the
// "Where are you right now?" picker; order is the order shown.
const fearIndex = [
  ["I'm panicking right now", "storm"],
  ["I can't sleep — the fear comes at night", "night"],
  ["I don't know what's coming and I can't stop imagining it", "unknown"],
  ["I'm facing something far bigger than me", "giant"],
  ["The outcome is out of my hands", "furnace"],
  ["I have a court date, or I've been accused", "den"],
  ["I feel completely outnumbered", "unseen"],
  ["I have to say something hard, and it could cost me", "throne"],
  ["People are mocking or opposing what I'm building", "wall"],
  ["I started something and I'm afraid I can't finish", "water"],
  ["I'm afraid for my child", "basket"],
  ["I've been praying for the same thing for years", "shiloh"],
  ["I've had frightening news about my health", "turning"],
  ["I've been unwell a long time and I'm worn out", "hem"],
  ["I don't know how I'm going to pay for it", "zarephath"],
  ["I'm about to step into something new", "jordan"],
  ["I don't feel like the right person for this", "torches"],
  ["I'm in the middle of a crisis I didn't choose", "shipwreck"],
  ["I'm starting over with nothing", "barley"],
  ["I'm tired of being strong and I need somewhere to rest", "shelter"],
  ["I want the full thirty-day journey", "core"]
];

// The four SOS sets in English. Their verses reuse day excerpts already in
// `themes`, so the WEB gate covers them without a second source of scripture.
// The Spanish sets are `esSos` in content.es.js, in the same order, and quote
// the Reina-Valera 1909 directly rather than translating these. app.js picks
// by language and holds the active set as an index, so a language switch
// keeps the reader's place. Kept here rather than in app.js so the narration
// build (scripts/build-audio.js) can read them in Node.
const sosSetsEn = [
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

if (typeof module !== "undefined" && module.exports) {
  // Node (the page builder, the workbook, the tests) always has every day.
  const { journeyDays } = require("./content-journeys.js");
  for (const [id, days] of Object.entries(journeyDays)) tracks[id].days = days;
  module.exports = { themes, weeks, tracks, fearIndex, sosSetsEn };
}
