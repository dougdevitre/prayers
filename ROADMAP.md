# Stand — Product Roadmap

**Mission: the most trusted companion for combating fear with prayer.**

Not a broad devotional platform. One job, done better than anyone: when fear rises — at 3 a.m., before the hearing, in the waiting room — Stand is the app that steadies you, and the daily practice that makes you harder to shake over time.

Current state (v1.2): a complete 30-day journey as an offline-capable PWA with guided narration, notes, journal + export, favorites, streaks, sharing, backup/restore, and hardened security headers. Zero backend, zero cost, total privacy.

---

## Positioning

| | Hallow / Pray.com / Abide | **Stand** |
|---|---|---|
| Scope | Broad devotional catalogs | Laser-focused: fear, anxiety, spiritual combat |
| Model | Subscription paywall up front | Free core forever; optional premium later |
| Account | Required | None required — privacy by default |
| Offline | Partial | Fully offline, installable |
| In-crisis help | Buried in catalog | One tap from the home screen (planned SOS) |

**The wedge:** nobody owns "fear" specifically. Search demand is deep and specific — "prayers for fear of the unknown," "scripture for anxiety at night," "prayer before court." Stand can own that entire long tail.

---

## Goals

1. Be the fastest path from acute fear to calm — under 10 seconds from home screen to a guided rescue moment.
2. Build a durable daily habit — measurable by streaks, completion, and return rate.
3. Prove it works — show users their own fear measurably dropping, session over session.
4. Stay private by default — no account needed for the core experience, ever.
5. Become sustainable without compromising 1–4.

## Non-goals

- A social network. Community features serve prayer, not feeds or follower counts.
- Clinical treatment. Stand supports spiritual practice; it never claims to treat anxiety disorders, and it gently routes people in crisis to real help.
- A content catalog race. Depth on fear beats breadth on everything.

---

## Phase 1 — Rescue (v1.3–v1.4, no backend, ~2–4 weeks)

The features that make Stand *the* fear app, all buildable on the current static PWA.

### SOS mode — the flagship feature
A "Steady me now" button, always visible, and a PWA home-screen shortcut. Launches a 90-second guided rescue: slow breathing pacer (animated, haptic on mobile) → one anchoring verse → a short spoken prayer → a declaration. Works fully offline. Ends with "I'm steadier" / "I need more" (chains another round) and, always visible, "Fear feels unmanageable" → crisis resources.

### Fear check-in and the calm ledger
Optional 1-tap check-in before and after each day and each SOS: "Where is your fear right now?" (1–5). Over time the app shows the user their own evidence: *"After prayer, your fear drops an average of 1.8 points."* This is the retention engine — proof from their own data, stored only on their device.

### Fear-specific tracks
Beyond the core 30 days: short 5–7 day tracks — Fear of the Unknown, Night Fear & Sleep, Health Fears, Financial Fear, Conflict & Court, Fear for Your Children. Requires refactoring content from `app.js` into JSON track files (also the prerequisite for translations and SEO pages).

### Courage stories (shipped: seventeen modules)
Narrative tracks that teach courage through one heroic account rather than one topic. Each is four days following the same beats — the fear, the choice, the outcome, the carry-forward — with a concrete exercise per day.

First batch: The Furnace (Daniel 3, outcome anxiety), The Giant (1 Samuel 17, an overwhelming problem), The Den (Daniel 6, accusation and unjust process), The Storm (Mark 4, panic — pairs with SOS), The Unseen Army (2 Kings 6, feeling outnumbered, night fear).

Second batch: The Throne Room (Esther 4–5, speaking up at cost), The Wall (Nehemiah 4 & 6, working through opposition), The Water (Matthew 14, fear mid-attempt), The Basket (Exodus 2) and Shiloh (1 Samuel 1) for fear for your children, Turned to the Wall (Isaiah 38) and The Hem (Mark 5) for health fears, The Last Meal (1 Kings 17, financial fear).

The two health tracks and the financial track carry explicit guardrails in the content itself: prayer is never framed as an alternative to medical care, an outcome is never framed as a grade on anyone's faith, and the Zarephath track states plainly that it is not a transaction or a technique for producing money.

