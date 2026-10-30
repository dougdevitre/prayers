// DRAFT — Shelter: 30 Days in the Psalms of Trust. Weeks one and two.
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
// npm package as scripts/web-source.json (the extraction reproduces that
// file's Psalm 27:1 byte for byte); on merge, its entries move into that file.

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
    ["Shield","Psalm 3:3","But you, the LORD, are a shield around me, my glory, and the one who lifts up my head.","Psalm 3 is headed as David’s prayer while fleeing from his own son. Trouble surrounded him on every side, and so, he says, does God: a shield around him, not only in front. And when fear and shame bend a head down, God is the one who lifts it.","Lord, I feel exposed on every side. Be a shield around me, not only in front of me. Where fear and shame have bent my head down, lift it, gently, until I can look at today.","I am surrounded, and I am also shielded.","Notice your posture right now. Lift your head, let your shoulders drop, and pray verse 3 once, slowly, looking up."],
    ["Rock","Psalm 18:2","The LORD is my rock, my fortress, and my deliverer; my God, my rock, in whom I take refuge.","David piles up names because one is not enough to hold what God has been to him. Fear narrows your vocabulary to a single word: danger. Naming God widens it again.","My Rock, my fortress, my deliverer: I say Your names because my fear has only one word, and I need more than one. Be steady under me where everything else is moving. I take refuge in You today.","I stand on something that does not move.","Write three names for God that have been true in your own life, not borrowed but remembered. Keep the list where you will see it tonight."],
    ["Silence","Psalm 62:5–6","My soul, wait in silence for God alone, for my expectation is from him. He alone is my rock and my salvation, my fortress. I will not be shaken.","David speaks to his own soul like a friend who needs settling. Silence here is not emptiness. It is the noise of rehearsing and bargaining set down, so you can wait for God alone rather than for every outcome at once.","God, my mind is crowded with rehearsed conversations and worst cases. For a few minutes I set them down. I wait for You alone. Let quiet become a place where I meet You, not a place I dread.","In the quiet, I am not alone.","Sit in silence for three minutes with a timer. When a worry speaks, answer it once with “for God alone,” and return to the quiet. Afterward, write one word for how it went."],
    ["How Long?","Psalm 13:1–2","How long will you hide your face from me? How long shall I take counsel in my soul, having sorrow in my heart every day?","David asks “how long” four times in two verses, and the psalm keeps every one of them. Complaint addressed to God is still faith; it assumes Someone is listening. By verse 5 he is trusting again, but he does not get there by skipping the questions.","Lord, I have carried this a long time, and I am tired of being brave about it. How long? I am asking You, not walking away from You. Hear the question, and stay with me while I wait for the answer.","Asking God “how long” is still talking to God.","Write your own “How long…?” lines, as many as are true, with nothing softened. Beneath them, write one line that begins with “But.” If you cannot write it yet, leave the space."],
    ["Brokenhearted","Psalm 34:18","The LORD is near to those who have a broken heart, and saves those who have a crushed spirit.","This verse does not tell the brokenhearted to recover first and then come near. It says God comes near to them, in the condition they are in. A crushed spirit is not disqualifying; it is where he is said to be.","God, I do not have much left in me today, and I will not pretend otherwise. Come near the way this verse says You do, to the broken and the crushed, and carry what I cannot.","Being broken does not put me out of God’s reach.","Tell one safe person one true sentence about how you are doing. If despair has become heavy or constant, reach out today to a pastor, counselor, or doctor; the people listed under Steady me now are there at any hour."],
    ["Waiting for Morning","Psalm 130:5–6","I wait for the LORD. My soul waits. I hope in his word. My soul longs for the Lord more than watchmen long for the morning, more than watchmen for the morning.","A watchman on the wall cannot make the sun rise. He can only stay at his post and keep looking east. The psalmist’s waiting is like that: not passive, not in control, but awake and expecting.","Lord, the night feels long, and I cannot make the morning come. Teach me to wait like a watchman, awake, at my post, looking toward You. Give me Your word to hope in while I wait.","Morning is not up to me, and it is still coming.","Name one thing you are waiting on that you cannot hurry. Then name one small duty that is still yours today, and do just that one."],
    ["When I Am Afraid","Psalm 56:3–4","When I am afraid, I will put my trust in you. In God, I praise his word. In God, I put my trust. I will not be afraid. What can flesh do to me?","The psalm does not say “I am never afraid.” It says “when I am afraid,” and then names what it will do. Trust here is not the absence of fear; it is a decision made in its presence, sometimes many times a day.","God, I am afraid right now. I am not waiting to feel brave before I trust You. In this fear I put my trust in You, and when it rises again, I will put it there again.","Fear is the moment I choose trust, not proof that I lack it.","Write verse 3 on something you will carry today. Each time fear rises, read it once and say, “Again.”"],
    ["Every Tear","Psalm 56:8","You count my wanderings. You put my tears into your container. Aren’t they in your book?","Four verses after “when I am afraid,” the same psalm pictures a God who keeps count: of wanderings, of tears, of nights you thought no one saw. Being seen does not end the pain, but it ends being alone in it.","Lord, You have kept count of what I could not keep track of. Thank You that my tears are not wasted or forgotten. Hold what I have cried over, and let me feel known in it.","None of my tears have gone unseen.","Write down one sorrow you have carried quietly. Give it a date and one sentence, as though writing it in God’s book. Then close the page."],
    ["Higher Than I","Psalm 61:2","From the end of the earth, I will call to you when my heart is overwhelmed. Lead me to the rock that is higher than I.","“Lead me to the rock that is higher than I” is the prayer of someone who knows their own footing is not enough. An overwhelmed heart does not have to climb on its own; it can ask to be led.","God, my heart is overwhelmed, and I cannot climb out of this by myself. Lead me to the rock that is higher than I am: higher than my fear, higher than my thinking, higher than this day.","I do not have to climb alone; I can ask to be led.","When overwhelm rises today, stop and pray this verse as one sentence. Then do only the next small thing, and let the rest wait."],
    ["My God, My God","Psalm 22:1","My God, my God, why have you forsaken me? Why are you so far from helping me, and from the words of my groaning?","Jesus prayed this line from the cross (Matthew 27:46), so the feeling of being forsaken is not foreign to faith; it was spoken at its center. And the psalm does not end where it begins. By verse 24 it says God has not hidden his face from the afflicted, and when they cried to him, he heard.","My God, sometimes You feel far away, and I am not going to pretend You don’t. I say it to You, the way Jesus did. Hear me in the distance I feel, and let me find, as this psalm does, that You were listening all along.","Feeling forsaken is not the same as being forsaken.","Read all of Psalm 22 once, slowly, and mark the verse where it begins to turn. Then note where you are in your own psalm today. You do not need to be at the end yet."]
  ]
};

