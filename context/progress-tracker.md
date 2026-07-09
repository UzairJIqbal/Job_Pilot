# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** 6 — Post-Launch Features
**Last completed:** 23 Application Email Templates
**Next:** Awaiting direction

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth — Google + GitHub OAuth via InsForge, proxy-based route protection, sign-out in Navbar
- [x] 03 PostHog Initialization — browser client, server client, page view tracking, identify/reset on auth
- [x] 04 Database Schema — profiles, agent_runs, jobs, agent_logs tables + resumes bucket + RLS policies

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI — completion banner, resume upload, profile form (5 sections), all mock data
- [x] 06 Profile Save Logic — Server Action upsert, real DB data, loading state, inline feedback, completion recalculation
- [x] 07 AI Profile Extraction from Resume — Gemini API extraction, pdf-parse, API route, wired Extract button
- [x] 08 Resume PDF Generation from Profile — Gemini content enhancement, @react-pdf/renderer, InsForge Storage upload, PDF buffer returned to client for direct download

### Phase 3 — Find Jobs Page

- [x] 09 Find Jobs Page — Full UI — search controls, filter bar, jobs table with match scores, pagination, 24 mock jobs
- [x] 10 Adzuna Job Discovery — Adzuna API client, Gemini scoring agent, API route, wired to UI, PostHog events
- [x] 11 Filter + Sort + Pagination — server-side DB queries with filter/sort/search/pagination params

### Phase 4 — Job Details Page

- [x] 12 Job Details Page — Full UI — server component fetches job by ID, client component renders all sections (header, info boxes, role description with "View Full Posting" link, AI match analysis with matched/missing skills, responsibilities, requirements, nice to have, benefits, apply button, company research empty state), clickable rows in JobsTable, SummaryBox expand/collapse toggle
- [x] 13 Company Research Agent — Stagehand + local Playwright browser automation, Gemini synthesis, 9-field structured dossier (companyOverview, techStack, culture, whyThisRole, yourEdge, gapsToAddress, smartQuestions, interviewPrep, sources), defensive normalization for Gemini type drift, API route with auth, loading spinner, PostHog event

### Phase 5 — Dashboard

- [x] 14 Dashboard Page — Full UI — StatsBar with 4 stat cards, RecentActivity list, AnalyticsCharts with resume tailoring, jobs found, and match score distribution charts
- [x] 15 Stats Bar — Real Data — Single DB query computes total jobs, avg match rate, companies researched count, jobs this week count, passed as props to StatsBar
- [x] 16 Recent Activity — Real Data
- [x] 17 Analytics Charts — PostHog Data

### Phase 6 — Post-Launch Features

- [x] 18 Skills Gap Analysis — Aggregates missing_skills across all jobs, horizontal bar chart on dashboard showing top 10 in-demand skills user lacks
- [x] 19 Dark Mode — next-themes with class strategy, .dark CSS variable overrides for all tokens, sun/moon toggle in navbar, system preference detection, localStorage persistence — DB aggregation from jobs table, real event data, empty states per chart
- [x] 20 Application Tracker — status column on jobs table (Saved/Applied/Interviewing/Rejected), status selector on job details page with optimistic updates, status filter on find-jobs page, Applications Sent stat on dashboard, server action for status updates, shared type module with color mapping
- [x] 21 Progress Modal — reusable step-by-step progress component for long-running operations, animated checkmarks/spinners, time-based step advancement, auto-dismiss on completion, error state with backdrop dismiss, integrated into Find Jobs and Company Research flows
- [x] 22 Interview Prep Agent — STAR-format behavioral questions, technical questions, talking points, closing strategies generated from job + company research + profile, expandable STAR cards, cached in jobs.interview_prep JSONB column
- [x] 23 Application Email Templates — networking outreach, follow-up, and thank-you emails with copy-to-clipboard, tabbed UI, cached in jobs.email_templates JSONB column

---

## Decisions Made During Build

