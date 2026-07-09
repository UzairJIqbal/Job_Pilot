# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Layout

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Navbar` | `components/layout/Navbar.tsx` | `h-16 max-w-[1128px] bg-surface border-b border-border`, logo text `text-sm font-semibold text-text-slate` with `gap-2`, nav links `text-sm font-medium text-text-primary`, CTA `bg-text-slate text-white rounded-md h-9`. Server component — checks auth state, shows SignOutButton + PostHogIdentify when authenticated |
| `Footer` | `components/layout/Footer.tsx` | `min-h-28 max-w-[1128px] bg-surface border-x border-t border-border`, logo text `text-sm font-semibold text-text-slate` with `gap-2`, links `text-xs font-medium text-text-secondary`, social icons `h-8 w-8 rounded-md text-text-secondary` |
| `SignOutButton` | `components/layout/SignOutButton.tsx` | Client component. `h-9 border border-border bg-surface rounded-md text-text-primary` secondary button style. Calls `signOut` server action, redirects to /login |
| `ThemeProvider` | `components/ui/ThemeProvider.tsx` | Client component. Wraps `next-themes` ThemeProvider with `attribute="class"`, `defaultTheme="system"`, `enableSystem`. Used in root layout. |
| `ThemeToggle` | `components/ui/ThemeToggle.tsx` | Client component. `h-9 w-9 rounded-md border border-border bg-surface` button. Sun/Moon icons from lucide-react. Uses `useTheme()` to toggle. Renders empty div when not mounted (SSR safety). |
| `ProgressModal` | `components/ui/ProgressModal.tsx` | Client component. Reusable step-by-step progress overlay. Props: `isOpen`, `title`, `steps: ProgressStep[]`, `activeStep`, `isComplete`, `error`, `onDismiss`. Overlay: `fixed inset-0 z-50 bg-overlay/40 backdrop-blur-sm`. Card: `rounded-2xl border border-border bg-surface px-8 py-7 max-w-md`. Progress bar: `h-1 bg-accent` transitioning to `bg-success` on complete. Step states: pending `opacity-40 border-2 border-border`, active `animate-spin border-2 border-accent border-t-transparent bg-accent/5`, completed `bg-success text-white` with `animate-[check-draw_0.4s]` checkmark. Error state: centered `bg-error-lightest` icon + message + dismiss button. Dismiss X button: top-right, only during error/completion. Backdrop click: disabled during progress, enabled during error/completion. Fade-out: `animate-[modal-fade-out_0.5s_ease-in_forwards]`. Used in FindJobsClient and CompanyResearchCard. |

### Homepage Sections

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Hero` | `components/homepage/Hero.tsx` | `min-h-[540px] landing-gradient`, headline `text-[42px] md:text-[48px] font-bold text-text-slate`, CTA primary `bg-overlay text-accent-foreground`, CTA secondary `border border-border bg-surface text-text-primary` |
| `DashboardPreview` | `components/homepage/DashboardPreview.tsx` | `bg-surface-muted border-x border-b border-border`, image `max-w-[848px] image-soft-shadow rounded-2xl` |
| `SearchFeature` | `components/homepage/SearchFeature.tsx` | Two-column grid, left `bg-surface-muted border-r`, right `px-14`, heading `text-[38px] font-bold text-text-slate`, active benefit `border-l-2 border-l-success` |
| `ApplyFeature` | `components/homepage/ApplyFeature.tsx` | Two-column grid, left `bg-surface-muted border-r`, right `px-14`, heading `text-[38px] font-bold text-text-slate`, active benefit `border-l-2 border-l-success` |
| `Testimonial` | `components/homepage/Testimonial.tsx` | `min-h-[360px] bg-surface`, quote `text-[26px] font-semibold text-text-darker`, badge `text-xs font-semibold uppercase text-accent`, verified icon `fill-success` green checkmark next to name |
| `BottomCta` | `components/homepage/BottomCta.tsx` | `min-h-[330px] landing-gradient`, headline `text-[42px] md:text-[48px] font-bold text-text-slate`, buttons same as Hero |