Third batch: The River (Joshua 3–4, the water parts only after the step), The Three Hundred (Judges 6–7, inadequacy), The Shipwreck (Acts 27, a crisis you did not choose), The Barley Field (Ruth 1–2, starting over with nothing).

### Finding the right track (shipped)
With twenty journeys, browsing titles is the wrong entry point for someone already afraid. The library now opens with "Where are you right now?" — a plain-language list of situations mapped to tracks in `fearIndex` (`content.js`), one entry per journey, which switches track and opens the first unfinished day in a single interaction.

The list is now also a crawlable page at `/fears`, generated from the same `fearIndex` by `scripts/build-day-pages.js` and guarded in CI, so the page and the dialog cannot drift. Each situation links to that journey's first day page, which gives the long-tail entries real internal linking instead of leaving them trapped inside a dialog. Its own test walks every generated link and fails if one 404s.

Next on this thread: surfacing the list on the welcome screen once there is evidence about where first-time users get stuck, and watching which situations actually draw traffic — that is the cheapest signal available about which fears to write for next.

### Prayer composer (shipped)
Ported from REMAM (`dougdevitre/remam`), English only: a reviewed corpus of blocks (`prayers.js`) plus a seeded, deterministic composer (`compose.js`). A given mode + intention + seed always yields the same prayer, and "another prayer" is seed + 1 — no generation at runtime, so the whole space of possible prayers is reviewable in the data file. The optional personal intention is inserted into the corpus's own template and never stored or sent.

Carried over from REMAM's audio framework: per-prayer pacing metadata (`speed`/`stability`/`style` and ordered `{after, seconds}` break anchors). Device narration honours the anchors today by splitting the text and holding the silence; because the metadata stays inside the same limits REMAM's ElevenLabs generator enforces (validated in CI), recorded MP3s can be generated from it later without changing the data.

Deliberately not carried over: the Laudato Si' slot and the creation/defenders intentions, both specific to REMAM's ecological mission.

Both languages ship. Every corpus block carries `{ en, es }`, the chosen language is app-wide state (`state.lang`, saved with the rest), and one seed picks the same blocks in either language — so switching translates the prayer rather than composing a different one. Narration sets the utterance language and uses that language's break anchors. The 30-day devotional content is still English only; the translation layer in Phase 1 is what would change that.

Roman Catholic material is present and named. Six of the traditional prayers, and the Marian and Franciscan closings, are tagged `roman-catholic` and shown under their own labelled heading with a one-line note, rather than folded in with the prayers shared across the wider Christian tradition. `meta.defaultClosingTraditions` (shipping as `["universal"]`) governs only what "As composed" draws on, so a Roman Catholic closing is a deliberate pick.

Side by side shipped. “Show both languages” renders each line with its translation beneath it, for the traditional prayers as well as composed ones, and the preference is saved with the rest of the state. It rests on the invariant above — one seed, the same blocks, two languages — so the two columns are one prayer rather than two. `composeBilingual` pairs them and the validator checks each column against what that language composes alone, which is the check that actually has teeth: an earlier version compared only the primary column and passed even with the pairing deliberately broken.

Next on this thread: recorded narration for the traditional prayers in both languages via the same generator REMAM uses — the pacing metadata is already generator-ready and validated, so this needs an ElevenLabs key and an S3 bucket rather than more code. And, if the composer proves useful, an SOS variant that composes rather than reads a fixed script.

### Landing page (shipped)
`/` — a hand-written static page describing what Stand does, built from the same stylesheet and the same components as the app and the day pages, so the marketing surface and the product read as one thing. It is in the sitemap, and `/fears` carries the same nav and footer.

The app lives at `/app`. It held the root until v1.8, which meant the domain opened a hash-routed SPA instead of the page explaining it. `/about` redirects permanently to `/`. Two things make that move safe rather than merely tidy: the manifest's `start_url` moved to `/app`, so an installed copy still opens the app rather than the marketing page; and the service worker's cached shell moved with it, since a shell still keyed to `/` would be served to everyone opening the site. Reader data is untouched — `localStorage` is scoped to the origin, not the path.

