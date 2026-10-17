# Tsenta-class JobPilot: feature map

Status: **approved 2026-10-17** (cap 25/day, seeded company list). Branch: `tsenta-parity`.

Clean-room plan. Tsenta was studied only through its public site, third-party reviews, and an unauthenticated load of its dashboard login page. No Tsenta code, copy, or brand assets are reused.

## What Tsenta does

An auto-apply agent. It watches company career pages (Greenhouse, Lever, Ashby, Workday and others), matches roles to the user's resume and preferences, tailors a resume and cover letter per role, shows the edits for approval, then fills and submits the application form and keeps a receipt. Recruiter emails are routed back to each application.

Evidence: tsenta.com home page; scoutify.com and loopcv.pro reviews; REA capture `ev_2c445546…0230a` (dashboard login page: Firebase auth, Google/email/messaging sign-in, PostHog, Sentry, Intercom; lazy chunks named `applicationsApi`, `jobboard`, `ats`, `filter_config`, `subscriptionApi`, `usersApi`, `use_referral`). Anything behind login is inferred from public descriptions, not observed.

## Gap analysis

| Area | Tsenta | JobPilot today | Plan |
|---|---|---|---|
| Job sources | 50k+ career pages via ATS boards | Adzuna search on demand | **Add** Greenhouse, Lever and Ashby public job-board APIs over a seed list of companies; keep Adzuna |
| Freshness | Continuous monitoring | Manual search | **Add** scheduled ingestion (InsForge schedules), dedupe by ATS job id |
| Preferences | Role family, location, salary, seniority, exclusions | Title + location, profile skills | **Extend** profile: salary floor, seniority, remote, excluded companies/keywords |
| Matching | Match % + explanation | Gemini score 0–100 + skills | **Keep**, add a one-line "why it fits" and hard filters before scoring |
| Add job by URL | Yes | No | **Add**: paste a Greenhouse/Lever/Ashby URL |
| Tailored resume | Per job, ATS-safe, diff view | One generic generated PDF | **Add** per-job tailored resume (structured edits → PDF) with before/after diff |
| Cover letter | Per job | No | **Add** |
| Screening questions | Answered from profile | No | **Add** application profile (work authorization, sponsorship, notice period, saved answers); EEO defaults to "decline to answer" |
| Approval | Review edits before send | n/a | **Add** approval queue: needs review → approved → submitting → submitted / failed / skipped |
| Submission | Fills and submits 19+ ATSes | "Apply Now" link | **Add** a browser worker (Stagehand) for Greenhouse, Lever, Ashby only |
| Receipts | Every field, answer, resume version, time | No | **Add** stored receipt + final-page screenshot |
| Tracking | Applied / viewed / replied / interview, inbox routing | Saved / applied / interviewing / rejected | **Extend** statuses (submitted, replied, interview, offer, rejected); manual updates first |
| Research, interview prep, emails | No | Yes | **Keep**, as answered "yes" |
| Inbox routing (Gmail) | Yes | No | **Later**: phase 6, optional |
| Credits / billing | Stripe tiers | No | **Out** unless you want it |
| Mobile, iMessage, WhatsApp, Chrome extension, MCP | Yes | No | **Out** for now |
| Workday (incl. account creation) | Yes | No | **Out**: no public API, needs per-employer accounts |

## Phases

