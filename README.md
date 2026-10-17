<div align="center">

# JobPilot

**AI-Powered Job Hunting Assistant**

Set up your profile once. JobPilot discovers relevant jobs, scores them against your skills, researches each company, and prepares interview materials — so you just decide which ones to apply to.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## Overview

Job hunting is repetitive — reading dozens of job descriptions, deciding if a role fits, researching each company from scratch. JobPilot eliminates that preparation work.

The agent finds jobs via Adzuna, scores each one against your actual skills using Gemini, researches companies across their public web pages with browser automation, and generates interview prep materials and application email templates. You review everything and apply with one click.

## Features

- **AI Job Matching** — Gemini scores each job 0–100 against your profile, with matched/missing skills breakdown
- **Company Research Agent** — Automated browser research (Playwright + Stagehand) builds structured dossiers: tech stack, culture, why the role exists, interview prep
- **Interview Prep** — STAR-format behavioral questions, technical questions, talking points, and closing strategies
- **Email Templates** — Networking outreach, follow-up, and thank-you emails with copy-to-clipboard
- **Resume Management** — Upload existing resume with AI extraction, or generate a professional PDF from your profile
- **Application Tracker** — Track job statuses (Saved → Applied → Interviewing → Rejected) across your pipeline
- **Dashboard Analytics** — Stats, recent activity, match score distribution, skills gap analysis
- **Dark Mode** — System-aware theme with manual toggle

## Screenshots

![Dashboard](public/images/dashboard-demo.png)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Backend | [InsForge](https://insforge.app/) — Auth, Database, Storage |
| AI Model | [Google Gemini 2.5 Flash](https://ai.google.dev/) |
| Job Discovery | [Adzuna API](https://developer.adzuna.com/) |
| Browser Automation | [Playwright](https://playwright.dev/) + [Stagehand](https://stagehand.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Charts | [Recharts](https://recharts.org/) |
| PDF Generation | [@react-pdf/renderer](https://react-pdf.org/) |
| Analytics | [PostHog](https://posthog.com/) |

## Getting Started

### Prerequisites

- Node.js 18+
- An [InsForge](https://insforge.app/) project (provides auth, database, and storage)
- A [Google Gemini API key](https://ai.google.dev/)
- An [Adzuna API key](https://developer.adzuna.com/)
- A [PostHog](https://posthog.com/) project (optional, for analytics)

### Installation

```bash
git clone https://github.com/UzairJIqbal/Job_Pilot.git
cd Job_Pilot
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

`NEXT_PUBLIC_INSFORGE_URL` and `NEXT_PUBLIC_INSFORGE_ANON_KEY` come from your InsForge project. `INSFORGE_API_KEY` is an admin key — keep it server-only and never commit `.env`.

### Database Setup

The schema lives in [`migrations/`](migrations/) and is applied with the InsForge CLI:

```bash
npx -y @insforge/cli link                      # once, to pick your project
npx -y @insforge/cli db migrations up --all
npx -y @insforge/cli storage create-bucket resumes --private
```

| Table | Purpose |
|-------|---------|
| `profiles` | One row per user (`id` = auth user id): contact info, experience, skills, target titles, preferences, resume URL |
| `jobs` | Scored listings. `status` (`saved` → `applied` → `interviewing` / `rejected`) is the application pipeline |
| `agent_runs` | One row per job search |
| `agent_logs` | Activity feed for searches and per-job agents |

Every table has row-level security restricting users to their own rows. Resumes are stored in the private `resumes` bucket at `{user_id}/resume.pdf`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
/
├── app/                    # Pages and API routes
│   ├── (auth)/             # Login + OAuth callback
│   ├── dashboard/          # Overview, stats, analytics
│   ├── find-jobs/          # Search + job listings
│   │   └── [id]/           # Individual job details
│   ├── profile/            # Profile form + resume management
│   └── api/agent/          # Agent API routes
├── agent/                  # AI agent logic
│   ├── adzuna.ts           # Job discovery + scoring
│   ├── research.ts         # Company research (Playwright)
│   ├── interview-prep.ts   # Interview materials
│   └── email-templates.ts  # Application emails
├── actions/                # Server Actions
├── components/             # UI components
├── lib/                    # Clients + utilities
└── types/                  # Shared TypeScript types
```

## How It Works

1. **Sign up** with Google or GitHub OAuth
2. **Complete your profile** — skills, experience, preferences (or let AI extract from your resume)
3. **Search for jobs** — enter title + location, agent discovers and scores matches
4. **Research companies** — one-click browser research builds a structured dossier
5. **Prepare for interviews** — AI generates STAR questions, technical prep, and email templates
6. **Apply** — click through to the company's application page

## License

MIT
