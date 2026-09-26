// End-to-end smoke suite: serves the app with the production CSP and drives
// it in headless Chromium. Run with `npm test` (after `npx playwright install
// chromium`), or set CHROMIUM_PATH to use a pre-installed browser.
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("playwright-core")); }

const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const ROOT = path.join(__dirname, "..");
const { tracks, fearIndex } = require("../content.js");
const { prayerCorpus, prayerUi } = require("../prayers.js");
const TRACK_COUNT = Object.keys(tracks).length;
const GROUP_COUNT = new Set(Object.values(tracks).map(t => t.group)).size;
// Must match the generator's default; the suite checks the committed output.
const SITE = "https://prayers.dougdevitre.org";
// The app is served from the test server, so runtime URLs use its origin.
const SITE_ORIGIN = "http://localhost:8123";
const DAY_PAGE_COUNT = Object.values(tracks).reduce((n, t) => n + t.days.length, 0);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };

// Mirrors the redirects in vercel.json, so the suite covers old links too.
const REDIRECTS = { "/about": "/" };

// The calendar feed is a Vercel function reached through the rewrite in
// vercel.json; the test server routes the same path to the same handler.
const calendarFeed = require("../api/calendar.js");
// Error reports: the same handler Vercel runs, logging into this array
// instead of the console so the suite can read what would be kept.
const reportHandler = require("../api/report.js");
// Share cards: the rewrite in vercel.json, /cards/{lang}/{track}/{file} ->
// /api/card, mirrored here onto the same handler.
const cardHandler = require("../api/card.js");
const reports = [];
reportHandler.log = line => reports.push(JSON.parse(line));

const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  if (file === "/calendar.ics" || file === "/api/calendar") return calendarFeed(req, res);
  if (file === "/api/report") return reportHandler(req, res);
  const cardRoute = /^\/cards\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(file);
  if (cardRoute) {
    req.url = `/api/card?${new URLSearchParams({ lang: cardRoute[1], track: cardRoute[2], file: cardRoute[3] })}`;
    return cardHandler(req, res);
  }
  if (REDIRECTS[file]) {
    res.writeHead(308, { Location: REDIRECTS[file] });
    return res.end();
  }
  if (file === "/") file = "/index.html";
  // The suite must not depend on the audio host: every recorded-narration
  // check below installs its own manifest entries, pointed at this origin, so
  // the page gets an empty manifest whatever the committed one holds.
  // scripts/verify-audio.js is what checks the committed manifest.
  if (file === "/audio-manifest.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end(`const audioManifest = { version: 1, enabled: true, base: "", items: {} };\n`);
  }
  // Mirror Vercel's cleanUrls: /about -> about/index.html, /day/x -> day/x.html
  let full = path.join(ROOT, file);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    for (const candidate of [full + ".html", path.join(full, "index.html")]) {
      if (fs.existsSync(candidate)) { full = candidate; break; }
    }
  }
  try {
    const data = fs.readFileSync(full);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
      // Mirror the production CSP from vercel.json so violations fail the test.
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; media-src 'self' blob: https://stand-audio.vercel.app https://audio.prayers.dougdevitre.org; connect-src 'self' https://stand-audio.vercel.app https://audio.prayers.dougdevitre.org; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    res.end(data);
  } catch {
    // Mirror Vercel: a path that matches nothing gets the site's 404.html,
    // with a 404 status, under the same CSP.
    res.writeHead(404, {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; media-src 'self' blob: https://stand-audio.vercel.app https://audio.prayers.dougdevitre.org; connect-src 'self' https://stand-audio.vercel.app https://audio.prayers.dougdevitre.org; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    res.end(fs.readFileSync(path.join(ROOT, "404.html")));
  }
});