One transitional wrinkle, by design rather than oversight: a visitor whose browser still holds the previous service worker will see the old cached app shell once at `/` before the new worker activates and takes over. It self-heals on the next load, and an installed copy keeps working throughout.

A call to action appears in three places: the hero (open the app, plus a direct "Steady me now"), the nav, and the footer. The nav pairs an always-visible primary action with a `<details>` disclosure menu for everything else — chosen over a scripted dropdown so the static pages stay script-free under the strict CSP, and so the open state is announced natively rather than needing `aria-expanded` bookkeeping.

No pricing. The page states plainly that Stand is free with no account, and says nothing about tiers or future paid options. If that changes, this page is where it lands.

### Verse cards
Share a day as a beautiful generated image (Canvas API) — the app's typography and palette, verse + reference. Images travel where links don't; this is the organic growth loop.

### Media & sleep
Media Session API (lock-screen play/pause, artwork), a sleep timer for night narration, and an audio-only "loop this prayer" mode.

### Safety footer
A calm, permanent line in settings and SOS: educational/spiritual support framing, plus 988 Suicide & Crisis Lifeline and Crisis Text Line (text HOME to 741741). Trauma-informed wording, never gating, never alarmist.

### SEO day pages
Pre-render each day and track as a real static page (`/day/8-fear`, `/track/night-fear`) with proper titles and meta. Currently the SPA's hash routes are invisible to search — this unlocks the long-tail acquisition channel at zero cost.

**RESOLVED.** The 30-day journey, both fear tracks and the four SOS sets read as NIV and were unlicensed. All 44 excerpts now come from the public-domain World English Bible, and `npm run verify:scripture` fails CI if any drifts back — checked against a committed 20 KB fixture of the WEB text for every reference the app cites. Reintroducing an NIV line fails the check, which was confirmed rather than assumed.

Still open, and a labelling question rather than a licensing one: 56 of the 68 courage-story excerpts are condensed from the WEB rather than quoted from it — clauses dropped to fit a card, and in a few places wording from outside the WEB (Mark 4:38 reads "perishing" where the WEB has "dying"). The text is public domain either way, so nothing is at risk; but they are described in the app as scripture excerpts and they are closer to paraphrase. Converting them to true WEB substrings is the same exercise as the 44, just longer.

## Phase 2 — Sound (v1.5, ~4–6 weeks)

Device TTS is functional; recorded audio is transformative.

- Professionally recorded narration (or premium pre-rendered TTS) as MP3s per day/track — the README already anticipates `audio/day-01.mp3`.
- Audio settings: voice choice (recorded vs. device), background music bed toggle.
- Local reminders (notification triggers where supported) — "Your daily stand is ready," user-chosen time.
- iOS install education — guided "Add to Home Screen" flow, since iOS Safari hides PWA installs.

## Phase 3 — Connect (v2.0, backend, ~6–8 weeks)

Optional accounts, only for what genuinely needs them: sync and reliable push.

**Stack (per engineering defaults):** TypeScript end-to-end; Vercel serverless functions (or Node/Express on AWS if it outgrows that); Postgres (Neon or RDS); secrets in SSM SecureString / env vars; least-privilege IAM; magic-link or passkey auth — no passwords.

### Data model (sketch)

```sql
users          (id, email_hash, created_at, translation, reminder_time)
devices        (id, user_id, push_endpoint, platform, last_seen)
journeys       (id, user_id, track_id, started_at, completed_at)
day_progress   (user_id, track_id, day, completed_on)        -- date only, feeds streaks
checkins       (id, user_id, context, before, after, at)     -- context: 'day' | 'sos'
notes          (user_id, track_id, day, ciphertext, iv)      -- E2E-encrypted client-side
groups         (id, name, owner_id, track_id, invite_code)
group_members  (group_id, user_id, joined_at, share_progress bool)
```

Notes are encrypted on-device with a user-held key before upload — the server can never read a prayer journal. Non-negotiable.

### API routes (sketch)

