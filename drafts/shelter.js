// DRAFT — Shelter: 30 Days in the Psalms of Trust. Week one only.
//
// Not loaded by the app. This file is the review copy: the entry below is in
// the exact shape of a `tracks` entry in content.js, so once the 30 days are
// reviewed it moves across as-is. It is kept out of content.js until then
// because a track there is live on the next deploy, and the scripture gate
// (scripts/verify-scripture.js) fails any English track without a Spanish
// edition in content.es.js.
//
// Why this journey: Stand is Ephesians 6 — resisting fear, putting on the
// armor, holding ground. Shelter is the other posture Scripture gives a
// frightened person: resting in God while still afraid, in the Psalms' own
// words. Morning Stand and evening Shelter is one intended way to use both.
//
// Check the excerpts against the World English Bible:
//
//   node drafts/shelter.js
//
// Every verse must be a contiguous substring of `webSource` below after the
// two substitutions verify-scripture.js applies (Yahweh -> the LORD, utility
// belt -> belt). `webSource` was extracted from the same `world-english-bible`
// npm package as scripts/web-source.json (Psalm 27:1 matches it byte for
// byte); on merge, its entries move into that file.

// [title, reference, verse, reflection, prayer, declaration, practice]
const shelter = {
  id: "shelter",
  group: "The 30-Day Journey",
  name: "Shelter — 30 Days in the Psalms of Trust",
  short: "Shelter",
  weeks: [
    "Week one · Refuge",
    "Week two · Honest lament",
    "Week three · Retraining trust",
    "Week four · From fear to praise",
    "Day thirty · I will not be shaken"
  ],
  days: [
    ["Shelter","Psalm 91:1–2","He who dwells in the secret place of the Most High will rest in the shadow of the Almighty. I will say of the LORD, “He is my refuge and my fortress; my God, in whom I trust.”","Fear tells you to become your own fortress: watchful, armored, never off duty. This psalm offers a different posture. Dwell near, and rest in a shadow you did not have to cast.","Most High, I have been trying to be my own shelter, and I am tired. Teach me to dwell near You, not only to visit when things are bad, but to stay. Let me say it aloud and mean it a little more each day: You are my refuge, and I trust You.","I do not have to be my own fortress.","Say verse 2 aloud, slowly. Notice which word is hardest to mean today (refuge, fortress, or trust) and write it in your notes."],
    ["Shepherd","Psalm 23:4","Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.","The psalm does not promise a way around the valley; it promises company through it. The reason given for not fearing is not that the valley is safe, but that you are not walking it alone.","Shepherd, I would rather skip this valley, and You know that. If I must walk through it, walk close enough that I can tell. Let Your nearness be louder than the shadows, and lead me one step at a time.","I am walking through this valley, and I am not walking alone.","Name the valley you are in with one plain sentence, without exaggerating or minimizing it. Then add four words: “and You are with me.”"],
    ["Refuge","Psalm 46:1–2","God is our refuge and strength, a very present help in trouble. Therefore we won’t be afraid, though the earth changes, though the mountains are shaken into the heart of the seas.","“Very present” means help that is already here, not help that is on its way. The psalm faces the worst case directly, the ground itself moving, and places God inside it rather than after it.","God, things I counted on as solid have shifted. Be my refuge now, in the middle of the change, not only once it settles. Help me look for You in this hour instead of waiting for a better one.","Help is present, not pending.","List what has shifted recently that felt like solid ground. Beside each, write one way God has been present in it. If you cannot find one yet, write “not yet.” That is honest too."],
    ["Keeper","Psalm 121:1–2","I will lift up my eyes to the hills. Where does my help come from? My help comes from the LORD, who made heaven and earth.","The psalmist asks the question fear asks (where will help come from?) and does not pretend not to have asked it. The answer looks past the hills, past every visible source of rescue, to the One who made them.","Lord, I keep scanning the hills: people, plans, money, the next phone call. Today I lift my eyes higher. You made heaven and earth, and You can keep me. Let my help come from You first, and let every other help be a gift rather than a lifeline I clutch.","My help comes from the One who made the hills.","Write down the “hills” you have been watching for rescue. Thank God for each as a possible gift, and place your hope above all of them."],
    ["Light","Psalm 27:1","The LORD is my light and my salvation. Whom shall I fear? The LORD is the strength of my life. Of whom shall I be afraid?","David asks his fear a question instead of obeying it. Fear works best in the dark, where every shape looks like a threat. Light does not remove what is in the room; it shows you its true size.","Lord, be my light where my thoughts have gone dark. Show me the true size of what I am afraid of, and the true size of You beside it. When fear makes its claim, help me answer with Your name.","I can question my fear instead of obeying it.","Write today’s fear as a question, the way David did: “Whom shall I fear?” or “What can this actually take from me?” Answer it slowly, in daylight."],
    ["Rock","Psalm 18:2","The LORD is my rock, my fortress, and my deliverer; my God, my rock, in whom I take refuge.","David piles up names because one is not enough to hold what God has been to him. Fear narrows your vocabulary to a single word: danger. Naming God widens it again.","My Rock, my fortress, my deliverer: I say Your names because my fear has only one word, and I need more than one. Be steady under me where everything else is moving. I take refuge in You today.","I stand on something that does not move.","Write three names for God that have been true in your own life, not borrowed but remembered. Keep the list where you will see it tonight."],
    ["Silence","Psalm 62:5–6","My soul, wait in silence for God alone, for my expectation is from him. He alone is my rock and my salvation, my fortress. I will not be shaken.","David speaks to his own soul like a friend who needs settling. Silence here is not emptiness. It is the noise of rehearsing and bargaining set down, so you can wait for God alone rather than for every outcome at once.","God, my mind is crowded with rehearsed conversations and worst cases. For a few minutes I set them down. I wait for You alone. Let quiet become a place where I meet You, not a place I dread.","In the quiet, I am not alone.","Sit in silence for three minutes with a timer. When a worry speaks, answer it once with “for God alone,” and return to the quiet. Afterward, write one word for how it went."]
  ]
};

