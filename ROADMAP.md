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

### Courage stories (shipped: thirteen modules)
Narrative tracks that teach courage through one heroic account rather than one topic. Each is four days following the same beats — the fear, the choice, the outcome, the carry-forward — with a concrete exercise per day.

First batch: The Furnace (Daniel 3, outcome anxiety), The Giant (1 Samuel 17, an overwhelming problem), The Den (Daniel 6, accusation and unjust process), The Storm (Mark 4, panic — pairs with SOS), The Unseen Army (2 Kings 6, feeling outnumbered, night fear).

Second batch: The Throne Room (Esther 4–5, speaking up at cost), The Wall (Nehemiah 4 & 6, working through opposition), The Water (Matthew 14, fear mid-attempt), The Basket (Exodus 2) and Shiloh (1 Samuel 1) for fear for your children, Turned to the Wall (Isaiah 38) and The Hem (Mark 5) for health fears, The Last Meal (1 Kings 17, financial fear).

The two health tracks and the financial track carry explicit guardrails in the content itself: prayer is never framed as an alternative to medical care, an outcome is never framed as a grade on anyone's faith, and the Zarephath track states plainly that it is not a transaction or a technique for producing money.

Remaining candidates: Joshua at the Jordan (the river parts only after the priests' feet are already in it), Gideon's three hundred (fear of inadequacy), Paul in the shipwreck (calm leadership in a crisis you did not choose), Ruth in the barley field (starting over with nothing). All are `content.js` additions.

With sixteen journeys, the library picker now groups tracks by each track's `group` field. The next scale problem is the reverse lookup — a user arriving with one fear ("my court date is Thursday") has to recognize which story fits. A fear-to-track index, or a short intake on the welcome screen, is the natural follow-on.

### Verse cards
Share a day as a beautiful generated image (Canvas API) — the app's typography and palette, verse + reference. Images travel where links don't; this is the organic growth loop.

### Media & sleep
Media Session API (lock-screen play/pause, artwork), a sleep timer for night narration, and an audio-only "loop this prayer" mode.

### Safety footer
A calm, permanent line in settings and SOS: educational/spiritual support framing, plus 988 Suicide & Crisis Lifeline and Crisis Text Line (text HOME to 741741). Trauma-informed wording, never gating, never alarmist.

### SEO day pages
Pre-render each day and track as a real static page (`/day/8-fear`, `/track/night-fear`) with proper titles and meta. Currently the SPA's hash routes are invisible to search — this unlocks the long-tail acquisition channel at zero cost.

**ASSUMPTION:** current scripture excerpts read as NIV. Before any commercial or store release, either license NIV or swap excerpts to public-domain KJV/WEB. Phase 1 should add a translation layer to the content JSON so this is a data change, not a code change.

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

Free forever: the 30-day journey, SOS mode, device narration, notes, backup. Paid (later): recorded-audio packs, additional tracks, church/group licensing. Never paywall a person in the middle of fear — SOS is free in every tier, permanently.

## Security & privacy commitments

- Local-first always; account optional forever; E2E encryption for synced notes.
- Keep and extend the strict CSP; add integrity pins for any future CDN assets.
- Anonymous, aggregate-only analytics (privacy-respecting, e.g. self-hosted), never prayer content, never fear scores tied to identity.
- Export and erase already exist locally; Phase 3 adds one-call server-side deletion.

## Safety & compliance

- Educational/spiritual framing throughout; no claims to treat, cure, or replace care for anxiety disorders — in-app and in all marketing copy ("supports your practice," never "treats anxiety").
- Crisis resources surfaced calmly and persistently (988, Crisis Text Line), especially inside SOS.
- Scripture licensing resolved before commercial release (see Phase 1 assumption).
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

- Keep and grow the Playwright smoke suite (38 scenarios today) — add SOS offline mode, check-in math, track switching, and sync merge cases as they land; run it in CI on every push.
- Unit tests for pure logic: streak calculation (timezone/DST cases), backup sanitizing, check-in aggregation.
- Lighthouse budget in CI: PWA installability, a11y ≥ 95, performance ≥ 90.
- Device matrix before each release: iOS Safari (TTS + install), Android Chrome (Media Session), desktop.

## Rollout plan

1. **Now:** merge the v1.2 branch; Vercel production deploy.
2. **v1.3 soft launch:** SOS + check-ins to a small circle for 2 weeks; watch fear-delta and SOS usage before widening.
3. **v1.4 public:** SEO day pages live; begin long-tail content ("prayer for fear of ___" pages).
4. **v1.5:** recorded audio; pitch 3–5 churches as pilot groups (free), converting to the Phase 4 group product.
5. **v2.0:** accounts/sync behind an invite flag first; store submission (Capacitor) after push notifications prove stable.

Each phase ships behind the same discipline as v1.0–v1.2: small validated commits, the full browser test suite green before every push, and no feature that compromises "free, private, offline" for the person who needs it most.

---

**ASSUMPTIONS (labeled):** solo developer or very small team; ~zero infra budget until Phase 3; English-first with translations later; the fear/anxiety focus is the intended brand direction rather than general devotionals; NIV-style excerpts in current content are unlicensed and must be resolved before commercial release.