### Auth Pages

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Dashboard Page` | `app/dashboard/page.tsx` | Thin wrapper: Navbar → `main.flex-1.px-6.py-8` → Footer. Content `max-w-6xl mx-auto space-y-6`. Heading `text-xl font-semibold text-text-primary`, body `text-sm text-text-secondary`. |
| `Login Page` | `app/(auth)/login/page.tsx` | Two-panel layout. Left branding panel: `w-[480px] bg-accent p-12` (hidden below lg). Pill badge: `rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white`. Headline: `text-3xl font-semibold leading-tight text-white`. Subtext: `text-sm leading-relaxed text-white/80`. Benefit icon: `h-9 w-9 rounded-lg bg-white/15 text-base`. Benefit title: `text-sm font-medium text-white`. Benefit desc: `text-xs leading-relaxed text-white/70`. Right form panel: `flex-1 items-center justify-center px-6 py-12`, form `max-w-sm`. Heading: `text-xl font-semibold text-text-primary`. Subheading: `text-sm text-text-secondary`. OAuth buttons: `h-11 rounded-lg border border-border bg-surface hover:bg-surface-secondary text-sm font-medium text-text-primary gap-3`. Legal text: `text-xs text-text-muted` with `underline hover:text-text-secondary`. Error text: `text-sm text-error`. Suspense fallback: `h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent`. Client component — uses `useSearchParams` wrapped in `Suspense`. |

**Pattern notes:**
- OAuth buttons use `h-11` (larger than standard `h-9` buttons) for tap-friendly touch targets on auth flow
- Left branding panel uses `bg-accent` (the project's primary purple) — consistent brand color for auth screens
- White overlays on accent: `bg-white/20` for badges, `bg-white/15` for icons, `text-white/80` for subtext, `text-white/70` for descriptions
- Error and legal text sit below the buttons with `mt-4` and `mt-10` respectively
- Suspense fallback spinner uses `border-t-accent` accent color on a `border-border` track — reuse this pattern for all loading spinners

### Profile Page

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Profile Page` | `app/profile/page.tsx` | Server component: Navbar → `main.flex-1.px-6.py-8` → Footer. Content `max-w-282 mx-auto space-y-6`. Heading `text-xl font-semibold text-text-primary`. Renders `ProfilePageClient`. |
| `ProfilePageClient` | `components/profile/ProfilePageClient.tsx` | Client component. Stacks: `CompletionIndicator` → `ResumeUpload` → `ProfileForm`. `space-y-6` between sections. |
| `CompletionIndicator` | `components/profile/CompletionIndicator.tsx` | `rounded-xl border border-border bg-surface px-6 py-5`. Ring: SVG 72×72 circle, `strokeWidth="6"`, track `stroke="var(--color-border)"`, fill `stroke="var(--color-warning)"`. Text inside: `text-2xl font-semibold text-text-primary`. Heading: `text-sm font-medium text-text-primary`. Subtext: `text-sm text-text-secondary`. Tags: `rounded-full bg-[#fff4ed] px-3 py-1 text-xs font-medium text-warning`. |
| `ResumeUpload` | `components/profile/ResumeUpload.tsx` | `rounded-xl border border-border bg-surface px-6 py-5`. Section title: `text-sm font-medium text-text-primary`. Drag zone: `rounded-lg border-2 border-dashed px-4 py-8`, default `border-border bg-surface-secondary`, active `border-accent bg-accent-muted`. Icon: `h-12 w-12 rounded-full bg-surface-tertiary`. Select Resume button: `rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary`. Generate Resume button: `rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark`, enabled when resume exists, loading state "Generating...", triggers PDF download. Extract button: same as Select Resume, enabled when resume exists, loading state "Extracting...". |
| `ProfileForm` | `components/profile/ProfileForm.tsx` | Client component. Accepts `initialProfile: ProfileFormData | null` prop. Each section: `rounded-xl border border-border bg-surface px-6 py-5`. Section header: `mb-5 flex items-center gap-2.5`, icon in `h-8 w-8 rounded-lg bg-surface-tertiary`. Grid: `grid-cols-1 gap-4 sm:grid-cols-2`. Form inputs: `h-10 rounded-lg border border-border bg-surface px-3 text-sm`. Focus: `focus:border-accent focus:ring-1 focus:ring-accent`. Disabled email: `disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed`. Tag input: `min-h-10 rounded-lg border border-border bg-surface px-3 py-2`, tags `rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium text-text-dark`. Experience card: `rounded-lg border border-border bg-surface-secondary p-4`. Work exp header: `text-xs font-medium text-text-muted`. Save button: `rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed` in `flex flex-col items-end gap-2`. Saving state: button text "Saving...", inline `text-sm text-green-600` success / `text-sm text-red-600` error below button. |