1. **Discovery**: `companies` seed table, ATS fetchers, scheduled ingestion, extended preferences, paste-a-URL.
2. **Tailoring**: tailored resume + diff, cover letter, screening answers, application profile.
3. **Approval queue**: new `/queue` page; bulk approve/skip.
4. **Submission worker**: Stagehand on InsForge compute (Fly), not Vercel (serverless timeouts can't run a browser for minutes). Greenhouse first, then Lever, Ashby. Receipts.
5. **Tracking**: extended statuses on the applications board, receipts on job details.
6. **Inbox routing** (optional): Gmail read-only to match recruiter replies to applications.

Each phase ships on its own and leaves the app working.

## Phase 1 status: done

- 252 companies seeded (152 Greenhouse, 79 Ashby, 21 Lever), each board checked live on 2026-10-17.
- **Scan company boards** on Find jobs runs `POST /api/agent/boards`. A full scan reads about 31k open roles in about 60s. Profile filters (titles, seniority, location, salary floor, exclusions) cut that to a few hundred. Duplicates per location are collapsed, then the top `DISCOVERY_SCORE_LIMIT` (default 5) are scored by Gemini, spaced 13s apart for the free tier.
- **Add a job by link** runs `POST /api/agent/import-url` for any Greenhouse, Lever or Ashby posting.
- **Daily scan**: `POST /api/cron/discover` runs a scan for every profile with "Scan boards for me every day" switched on. It needs `CRON_SECRET` and a public URL, so schedule it after deploying:

  ```bash
  npx -y @insforge/cli secrets add CRON_SECRET "$(openssl rand -hex 32)"   # same value in the app's env
  npx -y @insforge/cli schedules create --name daily-discover --cron "0 13 * * *" \
    --url https://<your-app>/api/cron/discover --method POST \
    --headers '{"Authorization":"Bearer ${{secrets.CRON_SECRET}}"}'
  ```

## Phase 2 status: done

- **Application answers** on Profile (`application_profiles`): countries you can work in, sponsorship, relocation, notice period, start date, GitHub, pronouns, self-ID choices (default "decline to answer"), and saved answers to common questions.
- **Form questions** are read from the public Greenhouse and Ashby APIs, and from the question cards embedded in Lever's apply page (`lib/ats/questions.ts`).
- **Tailor Application** on job details runs `POST /api/agent/tailor` (one Gemini call). It produces a tailored resume PDF, a diff against the profile, a cover letter and an answer for every question. Identity, document and self-ID answers are filled without AI.
- **Guards**: company, title and dates always come from the profile. Bullets with numbers the profile doesn't contain are dropped, and so are skills the profile doesn't support. The diff lists everything removed. Answers that don't match the form's options, or that the model isn't sure about, are flagged.
- **Review**: edit the cover letter and answers, then Approve, Skip or Re-tailor (`PATCH /api/applications/{id}`). Approve stays blocked while any answer is flagged. A database trigger stops a browser session from setting worker-only states or fields.
- Verified on 2026-10-17 against Linear's live Ashby form (14 questions) with a synthetic profile. The test row, PDF and logs were removed afterwards.

## Phase 3 status: done

- **`/queue`** (in the sidebar) lists drafted applications under the tabs Needs review, Approved, Failed and Skipped. The Approved tab also shows applications being sent or already sent.
- **Bulk actions**: select rows, then Approve, Skip or Back to review (`PATCH /api/applications` with `{ids, state}`, at most 100 ids). Rows with flagged answers aren't approved and are counted in the result, and sent rows are never changed.
- **Draft next 3** tailors the top untailored strong matches (score ≥ 70 on a known ATS) one at a time from the browser. The free Gemini tier gets one request per job, and a missing-profile error stops the batch.
- **Dashboard**: "Needs you" opens with "N drafted applications to review" when there are any.
- Not verified at runtime: the trigger that blocks browser sessions from setting worker-only states. The CLI won't switch to the `authenticated` role, so it has only been reviewed in code.

## Phase 4 status: built, not deployed

- **Worker** (`worker/`): a Node service that claims approved applications, fills the employer's form in headless Chromium (Playwright) and records a receipt. It falls back to Stagehand with Gemini only for fields it can't place. Adapters cover Greenhouse, Ashby and Lever (`worker/src/ats.ts`).
- **Claiming** (`claim_next_application`, migration `20261017115403`): `FOR UPDATE SKIP LOCKED` plus a per-user lock, so several workers never take the same row. It enforces the daily cap (25 per user over 24 hours, counting rows in flight). A row stuck in `submitting` for 20 minutes is failed with a "check the company's site" message rather than retried, because it may have gone through.
- **Safety**: the run stops before submitting if a required field is still empty, a CAPTCHA challenge is showing, or there's no submit button. After submitting it needs a confirmation page or message. Otherwise it fails with the form's errors or "may have gone through". It never solves CAPTCHAs or email codes.
- **Receipts**: every field and how it was filled, the resume key, the cover letter mode and the confirmation text, plus a full-page screenshot at `{user}/receipts/{application}.png` in the `resumes` bucket. Success marks the job `applied` and writes to the activity log.
- **Dry run**: `npx tsx src/main.ts --dry-run --app <id>` (from `worker/`) fills the form and saves a screenshot. It claims nothing, attaches no files and never clicks submit.
- Verified on 2026-10-17 by dry runs with a synthetic candidate against live forms. The Affirm Greenhouse form (25 questions) and the Linear Ashby form (9 questions) were filled. Binance's Lever form was filled too: 7 custom questions, plus dropdowns, radios and textareas. Nothing was attached or submitted, and no live submission has been tested.
- **Deploy** (InsForge compute, needs `flyctl` on PATH):
  ```bash
  ctx=$(worker/scripts/stage.sh)   # copies worker/ and lib/ats/ only
  npx -y @insforge/cli compute deploy "$ctx" --name jobpilot-worker \
    --port 8080 --cpu shared-2x --memory 2048 --env-file <worker env file>
  ```
  Env: `INSFORGE_URL`, `INSFORGE_API_KEY` (admin, server-only), `GEMINI_API_KEY` (AI fallback). Optional: `DAILY_SUBMISSION_CAP` (25), `POLL_INTERVAL_MS` (15000), `AI_FALLBACK=0`, `WORKER_ID`. Run a single instance until live submission has been watched end to end.

## Phase 5 status: done

- **Statuses**: jobs move through Saved → Applied → Replied → Interviewing → Offer, or Closed (migration `20261017120738`). The board, dashboard strip, filters and job details all read the list from `lib/job-status.ts`. The worker sets Applied when it submits; the later stages are manual.
- **Receipts on job details**: once the worker has tried an application, the Tailored Application card shows when it was sent, the employer's confirmation text, whether the resume and cover letter went in, and every field with how it was filled. It links to the screenshot (`GET /api/applications/{id}/screenshot`, owner-only) and the employer's form.
- Typecheck and `next build` pass. The receipt view hasn't been seen with real data, since no live submission has run yet.

## Schema changes (new migrations)

- `companies` (name, ats, board_token, active)
- `jobs` + `source`, `ats`, `ats_job_id` (unique per source), `posted_at`, `fit_reason`
- `profiles` + `salary_min`, `seniority`, `excluded_companies`, `excluded_keywords`, `auto_discover`, `last_discovered_at` (the existing `remote_preference` is reused)
- `application_profiles` (work auth, sponsorship, saved answers, EEO choices; one per user)
- `applications` (job_id, state, tailored_resume_key, resume_diff, cover_letter, answers, receipt, screenshot_key, error, submitted_at)

All with RLS per user, like the existing tables.

## Risks to decide on

- **ATS terms and bot checks**: automated submission can trip CAPTCHAs or break ATS terms of use. Mitigations: approval required for every application, per-user daily cap (default 25), visible failures, no CAPTCHA solving.
- **Quality vs volume**: reviews of Tsenta report low match quality and few interviews from high volume. Default to fewer, better-matched applications.
- **Gemini free tier** (5 req/min, 20/day) won't cover tailoring at volume; a paid key will be needed past testing.
- **Cost of the worker**: a Fly machine per run; scale-to-zero keeps idle cost near zero.

## Decisions needed

1. Approve the phases and the "Out" list?
2. Daily submission cap default (25)?
3. Seed company list: start with ~200 tech companies on Greenhouse/Lever/Ashby, or provide your own?
