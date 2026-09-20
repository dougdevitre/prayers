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
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  if (file === "/") file = "/index.html";
  const full = path.join(ROOT, file);
  try {
    const data = fs.readFileSync(full);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
      // Mirror the production CSP from vercel.json so violations fail the test.
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
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

  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });

  // first-visit welcome with path choice
  check("welcome shows on first visit", await page.evaluate(() => document.getElementById("welcomeDialog").open));
  check("welcome offers 3 paths", (await page.$$(".path-button")).length === 3);
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
  check("track picker shows 3 journeys", (await page.$$(".track-chip")).length === 3);
  await page.click(".track-chip:nth-child(2)");
  check("track day 1 title", (await page.textContent("#dayTitle")) === "The Unwritten Page");
  check("track length is 5", (await page.textContent("#progressLabel")) === "Day 1 of 5");
  check("track week label", (await page.textContent("#weekLabel")).includes("FEAR OF THE UNKNOWN"));
  await page.click("#completeButton");
  check("track completion isolated", (await page.textContent("#progressPercent")).startsWith("1 of 5"));
  await page.fill("#notes", "track note");
  await page.waitForTimeout(600);
  await page.click("#libraryButton");
  await page.click(".track-chip:nth-child(1)");
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
  check("SOS anchor shows verse", (await page.textContent("#sosStage")).includes("whom shall I fear"));
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
  await page.click("#closeSos");

  // calm ledger in journal
  await page.click("#journalButton");
  const ledgerText = await page.textContent("#ledger");
  check("ledger shows fear drop", ledgerText.includes("2.0 points"));
  check("ledger shows weekly average", ledgerText.includes("this week"));
  await page.click("#closeJournal");

  // share button: desktop fallback downloads a verse card PNG
  const card = await Promise.all([page.waitForEvent("download"), page.click("#shareButton")]).then(r => r[0]);
  check("share downloads verse card", card.suggestedFilename() === "stand-day-01.png");

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
  check("SEO page links into app", await page.isVisible('a[href="/#8"]'));

  // static SEO track page + deep link
  await page.goto("http://localhost:8123/track/night/01-lying-down.html", { waitUntil: "networkidle" });
  check("track SEO page title", (await page.title()).includes("Lying Down"));
  check("track SEO page links into app", await page.isVisible('a[href="/?track=night#1"]'));
  await page.goto("http://localhost:8123/?track=unknown#2", { waitUntil: "networkidle" });
  check("?track deep link switches journey", (await page.textContent("#dayTitle")) === "Daily Bread");
  await page.goto("http://localhost:8123/?track=core#1", { waitUntil: "networkidle" });

  // daily reminder ICS
  await page.click("#libraryButton");
  const ics = await Promise.all([page.waitForEvent("download"), page.click("#reminderButton")]).then(r => r[0]);
  check("reminder downloads ics", ics.suggestedFilename() === "stand-daily-reminder.ics");
  await page.click("#closeLibrary");

  // reload: resumes at first incomplete day (day 1 complete -> day 2)
  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  check("resumes at first incomplete day (Day 2)", (await page.textContent("#dayNumber")) === "DAY 02");
  check("welcome not shown on return visit", !(await page.evaluate(() => document.getElementById("welcomeDialog").open)));

  // deep link still wins
  await page.goto("http://localhost:8123/#15", { waitUntil: "networkidle" });
  check("deep link #15 opens Day 15", (await page.textContent("#dayNumber")) === "DAY 15");

  // ?sos=1 home-screen shortcut auto-opens SOS
  await page.goto("http://localhost:8123/?sos=1", { waitUntil: "networkidle" });
  check("?sos=1 auto-opens SOS", await page.evaluate(() => document.getElementById("sosDialog").open));
  await page.click("#closeSos");

  // theme toggle
  await page.click("#themeButton");
  check("theme toggles dark class", await page.evaluate(() => document.documentElement.classList.contains("dark")));

  // play button doesn't throw (voices may be absent headless)
  await page.click("#playButton");
  await page.waitForTimeout(300);

  // service worker registered
  const swReady = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length > 0));
  check("service worker registered", swReady);

  // erase all data (confirm auto-accepted) -> reload -> welcome returns
  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  await page.click("#journalButton");
  await Promise.all([page.waitForNavigation(), page.click("#eraseButton")]);
  await page.waitForTimeout(300);
  check("erase clears state and reshows welcome", await page.evaluate(() => document.getElementById("welcomeDialog").open));
  check("erase removed storage", await page.evaluate(() => localStorage.getItem("stand-state") === null || !JSON.parse(localStorage.getItem("stand-state")).completed.length));

  // welcome path selection starts the chosen track
  await page.click('.path-button[data-track="night"]');
  check("welcome path starts night track", (await page.textContent("#dayTitle")) === "Lying Down");
  check("welcome path shows 5-day progress", (await page.textContent("#progressLabel")) === "Day 1 of 5");

  check("no page errors (incl. CSP violations)", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