**Pattern notes:**
- Profile page uses `max-w-282` (1128px) to match the Navbar width — same as the dashboard max-width pattern
- All profile sections use the same card pattern: `rounded-xl border border-border bg-surface px-6 py-5`
- Section headers use a consistent pattern: icon in `h-8 w-8 rounded-lg bg-surface-tertiary` with `gap-2.5`
- Form inputs use `h-10` (smaller than auth buttons `h-11`) for form density
- Work experience cards are nested inside the section with `bg-surface-secondary` to visually separate roles
- Tag input pattern: inline tags with `rounded-full bg-surface-tertiary` + text input
- All icons use `var(--color-text-secondary)` for stroke color (not hardcoded)
- Save button uses `bg-accent` + `hover:bg-accent-dark` — same as Generate Resume button
- Client components are minimal: `ProfilePageClient` (layout only), `CompletionIndicator` (ring animation), `ResumeUpload` (drag state), `ProfileForm` (state management)
- API routes that need auth use `getAuthenticatedClient()` from `lib/auth-helpers.ts` — handles access token + refresh token from cookies with automatic session refresh
- PDF-generating API routes return buffer directly (not JSON URL) to avoid cross-origin CORS issues with InsForge storage

### Find Jobs Page

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Find Jobs Page` | `app/find-jobs/page.tsx` | Server component: Navbar → `main.flex-1.px-6.py-8` → Footer. Content `max-w-6xl mx-auto space-y-6`. Heading `text-xl font-semibold text-text-primary`. Renders `FindJobsClient`. |
| `FindJobsClient` | `components/find-jobs/FindJobsClient.tsx` | Client component. Manages search state, filter, sort, pagination. Contains `SearchControls` → `JobFilters` → `JobsTable` → `JobsPagination` in a `rounded-xl border border-border bg-surface` card. Jobs per page: 6. Filter/sort handled server-side via `GET /api/agent/find?filter=&sort=`. Text search and pagination handled client-side. Debounced search (300ms). Filter/sort changes trigger immediate refetch. |
| `SearchControls` | `components/find-jobs/SearchControls.tsx` | `rounded-xl border border-border bg-surface px-6 py-5`. Two-column grid `grid-cols-1 gap-4 sm:grid-cols-2`. Labels: `text-xs font-bold uppercase tracking-wider text-text-muted`. Inputs: `h-10 rounded-lg border border-border bg-surface pl-10 pr-3 text-sm`. Search icon: `absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted`. Find Jobs button: `bg-success hover:bg-success-dark`. Message banner accepts `messageType` prop: `"success"` → `bg-success-lightest text-success-foreground`, `"warning"` → `bg-warning-lightest text-warning-foreground`, `"error"` → `bg-error-lightest text-error-foreground`. Accepts `isLoading` prop from parent. |
| `JobFilters` | `components/find-jobs/JobFilters.tsx` | Flex row `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. Text input same as search. Select dropdowns: `h-10 appearance-none rounded-lg border border-border bg-surface pr-8 pl-3 text-sm font-medium`. Chevron: `absolute right-2.5 top-1/2 h-4 w-4`. Three dropdowns: Match filter (all/high/low), Status filter (all/saved/applied/interviewing/rejected), Sort (score/newest/oldest). |
| `JobsTable` | `components/find-jobs/JobsTable.tsx` | Full width table. Header: `border-b border-border`, columns `text-xs font-medium uppercase tracking-wider text-text-secondary`. Rows: `border-b border-border hover:bg-surface-secondary cursor-pointer`. Company: circular avatar `h-9 w-9 rounded-full text-sm font-semibold text-white` with dynamic background color using tokens (`bg-accent`, `bg-info`, `bg-success`, `bg-warning`, `bg-error`). Match score: `h-1 w-20 rounded-full bg-border` track, fill color by range (≥MATCH_THRESHOLD `bg-success`, ≥MATCH_THRESHOLD-10 `bg-info`, below `bg-warning`). Status badge: `rounded-full px-2.5 py-0.5 text-xs font-medium` with colors from `STATUS_COLORS` map (saved: `bg-surface-tertiary text-text-secondary`, applied: `bg-info-lightest text-info-foreground`, interviewing: `bg-success-lightest text-success-foreground`, rejected: `bg-error-lightest text-error-foreground`). Source badge: `rounded-full bg-success-lightest px-2.5 py-0.5 text-xs font-medium text-success-foreground`. |
| `JobsPagination` | `components/find-jobs/JobsPagination.tsx` | `flex items-center justify-between px-4 py-4`. Text: `text-sm text-text-secondary`. Prev/Next buttons: `rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium`. Page numbers: `h-9 w-9 rounded-lg text-sm font-medium`. Active page: `bg-accent text-white`. Inactive: `border border-border bg-surface hover:bg-surface-secondary`. |

