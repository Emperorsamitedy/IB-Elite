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
falls back to deterministic offline hints when no key is present.

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

## Content model

Navigation is rendered entirely from the database, so the syllabus can change
without touching application code:

```
Subject → Theme → Topic → Subtopic (optional) → Questions
```

Admins manage the tree at `/admin/syllabus` (add, rename, reorder, merge,
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