```
POST /api/auth/magic-link        request sign-in
POST /api/auth/verify            exchange token for session
GET  /api/sync                   pull state since cursor
PUT  /api/sync                   push local state (LWW merge per key)
POST /api/checkins               append check-in
POST /api/reminders/subscribe    register push endpoint
POST /api/groups                 create group
POST /api/groups/:code/join      join by invite code
GET  /api/groups/:id/progress    aggregate, respecting share_progress
DELETE /api/me                   full account + data deletion
```

- True push reminders and streak-protection nudges.
- Sync built on the existing backup format — the local-first model stays; the server is a replica, not the source of truth.

## Phase 4 — Together (v2.5+)

- **Group journeys:** a church small group or family walks the 30 days together — shared start date, opt-in progress visibility, a leader view. This is also the B2B channel: church licensing is the natural revenue model that doesn't paywall an anxious person at 3 a.m.
- **Prayer partners:** invite one person; they see only "Doug stood today" and can send one tap of encouragement.
- **App stores:** wrap with Capacitor for App Store/Play presence, reliable notifications, and haptics; the PWA remains the free open door.

---

## Sustainability

Stand is free, with no account and no tiers, and the landing page says so plainly. There is no paid plan, no trial, and nothing held back — every journey, SOS mode, narration, notes and backup are simply part of the app.

If that ever needs to change, the constraint comes first and the pricing second: never paywall a person in the middle of fear. SOS stays free unconditionally, whatever else does not. The likeliest candidates that would not violate that are recorded-audio packs and church/group licensing (see Phase 4) — a B2B channel that charges an institution rather than an anxious person at 3 a.m. Until such a decision is actually made, no surface in the app, the landing page, or this document should imply that tiers exist.

## Security & privacy commitments

- Local-first always; account optional forever; E2E encryption for synced notes.
- Keep and extend the strict CSP; add integrity pins for any future CDN assets.
- Anonymous, aggregate-only analytics (privacy-respecting, e.g. self-hosted), never prayer content, never fear scores tied to identity.
- Export and erase already exist locally; Phase 3 adds one-call server-side deletion.

## Safety & compliance

- Educational/spiritual framing throughout; no claims to treat, cure, or replace care for anxiety disorders — in-app and in all marketing copy ("supports your practice," never "treats anxiety").
- Crisis resources surfaced calmly and persistently (988, Crisis Text Line), especially inside SOS.
- Scripture licensing resolved (see Phase 1): everything quoted is public-domain WEB, gated in CI. The remaining item is honest labelling of the condensed courage-story excerpts, not a licence.
- Accessibility as a feature: the current a11y baseline (ARIA states, focus styles, reduced-motion) is table stakes for an audience that includes people in distress.

## Edge cases to hold the line on

- SOS must work with zero network, zero TTS voices, and storage blocked (private browsing) — it degrades to text + breathing animation, never to a blank screen.
- Streaks across timezones/DST: computed from local calendar dates (already the design); sync must not double-count a day completed on two devices.
- Restore/sync conflicts: last-write-wins per day/note with the newer timestamp; never silently drop a note — keep both and mark one "recovered."
- iOS Safari: TTS voice loading is lazy and audio requires a user gesture — SOS pre-warms voices on first tap.

## Metrics that matter

| Metric | Question it answers |
|---|---|
| Day-1 completion | Does onboarding land? |
| D7 / D30 retention | Is the habit forming? |
| Fear delta (before/after avg) | Does it *work*? |
| SOS uses per user | Is it the rescue tool we claim? |
| 30-day journey completion rate | Is the content holding? |
| Verse-card shares | Is growth organic? |

## Test plan