**Pattern notes:**
- Find Jobs page uses `max-w-6xl` (same as dashboard) — slightly wider than profile's `max-w-282`
- Job list section uses the same card pattern: `rounded-xl border border-border bg-surface`
- Filter bar separated from table by `border-b border-border`
- Company avatars use dynamic color based on company name hash (consistent per company) using token colors
- Match score bar track: `h-1 w-20` (4px height, 80px width), fill color by score range using tokens
- Source badge uses `bg-success-lightest text-success-foreground` tokens
- Pagination follows standard pattern: Prev/Next with page number buttons
- All filter/sort state managed in `FindJobsClient` — wired to real API
- All data served from InsForge DB via `GET /api/agent/find` — no mock data
- JobsTable rows are clickable — `router.push(/find-jobs/${id})` on row click

### Dashboard Page

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Dashboard Page` | `app/dashboard/page.tsx` | Server component: Navbar → `main.flex-1.px-6.py-8` → Footer. Content `max-w-6xl mx-auto space-y-6`. Grid layout: `grid grid-cols-1 gap-6 lg:grid-cols-2` for RecentActivity + AnalyticsCharts. |
| `StatsBar` | `components/dashboard/StatsBar.tsx` | Client component. Accepts `stats: DashboardStats` prop (`{ totalJobs, avgMatchRate, companiesResearched, jobsThisWeek, appliedCount }`). 5 stat cards in `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5`. Each card: `rounded-2xl border border-border bg-surface p-6`. Icon: `rounded-full bg-accent/10 p-3` with `text-accent` icon. Label: `text-xs font-medium text-text-muted`. Value: `text-2xl font-semibold text-text-primary`. Icons: BriefcaseIcon, Target, Building2, Calendar, Send from lucide-react. Exports `DashboardStats` type. |
| `RecentActivity` | `components/dashboard/RecentActivity.tsx` | Server component. Accepts `activities: Activity[]` prop. `rounded-2xl border border-border bg-surface p-6`. Title: `text-sm font-semibold text-text-primary`. Activity dots: `h-3 w-3 rounded-full` with color `bg-success` (search) or `bg-accent` (research). Text: `text-sm text-text-primary`. Timestamp: `text-xs text-text-muted` via `timeAgo()`. Space between entries: `space-y-4`. Empty state: `text-sm text-text-muted` "No activity yet." Exports `Activity` type: `{ id, text, timestamp, type: "search" \| "research" }`. |
| `AnalyticsCharts` | `components/dashboard/AnalyticsCharts.tsx` | Client component. Accepts `jobsFoundData`, `matchScoreData`, `companyResearchData` props. Internal 2-column grid: `grid grid-cols-1 gap-6 lg:grid-cols-2`. Left: Company Research Activity `rounded-2xl border border-border bg-surface p-6` with `BarChart` (`var(--color-success)` bars, radius 4px). Right: Jobs Found Over Time (top) `rounded-2xl` with `AreaChart` (`var(--color-accent)` stroke, gradient fill), Match Score Distribution (bottom) `rounded-2xl` with `BarChart` (`var(--color-success)` bars). Grid lines use `var(--color-border)`. Axis labels use `var(--color-text-muted)`. Empty state per chart: centered message when data array is empty. Date labels formatted as "Jul 8" via `formatDayLabel()`. Exports `ChartData` type. |
| `SkillsGapChart` | `components/dashboard/SkillsGapChart.tsx` | Client component. Accepts `skills: SkillsGapData` prop (`{ skill: string; count: number }[]`). Full-width card: `rounded-2xl border border-border bg-surface p-6`. Horizontal `BarChart` (layout="vertical") with `var(--color-warning)` bars, radius `[0, 4, 4, 0]`. YAxis shows skill names (width 120), XAxis shows frequency count. Grid lines use `var(--color-border)`. Axis labels use `var(--color-text-muted)`. Empty state: centered message when data array is empty. Top 10 skills by frequency, case-normalised. Exports `SkillsGapData` type. |

**Pattern notes:**
- Dashboard uses `max-w-6xl` (same as Find Jobs and Job Details pages)
- StatsBar cards use `rounded-2xl` (larger radius than profile/job cards which use `rounded-xl`)
- Activity dots use solid colored circles (not the ring pattern from JobFilters badges)
- Charts use recharts library (`BarChart`, `AreaChart`, `ResponsiveContainer`)
- All dashboard components are client components (recharts requires browser rendering)
- RecentActivity is now a server component (no hooks needed, accepts props)
- All dashboard data wired to real sources: StatsBar, RecentActivity, and AnalyticsCharts all from InsForge DB (single `jobs` table query)
- Charts use CSS custom properties (`var(--color-success)`, `var(--color-accent)`, etc.) instead of hardcoded hex values
- Empty state per chart — centered message when no data exists
- Date labels on time-series charts formatted as "Jul 8" via `formatDayLabel()` helper
- Chart data computed server-side in `app/dashboard/page.tsx` via `computeChartData()` from the same jobs array used for stats
- `ChartData` type exported from `AnalyticsCharts.tsx` for use by the dashboard page
- SkillsGapChart sits full-width below the 2-column grid — horizontal bar chart needs room for skill name labels
- SkillsGapChart uses `var(--color-warning)` (orange) to visually distinguish "gap" data from match/research charts
- Skills data aggregated server-side via `computeSkillsGap()` from the same jobs array — top 10 by frequency, case-normalised

### Job Details Page

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Job Details Page` | `app/find-jobs/[id]/page.tsx` | Server component: fetches job by ID from InsForge DB, renders Navbar → `JobDetailsClient` → Footer. Calls `notFound()` if job not found. |
| `JobDetailsClient` | `components/job-details/JobDetailsClient.tsx` | Client component. `rounded-xl border border-border bg-surface px-6 py-5` main card. Back link: `text-sm font-medium text-accent hover:text-accent-dark`. Job title: `text-3xl font-bold text-text-slate`. Company badge: `rounded-full bg-surface-secondary px-3 py-1 text-sm font-medium text-text-primary`. Match score badge: `rounded-full px-4 py-2 text-sm font-semibold text-white` with `bg-success`/`bg-info`/`bg-warning`. Score text: `text-lg font-bold text-text-slate`. Status selector: horizontal row of `rounded-full px-4 py-2 text-sm font-medium` buttons, active uses status color from `STATUS_COLORS`, inactive uses `bg-surface-secondary text-text-secondary hover:bg-surface-tertiary`. Optimistic update on click via `updateJobStatus` server action. Apply button: `bg-success-dark hover:bg-success-darker`. Visit Job Post: `border border-border bg-surface hover:bg-surface-secondary`. Summary boxes: `rounded-lg border border-border bg-surface-secondary p-4`. Section headings: `text-lg font-semibold text-text-slate`. Bullet items: `text-sm text-text-secondary` with checkmark icons in `text-success`/`text-accent`/`text-text-muted`. Benefits: same checkmark pattern. Large Apply Now: `bg-success-dark w-full sm:w-auto`. CompanyResearchCard rendered as sibling below main card. |
| `AiMatchAnalysis` | `components/job-details/JobDetailsClient.tsx` | Inline helper. `rounded-lg border border-border bg-surface-secondary p-5` card. Score bar: `h-2 w-full rounded-full bg-border` track, fill uses `getMatchScoreColor()`. Matched skills: `rounded-full bg-success-lightest` circle with `text-success` checkmark. Missing skills: `rounded-full bg-error-lightest` circle with `text-error` X icon. Skills grid: `grid-cols-1 gap-6 sm:grid-cols-2`. Match reason renders parsed markdown via `parseMarkdown()`. |
| `CompanyResearchCard` | `components/job-details/CompanyResearchCard.tsx` | Separate file. Renders as sibling below main job card (not nested). Uses `space-y-4` vertical stack. Header: building icon in `h-8 w-8 rounded-lg bg-surface-tertiary` + `text-base font-semibold text-text-primary`. Each dossier section is a separate card: `rounded-xl border border-border bg-surface p-5 border-l-[4px]` with color-coded left accent: Overview `border-l-accent`, Tech Stack `border-l-info`, Culture `border-l-warning`, Why This Role `border-l-accent`, Your Edge `border-l-success`, Gaps `border-l-warning`, Smart Questions `border-l-info`, Interview Prep `border-l-accent`, Sources `border-l-border`. Section headers: `text-xs font-bold uppercase tracking-wider text-text-muted`. All text rendered via `MarkdownText` component using `parseMarkdown()`. Tech Stack pills: `rounded-full bg-surface-tertiary px-3 py-1 text-xs font-medium text-text-primary`. Sources: clickable links `text-accent hover:text-accent-dark hover:underline` when URL detected. Empty state: `rounded-xl border border-dashed border-border bg-surface p-8 text-center`, Research Company button `bg-success-dark`. |

