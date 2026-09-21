# Stand — 30 Days of Spiritual Combat

A mobile-first, audio-ready devotional app built with plain HTML, CSS, and JavaScript. It includes all 30 days, guided device narration, progress tracking, favorites, private reflection notes, dark mode, and responsive design.

## Features

- **SOS mode — "Steady me now"** — a 90-second guided rescue for fearful moments: slow breathing, an anchoring verse, a short prayer, and a declaration. Always one tap away (including a home-screen shortcut), fully offline, with crisis-support resources always visible.
- **Fear-specific tracks** — alongside the 30-day core journey, focused 5-day tracks (Fear of the Unknown, Night Fear & Sleep) with their own progress, notes, and favorites; switch journeys from the ☰ library.
- **Courage stories** — seventeen four-day modules, each built on a single heroic account, covering overwhelming problems, accusation, panic, speaking up, opposition, fear for your children, health fears, financial fear, stepping into the unknown, inadequacy, an unchosen crisis, and starting over. Each walks the same four beats — the fear, the choice, the outcome, what you carry forward — and ends every day with one concrete exercise. Scripture in these tracks is public domain (World English Bible, lightly modernized).
- **"Where are you right now?"** — the ☰ library opens with a plain-language list of situations ("I have a court date", "I'm afraid for my child", "I don't know how I'm going to pay for it") that jumps straight into the journey that meets it, so nobody has to browse twenty titles while afraid. The mapping lives in `fearIndex` in `content.js`.
- **Grouped journey picker** — the ☰ library groups journeys under the heading in each track's `group` field (the 30-day journey, fear tracks, courage stories), so the list stays scannable as tracks are added.
- **Prayer composer** (✛) — composes a whole prayer from a reviewed corpus: pick a language, a kind (prayer, forgiveness, grace) and an intention, add an optional personal intention, and reseed for another. Composition is deterministic and offline — nothing is generated at runtime, so every line a reader can see is reviewable in `prayers.js`. Also lists the traditional prayers, with device narration that pauses where each prayer's pacing metadata says to.
- **English and Spanish** — every prayer and every label on the prayer surface carries both languages, and the choice is app-wide and saved. The same seed composes the same prayer in either language, so switching translates the prayer rather than replacing it. (The 30-day devotional days are still English only.)
- **Side by side** — tick “Show both languages” and each line appears with its translation beneath it, the way a bilingual prayer book sets them. It is one prayer shown twice, not two prayers: the same seed picks the same blocks in both columns, and `npm run validate` checks that each column matches what that language composes on its own.
- **Roman Catholic prayers named as such** — the traditional prayers are grouped and labelled: those shared across the wider Christian tradition, and those that are specifically Roman Catholic devotions. The Marian and Franciscan closings are labelled the same way in the composer, and "As composed" only draws on the traditions in `meta.defaultClosingTraditions`, so a Roman Catholic closing is always a deliberate choice.
- **Fear check-ins and a calm ledger** — optional 1–5 check-ins before and after SOS and on any day; the journal shows your own evidence, like the average fear drop after prayer.
- **Guided narration** with play/pause, adjustable speed, and an automatically selected English voice.
- **Picks up where you left off** — opening the app jumps to your first incomplete day.
- **Library filters** — browse all days, favorites, or completed days from the ☰ menu.
- **Keyboard navigation** — use ← and → to move between days.
- **Installable and offline-ready** — a web app manifest and service worker let you add it to your home screen and use it without a connection.
- **Reflections journal** — open ✎ to read every note in one place and download them as a text file.
- **Daily streak** — completing days on consecutive calendar days builds a streak shown in the progress bar.
- **Verse cards** — the ↗ button shares the day's verse as a designed image via the device share sheet (desktop saves the card and copies the text).
- **Repeat & sleep timer** — loop the guided prayer and let a 5–30 minute timer stop it, for night-time listening.
- **Dark mode on the static pages** — the landing page at `/`, `/fears` and all 108 day pages follow the device's colour scheme. They carry no JavaScript, so the `.dark` class the app toggles never reached them and they rendered full-brightness for a reader whose device was set to dark. They opt in with `class="theme-auto"` plus a `prefers-color-scheme` rule; the app deliberately does not carry that class, because choosing "light" in the app is the *absence* of `.dark` and a bare `:root` rule would override it. The smoke suite checks both token blocks are identical and that an explicit in-app light choice still wins on a dark device.
- **The actual screens** — the landing page shows three captures of the running app (SOS mid-breath, a day with its narration card, a composed prayer), in light and dark variants via `<picture>` so only the matching set is downloaded. `node scripts/build-screenshots.js` regenerates them from the real app, so they cannot drift into promising something it does not do.
- **Structured data** — the landing page carries a `WebSite` + `SoftwareApplication` JSON-LD graph. `script-src 'self'` does not block it (ld+json is data, not executable script — verified against the production CSP), and it claims nothing the app has not earned: no ratings, no reviews.
- **Routing** — `/` is the landing page and `/app` is the app. The root used to be the app itself, so the domain opened a hash-routed SPA (landing on `/#1`) rather than the page that explains it. `/about` redirects permanently to `/`, the manifest's `start_url` and SOS shortcut point at `/app` so an installed copy still opens the app, and the service worker's cached shell is `/app` — pointing it at `/` would hand the app shell to everyone opening the site. Saved notes, progress and streaks are unaffected: `localStorage` is scoped to the domain, not the path.
- **Landing page at the root** — `/` describes what the app does, in the app's own type, palette, and components (it links `styles.css` and reuses `.app-shell`, `.topbar`, `.eyebrow`, and the rest, exactly as the generated day pages do). A call to action sits in the hero, in the nav's mobile menu, and in the footer. The menu is a `<details>` disclosure, so the static pages stay script-free and the open state is announced natively. No pricing.
- **Fear index** — `/fears` is the finder's list as a crawlable page: every situation, grouped by kind of journey, each linking to that journey's first day. Generated from the same `fearIndex` the app uses, so the page and the dialog cannot drift, and CI fails if the committed page falls out of sync.
- **SEO day pages** — `npm run build:seo` regenerates the static, crawlable pages under `day/` (core) and `track/<id>/` (tracks) from `content.js`, plus `sitemap.xml` (111 URLs) and `robots.txt`. Every page carries a canonical link, an `og:url`, and the shared social card. `SITE_URL` defaults to production and can be overridden for a staging build. `?track=<id>` links deep-link into a journey.
- **Every static page is a way in, not a dead end** — the day and track pages carry the same nav and footer as the landing page, generated from one `NAV_LINKS` list, so someone who arrives at day 14 of a courage story from a search result can reach SOS, the fear index, or the app itself. A page never links to itself in its own menu.
- **One social card** — `og-card.png` is the shared `og:image` for all 111 pages, so a shared link previews as the brand rather than a blank grey box. Regenerate it with `node scripts/build-og-card.js`; the PNG is committed because social scrapers fetch it directly and never run JavaScript.
- **Personalized start** — first-time visitors choose where to begin: the 30-day journey or a focused fear track.
- **Daily calendar reminder** — the library can generate a recurring calendar event (.ics) at your chosen time, with no notifications permission or server needed.
- **iOS install tip** — Safari visitors get a one-time, dismissible Add-to-Home-Screen hint.
- **Dark mode** follows your device setting until you choose a theme with ◐.
- **Backup and restore** — download all data as a JSON file and restore it on any device; an erase option removes everything.
- **Welcome screen** introduces the journey on first visit.
- **Print-friendly** — printing a day hides the app chrome and keeps the devotional content.
- Notes, favorites, and progress are stored privately on your device (localStorage), and the deployment ships a strict Content Security Policy.

