# Atlas — IB revision platform

Stop searching. Start practising. Atlas is an IB revision companion: past-paper
style questions organised by the real syllabus, practice sessions, a mistake
notebook, an AI tutor and progress on the IB 1–7 scale.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS
- Supabase (Postgres, Auth, Storage, RLS) — local via the Supabase CLI
- Stripe (billing scaffolding) · OpenAI-compatible tutor with an offline fallback

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in the Supabase keys printed below
npx supabase start                # local Postgres, Auth, Studio (Docker)
npx supabase db reset             # migrations + syllabus/demo seed
npm run dev                       # http://localhost:3000
```

Stripe and AI keys are optional: billing shows as "not configured" and the tutor
falls back to deterministic offline hints when no key is present. Supabase
Realtime and Analytics are disabled in `supabase/config.toml` — Ranked Duels
poll for live state, and Analytics only powers the Studio Logs tab.

### Environment variables

Only two are required; everything else degrades gracefully.

| Variable | Required | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API (or `npx supabase status` locally) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | admin tasks | same page — server only |
| `NEXT_PUBLIC_SITE_URL` | recommended | your deployed URL, e.g. `https://ib-elite.vercel.app` |
| `OPENAI_API_KEY` | optional | enables the live AI tutor |
| `STRIPE_*` | optional | enables billing |

They are read at request time, so the build never needs them — but the app
cannot serve pages until the two Supabase values are set.

## Deploying to Vercel

1. Create a Supabase project (cloud) and push the schema:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push                       # migrations
   psql "$DATABASE_URL" -f supabase/seed_syllabus.sql   # syllabus tree (optional seed)
   ```
2. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` for Production,
   Preview and Development.
3. In Supabase → Authentication → URL Configuration, set the site URL to your
   Vercel domain and add `https://<domain>/auth/callback` as a redirect URL.
4. Redeploy.

## Ranked Duels

`/ladder` is the competitive arena: per-subject Elo (monthly seasons, Bronze →
Grandmaster leagues, soft rating reset), skill-based matchmaking with a
widening search window, and server-authoritative play — the server stamps
per-question timing and grades every answer against a structured key, so the
client is never trusted. Losses feed the mistake notebook and the
`performance_events` ledger; statistical outliers (impossible speed, sudden
accuracy jumps) are flagged into `integrity_reviews` and rating changes are
withheld pending review. Friendly matches and shareable challenge links
(`/duel/challenge/<token>`, works logged out and tracks signup attribution)
carry no rating. Questions enter the duel pool once an admin gives them a
structured answer key (MCQ / numeric / exact) in the question editor.

## World Mock

A monthly, globally synchronized mock sitting (feature-flagged:
`app_flags.world_mock`). Admins author an exam-standard paper with a
per-criterion markscheme at `/admin/mock`, calibrate the AI marker on sample
scripts, and schedule three timezone-band sittings. The paper body is only
served at the bell; each student's clock is server-stamped from their own
start; scripts are handwritten, photographed and submitted before
`min(own duration, window close) + 60s`. A cron heartbeat
(`POST /api/mock/cron`, `x-cron-secret`) OCRs and grades scripts per
criterion overnight, quarantines integrity outliers, then on Results Day
computes global and country percentiles across all bands (late and
quarantined scripts get marks but no rank). Free tier: mark + percentiles +
shareable card (`/api/mock/card/<entryId>`). Pro: criterion breakdown,
top-decile comparison and a practice plan targeting the weakest criteria.
Operating guide: `docs/world-mock-runbook.md`.

## School Wars

A persistent school-vs-school ladder (feature-flagged:
`app_flags.school_wars`). Students opt into a school from a searchable
registry (`/schools`), request unlisted schools for admin verification
(`/admin/schools`), or join their country's regional team so nobody is
locked out. School scores are recomputed each heartbeat
(`POST /api/school/cron`) from the performance ledger:
participation-weighted averages with a per-member cap and a breadth boost,
so an engaged 60-student school beats a passive 2,000-student one and the
winning strategy is always activating more classmates. The heartbeat also
pairs similarly ranked schools (same country preferred) into 7-day Rivalry
Weeks with a live scoreboard, lead-change notifications, a
participation-gap recruitment prompt with attributed invite links, and
preset-only inter-school banners (no free text ever crosses school lines).
Seasons align with duel seasons; a Top-100 snapshot is written when each
season ends.

## The Signal

A verified, versioned academic rating per subject (feature-flagged:
`app_flags.signal`), derived entirely from the immutable
`performance_events` ledger: World Mock percentiles weigh most, ranked duel
Elo next, graded practice least. Each rating carries a confidence (grows
with sample size and evidence diversity), a trajectory
(improving/stable/declining), and a verification tier — Verified requires a
body of clean evidence across two evidence kinds and zero pending or upheld
integrity reviews; Proctored is reserved for supervised sittings. Ratings
are recomputed by `POST /api/signal/cron` under a versioned algorithm
(`rating_algorithm_versions`) so any rating can be recomputed and
explained. Public profiles are opt-in and field-by-field student-controlled
(`/signal`, public page `/signal/p/<id>` shows the pseudonym only; private
profiles 404). Voluntary calibration receipts freeze the prediction at
report time and power public accuracy stats. The scout-portal data model
(institutions, approval-gated contact requests, immutable audit log) ships
now but stays behind `app_flags.scout_portal`.

## Whiteboard & scanning

`/whiteboard` is a pressure-sensitive scratch sheet (pen, highlighter, eraser,
ruled/grid/plain paper, undo/redo, PNG export) that autosaves to your account
as you work. Two buttons run OCR through the `/api/scan` route:

- **Scan a question** — photograph a past paper; the photo is placed on the
  sheet and its text is transcribed.
- **Read my working** — the sheet is flattened to dark-ink-on-white and read
  back, so you can copy your handwritten working out as text.

Scanning uses free providers only, tried in order:

| Provider | Env var | Free tier |
| --- | --- | --- |
| Google AI Studio (best at handwriting and maths) | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OCR.space | `OCR_SPACE_API_KEY` | [25k scans/month](https://ocr.space/ocrapi/freekey) |

With no keys at all it still works: the route falls back to OCR.space's public
demo key, which is rate limited but needs no signup. Photos are compressed
client-side to stay under the free tier's 1 MB cap.

## Content model

Navigation is rendered entirely from the database, so the syllabus can change
without touching application code:

```
Subject → Theme → Topic → Subtopic (optional) → Questions
```

Admins manage the tree at `/admin/curriculum` (add, rename, reorder, merge,
archive) and questions at `/admin/questions`. Publishing a question makes it
appear under its subject, theme, topic and subtopic automatically.

The seeded tree lives in `supabase/syllabus.json`; regenerate its SQL with:

```bash
npm run syllabus:sql
```

## Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```