(async () => {
  await new Promise(r => server.listen(8123, r));
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", d => d.accept());

  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) process.exitCode = 1; };

  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });

  // first-visit welcome with path choice
  check("welcome shows on first visit", await page.evaluate(() => document.getElementById("welcomeDialog").open));
  check("welcome offers 4 paths", (await page.$$(".path-button")).length === 4);
  await page.click("#beginButton");
  check("welcome closes on Begin", !(await page.evaluate(() => document.getElementById("welcomeDialog").open)));
  check("install hint hidden on desktop", await page.evaluate(() => document.getElementById("installHint").hidden));

  check("title shows Day 1", (await page.title()).includes("Day 1"));
  check("hash set to #1", page.url().endsWith("#1"));
  check("scripture rendered", (await page.textContent("#scriptureText")).length > 10);
  check("progress shows 0 of 30", (await page.textContent("#progressPercent")) === "0 of 30 complete");

  // next / prev
  await page.click("#nextButton");
  check("next goes to Day 2", (await page.textContent("#dayNumber")) === "DAY 02");
  await page.click("#prevButton");
  check("prev returns to Day 1", (await page.textContent("#dayNumber")) === "DAY 01");

  // keyboard nav
  await page.keyboard.press("ArrowRight");
  check("ArrowRight goes to Day 2", (await page.textContent("#dayNumber")) === "DAY 02");
  await page.keyboard.press("ArrowLeft");
  check("ArrowLeft returns to Day 1", (await page.textContent("#dayNumber")) === "DAY 01");

  // complete + favorite
  await page.click("#completeButton");
  check("complete marks day", (await page.textContent("#completeButton")).includes("Day complete"));
  check("progress shows 1 of 30", (await page.textContent("#progressPercent")) === "1 of 30 complete");
  check("aria-pressed true on complete", (await page.getAttribute("#completeButton", "aria-pressed")) === "true");
  await page.click("#favoriteButton");
  check("favorite toggles heart", (await page.textContent("#favoriteButton")) === "♥");

  // library + filters
  await page.click("#libraryButton");
  check("library opens", await page.isVisible("#dayGrid"));
  check("30 day cards in All", (await page.$$(".day-card")).length === 30);
  await page.click('.filter-tab[data-filter="favorites"]');
  check("favorites filter shows 1 card", (await page.$$(".day-card")).length === 1);
  await page.click('.filter-tab[data-filter="completed"]');
  check("completed filter shows 1 card", (await page.$$(".day-card")).length === 1);
  await page.click(".day-card");
  check("card click navigates to Day 1", (await page.textContent("#dayNumber")) === "DAY 01");

  // notes persistence
  await page.fill("#notes", "test note");
  await page.waitForTimeout(600);
  check("note save status", (await page.textContent("#saveStatus")) === "Saved on this device");

  // Keeping the data. With a note saved, never backed up, and storage the
  // browser has not promised to keep, the reader is offered a backup. The
  // storage answers are stubbed so the check does not depend on how this
  // browser decides. It ends snoozed, so the rest of the suite runs as before.
  await page.evaluate(() => {
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => false;
    localStorage.removeItem("stand-backup-at");
    localStorage.removeItem("stand-backup-snooze");
    return protectData();
  });
  check("a reader with notes and no backup is offered one", await page.isVisible("#backupNudge"));
  check("the offer says the data lives only on this device", (await page.textContent("#backupNudgeText")).includes("saved only on this device"));
  const nudged = await Promise.all([page.waitForEvent("download"), page.click("#backupNudgeSave")]).then(r => r[0]);
  check("the offer saves the same backup file", nudged.suggestedFilename() === "stand-backup.json");
  check("saving records the backup and says where to find Restore", await page.evaluate(() => Number(localStorage.getItem("stand-backup-at")) > 0)
    && (await page.textContent("#backupNudgeText")).includes("Backup saved") && !(await page.isVisible("#backupNudgeSave")));
  await page.evaluate(() => protectData());
  check("after a backup the offer stays away", !(await page.isVisible("#backupNudge")));
  await page.evaluate(() => { localStorage.removeItem("stand-backup-at"); return protectData(); });
  check("the offer returns when no backup is on record", await page.isVisible("#backupNudge") && await page.isVisible("#backupNudgeSave"));
  await page.click("#backupNudgeLater");
  await page.evaluate(() => protectData());
  check("Not now puts it away for a month", !(await page.isVisible("#backupNudge"))
    && await page.evaluate(() => Number(localStorage.getItem("stand-backup-snooze")) > 0));
  await page.evaluate(() => { localStorage.removeItem("stand-backup-snooze"); navigator.storage.persisted = async () => true; return protectData(); });
  check("storage the browser has promised to keep (off iPhone) needs no offer", !(await page.isVisible("#backupNudge")));
  check("the app asks the browser to keep its storage once there is something to keep", await page.evaluate(() => persistRequested));
  await page.evaluate(() => {
    navigator.storage.persisted = async () => false;
    localStorage.setItem("stand-backup-snooze", String(Date.now()));
  });

  // journal
  await page.click("#journalButton");
  check("journal opens", await page.isVisible("#journalList"));
  check("journal shows saved note", (await page.textContent("#journalList")).includes("test note"));
  check("journal entry labeled", (await page.textContent("#journalList")).includes("DAY 01"));
  check("export enabled", !(await page.isDisabled("#exportButton")));
  const download = await Promise.all([page.waitForEvent("download"), page.click("#exportButton")]).then(r => r[0]);
  check("export downloads reflections file", download.suggestedFilename() === "stand-reflections.txt");

  // backup, then clear the note and restore it
  const backup = await Promise.all([page.waitForEvent("download"), page.click("#backupButton")]).then(r => r[0]);
  check("backup downloads json file", backup.suggestedFilename() === "stand-backup.json");
  const backupPath = await backup.path();
  await page.click("#closeJournal");
  await page.fill("#notes", "");
  await page.waitForTimeout(600);
  await page.click("#journalButton");
  check("journal empty after clearing note", (await page.textContent("#journalList")).includes("No reflections yet"));
  await page.setInputFiles("#restoreInput", backupPath);
  await page.waitForTimeout(400);
  check("restore brings note back", (await page.textContent("#journalList")).includes("test note"));
  await page.click("#closeJournal");

  // tracks: switch to Fear of the Unknown, verify isolation, switch back
  await page.click("#libraryButton");
  check("track picker lists every journey", (await page.$$(".track-chip")).length === TRACK_COUNT);
  check("track picker groups journeys", (await page.$$(".track-group-label")).length === GROUP_COUNT);
  await page.click('.track-chip[data-track="unknown"]');
  check("track day 1 title", (await page.textContent("#dayTitle")) === "The Unwritten Page");
  check("track length is 5", (await page.textContent("#progressLabel")) === "Day 1 of 5");
  check("track week label", (await page.textContent("#weekLabel")).includes("FEAR OF THE UNKNOWN"));
  await page.click("#completeButton");
  check("track completion isolated", (await page.textContent("#progressPercent")).startsWith("1 of 5"));
  await page.fill("#notes", "track note");
  await page.waitForTimeout(600);
  await page.click("#libraryButton");
  await page.click('.track-chip[data-track="core"]');
  check("core day content restored", (await page.textContent("#dayNumber")) === "DAY 02");
  check("core progress unaffected by track", (await page.textContent("#progressPercent")).startsWith("1 of 30"));
  await page.click("#journalButton");
  check("track note not in core journal", !(await page.textContent("#journalList")).includes("track note"));
  await page.click("#closeJournal");
  await page.click("#prevButton"); // back to core Day 1 for the tests below

  // completion date recorded for streak
  const savedDate = await page.evaluate(() => JSON.parse(localStorage.getItem("stand-state")).completedDates[0]);
  check("completion date recorded", /^\d{4}-\d{2}-\d{2}$/.test(savedDate || ""));

  // day fear check-in
  await page.click('#dayCheckin button[data-v="3"]');
  check("day check-in noted", (await page.textContent("#checkinNote")).includes("3 of 5"));
  check("day check-in stored", await page.evaluate(() => JSON.parse(localStorage.getItem("stand-state")).checkins.length === 1));

  // SOS full flow: before check-in -> breathing -> anchor -> after check-in -> summary
  await page.click("#sosButton");
  check("SOS opens with before check-in", (await page.textContent("#sosStage")).includes("Where is your fear right now?"));
  await page.click('#sosStage .checkin-scale button:nth-child(4)'); // fear = 4
  check("SOS breathing stage", await page.isVisible(".breath-circle"));
  await page.click('#sosStage .complete-button'); // Continue past breathing
  // Capitalised since the scripture swap: the WEB renders Psalm 27:1 as two
  // sentences ("...my salvation. Whom shall I fear?") where the NIV had one.
  check("SOS anchor shows verse", (await page.textContent("#sosStage")).includes("Whom shall I fear"));
  await page.click('#sosStage .complete-button'); // I'm steadier
  check("SOS after check-in", (await page.textContent("#sosStage")).includes("And now"));
  await page.click('#sosStage .checkin-scale button:nth-child(2)'); // fear = 2
  check("SOS summary shows drop", (await page.textContent("#sosStage")).includes("4 → 2"));
  check("SOS session stored", await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stand-state")).sos;
    return s.length === 1 && s[0].before === 4 && s[0].after === 2;
  }));
  await page.click('#sosStage .complete-button'); // Close

  // crisis resources visible inside SOS
  await page.click("#sosButton");
  await page.click("#sosSupport");
  check("crisis resources shown", (await page.textContent("#sosResources")).includes("988"));
  // One tap to call or text in a crisis, and a way to find help outside the US.
  check("crisis numbers are tappable", await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll("#sosResources a")].map(a => a.getAttribute("href"));
    return ["tel:988", "sms:741741", "tel:911", "https://findahelpline.com"].every(h => hrefs.includes(h));
  }));
  check("the English text line keyword is HOME", (await page.textContent("#sosResources")).includes("Text HOME to 741741"));
  check("readers outside the US are pointed to a helpline finder", (await page.textContent("#sosResources")).includes("Outside the US: findahelpline.com"));
  check("the helpline finder opens safely in a new tab", await page.evaluate(() => {
    const a = document.querySelector('#sosResources a[href="https://findahelpline.com"]');
    return a.target === "_blank" && a.rel.includes("noopener");
  }));
  await page.click("#closeSos");

  // calm ledger in journal
  await page.click("#journalButton");
  const ledgerText = await page.textContent("#ledger");
  check("ledger shows fear drop", ledgerText.includes("2.0 points"));
  check("ledger shows weekly average", ledgerText.includes("this week"));
  await page.click("#closeJournal");

  // share button: headless Chromium has no navigator.share, so this is the
  // desktop path, a dialog. The link is the day's crawlable page (which
  // previews with the day's own title), not the app's /app#1.
  await page.click("#shareButton");
  check("share opens the share dialog on desktop", await page.evaluate(() => document.getElementById("shareDialog").open));
  {
    const pageUrl = "http://localhost:8123/day/01-stand";
    const enc = encodeURIComponent(pageUrl);
    const hrefs = await page.$$eval("#shareSheet .share-link", as => as.map(a => a.getAttribute("href")));
    check("share dialog links carry the day's canonical page, not /app", hrefs.length === 4
      && hrefs[0].startsWith("https://twitter.com/intent/tweet?text=") && hrefs[0].endsWith(`&url=${enc}`)
      && hrefs[1] === `https://www.facebook.com/sharer/sharer.php?u=${enc}`
      && hrefs[2].startsWith("https://wa.me/?text=") && hrefs[2].endsWith(enc)
      && hrefs[3].startsWith("mailto:?subject=Day%201%3A%20Stand") && hrefs.every(h => !h.includes(encodeURIComponent("/app"))));
    check("share dialog links draw their icons and open safely", await page.$$eval("#shareSheet .share-link", as =>
      as.every(a => a.querySelector("svg") && a.target === "_blank" && a.rel.includes("noopener") && (a.getAttribute("aria-label") || "").startsWith("Share"))));
    check("share dialog shows the verse it will share", (await page.textContent("#shareCaption")).startsWith("“Be strong in the Lord"));
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:8123" });
    await page.click("#shareCopy");
    await page.waitForFunction(() => document.getElementById("shareCopyLabel").textContent === "Link copied", null, { timeout: 3000 }).catch(() => {});
    check("share dialog copies the canonical page URL and says so", await page.evaluate(() => navigator.clipboard.readText()) === pageUrl
      && (await page.textContent("#shareCopyLabel")) === "Link copied");
    const card = await Promise.all([page.waitForEvent("download"), page.click("#shareSaveCard")]).then(r => r[0]);
    check("share dialog saves the verse card", card.suggestedFilename() === "stand-day-01.png");
    // The suite's contrast() helper is declared further down; this is the same
    // WCAG 2.1 ratio, local to this block.
    const ratio = sel => page.evaluate(s => {
      const lum = c => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const cs = getComputedStyle(document.querySelector(s));
      const a = lum(cs.color), b = lum(cs.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, sel);
    check("share dialog has no contrast failures", (await ratio("#shareCopy")) >= 4.5 && (await ratio("#shareSaveCard")) >= 4.5);
    await page.click("#closeShare");
    check("share dialog closes", await page.evaluate(() => !document.getElementById("shareDialog").open));
  }

  // repeat toggle and sleep timer controls
  await page.click("#repeatButton");
  check("repeat toggles on", (await page.getAttribute("#repeatButton", "aria-pressed")) === "true");
  await page.click("#repeatButton");
  check("repeat toggles off", (await page.getAttribute("#repeatButton", "aria-pressed")) === "false");
  check("sleep timer present", await page.isVisible("#sleepTimer"));

  // static SEO day page
  await page.goto("http://localhost:8123/day/08-fear.html", { waitUntil: "networkidle" });
  check("SEO page title", (await page.title()).includes("Day 8: Fear"));
  check("SEO page has prayer", (await page.textContent("body")).includes("worship fear"));
  check("SEO page links into app", await page.isVisible('a[href="/app#8"]'));

  // static SEO track page + deep link
  await page.goto("http://localhost:8123/track/night/01-lying-down.html", { waitUntil: "networkidle" });
  check("track SEO page title", (await page.title()).includes("Lying Down"));
  check("track SEO page links into app", await page.isVisible('a[href="/app?track=night#1"]'));
  await page.goto("http://localhost:8123/app?track=unknown#2", { waitUntil: "networkidle" });
  check("?track deep link switches journey", (await page.textContent("#dayTitle")) === "Daily Bread");
  await page.goto("http://localhost:8123/app?track=furnace#2", { waitUntil: "networkidle" });
  check("courage story deep link", (await page.textContent("#dayTitle")) === "Even If");
  check("courage story week label", (await page.textContent("#weekLabel")).includes("COURAGE STORY"));
  check("courage story length is 4", (await page.textContent("#progressLabel")) === "Day 2 of 4");
  await page.goto("http://localhost:8123/app?track=core#1", { waitUntil: "networkidle" });

  // daily reminder ICS
  await page.click("#libraryButton");
  const ics = await Promise.all([page.waitForEvent("download"), page.click("#reminderButton")]).then(r => r[0]);
  check("reminder downloads ics", ics.suggestedFilename() === "stand-daily-reminder.ics");
  await page.click("#closeLibrary");

  // reload: resumes at first incomplete day (day 1 complete -> day 2)
  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  check("resumes at first incomplete day (Day 2)", (await page.textContent("#dayNumber")) === "DAY 02");
  check("welcome not shown on return visit", !(await page.evaluate(() => document.getElementById("welcomeDialog").open)));

  // deep link still wins
  await page.goto("http://localhost:8123/app#15", { waitUntil: "networkidle" });
  check("deep link #15 opens Day 15", (await page.textContent("#dayNumber")) === "DAY 15");

  // ?sos=1 home-screen shortcut auto-opens SOS
  await page.goto("http://localhost:8123/app?sos=1", { waitUntil: "networkidle" });
  check("?sos=1 auto-opens SOS", await page.evaluate(() => document.getElementById("sosDialog").open));
  await page.click("#closeSos");

  // theme toggle
  await page.click("#themeButton");
  check("theme toggles dark class", await page.evaluate(() => document.documentElement.classList.contains("dark")));

  // play button doesn't throw (voices may be absent headless)
  await page.click("#playButton");
  await page.waitForTimeout(300);
  await page.evaluate(() => stopAudio());

  // Recorded narration. The test server serves an empty manifest (above), so
  // the suite points it at a one-second silent MP3 served from this origin (the CSP allows 'self' and the audio CDN) and checks the
  // player takes the recording rather than the device voice, ends back at
  // idle, and falls back to the device voice when the file is missing.
  {
    const csp = await page.evaluate(async () => (await fetch("/app")).headers.get("content-security-policy"));
    check("CSP allows media from the audio origins", /media-src 'self' blob: https:\/\/stand-audio\.vercel\.app https:\/\/audio\.prayers\.dougdevitre\.org; connect-src 'self' https:\/\/stand-audio\.vercel\.app https:\/\/audio\.prayers\.dougdevitre\.org;/.test(csp));
    check("the day narration script is the shared one", await page.evaluate(() =>
      narrationScript(0).startsWith("Day one. Stand.\n\nScripture... Ephesians, chapter six, verses ten through thirteen.")));
    check("no recording is offered without a manifest entry", await page.evaluate(() =>
      recordedFor(0) === null && document.getElementById("audioTime").textContent === "About 3 minutes"));
    await page.evaluate(() => {
      audioManifest.base = location.origin;
      audioManifest.items[dayItemId("en", "core", 0)] = { key: "tests/fixtures/silence.mp3", hash: "0".repeat(64), bytes: 15846, seconds: 1 };
      go(0);
    });
    check("a manifest entry labels the day as recorded", (await page.textContent("#audioTime")) === "Recorded narration · about 3 minutes");
    await page.click("#playButton");
    await page.waitForFunction(() => player.status === "playing", null, { timeout: 5000 }).catch(() => {});
    check("play takes the recording from the manifest", await page.evaluate(() =>
      player.mode === "rec" && player.status === "playing" && audioEl.src === `${location.origin}/tests/fixtures/silence.mp3`));
    check("a playing recording sets the Media Session playback state", await page.evaluate(() =>
      navigator.mediaSession.playbackState === "playing"));
    // The metadata is set once play() resolves, a moment after the status flips.
    await page.waitForFunction(() => navigator.mediaSession.metadata !== null, null, { timeout: 5000 }).catch(() => {});
    check("the Media Session artwork is an absolute path", await page.evaluate(() =>
      navigator.mediaSession.metadata.artwork[0].src.endsWith("/icon-512.png")));
    await page.waitForFunction(() => player.status === "idle", null, { timeout: 10000 }).catch(() => {});
    check("a recording ends back at idle", await page.evaluate(() => player.status === "idle"));
    check("an ended recording clears the Media Session playback state", await page.evaluate(() =>
      navigator.mediaSession.playbackState === "none"));
    // A file that is not audio (a 404 would log a console error and trip the
    // page-error check below; an undecodable body rejects play() the same way).
    await page.evaluate(() => { audioManifest.items[dayItemId("en", "core", 0)].key = "robots.txt"; });
    await page.click("#playButton");
    await page.waitForFunction(() => player.mode === "tts", null, { timeout: 5000 }).catch(() => {});
    check("an unplayable recording falls back to the device voice", await page.evaluate(() => player.mode === "tts"));
    await page.evaluate(() => { stopAudio(); audioManifest.items = {}; audioManifest.base = ""; go(0); });

    // Offline listening. Off by default; turned on, the week ahead and the SOS
    // sets are saved to the Cache API and played from blob: URLs, so with no
    // connection the day still plays its recording rather than falling back to
    // the device voice. Eleven distinct files (the query keeps them apart; the
    // test server ignores it).
    await page.evaluate(() => {
      audioManifest.base = location.origin;
      const entry = n => ({ key: `tests/fixtures/silence.mp3?n=${n}`, hash: "0".repeat(64), bytes: 15846, seconds: 1 });
      for (let d = 0; d < 7; d++) audioManifest.items[dayItemId("en", "core", d)] = entry(d);
      for (let i = 0; i < 4; i++) audioManifest.items[sosItemId("en", i)] = entry(`sos${i}`);
      go(0);
    });
    await page.click("#libraryButton");
    check("offline listening is offered once recordings exist", await page.isVisible("#offlineRow"));
    check("offline listening starts off", !(await page.isChecked("#offlineAudio")));
    await page.check("#offlineAudio");
    await page.waitForFunction(() => /saved on this device/.test(document.getElementById("offlineStatus").textContent), null, { timeout: 8000 }).catch(() => {});
    check("turning it on saves the week and the SOS sets and says how much", (await page.textContent("#offlineStatus")) === "11 recordings saved on this device · 0.2 MB");
    check("the choice is kept on this device, outside the backup", await page.evaluate(() =>
      localStorage.getItem("stand-offline-audio") === "1" && !JSON.stringify(JSON.parse(localStorage.getItem("stand-state"))).includes("offline")));
    check("the saved copies are in the offline cache", await page.evaluate(async () => (await (await caches.open(OFFLINE_CACHE)).keys()).length === 11));
    check("a saved day plays from the device copy", await page.evaluate(() => recordedFor(0).startsWith("blob:") && recordedFor(6).startsWith("blob:")));
    await page.click("#closeLibrary");
    await page.context().setOffline(true);
    await page.click("#playButton");
    await page.waitForFunction(() => player.status === "playing", null, { timeout: 5000 }).catch(() => {});
    check("with no connection, the saved recording plays instead of the device voice", await page.evaluate(() => player.mode === "rec" && audioEl.src.startsWith("blob:")));
    await page.waitForFunction(() => player.status === "idle", null, { timeout: 10000 }).catch(() => {});
    await page.context().setOffline(false);
    // Turning it off deletes the copies; playback streams from the host again.
    await page.click("#libraryButton");
    await page.uncheck("#offlineAudio");
    await page.waitForFunction(() => document.getElementById("offlineStatus").textContent === "Nothing is saved on this device.", null, { timeout: 5000 }).catch(() => {});
    check("turning it off deletes the saved copies and the preference", await page.evaluate(async () =>
      !(await caches.has(OFFLINE_CACHE)) && localStorage.getItem("stand-offline-audio") === null));
    check("and playback streams from the host again", await page.evaluate(() => recordedFor(0) === `${location.origin}/tests/fixtures/silence.mp3?n=0`));
    await page.click("#closeLibrary");
    await page.evaluate(() => { stopAudio(); audioManifest.items = {}; audioManifest.base = ""; go(0); });

    // The SOS recording: named on the lock screen, and it stops when the SOS
    // screen closes, by the × or by Escape. It used to keep talking. The
    // fixture is a second long, so it loops while the check runs; otherwise
    // "it stopped" could pass because it had simply ended.
    await page.evaluate(() => {
      audioManifest.base = location.origin;
      for (let i = 0; i < 4; i++) audioManifest.items[sosItemId("en", i)] = { key: "tests/fixtures/silence.mp3", hash: "0".repeat(64), bytes: 15846, seconds: 1 };
    });
    const sosListen = async () => {
      await page.click("#sosButton");
      await page.click("#sosStage .checkin-scale button:nth-child(4)");
      await page.click("#sosStage .complete-button");
      await page.click('#sosStage button:has-text("Hear this prayed")');
      await page.waitForFunction(() => sos.audio && !audioEl.paused && navigator.mediaSession.playbackState === "playing", null, { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => { audioEl.loop = true; });
    };
    await sosListen();
    check("the SOS recording plays and is named on the lock screen", await page.evaluate(() =>
      sos.audio && !audioEl.paused && audioEl.src === `${location.origin}/tests/fixtures/silence.mp3`
      && navigator.mediaSession.playbackState === "playing"
      && /^Steady me now · \S/.test(navigator.mediaSession.metadata && navigator.mediaSession.metadata.title)));
    check("the SOS recording gets lock-screen position like any recording", await page.evaluate(() => recordingInSession()));
    await page.click("#closeSos");
    check("closing SOS stops its recording", await page.evaluate(() => audioEl.paused && !sos.audio && navigator.mediaSession.playbackState === "none"));
    await page.evaluate(() => { audioEl.loop = false; });
    await sosListen();
    await page.keyboard.press("Escape");
    check("Escape out of SOS stops its recording too", await page.evaluate(() =>
      !document.getElementById("sosDialog").open && audioEl.paused && !sos.audio));
    await page.evaluate(() => { audioEl.loop = false; stopAudio(); audioManifest.items = {}; audioManifest.base = ""; go(0); });

    // Device speech names the day on the lock screen, without a scrubber.
    check("device narration names the day on the lock screen", await page.evaluate(() => {
      speakDay();
      const title = navigator.mediaSession.metadata && navigator.mediaSession.metadata.title;
      stopAudio();
      return title === document.title;
    }));
    // The kill switch: ?tts=1 ignores the manifest entirely.
    await page.goto("http://localhost:8123/app?tts=1#1", { waitUntil: "networkidle" });
    check("?tts=1 forces the device voice", await page.evaluate(() => {
      audioManifest.items[dayItemId("en", "core", 0)] = { key: "tests/fixtures/silence.mp3", hash: "0".repeat(64) };
      const forced = recordedFor(0) === null;
      audioManifest.items = {};
      return forced;
    }));
  }

  // Error reports, in a page of their own so these deliberate errors never
  // reach the suite's "no page errors" check. An error thrown by one of the
  // app's own scripts is reported with its type, file and line, and its
  // quoted text removed; a rejection carrying a reader's words keeps its
  // shape and loses the words; at most three go per page load; an error from
  // a script that is not the site's is not reported at all.
  {
    const probe = await browser.newPage();
    await probe.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
    reports.length = 0;
    await probe.evaluate(() => { setTimeout(() => dayScript(null, 0, "en"), 0); });
    await probe.waitForTimeout(400);
    const thrown = reports[0];
    check("an error in the app's own script is reported", reports.length === 1 && thrown.event === "client-error"
      && thrown.file === "/narration.js" && thrown.line > 0 && thrown.page === "/app" && thrown.name === "TypeError");
    check("the report carries no quoted text", !/'[^…]|"[^…]/.test(thrown.message));
    await probe.evaluate(() => { Promise.reject(new Error('could not save "my private note about court"')); });
    await probe.waitForTimeout(400);
    check("a rejection's message keeps its shape and loses the reader's words", reports.length === 2
      && reports[1].message === 'could not save "…"' && !JSON.stringify(reports).includes("private note"));
    await probe.evaluate(() => { for (let i = 0; i < 5; i++) Promise.reject(new Error(`failure ${i}`)); });
    await probe.waitForTimeout(400);
    check("no more than three reports leave a page load", reports.length === 3);
    await probe.close();
    const quiet = await browser.newPage();
    await quiet.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
    reports.length = 0;
    await quiet.evaluate(() => { dispatchEvent(new ErrorEvent("error", { message: "from an extension", filename: "chrome-extension://abc/content.js", lineno: 1 })); });
    await quiet.waitForTimeout(400);
    check("errors from scripts that are not the site's are not reported", !reports.some(r => /extension/.test(r.message)));
    await quiet.close();
  }

  // service worker registered
  const swReady = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length > 0));
  check("service worker registered", swReady);

  // erase all data (confirm auto-accepted) -> reload -> welcome returns
  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  await page.click("#journalButton");
  await Promise.all([page.waitForNavigation(), page.click("#eraseButton")]);
  await page.waitForTimeout(300);
  check("erase clears state and reshows welcome", await page.evaluate(() => document.getElementById("welcomeDialog").open));
  check("erase removed storage", await page.evaluate(() => localStorage.getItem("stand-state") === null || !JSON.parse(localStorage.getItem("stand-state")).completed.length));
  check("erase also forgets the backup reminders", await page.evaluate(() => localStorage.getItem("stand-backup-at") === null && localStorage.getItem("stand-backup-snooze") === null));

  // welcome path selection starts the chosen track
  await page.click('.path-button[data-track="night"]');
  check("welcome path starts night track", (await page.textContent("#dayTitle")) === "Lying Down");
  check("welcome path shows 5-day progress", (await page.textContent("#progressLabel")) === "Day 1 of 5");

  // fear finder: a plain-language situation jumps straight into its track
  await page.click("#libraryButton");
  check("fear finder lists every situation", (await page.$$("#fearFinder option")).length === fearIndex.length + 1);
  await page.selectOption("#fearFinder", "den");
  check("fear finder opens the mapped track", (await page.textContent("#dayTitle")) === "The Trap");
  check("fear finder closed the library", !(await page.evaluate(() => document.getElementById("libraryDialog").open)));
  await page.click("#libraryButton");
  check("fear finder resets after use", (await page.inputValue("#fearFinder")) === "");
  await page.click("#closeLibrary");

  // prayer composer: composes from the corpus, reseeds, and narrates
  await page.click("#prayerButton");
  check("prayer dialog opens", await page.isVisible("#prayerCard"));
  const firstPrayer = await page.textContent("#prayerCard");
  check("prayer has a title and lines", (await page.$$(".prayer-line")).length >= 3);
  check("prayer footnote shows combinations", (await page.textContent("#prayerMeta")).includes("can be composed"));
  await page.click("#prayerAnother");
  check("another prayer composes a different one", (await page.textContent("#prayerCard")) !== firstPrayer);
  await page.selectOption("#prayerMode", "grace");
  check("switching mode repopulates intentions", (await page.$$("#prayerIntention option")).length === prayerCorpus.modes.grace.intentions.length);
  await page.selectOption("#prayerMode", "prayer");
  await page.selectOption("#prayerIntention", "fear");
  await page.fill("#prayerPetition", "my hearing on Thursday");
  check("petition is woven into the prayer", (await page.textContent("#prayerCard")).includes("my hearing on Thursday"));
  check("every traditional prayer is listed", (await page.$$(".traditional-chip")).length === prayerCorpus.traditional.length);
  const rcCount = prayerCorpus.traditional.filter(t => t.tradition === "roman-catholic").length;
  check("Roman Catholic prayers are a named group", (await page.$$('.traditional-chips[data-tradition="roman-catholic"] .traditional-chip')).length === rcCount);
  check("Roman Catholic group is labelled", (await page.textContent("#traditionalList")).includes("Roman Catholic prayers"));
  await page.click('.traditional-chips[data-tradition="roman-catholic"] .traditional-chip');
  check("traditional prayer opens", await page.isVisible("#traditionalCard"));
  check("Roman Catholic prayer says so", (await page.textContent("#traditionalCard")).includes("Roman Catholic"));

  // A traditional prayer's recording, from the manifest, through the same
  // audio element as the day narration: the Listen button becomes Stop while
  // it plays, resets when the file ends, and an unplayable file falls back to
  // the device voice without touching the day player's state.
  {
    const openId = await page.evaluate(() => prayerState.openTraditional);
    await page.evaluate(id => {
      audioManifest.base = location.origin;
      audioManifest.items[prayerItemId("en", id)] = { key: "tests/fixtures/silence.mp3", hash: "0".repeat(64), bytes: 15846, seconds: 1 };
    }, openId);
    await page.click(`.traditional-chip[data-prayer="${openId}"]`);
    await page.click("#traditionalListen");
    await page.waitForFunction(() => prayerAudio.playing, null, { timeout: 5000 }).catch(() => {});
    check("a traditional prayer plays its recording", await page.evaluate(() =>
      prayerAudio.playing && prayerAudio.recorded && audioEl.src === `${location.origin}/tests/fixtures/silence.mp3` && player.status === "idle"));
    check("the prayer button reads Stop while it plays", (await page.textContent("#traditionalListen")).includes("Stop"));
    await page.waitForFunction(() => !prayerAudio.playing, null, { timeout: 10000 }).catch(() => {});
    check("the prayer recording ends and the button resets", await page.evaluate(() => !prayerAudio.playing && !prayerAudio.recorded)
      && (await page.textContent("#traditionalListen")).includes("Listen"));
    await page.evaluate(id => { audioManifest.items[prayerItemId("en", id)].key = "robots.txt"; }, openId);
    await page.click("#traditionalListen");
    await page.waitForFunction(() => !prayerAudio.recorded, null, { timeout: 5000 }).catch(() => {});
    check("an unplayable prayer recording falls back to the device voice", await page.evaluate(() => !prayerAudio.recorded));
    await page.evaluate(() => { stopPrayerNarration(); audioManifest.items = {}; audioManifest.base = ""; });
    await page.click(`.traditional-chip[data-prayer="${openId}"]`);
  }
  // language is app-wide state: switching repaints the corpus and the chrome
  await page.selectOption("#prayerLang", "es");
  check("Spanish switches the heading", (await page.textContent("#prayerHeading")) === prayerUi.es.title);
  check("Spanish switches the group label", (await page.textContent("#traditionalList")).includes(prayerCorpus.meta.traditionLabels["roman-catholic"].es));
  check("Spanish switches the composed prayer", (await page.textContent("#prayerCard")).includes("\u00f3") || (await page.textContent("#prayerCard")).includes("\u00e1"));
  check("language persists to storage", await page.evaluate(() => JSON.parse(localStorage.getItem("stand-state")).lang === "es"));
  const esSeed = await page.textContent("#prayerCard");
  await page.selectOption("#prayerLang", "en");
  check("English returns", (await page.textContent("#prayerHeading")) === prayerUi.en.title);
  check("switching language keeps the same prayer", (await page.textContent("#prayerCard")) !== esSeed);
  // side-by-side: one prayer shown twice, not two prayers
  await page.check("#prayerBoth");
  const altLines = await page.$$(".prayer-card .prayer-line-alt");
  check("both languages render side by side", altLines.length >= 1);
  check("each line has a translation beside it",
    (await page.$$(".prayer-card .prayer-line")).length === altLines.length * 2);
  check("the title is shown in both languages", await page.isVisible(".prayer-card .prayer-title-alt"));
  const primaryLine = await page.textContent(".prayer-card .prayer-line:not(.prayer-line-alt)");
  const altLine = await page.textContent(".prayer-card .prayer-line-alt");
  check("the two columns differ", primaryLine.trim() !== altLine.trim());
  check("side-by-side persists to storage", await page.evaluate(() => JSON.parse(localStorage.getItem("stand-state")).bilingual === true));
  await page.click('.traditional-chips[data-tradition="universal"] .traditional-chip');
  check("traditional prayers show both languages too", (await page.$$("#traditionalCard .prayer-line-alt")).length === 1);
  await page.uncheck("#prayerBoth");
  check("unchecking returns to one language", (await page.$$(".prayer-card .prayer-line-alt")).length === 0);
  await page.click("#closePrayer");
  check("prayer dialog closes", !(await page.evaluate(() => document.getElementById("prayerDialog").open)));

  // WCAG 2.1 contrast for a selector's own text against its own background.
  // `.landing-footer a` used to beat `.complete-button` on specificity and
  // painted the footer's call to action muted grey on ink at 2.92:1.
  const contrast = sel => page.evaluate(s => {
    const lum = c => {
      const [r, g, b] = c.match(/\d+/g).slice(0, 3)
        .map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const el = document.querySelector(s);
    if (!el) return 0;
    const cs = getComputedStyle(el);
    const a = lum(cs.color), b = lum(cs.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, sel);
  // landing page: what the app does, with a call to action in three places
  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  check("landing page loads", (await page.title()).includes("prayer companion for fear"));
  check("landing uses the app shell", await page.isVisible(".app-shell .topbar .brand"));
  check("landing describes what the app does", (await page.$$(".feature-card")).length >= 8);
  check("landing names the Roman Catholic prayers", (await page.textContent(".feature-grid")).includes("Roman Catholic"));
  check("landing quotes no prices", !/\$|price|pricing|per month|subscription/i.test(await page.textContent("main")));
  check("no plan cards remain", (await page.$$(".plan-card")).length === 0);
  // a call to action in the hero, the nav, and the footer
  check("hero has a call to action", await page.isVisible('.landing-hero a.complete-button[href="/app"]'));
  check("hero also offers SOS", await page.isVisible('.landing-hero a[href="/app?sos=1"]'));
  check("nav has a call to action", await page.isVisible('.site-nav a.nav-cta[href="/app"]'));
  check("footer has a call to action", await page.isVisible('.landing-footer a.complete-button[href="/app"]'));
  // 13.6px at weight 800 is normal text by WCAG, so the bar is 4.5:1.
  check("landing footer CTA meets AA contrast", (await contrast(".landing-footer .complete-button")) >= 4.5);
  check("footer links onward", (await page.$$(".footer-links a")).length >= 3);
  check("landing heading levels do not skip", await page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(h => Number(h.tagName[1]));
    return !levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
  }));
  const landingScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("landing has no horizontal scroll", !landingScroll);
  // Screenshots of the running app. The page described the app in 650 words
  // and showed none of it; these are captures, not mockups.
  check("landing shows the app", (await page.$$("#see .shot img")).length === 3);
  const shotsLoad = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("#see .shot img")];
    await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; })));
    return imgs.filter(i => i.naturalWidth > 0).length;
  });
  check("every screenshot resolves", shotsLoad === 3);
  check("screenshots are described", await page.evaluate(() =>
    [...document.querySelectorAll("#see .shot img")].every(i => (i.getAttribute("alt") || "").length > 40)));
  check("screenshots reserve their space", await page.evaluate(() =>
    [...document.querySelectorAll("#see .shot img")].every(i => i.getAttribute("width") && i.getAttribute("height"))));
  // A light screenshot on a dark page glares, so each has a dark counterpart.
  check("screenshots have a dark variant", await page.evaluate(() =>
    [...document.querySelectorAll("#see .shot picture source")]
      .every(sourceEl => sourceEl.getAttribute("media") === "(prefers-color-scheme: dark)")
    && document.querySelectorAll("#see .shot picture source").length === 3));

  // Structured data: verified to survive script-src 'self' because ld+json is
  // data, not executable script.
  const ld = await page.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return "unparseable"; }
  });
  check("landing carries structured data", ld && ld !== "unparseable");
  check("structured data names the app", Boolean(ld) && ld !== "unparseable"
    && ld["@graph"].some(n => n["@type"] === "SoftwareApplication" && n.name === "Stand"));
  check("structured data says it is free", Boolean(ld) && ld !== "unparseable"
    && ld["@graph"].some(n => n.offers && n.offers.price === "0"));
  // Never claim ratings or reviews the app has not received.
  check("structured data invents no reviews",
    !/aggregateRating|"review"|ratingValue/i.test(await page.content()));

  // the menu is a <details> disclosure, so it works with no script at all
  check("menu starts closed", !(await page.evaluate(() => document.querySelector(".nav-menu").open)));
  await page.click(".nav-menu > summary");
  check("menu opens", await page.evaluate(() => document.querySelector(".nav-menu").open));
  check("menu holds the call to action", await page.isVisible('.nav-menu a[href="/app"]'));
  check("menu links to the fear index", await page.isVisible('.nav-menu a[href="/fears"]'));
  await page.click(".nav-menu > summary");
  check("menu closes again", !(await page.evaluate(() => document.querySelector(".nav-menu").open)));
  // fear index: the finder's phrases as a crawlable page
  await page.goto("http://localhost:8123/fears", { waitUntil: "networkidle" });
  check("fear index loads", (await page.title()).includes("Where are you right now?"));
  check("fear index lists every situation", (await page.$$(".feature-card")).length === fearIndex.length);
  check("fear index groups by journey kind", (await page.$$(".landing-section .section-kicker")).length >= 3);
  // Scoped to the closing section: the nav menu also links to SOS, and its copy
  // sits inside a closed <details>, so a bare selector matches a hidden node.
  check("fear index offers SOS for the rest", await page.isVisible('.landing-close a[href="/app?sos=1"]'));
  const fearNoScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("fear index has no horizontal scroll", !fearNoScroll);
  // Heading levels must not skip: an h1 followed by card h3s reads as a broken
  // outline to a screen reader, which is what axe flagged here.
  const headingsSkip = async () => page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(h => Number(h.tagName[1]));
    return levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
  });
  check("fear index heading levels do not skip", !(await headingsSkip()));
  check("fear index footer CTA meets AA contrast", (await contrast(".landing-footer .complete-button")) >= 4.5);
  // every generated link must resolve, or the page quietly sends people to 404s
  const hrefs = await page.$$eval(".feature-card h3 a", els => els.map(e => e.getAttribute("href")));
  let broken = 0;
  for (const href of hrefs) {
    const res = await page.request.get("http://localhost:8123" + href);
    if (!res.ok()) broken++;
  }
  check("every fear links to a page that exists", broken === 0 && hrefs.length === fearIndex.length);
  await page.click(".feature-card h3 a");
  check("following a fear opens a day page", (await page.$$("article.devotional")).length === 1);

  // Day pages are where search traffic actually lands, so they carry the same
  // way onward as the landing page, and the same social card. Until now they
  // were dead ends: a brand mark, one button, and prev/next.
  await page.goto("http://localhost:8123/day/01-stand", { waitUntil: "networkidle" });
  const meta = name => page.getAttribute(`meta[property="${name}"], meta[name="${name}"]`, "content");
  check("day page is canonical", await page.getAttribute('link[rel="canonical"]', "href") === `${SITE}/day/01-stand`);
  check("day page names its own URL", await meta("og:url") === `${SITE}/day/01-stand`);
  // Each day previews with its own card (api/card.js), not the brand card.
  const { cardFor: dayCard, cardPath: dayCardPath } = require("../cards.js");
  check("day page previews with its own card", await meta("og:image") === `${SITE}${dayCardPath(dayCard("en", "core", 0), "og")}`);
  check("day page asks for a large card", await meta("twitter:card") === "summary_large_image");
  check("day page has the site nav", await page.isVisible('.site-nav a.nav-cta[href="/app"]'));
  check("day page has the footer", await page.isVisible('.landing-footer a.complete-button[href="/app"]'));
  check("day page footer links onward", (await page.$$(".footer-links a")).length >= 3);
  // 13.6px at weight 800 is normal text by WCAG, so the bar is 4.5:1.
  check("day page footer CTA meets AA contrast", (await contrast(".landing-footer .complete-button")) >= 4.5);
  // A page should not link to itself in its own menu.
  check("day one omits itself from its menu", (await page.$$('.nav-menu a[href="/day/01-stand"]')).length === 0);
  check("day one still offers the other journeys", (await page.$$('.nav-menu a[href="/fears"]')).length === 1);

  // The social card is described fully enough for a scraper to lay it out
  // before fetching it, and X is told explicitly rather than left to fall
  // back to og:*.
  check("day page states the card's size and alt text", await meta("og:image:width") === "1200" && await meta("og:image:height") === "630" && (await meta("og:image:alt") || "").startsWith("Day 1: Stand — "));
  check("day page carries twitter:image matching og:image", await page.getAttribute('meta[name="twitter:image"]', "content") === await meta("og:image"));
  check("day page names its locale alternate", await meta("og:locale:alternate") === "es_ES");

  // The share row: four intent links that need no script, plus copy and the
  // native sheet, which share.js reveals. Headless Chromium has no
  // navigator.share, so that button stays hidden here.
  {
    const hrefs = await page.$$eval(".share-row .share-link", as => as.map(a => a.getAttribute("href")));
    check("share row offers X, Facebook, WhatsApp and email", hrefs.length === 4
      && hrefs[0].startsWith("https://twitter.com/intent/tweet?text=") && hrefs[0].endsWith(`&url=${encodeURIComponent(`${SITE}/day/01-stand`)}`)
      && hrefs[1] === `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE}/day/01-stand`)}`
      && hrefs[2].startsWith("https://wa.me/?text=") && hrefs[3].startsWith("mailto:?subject="));
    check("share links open in a new tab without a referrer handle", await page.$$eval(".share-row .share-link", as => as.every(a => a.target === "_blank" && a.rel.includes("noopener"))));
    check("share links are labelled for a screen reader", await page.$$eval(".share-row .share-link", as => as.every(a => (a.getAttribute("aria-label") || "").startsWith("Share"))));
    check("copy link is revealed by share.js, native share is not", await page.isVisible(".share-row .share-copy") && !(await page.isVisible(".share-row .share-native")));
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:8123" });
    await page.click(".share-row .share-copy");
    await page.waitForFunction(() => document.querySelector(".share-row .share-copy span").textContent === "Link copied", null, { timeout: 3000 }).catch(() => {});
    check("copy link puts the canonical page URL on the clipboard and says so", await page.evaluate(() => navigator.clipboard.readText()) === `${SITE}/day/01-stand` && (await page.textContent(".share-row .share-copy span")) === "Link copied");
    check("the copy label returns to rest", await page.waitForFunction(() => document.querySelector(".share-row .share-copy span").textContent === "Copy link", null, { timeout: 4000 }).then(() => true).catch(() => false));
    check("share row has no contrast failures", (await contrast(".share-row .share-copy")) >= 4.5 && (await contrast(".share-label")) >= 4.5);
  }
  const dayNoScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("day page has no horizontal scroll", !dayNoScroll);

  // The social card must actually exist and be an image — an og:image that
  // 404s previews worse than none at all.
  const ogCard = await page.request.get("http://localhost:8123/og-card.png");
  check("the social card resolves", ogCard.ok());
  check("the social card is a PNG", (await ogCard.body()).slice(1, 4).toString() === "PNG");
  const dayOg = await page.request.get((await meta("og:image")).replace(SITE, "http://localhost:8123"));
  const dayOgBody = await dayOg.body();
  check("the day's own preview card resolves as a 1200x630 PNG", dayOg.ok() && dayOgBody.slice(1, 4).toString() === "PNG"
    && dayOgBody.readUInt32BE(16) === 1200 && dayOgBody.readUInt32BE(20) === 630);

  // The sitemap is the whole point of generating these pages.
  const sitemapRes = await page.request.get("http://localhost:8123/sitemap.xml");
  const sitemap = await sitemapRes.text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  // The two landing pages, the two fear indexes, and the privacy policy and
  // terms in both languages, plus every day page.
  check("sitemap lists every generated page", locs.length === DAY_PAGE_COUNT * 2 + 8);
  check("sitemap is absolute", locs.every(u => u.startsWith(SITE + "/")));
  check("sitemap covers the landing page", locs.includes(`${SITE}/`));
  check("sitemap omits the redirected /about", !locs.includes(`${SITE}/about`));
  check("sitemap omits the app shell", !locs.includes(`${SITE}/app`));
  check("sitemap still omits /about", !locs.includes(`${SITE}/about`));
  const robots = await (await page.request.get("http://localhost:8123/robots.txt")).text();
  check("robots points at the sitemap", robots.includes(`Sitemap: ${SITE}/sitemap.xml`));

  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  await page.click("#libraryButton");
  check("app links to the landing page", await page.isVisible('.library-about a[href="/"]'));
  check("app links to the fear index", await page.isVisible('.library-about a[href="/fears"]'));
  // The library link used to read "Features and plans". There are no plans, so
  // it must not promise any — in the app or on the page it opens.
  check("app promises no plans", !/plans|pricing|per month|subscription/i.test(await page.textContent(".library-about")));
  await page.click("#closeLibrary");

  // ---------------------------------------------------------------------
  // Spanish devotional days. The prayer surface has been bilingual for a
  // while; the 108 days were English only, which undercut the claim the
  // landing page makes.
  // Earlier blocks leave the app on another track, day and language, so pin
  // all three before comparing — otherwise this asserts against whatever the
  // previous test happened to leave behind.
  // Set it through the app's own state rather than localStorage directly:
  // app.js reads storage once at evaluation, so a raw write races with the
  // next save() and gets clobbered — which left this block asserting against
  // whatever track the previous test ended on.
  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  await page.evaluate(() => { state.lang = "en"; state.track = "core"; location.hash = "#1"; save(); });
  // reload(), not goto("#1"): adding a hash to the current URL is a
  // same-document navigation, so the page would not reload and this block
  // would assert against the previous test's render.
  await page.reload({ waitUntil: "networkidle" });
  const dayText = async () => ({
    title: await page.textContent("#dayTitle"),
    ref: await page.textContent("#scriptureRef"),
    verse: await page.textContent("#scriptureText"),
    week: await page.textContent("#weekLabel"),
    reflection: await page.textContent("#reflection")
  });
  const english = await dayText();
  check("day starts in English", english.title === "Stand" && english.ref === "Ephesians 6:10–13");

  await page.click("#prayerButton");
  await page.selectOption("#prayerLang", "es");
  await page.click("#closePrayer");
  const spanish = await dayText();
  check("day switches to Spanish", spanish.title === "Firmeza");
  check("reference is localized", spanish.ref === "Efesios 6:10–13");
  check("verse is Reina-Valera", spanish.verse.includes("Confortaos en el Señor"));
  check("week label is Spanish", spanish.week.includes("SEMANA UNO"));
  check("reflection is Spanish", spanish.reflection.includes("combate espiritual"));
  check("every field actually changed", ["title", "ref", "verse", "week", "reflection"]
    .every(k => spanish[k] !== english[k]));

  // The library follows the same choice.
  await page.click("#libraryButton");
  check("library groups are Spanish", (await page.textContent("#trackPicker")).includes("HISTORIAS DE VALOR"));
  check("library counts are Spanish", (await page.textContent("#trackPicker")).includes(" días"));
  await page.click("#closeLibrary");

  // Progress is keyed by index, not by text, so it must survive the switch.
  check("language choice persists", await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stand-state")).lang === "es"));
  await page.reload({ waitUntil: "networkidle" });
  check("Spanish survives a reload", (await page.textContent("#dayTitle")) === "Firmeza");

  await page.click("#prayerButton");
  await page.selectOption("#prayerLang", "en");
  await page.click("#closePrayer");
  check("English returns to the day view", (await page.textContent("#dayTitle")) === "Stand");

  // ---------------------------------------------------------------------
  // Interface translation. The content going Spanish while the chrome around
  // it stayed English was the visible half of this gap, so the chrome is
  // asserted the same way the content is: field by field, and back again.
  const chrome = async () => ({
    htmlLang: await page.getAttribute("html", "lang"),
    complete: await page.textContent("#completeButton"),
    audio: await page.textContent("#audioTime"),
    progress: await page.textContent("#progressLabel"),
    count: await page.textContent("#progressPercent"),
    notes: await page.textContent('label[for="notes"]'),
    scale: await page.textContent("#checkinNote"),
    sos: await page.textContent("#sosButton"),
    timer: await page.textContent('#sleepTimer option[value="5"]'),
    title: await page.title()
  });
  const enChrome = await chrome();
  check("chrome starts in English", enChrome.htmlLang === "en" && enChrome.complete === "Mark day complete");

  await page.click("#prayerButton");
  await page.selectOption("#prayerLang", "es");
  await page.click("#closePrayer");
  const esChrome = await chrome();
  check("document language follows the choice", esChrome.htmlLang === "es");
  check("buttons are Spanish", esChrome.complete === "Marcar el día como completado");
  check("audio length is Spanish", esChrome.audio === "Unos 3 minutos");
  check("progress is Spanish", esChrome.progress === "Día 1 de 30");
  check("progress count is Spanish", esChrome.count.includes("de 30 completados"));
  check("form labels are Spanish", esChrome.notes === "Mi reflexión");
  check("the check-in scale is Spanish", esChrome.scale === "1 = en calma · 5 = abrumador");
  check("the SOS button is Spanish", esChrome.sos === "Calma ahora");
  check("select options are Spanish", esChrome.timer === "5 min");
  check("the document title is Spanish", esChrome.title.startsWith("Día 1: Firmeza"));
  check("every chrome field changed", Object.keys(enChrome).filter(k => k !== "timer")
    .every(k => esChrome[k] !== enChrome[k]));

  // Nothing in the shell may still read English once Spanish is chosen. This
  // is the check that catches a string added later and never translated.
  const strays = await page.evaluate(() => {
    const needles = ["Mark day complete", "About 3 minutes", "Guided prayer", "My reflection",
      "Reflection", "Pray", "Declare", "Practice", "Previous", "Next", "Steady me now",
      "No timer", "Narration speed", "Journey progress"];
    const text = document.querySelector("main").innerText;
    return needles.filter(n => text.includes(n));
  });
  check(`no English left in the Spanish shell${strays.length ? ` (found: ${strays.join(", ")})` : ""}`,
    strays.length === 0);

  // Dialogs and generated files follow too.
  await page.click("#journalButton");
  check("the journal is Spanish", (await page.textContent("#exportButton")) === "Descargar mis reflexiones (.txt)");
  check("the ledger is Spanish", (await page.textContent("#ledger")).includes("REGISTRO DE CALMA"));
  await page.click("#closeJournal");

  await page.click("#libraryButton");
  check("the library is Spanish", (await page.textContent("#libraryDialog h2")) === "Elige tu camino");
  check("the reminder label is Spanish",
    (await page.textContent('label[for="reminderTime"]')) === "Recordatorio diario");
  const [esDownload] = await Promise.all([page.waitForEvent("download"), page.click("#reminderButton")]);
  const esIcs = fs.readFileSync(await esDownload.path(), "utf8");
  check("the calendar reminder is Spanish", esIcs.includes("SUMMARY:Stand — oración diaria"));
  check("the calendar alarm is Spanish", esIcs.includes("Hora de estar firme"));
  check("the calendar days link to the Spanish pages",
    esIcs.replace(/\r\n /g, "").includes(`Léelo en la web: ${SITE_ORIGIN}/es/`));
  check("the reminder button and preview are Spanish",
    (await page.textContent("#reminderButton")).startsWith("Añadir") && (await page.textContent("#reminderPreviewTitle")).includes("Día"));
  check("the reminder status is Spanish",
    (await page.textContent("#reminderStatus")).includes("cada día"));
  await page.click("#closeLibrary");

  // SOS runs entirely on Spanish content: the verses come from esSos, not
  // from a translated wrapper around the English ones.
  await page.click("#sosButton");
  check("SOS opens in Spanish", (await page.textContent("#sosStage")).includes("¿Dónde está tu miedo"));
  await page.click('#sosStage .checkin-scale button:nth-child(4)');
  await page.click("#sosStage .complete-button");
  const esAnchor = await page.textContent("#sosStage");
  check("SOS verses are Reina-Valera", esAnchor.includes("Jehová es mi luz y mi salvación"));
  check("SOS references are Spanish", esAnchor.includes("Salmo 27:1"));
  check("SOS prayers close in Spanish", esAnchor.includes("Amén."));
  // Spanish readers get the Spanish routes: 988 answers in Spanish on 2 or to
  // AYUDA by text, and Crisis Text Line answers in Spanish to AYUDA. HOME
  // would reach an English-speaking counselor.
  await page.click("#sosSupport");
  const esResources = await page.textContent("#sosResources");
  check("Spanish crisis resources give 988's Spanish options", esResources.includes("marca 2 para español") && esResources.includes("AYUDA al 988"));
  check("Spanish crisis resources text AYUDA, not HOME, to 741741", esResources.includes("Escribe AYUDA al 741741") && !esResources.includes("HOME"));
  check("Spanish crisis resources point outside the US too", esResources.includes("Fuera de EE. UU.: findahelpline.com"));
  await page.click("#closeSos");

  await page.click("#prayerButton");
  await page.selectOption("#prayerLang", "en");
  await page.click("#closePrayer");
  const backChrome = await chrome();
  check("switching back restores every English string",
    Object.keys(enChrome).every(k => backChrome[k] === enChrome[k]));

  // ---------------------------------------------------------------------
  // Daily reminder (.ics). The generated file is parsed rather than eyeballed:
  // every previous defect here was invisible from the UI.
  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  const readIcs = async () => {
    const dl = await Promise.all([page.waitForEvent("download"), page.click("#reminderButton")]).then(r => r[0]);
    return fs.readFileSync(await dl.path(), "utf8");
  };
  await page.click("#libraryButton");
  await page.fill("#reminderTime", "21:30");
  const ics1 = await readIcs();

  check("reminder file is a calendar", ics1.startsWith("BEGIN:VCALENDAR") && ics1.includes("END:VCALENDAR"));
  check("reminder repeats daily", ics1.includes("RRULE:FREQ=DAILY"));
  check("reminder uses the chosen time", /DTSTART:\d{8}T213000/.test(ics1));
  // Floating time on purpose: no Z and no TZID, so it fires at 21:30 wherever
  // the reader is rather than drifting when they travel.
  check("reminder time is floating, not UTC", !/DTSTART:[^\r\n]*Z/.test(ics1) && !/DTSTART;TZID/.test(ics1));
  // It used to link to the origin, which became the landing page when the app
  // moved to /app — so the 7am tap opened marketing instead of the prayer.
  check("reminder links into the app", ics1.includes(`${SITE_ORIGIN}/app`) && !/DESCRIPTION:[^\r\n]*app: https?:\/\/[^\r\n/]+\r?\n/.test(ics1));

  // RFC 5545 §3.1: no content line may exceed 75 octets.
  //
  // Asserting that over the generated file alone is NOT enough: on this test
  // server the DESCRIPTION line is exactly 75 octets, while against the real
  // origin it is 85. The check would pass with folding removed entirely, so
  // icsFold is exercised directly with inputs that must fold.
  const longLines = ics1.split("\r\n").filter(l => Buffer.byteLength(l, "utf8") > 75);
  check("no line exceeds 75 octets", longLines.length === 0);

  const folding = await page.evaluate(() => {
    const bytes = s => new TextEncoder().encode(s).length;
    const report = input => {
      const lines = icsFold(input).split("\r\n");
      return {
        overLong: lines.filter(l => bytes(l) > 75).length,
        continuationsIndented: lines.slice(1).every(l => l.startsWith(" ")),
        // Unfolding (drop CRLF + one space) must return the original exactly.
        roundTrips: lines.map((l, i) => (i ? l.slice(1) : l)).join("") === input,
        folded: lines.length > 1
      };
    };
    return {
      ascii: report("DESCRIPTION:" + "x".repeat(300)),
      // Multi-byte characters must never be split across a fold boundary.
      emDash: report("SUMMARY:" + "Stand — daily prayer ".repeat(12)),
      short: report("SUMMARY:Stand")
    };
  });
  check("long lines are folded", folding.ascii.folded && folding.emDash.folded);
  check("folded lines respect the 75-octet limit", folding.ascii.overLong === 0 && folding.emDash.overLong === 0);
  check("folded lines are continued with a space", folding.ascii.continuationsIndented && folding.emDash.continuationsIndented);
  check("folding round-trips without losing bytes", folding.ascii.roundTrips && folding.emDash.roundTrips);
  check("short lines are left alone", !folding.short.folded);
  check("the file uses CRLF line endings", ics1.includes("\r\n") && !/[^\r]\n/.test(ics1));

  // Tapping twice used to leave two daily alarms running forever.
  const uid = ics1.match(/UID:(.+)/)[1].trim();
  const seq1 = Number(ics1.match(/SEQUENCE:(\d+)/)[1]);
  await page.fill("#reminderTime", "06:15");
  const ics2 = await readIcs();
  check("a second export reuses the same event", ics2.includes(`UID:${uid}`));
  check("a second export out-ranks the first", Number(ics2.match(/SEQUENCE:(\d+)/)[1]) > seq1);
  check("a second export uses the new time", /DTSTART:\d{8}T061500/.test(ics2));
  check("the button reports what happened", (await page.textContent("#reminderStatus")).includes("06:15"));

  // Every remaining day is its own RECURRENCE-ID override of the one series,
  // linking to the day itself rather than the app's front door.
  const unfold = ics => ics.replace(/\r\n /g, "");
  const overrideCount = ics => ics.split("RECURRENCE-ID:").length - 1;
  const expected = await page.evaluate(() => reminderSchedule({ dayCount: DAYS(), completed: tdata().completed, time: "06:15", now: new Date() }));
  check("one override per remaining day", overrideCount(ics2) === expected.count && expected.count > 1);
  check("the series stops when the journey does", ics2.includes(`RRULE:FREQ=DAILY;COUNT=${expected.count}`));
  const firstDay = expected.fromDay + 1;
  check("the first override is the first incomplete day",
    ics2.includes(`URL:${SITE_ORIGIN}/app#${firstDay}`) && unfold(ics2).includes(`SUMMARY:Stand · Day ${firstDay} · `));
  check("an override carries the practice and the page link",
    unfold(ics2).includes("Today’s practice: ") && unfold(ics2).includes(`Read it on the web: ${SITE_ORIGIN}/day/`));
  check("every override names its own occurrence", unfold(ics2).split("BEGIN:VEVENT").slice(2)
    .every(ev => ev.match(/RECURRENCE-ID:(\S+)/)[1] === ev.match(/DTSTART:(\S+)/)[1]));
  check("the status names the range", /Day \d+ to Day \d+/.test(await page.textContent("#reminderStatus")));

  // The button says what it will add, and the preview shows the first
  // reminder as the calendar will: the same summary and notes as the file.
  const buttonText = await page.textContent("#reminderButton");
  check("the button says how many reminders it adds", buttonText.includes(`${expected.count} reminders`) && buttonText.includes(`Day ${firstDay}`));
  const previewBody = await page.textContent("#reminderPreviewBody");
  check("the preview is the first reminder in the file",
    unfold(ics2).includes(`SUMMARY:${await page.textContent("#reminderPreviewTitle")}`)
    && unfold(ics2).includes(`DESCRIPTION:${previewBody.replace(/([;,])/g, "\\$1").replace(/\n/g, "\\n")}`));
  check("the calendar is published under its own name", ics2.includes("METHOD:PUBLISH\r\n") && ics2.includes("X-WR-CALNAME:Stand\r\n"));

  // Every link in the file opens the day it names: the app deep link renders
  // the same day and practice the notes carry, and the web page exists with
  // the practice anchored. Checked for every override, not a sample.
  const overrideEvents = unfold(ics2).split("BEGIN:VEVENT").slice(2);
  const linkPage = await browser.newPage();
  const linkFailures = [];
  for (const ev of overrideEvents) {
    const url = ev.match(/\r\nURL:(\S+)/)[1];
    const notes = ev.match(/\r\nDESCRIPTION:(.+)/)[1].replace(/\\n/g, "\n").replace(/\\([;,\\])/g, "$1").split("\n");
    const practice = notes.find(l => l.startsWith("Today’s practice: ")).slice("Today’s practice: ".length);
    const pageUrl = notes[notes.length - 1].replace(/^[^:]+: /, "");
    await linkPage.goto(url, { waitUntil: "networkidle" });
    const title = await linkPage.textContent("#dayTitle"), action = await linkPage.textContent("#action");
    const res = await fetch(pageUrl.replace(/#practice$/, ""));
    const html = await res.text();
    const escaped = practice.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    if (!(ev.includes(`· ${title}`) && action === practice && res.status === 200 && html.includes(escaped) && html.includes('id="practice"') && pageUrl.endsWith("#practice"))) linkFailures.push(url);
  }
  await linkPage.close();
  check(`every one of ${overrideEvents.length} reminder links opens the day it names`, overrideEvents.length === expected.count && linkFailures.length === 0);
  if (linkFailures.length) console.log("     failing links: " + linkFailures.join(", "));

  // Completing a day moves the series forward on the next export.
  await page.click("#closeLibrary");
  await page.click("#completeButton");   // the current day is the first incomplete one
  await page.click("#libraryButton");
  const ics3 = await readIcs();
  check("completing a day drops one override", overrideCount(ics3) === overrideCount(ics2) - 1);
  check("completing a day moves the first override on", ics3.includes(`URL:${SITE_ORIGIN}/app#${firstDay + 1}`));
  await page.click("#closeLibrary");
  await page.click("#completeButton");   // put it back
  await page.click("#libraryButton");

  // The export options. Each one changes the file, the label or the status,
  // and all three survive a reload. They sit inside a closed disclosure.
  await page.click("#reminderOptions > summary");
  await page.selectOption("#reminderFrom", "start");
  const fromStart = await readIcs();
  check("\"Day 1\" starts the series at the first day", fromStart.includes(`URL:${SITE_ORIGIN}/app#1`) && overrideCount(fromStart) === await page.evaluate(() => DAYS()));
  check("the button follows the start option", (await page.textContent("#reminderButton")).includes("Day 1"));
  await page.selectOption("#reminderFrom", "current");

  await page.check("#reminderWeekdays");
  const weekdays = await readIcs();
  check("weekdays only writes a Monday-to-Friday rule", weekdays.includes("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT="));
  check("weekdays only puts no override on a weekend", unfold(weekdays).split("BEGIN:VEVENT").slice(2).every(ev => {
    const m = ev.match(/DTSTART:(\d{4})(\d{2})(\d{2})T/);
    const day = new Date(+m[1], +m[2] - 1, +m[3], 12).getDay();
    return day >= 1 && day <= 5;
  }));
  check("the status says each weekday", (await page.textContent("#reminderStatus")).includes("each weekday"));
  await page.uncheck("#reminderWeekdays");

  await page.selectOption("#reminderLead", "10");
  const lead = await readIcs();
  check("an alert lead fires the alarm ten minutes before", lead.includes("TRIGGER:-PT10M") && !lead.includes("TRIGGER:PT0S"));

  await page.reload({ waitUntil: "networkidle" });
  await page.click("#libraryButton");
  await page.click("#reminderOptions > summary");
  check("the export options are remembered", await page.inputValue("#reminderLead") === "10" && await page.inputValue("#reminderFrom") === "current" && !(await page.isChecked("#reminderWeekdays")));
  await page.selectOption("#reminderLead", "0");

  // The evening check-in: a second series on the same days, and a single
  // cancellation when it is turned off again.
  check("the evening time is disabled until the check-in is on", await page.isDisabled("#reminderEveningTime"));
  await page.check("#reminderEvening");
  await page.fill("#reminderEveningTime", "20:45");
  const withEvening = await readIcs();
  const eveningEvents = unfold(withEvening).split("BEGIN:VEVENT").filter(ev => ev.includes("UID:stand-evening-checkin@"));
  check("the evening check-in is a second series", eveningEvents.length === overrideCount(withEvening.split("UID:stand-evening-checkin@")[0]) + 1);
  check("the evening series runs at the chosen time", eveningEvents.every(ev => /DTSTART:\d{8}T204500/.test(ev)));
  check("the evening entries ask how it went and link to the check-in", eveningEvents.slice(1).every(ev => ev.includes("How did it go?") && ev.includes(`URL:${SITE_ORIGIN}/app?checkin=1#`)));
  check("the status mentions the evening check-in", (await page.textContent("#reminderStatus")).includes("evening check-in at 20:45"));

  await page.uncheck("#reminderEvening");
  const cancelled = await readIcs();
  check("turning the evening check-in off cancels the series once", cancelled.includes("UID:stand-evening-checkin@") && cancelled.includes("STATUS:CANCELLED") && !unfold(cancelled).includes("How did it go?"));
  check("the status says the evening series is cancelled", (await page.textContent("#reminderStatus")).includes("cancelled"));
  const clean = await readIcs();
  check("the next export carries no evening series at all", !clean.includes("stand-evening-checkin@"));

  // The subscription feed: the link the app builds must serve the same
  // series the download does, from the same options.
  await page.click("#reminderSubscribe > summary");
  const webcal = await page.getAttribute("#subscribeLink", "href");
  const feedHttps = await page.getAttribute("#subscribeLink", "data-https");
  check("the subscribe link is a webcal URL on this origin", webcal.startsWith("webcal://localhost:8123/calendar.ics?") && feedHttps === webcal.replace("webcal://", "http://"));
  check("the subscribe link carries the journey, start day, date, time and language", /[?&]track=core(&|$)/.test(webcal) && /[?&]from=\d+(&|$)/.test(webcal) && /[?&]start=\d{4}-\d{2}-\d{2}(&|$)/.test(webcal) && /[?&]time=06(%3A|:)15(&|$)/.test(webcal) && /[?&]lang=en(&|$)/.test(webcal));
  const feedRes = await fetch(feedHttps);
  const feed = await feedRes.text();
  const downloaded = await readIcs();
  const firstOf = ics => unfold(ics).split("BEGIN:VEVENT").slice(2)[0].match(/SUMMARY:([^\r\n]+)/)[1];
  check("the feed serves a calendar", feedRes.status === 200 && feedRes.headers.get("content-type").startsWith("text/calendar") && feed.startsWith("BEGIN:VCALENDAR"));
  check("the feed starts on the same day as the download", firstOf(feed) === firstOf(downloaded) && overrideCount(feed) === overrideCount(downloaded));
  check("the feed's links point at this origin", unfold(feed).includes(`URL:${SITE_ORIGIN}/app#`));
  await page.check("#reminderWeekdays");
  check("changing an option changes the feed link", /[?&]weekdays=1(&|$)/.test(await page.getAttribute("#subscribeLink", "href")));
  await page.uncheck("#reminderWeekdays");
  await page.click("#subscribeCopy");
  // The copy is asynchronous: wait for the status to change from the last export message.
  await page.waitForFunction(() => /Feed link copied|\/calendar\.ics\?/.test(document.getElementById("reminderStatus").textContent), null, { timeout: 5000 }).catch(() => {});
  const copied = await page.textContent("#reminderStatus");
  check("copying the feed link reports it, or shows the link when the clipboard is unavailable", copied.includes("Feed link copied") || copied.includes("/calendar.ics?"));
  const badFeed = await fetch("http://localhost:8123/calendar.ics?track=nope&start=2026-09-26");
  check("the feed refuses a bad query", badFeed.status === 400);

  // The evening link lands on the fear check-in.
  await page.goto("http://localhost:8123/app?checkin=1#3", { waitUntil: "networkidle" });
  const checkinInView = await page.evaluate(() => {
    const r = document.getElementById("dayCheckin").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });
  check("?checkin=1 opens the day with the fear check-in in view", checkinInView && (await page.textContent("#dayNumber")) === "DAY 03");
  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  await page.click("#libraryButton");

  // The chosen time survives a reload; it used to reset to 07:00.
  await page.reload({ waitUntil: "networkidle" });
  await page.click("#libraryButton");
  check("the reminder time is remembered", await page.inputValue("#reminderTime") === "06:15");
  await page.click("#closeLibrary");

  // ---------------------------------------------------------------------
  // Spanish static pages. The content was translated in the previous
  // release; these are the crawlable pages that carry it.
  const meta2 = name => page.getAttribute(`meta[property="${name}"], meta[name="${name}"]`, "content");
  const hreflang = code => page.getAttribute(`link[rel="alternate"][hreflang="${code}"]`, "href");

  await page.goto("http://localhost:8123/es", { waitUntil: "networkidle" });
  check("/es is the Spanish landing page", (await page.title()).includes("compañero de oración"));
  check("/es declares its language", await page.getAttribute("html", "lang") === "es");
  check("/es ships no script", (await page.$$("script:not([type='application/ld+json'])")).length === 0);
  // This line used to warn that the interface was still partly English. It
  // isn't any more, and a stale promise on the landing page is its own defect.
  check("/es no longer warns about an English interface",
    !(await page.textContent("#see")).includes("parcialmente en inglés"));
  check("/es says the interface is Spanish too",
    (await page.textContent("#see")).includes("la interfaz de la app"));

  await page.goto("http://localhost:8123/es/day/01-firmeza", { waitUntil: "networkidle" });
  check("Spanish day page loads", (await page.textContent("h1")) === "Firmeza");
  check("Spanish day quotes the RV1909", (await page.textContent(".scripture")).includes("Confortaos en el Señor"));
  check("Spanish day localizes the reference", (await page.textContent(".scripture cite")) === "Efesios 6:10–13");
  check("Spanish day localizes its headings", (await page.textContent("article")).includes("Reflexión")
    && (await page.textContent("article")).includes("PRÁCTICA DE HOY"));
  check("Spanish day is canonical to itself", await page.getAttribute('link[rel="canonical"]', "href") === `${SITE}/es/day/01-firmeza`);
  check("Spanish day's share row is in Spanish and points at the Spanish page", (await page.getAttribute(".share-row", "aria-label")) === "Compartir este día"
    && (await page.getAttribute(".share-row", "data-url")) === `${SITE}/es/day/01-firmeza`
    && (await page.textContent(".share-row .share-copy span")) === "Copiar enlace"
    && (await page.$$eval(".share-row .share-link", as => as.every(a => (a.getAttribute("aria-label") || "").startsWith("Compartir")))));
  check("Spanish day names en_US as its locale alternate", await meta("og:locale:alternate") === "en_US");
  check("Spanish day declares its locale", await meta2("og:locale") === "es_ES");

  // hreflang must be reciprocal or search engines treat the pair as
  // duplicates rather than translations.
  check("Spanish day points at its English twin", (await hreflang("en")) === `${SITE}/day/01-stand`);
  check("Spanish day points at itself for es", (await hreflang("es")) === `${SITE}/es/day/01-firmeza`);
  check("x-default is the English page", (await hreflang("x-default")) === `${SITE}/day/01-stand`);
  await page.goto("http://localhost:8123/day/01-stand", { waitUntil: "networkidle" });
  check("English day points back at the Spanish one", (await hreflang("es")) === `${SITE}/es/day/01-firmeza`);
  check("the pairing is reciprocal", (await hreflang("en")) === `${SITE}/day/01-stand`);

  // Slugs fold accents rather than percent-encoding them.
  check("Spanish slugs are ASCII", await page.evaluate(async site => {
    const res = await fetch("/sitemap.xml");
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
      .filter(u => u.includes("/es/")).every(u => /^[\x20-\x7e]+$/.test(u));
  }, SITE));

  await page.goto("http://localhost:8123/es/fears", { waitUntil: "networkidle" });
  check("Spanish fear index loads", (await page.textContent("h1")).includes("¿Dónde estás"));
  check("Spanish fear index lists every situation", (await page.$$(".feature-card")).length === fearIndex.length);
  check("Spanish fear index groups in Spanish", (await page.textContent("main")).includes("HISTORIAS DE VALOR"));
  const esFearHrefs = await page.$$eval(".feature-card h3 a", els => els.map(e => e.getAttribute("href")));
  check("every Spanish fear links under /es", esFearHrefs.every(h => h.startsWith("/es/")));
  let esBroken = 0;
  for (const href of esFearHrefs) if (!(await page.request.get("http://localhost:8123" + href)).ok()) esBroken++;
  check("every Spanish fear link resolves", esBroken === 0);

  // A reader who lands on the wrong language must be able to cross over.
  check("Spanish pages offer English", await page.evaluate(() =>
    Boolean(document.querySelector('.nav-menu a[hreflang="en"]'))));

  {
    const sitemapRes = await page.request.get("http://localhost:8123/sitemap.xml");
    const locs = [...(await sitemapRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    check("sitemap carries both languages", locs.length === DAY_PAGE_COUNT * 2 + 8);
    check("sitemap covers the Spanish landing page", locs.includes(`${SITE}/es`));
    check("sitemap covers the Spanish fear index", locs.includes(`${SITE}/es/fears`));
    check("sitemap covers the privacy policy and terms in both languages",
      ["/privacy", "/es/privacy", "/terms", "/es/terms"].every(p => locs.includes(`${SITE}${p}`)));
    check("sitemap omits the 404 page", !locs.some(u => /\/404(\.html)?$/.test(u)));
  }

  // ---------------------------------------------------------------------
  // Privacy policy and terms of use. Generated with the other static pages,
  // so they share the head, nav, footer and dark mode, and pair across the
  // two languages the same way the day pages do.
  const LEGAL = [["/privacy", "/es/privacy", "en"], ["/es/privacy", "/privacy", "es"], ["/terms", "/es/terms", "en"], ["/es/terms", "/terms", "es"]];
  for (const [url, alt, lang] of LEGAL) {
    const res = await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    const other = lang === "en" ? "es" : "en";
    check(`${url} loads`, res.status() === 200 && (await page.$$("main h1")).length === 1);
    check(`${url} declares its language`, await page.getAttribute("html", "lang") === lang);
    check(`${url} is canonical to itself`, await page.getAttribute('link[rel="canonical"]', "href") === `${SITE}${url}`);
    check(`${url} pairs with ${alt} via hreflang`, (await hreflang(lang)) === `${SITE}${url}`
      && (await hreflang(other)) === `${SITE}${alt}`
      && (await hreflang("x-default")) === `${SITE}${lang === "en" ? url : alt}`);
    check(`${url} carries the social card and its own URL`, await meta2("og:image") === `${SITE}/og-card.png`
      && await meta2("og:url") === `${SITE}${url}` && await meta2("twitter:card") === "summary_large_image");
    check(`${url} follows the device's colour scheme`, (await page.getAttribute("html", "class")) === "theme-auto");
    check(`${url} opens with a plain summary and closes with its date`, (await page.textContent(".landing-hero .landing-lead")).length > 200
      && /^(Last updated|Última actualización): 26/.test((await page.textContent(".landing-section > .landing-fineprint")).trim()));
    check(`${url} heading levels do not skip`, !(await headingsSkip()));
    check(`${url} ships no script`, (await page.$$("script")).length === 0);
    check(`${url} gives the contact address as a mailto link`,
      (await page.$$('a[href="mailto:dougdevitre@gmail.com"]')).length === 1 && !(await page.content()).includes("example.invalid"));
    const source = await (await page.request.get("http://localhost:8123" + url)).text();
    check(`${url} is marked as a draft for attorney review`, source.includes("<!-- Plain-language draft for review by an attorney before publication. -->"));
    check(`${url} has no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
  }
  for (const url of ["/privacy", "/es/privacy"]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    check(`${url} links to Vercel's privacy notice`, (await page.$$('main a[href="https://vercel.com/legal/privacy-policy"]')).length === 1);
    check(`${url} names where the recordings come from`, (await page.textContent("main")).includes("stand-audio.vercel.app"));
    check(`${url} describes the error reports and the Global Privacy Control opt-out`,
      /ERROR REPORTS|INFORMES DE ERRORES/.test(await page.textContent("main")) && (await page.textContent("main")).includes("Global Privacy Control"));
  }
  for (const url of ["/terms", "/es/terms"]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    const text = await page.textContent("main");
    check(`${url} gives the 988 line`, text.includes("988") && (await page.$$('main a[href="tel:988"]')).length === 1);
    check(`${url} points outside the US to findahelpline.com`, (await page.$$('main a[href="https://findahelpline.com"]')).length === 1);
  }
  await page.goto("http://localhost:8123/es/terms", { waitUntil: "networkidle" });
  check("the Spanish terms give the Spanish crisis instructions", (await page.textContent("main")).includes("AYUDA")
    && (await page.textContent("main")).includes("marca 2"));

  // Every static page links to both documents from its footer, in its own
  // language: two generated shapes and the hand-written landing page, in
  // English and Spanish, plus the legal pages themselves (each omitting only
  // itself).
  for (const [url, prefix] of [["/day/01-stand", ""], ["/fears", ""], ["/", ""], ["/es/day/01-firmeza", "/es"], ["/es/fears", "/es"], ["/es", "/es"]]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    check(`${url} footer links to the privacy policy and terms`,
      (await page.$$(`.landing-footer .footer-links a[href="${prefix}/privacy"]`)).length === 1
      && (await page.$$(`.landing-footer .footer-links a[href="${prefix}/terms"]`)).length === 1);
  }
  await page.goto("http://localhost:8123/privacy", { waitUntil: "networkidle" });
  check("the privacy footer links to the terms, not to itself", (await page.$$('.footer-links a[href="/terms"]')).length === 1
    && (await page.$$('.footer-links a[href="/privacy"]')).length === 0);

  // ---------------------------------------------------------------------
  // Routing. The root used to be the app, which meant the domain opened a
  // hash-routed SPA rather than the page that explains it.
  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  check("the root is the landing page", (await page.title()).includes("prayer companion for fear"));
  check("the root is not the app", (await page.$$("#dayNumber")).length === 0);
  // The static pages are script-free by design, which is what lets the strict
  // CSP stay strict and the <details> menu work with no JavaScript at all.
  check("the root ships no script", (await page.$$("script:not([type='application/ld+json'])")).length === 0);

  // ---------------------------------------------------------------------
  // Structured data on the day pages: an Article in a series, with its
  // translation and a breadcrumb trail. Every generated page is parsed from
  // disk, and two are read through the browser under the production CSP.
  const ldOf = html => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    try { return m ? JSON.parse(m[1]) : null; } catch { return "unparseable"; }
  };
  let ldChecked = 0, ldBad = [];
  for (const [lang, set] of [["en", tracks], ["es", require("../content.es.js").esTracks]]) {
    for (const [id, track] of Object.entries(set)) {
      for (let i = 0; i < track.days.length; i++) {
        const prefix = lang === "es" ? "/es" : "";
        const base = id === "core" ? `${prefix}/day` : `${prefix}/track/${id}`;
        const name = `${String(i + 1).padStart(2, "0")}-${require("../logic.js").slugify(track.days[i][0])}`;
        const html = fs.readFileSync(path.join(ROOT, `${base}/${name}.html`), "utf8");
        const ld = ldOf(html);
        const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
        const article = ld && ld !== "unparseable" && ld["@graph"].find(n => n["@type"] === "Article");
        const crumbs = ld && ld !== "unparseable" && ld["@graph"].find(n => n["@type"] === "BreadcrumbList");
        const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
        const ok = article && crumbs
          && article.image === ogImage && ogImage.startsWith(`${SITE}/cards/${lang}/${id}/${name}.`)
          && html.includes(`<meta name="twitter:image" content="${ogImage}" />`)
          && article.url === canonical && article.inLanguage === lang && article.position === i + 1
          && article.name === track.days[i][0] && article.citation === track.days[i][1]
          && article.isPartOf.name === track.name && article.isAccessibleForFree === true
          && crumbs.itemListElement.length === 3 && crumbs.itemListElement[2].item === canonical
          && !html.includes("</script>\n  </script>");
        if (!ok) ldBad.push(`${base}/${name}`);
        ldChecked++;
      }
    }
  }
  check(`every day page carries valid structured data (${ldChecked} pages)`, ldChecked === DAY_PAGE_COUNT * 2 && ldBad.length === 0);
  if (ldBad.length) console.log("       " + ldBad.slice(0, 5).join(", "));

  for (const [url, lang, altPart] of [["/day/07-the-word", "en", "/es/day/07-la-palabra"], ["/es/track/furnace/01-el-decreto", "es", "/track/furnace/01-the-decree"]]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    const ld = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/ld+json"]');
      try { return el ? JSON.parse(el.textContent) : null; } catch { return "unparseable"; }
    });
    const article = ld && ld !== "unparseable" && ld["@graph"].find(n => n["@type"] === "Article");
    const link = article && (article.workTranslation || article.translationOfWork);
    check(`${url} structured data parses in the browser under the CSP`, Boolean(article));
    check(`${url} names its translation`, Boolean(link) && link["@id"] === `${SITE}${altPart}#article` && link.inLanguage === (lang === "en" ? "es" : "en"));
    // The one script a day page loads is share.js: same origin, deferred, and
    // only an enhancement (the page works without it). Nothing inline, nothing
    // from a platform.
    check(`${url} ships no script beyond the deferred same-origin share.js`, await page.$$eval("script:not([type='application/ld+json'])", ss =>
      ss.length === 1 && ss[0].getAttribute("src") === "/share.js" && ss[0].defer && !ss[0].textContent.trim()));
  }

  await page.goto("http://localhost:8123/app", { waitUntil: "networkidle" });
  check("/app is the app", (await page.$$("#dayNumber")).length === 1);
  check("/app keeps its assets", await page.evaluate(() =>
    Boolean(document.querySelector('link[rel="stylesheet"][href="/styles.css"]'))));

  // Old links must not 404 — /about was the landing page for three releases.
  const aboutRes = await page.request.get("http://localhost:8123/about", { maxRedirects: 0 });
  check("/about redirects rather than 404s", aboutRes.status() === 308);
  check("/about redirects to the root", aboutRes.headers()["location"] === "/");

  // An installed copy must still open the app, not the marketing page.
  const manifest = await (await page.request.get("http://localhost:8123/manifest.webmanifest")).json();
  check("manifest starts at the app", manifest.start_url === "/app");
  check("manifest SOS shortcut starts at the app", manifest.shortcuts[0].url === "/app?sos=1");

  // Share cards, through the same /cards route Vercel rewrites to api/card.js.
  const { cardFor, cardPath } = require("../cards.js");
  const stand = cardFor("en", "core", 0);
  const postRes = await page.request.get("http://localhost:8123" + cardPath(stand, "post"));
  const postBody = await postRes.body();
  check("a day's share card is served as a 1080x1350 PNG", postRes.status() === 200 && postRes.headers()["content-type"] === "image/png"
    && postBody.readUInt32BE(16) === 1080 && postBody.readUInt32BE(20) === 1350);
  const staleRes = await page.request.get("http://localhost:8123/cards/en/core/01-stand.00000000.og.png", { maxRedirects: 0 });
  check("an out-of-date card address redirects to the current one", staleRes.status() === 308 && staleRes.headers()["location"] === cardPath(stand, "og"));
  check("a card for a day that does not exist is 404", (await page.request.get("http://localhost:8123/cards/en/core/99-nope.0123abcd.og.png")).status() === 404);
  // The install sheet and the home-screen icon fetch these by URL; a path
  // that 404s just silently drops the image.
  for (const img of [...manifest.icons, ...manifest.screenshots]) {
    const res = await page.request.get("http://localhost:8123/" + img.src);
    check(`manifest image ${img.src} is served as ${img.type}`, res.status() === 200 && res.headers()["content-type"] === img.type);
  }

  // The service worker serves its cached shell only for the app. Pointing it
  // at "/" would hand the app shell to everyone opening the site.
  const swSource = await (await page.request.get("http://localhost:8123/sw.js")).text();
  check("service worker shell is /app", /APP_SHELL\s*=\s*"\/app"/.test(swSource));
  check("service worker no longer precaches the root", !/ASSETS\s*=\s*\["\.\/"/.test(swSource));

  // ---------------------------------------------------------------------
  // Dark mode on the static pages.
  //
  // These pages carry no JavaScript, so the .dark class app.js toggles never
  // reaches them; they rendered full-brightness for a reader whose device is
  // set to dark. They now opt in via class="theme-auto" plus a
  // prefers-color-scheme rule. The app deliberately does NOT carry that class:
  // choosing "light" in the app is the ABSENCE of .dark, so a bare :root rule
  // would override it, which is the regression the last check here guards.
  const DARK_PAPER = "rgb(13, 27, 36)";
  const LIGHT_PAPER = "rgb(247, 244, 236)";
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "dark" });
  for (const url of ["/", "/fears", "/day/01-stand"]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    check(`${url} follows a dark device`, (await bodyBg()) === DARK_PAPER);
  }
  await page.emulateMedia({ colorScheme: "light" });
  for (const url of ["/", "/fears", "/day/01-stand"]) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    check(`${url} follows a light device`, (await bodyBg()) === LIGHT_PAPER);
  }

  // The app must still honour an explicit choice against the device setting.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("http://localhost:8123/app", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("stand-state") || "{}");
    raw.theme = "light";
    localStorage.setItem("stand-state", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "networkidle" });
  check("app keeps an explicit light choice on a dark device", (await bodyBg()) === LIGHT_PAPER);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("stand-state") || "{}");
    delete raw.theme;
    localStorage.setItem("stand-state", JSON.stringify(raw));
  });
  await page.emulateMedia({ colorScheme: "light" });

  // The two dark token blocks are hand-duplicated (no build step to share
  // them), so assert they are character-for-character the same.
  {
    const css = await (await page.request.get("http://localhost:8123/styles.css")).text();
    const appDark = css.match(/:root\.dark\{([^}]*)\}/);
    const autoDark = css.match(/:root\.theme-auto\{([^}]*)\}/);
    check("both dark token blocks exist", Boolean(appDark && autoDark));
    check("static dark tokens match the app's", Boolean(appDark && autoDark) && appDark[1] === autoDark[1]);
  }

  // ---------------------------------------------------------------------
  // Contrast ratchet.
  //
  // Sweeps every element that renders its own text on the app shell and the
  // four static page shapes, and computes the WCAG 2.1 ratio against the
  // nearest painted ancestor background. Anything under the threshold must
  // be a class already on KNOWN_CONTRAST_DEBT — so a NEW failure fails CI,
  // while the existing debt stays visible in every run rather than living
  // in someone's notes.
  //
  // The list is empty. It used to hold four classes, all one token: --gold
  // #b88732 as text on the light palette (2.92:1 on the paper). Text now uses
  // --gold-text (#7f5b1a light, 5.60:1 on the paper and 4.74:1 on the gold
  // wash; the dark palette keeps #f1c879), while borders, fills and the
  // favourite glyph keep --gold. The list stays so a future shortfall has
  // somewhere to be recorded rather than silently waved through.
  //
  // <option> is excluded: its popup is painted by the OS, not in the page,
  // so the nearest-ancestor background is the wrong comparison. The rule
  // that sets it exists precisely so options read on the browser's own
  // light popup while the closed select inherits the dark card's colour.
  const KNOWN_CONTRAST_DEBT = [];
  const sweepContrastOn = p => p.evaluate(debt => {
    const lum = c => {
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b] = m.slice(0, 3)
        .map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bgOf = el => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      }
      return "rgb(255, 255, 255)";
    };
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.tagName === "OPTION") continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
      const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      const a = lum(cs.color), b = lum(bgOf(el));
      if (a === null || b === null) continue;
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio >= need) continue;
      if ([...el.classList].some(c => debt.includes(c))) continue;
      bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${ratio.toFixed(2)}:1 (needs ${need}) "${el.textContent.trim().slice(0, 30)}"`);
    }
    return bad;
  }, KNOWN_CONTRAST_DEBT);
  const sweepContrast = () => sweepContrastOn(page);

  const SWEEP_PAGES = ["/", "/app", "/fears", "/day/01-stand", "/track/furnace/01-the-decree", "/es", "/es/fears", "/es/day/01-firmeza",
    "/privacy", "/terms", "/es/privacy", "/es/terms"];
  for (const url of SWEEP_PAGES) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    const bad = await sweepContrast();
    if (bad.length) bad.forEach(b => console.log("       " + b));
    check(`no new contrast failures on ${url}`, bad.length === 0);
  }

  // Dark mode is swept the same way: the dark --gold (#f1c879) is 9.61:1 on
  // the dark paper, so every page passes outright. Now that the static pages
  // follow a dark device, this keeps that clean sheet honest.
  await page.emulateMedia({ colorScheme: "dark" });
  for (const url of SWEEP_PAGES) {
    await page.goto("http://localhost:8123" + url, { waitUntil: "networkidle" });
    const bad = await page.evaluate(() => {
      const lum = c => {
        const m = c.match(/[\d.]+/g);
        if (!m) return null;
        const [r, g, b] = m.slice(0, 3)
          .map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bgOf = el => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
        }
        return "rgb(255, 255, 255)";
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.tagName === "OPTION") continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
        const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
        const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
        const a = lum(cs.color), b = lum(bgOf(el));
        if (a === null || b === null) continue;
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < need) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${ratio.toFixed(2)}:1 (needs ${need})`);
      }
      return out;
    });
    if (bad.length) bad.forEach(b => console.log("       " + b));
    check(`no contrast failures in dark mode on ${url}`, bad.length === 0);
  }
  await page.emulateMedia({ colorScheme: "light" });

  // ---------------------------------------------------------------------
  // The 404 page. Vercel serves 404.html for any path that matches nothing,
  // and the test server now does the same. It has its own tab: the browser
  // logs a 404 response as a console error, which the page-error check
  // below would count against the app.
  {
    const nf = await browser.newPage();
    const res = await nf.goto("http://localhost:8123/no-such-page", { waitUntil: "networkidle" });
    check("an unknown path answers 404", res.status() === 404);
    check("an unknown path gets the branded page", await nf.isVisible(".app-shell .topbar .brand")
      && (await nf.textContent("h1")) === "This page isn’t here.");
    check("the 404 page offers the app and SOS", await nf.isVisible('main a.complete-button[href="/app"]')
      && await nf.isVisible('main a.complete-button[href="/app?sos=1"]'));
    check("the 404 page offers both home pages", await nf.isVisible('main a[href="/"]') && await nf.isVisible('main a[href="/es"]'));
    check("the 404 page says it in Spanish too", (await nf.textContent('main [lang="es"]')).includes("Esta página no está aquí")
      && await nf.isVisible('main [lang="es"] a[href="/app?sos=1"]'));
    check("the 404 page is not indexed", await nf.getAttribute('meta[name="robots"]', "content") === "noindex");
    check("the 404 page claims no URL of its own", (await nf.$$('link[rel="canonical"], link[rel="alternate"]')).length === 0);
    check("the 404 page ships no script", (await nf.$$("script")).length === 0);
    check("the 404 page footer links to the privacy policy and terms",
      (await nf.$$('.footer-links a[href="/privacy"]')).length === 1 && (await nf.$$('.footer-links a[href="/terms"]')).length === 1);
    const deep = await nf.goto("http://localhost:8123/day/99-not-a-day", { waitUntil: "networkidle" });
    check("a missing day page gets the same 404", deep.status() === 404 && (await nf.$$('main a[href="/app?sos=1"]')).length === 2);
    for (const scheme of ["light", "dark"]) {
      await nf.emulateMedia({ colorScheme: scheme });
      await nf.goto("http://localhost:8123/no-such-page", { waitUntil: "networkidle" });
      const bad = await sweepContrastOn(nf);
      if (bad.length) bad.forEach(b => console.log("       " + b));
      check(`no contrast failures on the 404 page (${scheme})`, bad.length === 0);
    }
    await nf.close();
  }

  check("no page errors (incl. CSP violations)", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