// WEB text for each reference above, keyed as in scripts/web-source.json.
const webSource = {
  "Psalm 91:1–2": "He who dwells in the secret place of the Most High will rest in the shadow of the Almighty. I will say of Yahweh, “He is my refuge and my fortress; my God, in whom I trust.”",
  "Psalm 23:4": "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
  "Psalm 46:1–2": "God is our refuge and strength, a very present help in trouble. Therefore we won’t be afraid, though the earth changes, though the mountains are shaken into the heart of the seas;",
  "Psalm 121:1–2": "I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth.",
  "Psalm 27:1": "Yahweh is my light and my salvation. Whom shall I fear? Yahweh is the strength of my life. Of whom shall I be afraid?",
  "Psalm 18:2": "Yahweh is my rock, my fortress, and my deliverer; my God, my rock, in whom I take refuge; my shield, and the horn of my salvation, my high tower.",
  "Psalm 62:5–6": "My soul, wait in silence for God alone, for my expectation is from him. He alone is my rock and my salvation, my fortress. I will not be shaken."
};

if (typeof module !== "undefined" && module.exports) module.exports = { shelter, webSource };

if (require.main === module) {
  // Same rule as scripts/verify-scripture.js: verbatim, or verbatim once a
  // closing period the source does not have is dropped.
  const MODERNIZE = t => t.replace(/Yahweh/g, "the LORD").replace(/utility belt/g, "belt");
  const norm = t => t.replace(/\s+/g, " ").trim().toLowerCase();
  let fail = 0;
  shelter.days.forEach(([title, ref, verse], i) => {
    const source = webSource[ref];
    const hay = source && norm(MODERNIZE(source));
    const needle = norm(verse);
    const status = !source ? "no-source"
      : hay.includes(needle) ? "verbatim"
      : hay.includes(needle.replace(/[.?!]$/, "")) ? "punctuation"
      : "not-in-source";
    if (status === "no-source" || status === "not-in-source") fail++;
    console.log(`${status.padEnd(13)} day ${i + 1} ${title} (${ref})`);
  });
  console.log(fail ? `\n${fail} excerpt(s) not drawn from the WEB` : `\nAll ${shelter.days.length} excerpts drawn from the WEB`);
  process.exit(fail ? 1 : 0);
}
