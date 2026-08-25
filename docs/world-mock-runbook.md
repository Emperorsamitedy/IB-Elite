# World Mock — sitting runbook

How to operate one monthly sitting end to end. Everything here is idempotent:
re-running any step is safe.

## 0. Prerequisites

- `app_flags.world_mock` is `true` (students see `/mock` only when it is).
- `GEMINI_API_KEY` set in production — without it grading falls back to the
  keyword marker and results are badged "keyword-marked".
- `CRON_SECRET` set, and a scheduler hitting the heartbeat every 10 minutes:

  ```
  curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/mock/cron
  ```

  Vercel cron, pg_cron + pg_net, or plain cron all work. Each call grades up
  to ~200s of scripts and releases any due results, then exits.

## 1. Author (T-2 weeks)

`/admin/mock` → New paper. Write the paper body (markdown + LaTeX), add the
markscheme criteria — title, what earns the marks, max marks, and a practice
topic per criterion (that link powers the paid practice plan). Save. Status
stays `draft`; students see nothing.

## 2. Calibrate (T-10 days)

Open the paper → Calibration. Paste 3–5 sample transcripts of known quality
(a strong, a middling, a weak script) and check the grader's awards match
your judgement. Adjust criterion descriptions until they do — the
descriptions are the examiner prompt. Optionally set status `calibration`
to mark the pass done.

## 3. Schedule (T-7 days)

Fill the three band rows (times entered in YOUR local timezone, stored UTC):

| Band | Reference wall-clock |
| --- | --- |
| Americas | 16:00 New York |
| Europe & Africa | 16:00 London |
| Asia-Pacific | 16:00 Singapore |

Window = paper duration + 30 min entry slack. Results day = next morning
08:00 in each band's reference zone. Then press **Set live** — this is the
public announcement: the sitting appears on `/mock` with its countdown.
(Set live refuses until a markscheme and at least one sitting exist.)

**Leak containment**: earlier bands can post the paper before later bands
sit. For high-stakes papers, open "Per-band paper variants" in the sitting
editor and give the later bands their own body — same markscheme skeleton,
different numbers. Blank variants fall back to the shared paper.

## 4. Sitting day

Nothing to do. The bell is enforced by the server: the paper body is only
served through `/api/mock/start` while the window is open; each student's
clock runs from their own Start; uploads close with the window; submissions
after `min(own duration, window close) + 60s grace` are marked late.

**Something is wrong?** `/admin/mock` → **Delay 24h** shifts every
not-yet-closed sitting and notifies entrants, or **Cancel** kills the paper.

## 5. Overnight grading

The cron heartbeat drains the queue: claim (SKIP LOCKED) → OCR via the scan
pipeline → per-criterion AI marking → integrity checks. Flagged scripts land
in `integrity_reviews` (impossible write speed and scored-but-empty scripts
are auto-quarantined and excluded from rankings; score-history outliers are
flagged for review only). To force a manual pass, POST `/api/mock/cron` as
an admin.

When `GEMINI_API_KEY` is set, grading also screens handwriting against the
student's earlier scripts; a confident mismatch lands in
`integrity_reviews` as `handwriting_mismatch` — flag-only, never an
automatic penalty. New pens and bad photos are expected; treat the flag as
a reason to look, not a verdict.

Check progress:

```sql
select status, count(*) from mock_entries group by 1;
```

## 6. Results Day

Automatic. Once every band has closed, the queue is drained, and
`results_at` has passed, the next heartbeat computes percentiles (global +
country, across all bands of the paper; late and quarantined scripts get
marks but no rank; percentiles hidden below 5 ranked sitters), flips
`released`, and notifies every entrant. Free users see mark + percentiles;
Pro users additionally get the criterion breakdown, top-decile comparison
and practice plan. Share cards live at `/api/mock/card/<entryId>`.

## 7. Aftercare

- Review `integrity_reviews` (status `pending`) and clear or uphold each.
  Upholding keeps the entry quarantined; nothing re-ranks automatically.
- Percentile sanity check:

  ```sql
  select global_percentile, count(*) from mock_results
  where released group by 1 order by 1;
  ```
