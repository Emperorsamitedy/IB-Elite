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
