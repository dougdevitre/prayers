# Stand — 30 Days of Spiritual Combat

A mobile-first, audio-ready devotional app built with plain HTML, CSS, and JavaScript. It includes all 30 days, guided device narration, progress tracking, favorites, private reflection notes, dark mode, and responsive design.

## Features

- **SOS mode — "Steady me now"** — a 90-second guided rescue for fearful moments: slow breathing, an anchoring verse, a short prayer, and a declaration. Always one tap away (including a home-screen shortcut), fully offline, with crisis-support resources always visible.
- **Fear-specific tracks** — alongside the 30-day core journey, focused 5-day tracks (Fear of the Unknown, Night Fear & Sleep) with their own progress, notes, and favorites; switch journeys from the ☰ library.
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
- **SEO day pages** — `npm run build:seo` regenerates the static, crawlable pages under `day/` (core) and `track/<id>/` (tracks) from `content.js` (set `SITE_URL=https://yourdomain` to also emit `sitemap.xml` and canonical links). `?track=<id>` links deep-link into a journey.
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

A 72-scenario end-to-end smoke suite drives the app in headless Chromium against a server that enforces the production Content Security Policy. It runs in CI (GitHub Actions) on every push and pull request, alongside syntax checks and a guard that the generated SEO pages match `content.js`.

```bash
npm install
npx playwright install chromium
npm test
```

## Publish with GitHub and Vercel

1. Create an empty GitHub repository.
2. Upload this folder or push it with Git.
3. In Vercel, select **Add New → Project**, import the repository, and click **Deploy**.
4. Leave Framework Preset as **Other**. No build command or environment variables are required.

## Audio

The player prefers recorded narration and falls back to the browser's built-in Speech Synthesis API (so the fallback voice depends on the listener's device). To add recordings: drop MP3s under `audio/` (e.g. `audio/day-01.mp3`, `audio/sos-01.mp3`) and register them in the `recordedAudio` manifest at the bottom of `content.js` — day keys are `"<trackId>-<dayIndex>"` (e.g. `"core-0"`), SOS entries follow the order of the SOS sets. Days without an entry keep using device narration. Recorded playback supports pause/resume, speed, repeat, the sleep timer, and lock-screen controls (Media Session).

## Content note

Scripture is presented through brief references and short excerpts. Before commercial publication, select a Bible translation and confirm its quotation and attribution requirements.