- Keep and grow the Playwright smoke suite (125 scenarios today) — add SOS offline mode, check-in math, track switching, and sync merge cases as they land; run it in CI on every push.
- Unit tests for pure logic (shipped): `logic.js` holds the streak arithmetic, backup sanitizing and ledger aggregation, extracted from `app.js` with every dependency passed in and "now" always injected, so `npm run test:unit` can cover them without a browser. 48 tests, including daylight-saving cases run in child processes with `TZ` set (New York both ways, Santiago where the jump deletes local midnight, Lord Howe's 30-minute shift, Auckland) at three times of day.
  - The streak cursor is now anchored at local noon. That is hardening rather than a fix: a sweep of 13,140 combinations found no case where it disagreed with the previous wall-clock cursor, because JS normalizes a deleted wall-clock time forward within the same calendar day. It removes the need to re-derive that reasoning.
  - Still worth adding here: sync merge cases, once there is a backend to merge against.
- Contrast ratchet in CI (shipped): the smoke suite sweeps every element that renders its own text on the app shell and the four static page shapes, computes the WCAG 2.1 ratio against the nearest painted ancestor background, and fails on anything under threshold that is not on `KNOWN_CONTRAST_DEBT`. A new failure breaks the build; the existing debt prints on every run instead of living in someone's notes. Verified by reintroducing the `.landing-footer a` specificity bug (3 failures) and by adding a fresh low-contrast rule (2 failures, each naming the selector, ratio and text).
  - All current debt is one token: `--gold` `#b88732` as text on the light palette — `.brand-mark` 2.92:1, `.eyebrow` and `.section-kicker` 3.15:1 on `--surface`, 2.54:1 on `--sage`, `.filter-tab.active` 3.15:1. The fix is a second token (`--gold-text`, around `#7f5d21`) used only for text, leaving `--gold` for borders and fills. It visibly darkens the brand's signature label colour, so it is a design decision rather than a defect to patch quietly. Dark mode already passes at 9.61:1.
  - The sweep now runs in dark mode too, with no known-debt allowance: every page passes outright, because the dark `--gold` is `#f1c879`. The debt above is light-mode only. This matters more since the static pages started following the device's colour scheme.
  - `<option>` is excluded from the sweep: its popup is painted by the OS, not in the page, so the nearest-ancestor background is the wrong comparison. `#voiceRate option{color:#132a3a}` exists precisely so options read on the browser's own light popup while the closed select inherits the dark audio card's colour. The sweep reported it at 1.00:1; that is an artifact of the measurement, not a bug.
- Still open: Lighthouse budget in CI (PWA installability, performance ≥ 90). Not wired up yet — the a11y half is better served by the deterministic ratchet above, and Lighthouse performance scores vary enough run to run on shared CI runners that a hard threshold would mostly produce reruns. Worth adding as a reported metric before it becomes a gate.
- Device matrix before each release: iOS Safari (TTS + install), Android Chrome (Media Session), desktop.
- The suite's “welcome shows on first visit” and “no page errors” checks are the guard against a broken first paint, and they have earned it — they caught both temporal-dead-zone crashes in `app.js`. Keep them first and last in the run.

### One convention in app.js
`app.js` is a single script that grows by appending sections, so its startup lives in `start()` at the very bottom and is deferred to `DOMContentLoaded`. Nothing else runs at load. That ordering is what makes appending safe: before it, startup reached `stopAudio()`, which reached a `const` declared in a later section, which throws on a temporal-dead-zone access and leaves a blank page. New sections can be added anywhere; startup still runs after the whole file has evaluated.

## Rollout plan

1. **Now:** merge the v1.2 branch; Vercel production deploy.
2. **v1.3 soft launch:** SOS + check-ins to a small circle for 2 weeks; watch fear-delta and SOS usage before widening.
3. **v1.4 public:** SEO day pages live; begin long-tail content ("prayer for fear of ___" pages).
4. **v1.5:** recorded audio; pitch 3–5 churches as pilot groups (free), converting to the Phase 4 group product.
5. **v2.0:** accounts/sync behind an invite flag first; store submission (Capacitor) after push notifications prove stable.

Each phase ships behind the same discipline as v1.0–v1.2: small validated commits, the full browser test suite green before every push, and no feature that compromises "free, private, offline" for the person who needs it most.

---

**ASSUMPTIONS (labeled):** solo developer or very small team; ~zero infra budget until Phase 3; the app is now fully bilingual (English and Spanish) across prayers and all 108 devotional days; the fear/anxiety focus is the intended brand direction rather than general devotionals; scripture is now public-domain WEB throughout, verified in CI.