// WEB text for each reference above, keyed as in scripts/web-source.json.
const webSource = {
  "Psalm 91:1–2": "He who dwells in the secret place of the Most High will rest in the shadow of the Almighty. I will say of Yahweh, “He is my refuge and my fortress; my God, in whom I trust.”",
  "Psalm 23:4": "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
  "Psalm 46:1–2": "God is our refuge and strength, a very present help in trouble. Therefore we won’t be afraid, though the earth changes, though the mountains are shaken into the heart of the seas;",
  "Psalm 121:1–2": "I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth.",
  "Psalm 3:3": "But you, Yahweh, are a shield around me, my glory, and the one who lifts up my head.",
  "Psalm 18:2": "Yahweh is my rock, my fortress, and my deliverer; my God, my rock, in whom I take refuge; my shield, and the horn of my salvation, my high tower.",
  "Psalm 62:5–6": "My soul, wait in silence for God alone, for my expectation is from him. He alone is my rock and my salvation, my fortress. I will not be shaken.",
  "Psalm 13:1–2": "How long, Yahweh? Will you forget me forever? How long will you hide your face from me? How long shall I take counsel in my soul, having sorrow in my heart every day? How long shall my enemy triumph over me?",
  "Psalm 34:18": "Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.",
  "Psalm 130:5–6": "I wait for Yahweh. My soul waits. I hope in his word. My soul longs for the Lord more than watchmen long for the morning, more than watchmen for the morning.",
  "Psalm 56:3–4": "When I am afraid, I will put my trust in you. In God, I praise his word. In God, I put my trust. I will not be afraid. What can flesh do to me?",
  "Psalm 56:8": "You count my wanderings. You put my tears into your container. Aren’t they in your book?",
  "Psalm 61:2": "From the end of the earth, I will call to you when my heart is overwhelmed. Lead me to the rock that is higher than I.",
  "Psalm 22:1": "My God, my God, why have you forsaken me? Why are you so far from helping me, and from the words of my groaning?"
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