**Pattern notes:**
- Job Details page uses `max-w-6xl` (same as Find Jobs page)
- `JobDetailsClient` has inline helpers (`SummaryBox`, `AiMatchAnalysis`) — `CompanyResearchCard` extracted to separate file due to complexity
- CompanyResearchCard is a sibling below the main job card, not nested inside it
- Each dossier section is its own `rounded-xl` card with a 4px left accent border color-coded by section type
- `MarkdownText` component renders parsed markdown via `parseMarkdown()` from `lib/utils.ts` — handles `**bold**`, `*italic*`, `` `code` ``, and `- bullet` lists
- `normalizeDossier()` handles Gemini type drift (string vs string[] for array fields) — defined inside `CompanyResearchCard.tsx`
- Four summary boxes in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` grid
- Match score colors follow existing `MATCH_THRESHOLD` system (≥70 green, ≥60 blue, <60 orange)
- "Back to Jobs" link uses arrow-left icon, navigates to `/find-jobs`
- AI Match Analysis section renders `match_reason` text (parsed markdown) + `matched_skills`/`missing_skills` comparison — positioned after Role Description, before Responsibilities
- Matched skills use green checkmarks in `bg-success-lightest` circles; missing skills use red X icons in `bg-error-lightest` circles
- AI Match Analysis renders nothing if `match_reason` is null and both skill arrays are empty
- Company Research shows empty state (Research Company button) when `company_research` is null
- All job data served from InsForge DB via server component — no client-side fetching needed
- Job details page is protected (same proxy as /find-jobs)
- SummaryBox uses `useState` for expand/collapse toggle — shows 3 lines by default (`line-clamp-3`), "Read more" button when `content.length > 150`, "Show less" to collapse
- Role Description section includes "View Full Posting →" link to `source_url` (Adzuna truncates descriptions in search results)
