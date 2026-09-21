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
const DAY_PAGE_COUNT = Object.values(tracks).reduce((n, t) => n + t.days.length, 0);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  let file = req.url.split("#")[0].split("?")[0];
  if (file === "/") file = "/index.html";
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
  await page.goto("http://localhost:8123/?track=furnace#2", { waitUntil: "networkidle" });
  check("courage story deep link", (await page.textContent("#dayTitle")) === "Even If");
  check("courage story week label", (await page.textContent("#weekLabel")).includes("COURAGE STORY"));
  check("courage story length is 4", (await page.textContent("#progressLabel")) === "Day 2 of 4");
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
  await page.goto("http://localhost:8123/about", { waitUntil: "networkidle" });
  check("landing page loads", (await page.title()).includes("prayer companion for fear"));
  check("landing uses the app shell", await page.isVisible(".app-shell .topbar .brand"));
  check("landing describes what the app does", (await page.$$(".feature-card")).length >= 8);
  check("landing names the Roman Catholic prayers", (await page.textContent(".feature-grid")).includes("Roman Catholic"));
  check("landing quotes no prices", !/\$|price|pricing|per month|subscription/i.test(await page.textContent("main")));
  check("no plan cards remain", (await page.$$(".plan-card")).length === 0);
  // a call to action in the hero, the nav, and the footer
  check("hero has a call to action", await page.isVisible('.landing-hero a.complete-button[href="/"]'));
  check("hero also offers SOS", await page.isVisible('.landing-hero a[href="/?sos=1"]'));
  check("nav has a call to action", await page.isVisible('.site-nav a.nav-cta[href="/"]'));
  check("footer has a call to action", await page.isVisible('.landing-footer a.complete-button[href="/"]'));
  // 13.6px at weight 800 is normal text by WCAG, so the bar is 4.5:1.
  check("landing footer CTA meets AA contrast", (await contrast(".landing-footer .complete-button")) >= 4.5);
  check("footer links onward", (await page.$$(".footer-links a")).length >= 3);
  check("landing heading levels do not skip", await page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(h => Number(h.tagName[1]));
    return !levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
  }));
  const landingScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("landing has no horizontal scroll", !landingScroll);
  // the menu is a <details> disclosure, so it works with no script at all
  check("menu starts closed", !(await page.evaluate(() => document.querySelector(".nav-menu").open)));
  await page.click(".nav-menu > summary");
  check("menu opens", await page.evaluate(() => document.querySelector(".nav-menu").open));
  check("menu holds the call to action", await page.isVisible('.nav-menu a[href="/"]'));
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
  check("fear index offers SOS for the rest", await page.isVisible('.landing-close a[href="/?sos=1"]'));
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
  check("day page carries the social card", await meta("og:image") === `${SITE}/og-card.png`);
  check("day page asks for a large card", await meta("twitter:card") === "summary_large_image");
  check("day page has the site nav", await page.isVisible('.site-nav a.nav-cta[href="/"]'));
  check("day page has the footer", await page.isVisible('.landing-footer a.complete-button[href="/"]'));
  check("day page footer links onward", (await page.$$(".footer-links a")).length >= 3);
  // 13.6px at weight 800 is normal text by WCAG, so the bar is 4.5:1.
  check("day page footer CTA meets AA contrast", (await contrast(".landing-footer .complete-button")) >= 4.5);
  // A page should not link to itself in its own menu.
  check("day one omits itself from its menu", (await page.$$('.nav-menu a[href="/day/01-stand"]')).length === 0);
  check("day one still offers the other journeys", (await page.$$('.nav-menu a[href="/fears"]')).length === 1);
  const dayNoScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("day page has no horizontal scroll", !dayNoScroll);

  // The social card must actually exist and be an image — an og:image that
  // 404s previews worse than none at all.
  const ogCard = await page.request.get("http://localhost:8123/og-card.png");
  check("the social card resolves", ogCard.ok());
  check("the social card is a PNG", (await ogCard.body()).slice(1, 4).toString() === "PNG");

  // The sitemap is the whole point of generating these pages.
  const sitemapRes = await page.request.get("http://localhost:8123/sitemap.xml");
  const sitemap = await sitemapRes.text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  check("sitemap lists every generated page", locs.length === DAY_PAGE_COUNT + 3);
  check("sitemap is absolute", locs.every(u => u.startsWith(SITE + "/")));
  check("sitemap covers the landing page", locs.includes(`${SITE}/about`));
  const robots = await (await page.request.get("http://localhost:8123/robots.txt")).text();
  check("robots points at the sitemap", robots.includes(`Sitemap: ${SITE}/sitemap.xml`));

  await page.goto("http://localhost:8123/", { waitUntil: "networkidle" });
  await page.click("#libraryButton");
  check("app links to the landing page", await page.isVisible('.library-about a[href="/about"]'));
  check("app links to the fear index", await page.isVisible('.library-about a[href="/fears"]'));
  // The library link used to read "Features and plans". There are no plans, so
  // it must not promise any — in the app or on the page it opens.
  check("app promises no plans", !/plans|pricing|per month|subscription/i.test(await page.textContent(".library-about")));
  await page.click("#closeLibrary");

  check("no page errors (incl. CSP violations)", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));

  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