## Run locally

```bash
npm run dev
```

## Tests

A 194-scenario end-to-end smoke suite drives the app in headless Chromium against a server that enforces the production Content Security Policy. It runs in CI (GitHub Actions) on every push and pull request, alongside syntax checks and a guard that the generated SEO pages, sitemap and robots.txt match `content.js`. It includes a contrast ratchet — a sweep of every element that renders its own text on the app shell and the four static page shapes, failing on any WCAG 2.1 shortfall that is not on a recorded known-debt list, so new failures break the build while existing ones stay visible. Dark mode is swept with no debt allowance at all — the dark `--gold` is 9.61:1, so every page passes outright there; the contrast debt is a light-mode problem only. It also asserts the footer call to action directly across all three static pages — that check was added after `.landing-footer a` was found to beat `.complete-button` on specificity and render the button's text at 2.92:1, under the 4.5:1 AA minimum.

```bash
npm install
npx playwright install chromium
npm test
```

Alongside it, `npm run test:unit` runs 48 unit tests (no browser, no dependencies) over the pure logic in `logic.js` — streak arithmetic, backup sanitizing, and calm-ledger aggregation. The daylight-saving cases run in child processes with `TZ` set, so they exercise real zones rather than whichever one the machine happens to be in. Both suites run in CI.

## Publish with GitHub and Vercel

1. Create an empty GitHub repository.
2. Upload this folder or push it with Git.
3. In Vercel, select **Add New → Project**, import the repository, and click **Deploy**.
4. Leave Framework Preset as **Other**. No build command or environment variables are required.

## Audio

The player prefers recorded narration and falls back to the browser's built-in Speech Synthesis API (so the fallback voice depends on the listener's device). To add recordings: drop MP3s under `audio/` (e.g. `audio/day-01.mp3`, `audio/sos-01.mp3`) and register them in the `recordedAudio` manifest at the bottom of `content.js` — day keys are `"<trackId>-<dayIndex>"` (e.g. `"core-0"`), SOS entries follow the order of the SOS sets. Days without an entry keep using device narration. Recorded playback supports pause/resume, speed, repeat, the sleep timer, and lock-screen controls (Media Session).

## Prayer corpus

`prayers.js` holds the prayer corpus and `compose.js` the composition engine, both ported from the REMAM project (`dougdevitre/remam`). Every block carries English and Spanish. The corpus keeps REMAM's shape: modes, each with intentions and ordered slots, where every block is a complete sentence or two so any one block per slot reads as a whole prayer.

`npm run validate` checks the corpus the way REMAM validates its own, in every language it declares — every mode composes at both lengths with no missing translation, closings carry a style and a tradition, the UI strings are complete, and the audio pacing stays inside the generator's limits (speed 0.7–1.2, stability and style 0–1, at most 6 breaks per language, each 0–3 seconds, every break anchor an exact substring appearing exactly once in that language's text). It also checks that one seed picks the same blocks in both languages. It runs in CI.

`meta.defaultClosingTraditions` decides which closings "As composed" draws on; it ships as `["universal"]`. Every traditional prayer is listed either way, under its own labelled heading.

## Content note

Scripture is presented through brief references and short excerpts. Before commercial publication, select a Bible translation and confirm its quotation and attribution requirements.