- **Gemini over OpenRouter/GPT-4o** — User had `GEMINI_API_KEY` in `.env.local`, no OpenAI key. Used `@google/generative-ai` SDK instead of `openai` package with OpenRouter.
- **Gemini model: `gemini-2.5-flash`** — `gemini-1.5-flash` is deprecated (404). Use `gemini-2.5-flash` for structured extraction tasks.
- **pdf-parse v1 (not v2)** — v2 has broken worker setup in Next.js (`pdf.worker.mjs` not found). v1 works but requires a `test/data/05-versions-space.pdf` file as workaround (gitignored).
- **Lazy Gemini client init** — `getGeminiClient()` function instead of module-level instantiation. Prevents app crash if `GEMINI_API_KEY` is missing at import time.
- **API routes need explicit session refresh** — InsForge `createServerClient` only reads access token from cookies, not refresh token. Proxy excludes `/api` routes. Created `lib/auth-helpers.ts` with `getAuthenticatedClient()` that tries `getCurrentUser()`, falls back to `refreshSession({ refreshToken })`, then retries.
- **PDF returned as buffer, not JSON URL** — InsForge storage URLs require auth and are cross-origin. Client `<a>` download can't send cookies. API route returns PDF buffer directly with `X-Resume-Url` header for state update.
- **Gemini retry with backoff** — `generateWithRetry()` retries 503/429/500 errors up to 3 times. Extracts `retryDelay` from Gemini error `errorDetails` array instead of fixed backoff.
- **InsForge SDK type: use `ReturnType<typeof createServerClient>`** — Custom InsForgeClient type was incompatible with actual SDK types. Use the SDK's own return type for agent function parameters.
- **InsForge insert returns array** — `.select()` after `.insert()` returns array, not single object. Access `data[0]` for the inserted record.
- **Env var names** — `.env.local` has `ADZUNA_APP_KEY` (numeric, maps to Adzuna `app_id`) and `ADZUNA_API_KEY` (hex, maps to Adzuna `app_key`). Different from `ADZUNA_APP_ID` in original library-docs.md.
- **API route: POST + GET** — POST triggers Adzuna search and returns new jobs. GET fetches saved jobs for the current user (for page revisit).
- **PostHog singleton lifecycle** — `shutdownPostHog()` in `lib/posthog-server.ts` calls `shutdown()` then sets `posthogClient = null` so next call to `getPostHogClient()` recreates a fresh instance.
- **Skip job on JSON parse failure** — When Gemini response can't be parsed, the job is skipped entirely (not assigned a fake score of 50). Logged and continued.
- **MATCH_THRESHOLD** — Centralised in `lib/utils.ts` as `MATCH_THRESHOLD = 70`. Used in `FindJobsClient.tsx` filter logic and `JobsTable.tsx` score color ranges.
- **Country detection from location** — `lib/adzuna.ts` has `detectCountry()` that matches UK/Canada/Australia keywords in location string, defaults to US. Adzuna API uses different country endpoints.
- **Deduplication** — Before inserting a job, checks if `(user_id, title, company)` already exists. Skips if duplicate found.
- **Agent error logging** — `logAgentError()` helper writes to `agent_logs` table with run_id, level, message. Used in scoring catch blocks and outer exception handler.
- **Jobs loaded on page revisit** — GET handler on `/api/agent/find` returns all saved jobs for current user. `FindJobsClient` calls it on mount via `useEffect`.
- **Server-side filter/sort, client-side text search/pagination** — Feature 11 uses a hybrid approach. `GET /api/agent/find` accepts `filter` and `sort` query params, returns all matching jobs. DB handles match score filtering (`gte`/`lt`) and sorting. Client handles text search (case-insensitive on company + title) and pagination (6 per page). This avoids InsForge SDK `.or()` limitation and slow `.ilike()` + `count: 'exact'` queries. Debounced search (300ms) via refs to avoid stale closures.
- **Job details page — single client component** — Feature 12 uses one `JobDetailsClient` with inline helper functions (`SummaryBox`, `CompanyResearchCard`) instead of separate component files. The page only exists once, so splitting into 5+ files would add overhead without reuse benefit.
- **Company Research empty state** — Feature 12 shows a disabled "Research Company" button in a dashed-border card when `company_research` is null. Feature 13 will wire the actual research agent.
- **Stagehand v3 requires explicit LLM config** — Defaults to OpenAI for extraction. Must pass `model: { modelName: "gemini-2.5-flash", apiKey }` to constructor to use Gemini. No separate browser needed — `new Stagehand({ env: "LOCAL" })` manages its own Chromium.
- **Stagehand v3 extract() API differs from docs** — `stagehand.extract(instruction, schema)` takes separate args, not an options object. `page.goto()` uses `timeoutMs` not `timeout`. `stagehand.close()` handles browser cleanup internally.
- **Gemini type drift on dossier fields** — Gemini sometimes returns `string[]` fields as strings (e.g. `culture: "Values-driven"` instead of `culture: ["Values-driven..."]`). Added `normalizeDossier()` at the UI boundary with `Array.isArray()` guards on all array fields.
- **`@browserbasehq/stagehand` not `stagehand`** — The plain `stagehand` npm package (v1.0.1) is an unrelated RPC library. The correct browser automation package is `@browserbasehq/stagehand` v3.6.0.
- **JobsTable click navigation** — Added `router.push(/find-jobs/${job.id})` on row click. The table row already had `cursor-pointer`, so no visual change was needed.
- **SummaryBox expand/collapse toggle** — Added `useState` for expand/collapse on `about_role` text in SummaryBox. Shows 3 lines by default (`line-clamp-3`), "Read more" button when `content.length > 150`, "Show less" to collapse.
- **Role Description "View Full Posting" link** — Adzuna API truncates job descriptions in search results (not a UI bug). Added "View Full Posting →" link below Role Description section linking to `source_url`. Opens in new tab.
- **Adzuna description truncation** — The `about_role` field stores Adzuna's `description` which is truncated by the Adzuna search API. This is a data source limitation, not a CSS/UI issue.
- **Dashboard uses rounded-2xl for stat/activity cards** — StatsBar and RecentActivity cards use `rounded-2xl` (larger radius) instead of `rounded-xl` used by profile/job cards. This matches the design mockup which shows softer corners on dashboard cards.
- **AnalyticsCharts internal 2-column layout** — The charts section is a 2-column grid where RecentActivity occupies the left column and AnalyticsCharts occupies the right. AnalyticsCharts itself has an internal 2-column layout: Resume Tailoring Activity on the left, Jobs Found Over Time + Match Score Distribution stacked on the right.
- **recharts for charts** — Used `recharts` library for all three charts. BarChart for Resume Tailoring and Match Score Distribution, AreaChart (not LineChart) for Jobs Found Over Time to get the gradient fill effect.
- **Dashboard components are all client components** — All three dashboard components (StatsBar, RecentActivity, AnalyticsCharts) use `"use client"` because recharts requires browser rendering and the components need React hooks for recharts.
- **Mock data for all dashboard stats/charts** — Feature 14 uses hardcoded mock data matching the design. Real data wiring happens in Features 15-17.
- **lucide-react for icons** — StatsBar uses `BriefcaseIcon`, `Target`, `Building2`, `Calendar` from lucide-react. Had to install the package (was not previously in dependencies).
- **Single DB query for all stats + charts** — Feature 15+17 uses one `getDashboardData()` function that fetches all user jobs once with `select("match_score, company_research, found_at")` and computes both stats and chart data in JavaScript. Avoids multiple separate round-trips.
- **StatsBar accepts DashboardStats prop** — Removed hardcoded mock data, now receives `{ totalJobs, avgMatchRate, companiesResearched, jobsThisWeek }` from server component. Trend badges removed (mock trend data).
- **Dashboard data computed in server component** — `getDashboardData()` function in `app/dashboard/page.tsx` queries DB once, returns stats + jobs list. `computeChartData()` derives chart datasets from the same jobs array. Falls back to zeros/empty on error. No client-side fetch needed.
- **RecentActivity is now a server component** — Removed `"use client"`, accepts `activities: Activity[]` prop from dashboard page. Matches StatsBar's server-component-with-props pattern.
- **Two DB queries for recent activity** — `agent_runs` (status=completed) for job searches + `jobs` (company_research not null) for research events. Merged, sorted by timestamp descending, top 8.
- **timeAgo extracted to lib/utils.ts** — Moved from `JobDetailsClient.tsx` to shared utility. Both components import it now.
- **Activity type exported from RecentActivity** — `{ id, text, timestamp, type: "search" | "research" }`. Used by both the component and the dashboard page.
- **Empty state for new users** — "No activity yet. Start by searching for jobs." when activity list is empty.
- **DB aggregation for chart data** — Feature 17 computes chart data from the same `jobs` table query used for stats. No PostHog Query API dependency. `computeChartData()` derives all three chart datasets from the jobs array in JavaScript.
- **"Resume Tailoring Activity" replaced with "Company Research Activity"** — No PostHog event or DB signal exists for resume tailoring. Third chart shows jobs with `company_research IS NOT NULL` from last 7 days.
- **Match score bucketing in JS** — Scores bucketed into ranges (50-60, 60-70, 70-80, 80-90, 90-100) from `match_score` column. Scores outside 50-100 range clamped to nearest bucket.
- **Date labels formatted as "Jul 8"** — Time-series charts use `formatDayLabel()` to convert ISO dates ("2026-07-08") to short labels. Handles 30-day range without overcrowding.
- **Empty state per chart** — Each chart shows a centered message when data is empty. Different messages for each chart guiding user action.
- **CSS custom properties for chart colors** — Replaced hardcoded hex values (`#10B981`, `#7C5CFC`, `#E7EAF3`, `#9CA3AF`) with CSS custom properties (`var(--color-success)`, `var(--color-accent)`, `var(--color-border)`, `var(--color-text-muted)`).
- **ChartData type exported from AnalyticsCharts** — `{ jobsFoundData, matchScoreData, companyResearchData }` type exported for use by the dashboard page.

---

## Notes

- `pdf-parse` v1 uses deprecated `Buffer()` internally — cosmetic Node.js warning, not fixable from our code. Ignored.
- `test/data/05-versions-space.pdf` is gitignored — required by `pdf-parse` v1 auto-test on import.
- Gemini prompt explicitly tells the model NOT to return `email` or `resumePdfUrl` — those come from OAuth/storage, not the resume.
- `recharts` is now in package.json (installed for Feature 14). Do not reinstall.
- `lucide-react` is now in package.json (installed for Feature 14). Do not reinstall.
- All 17 features complete. No remaining features in the build plan.
- PostHog remains capture-only in this project — no data retrieval. Chart data comes from the InsForge `jobs` table.
