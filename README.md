<div align="center">

# JobPilot

**AI-Powered Job Hunting Assistant**

Set up your profile once. JobPilot discovers relevant jobs, scores them against your skills, researches each company, and prepares interview materials — so you just decide which ones to apply to.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

![Dashboard](public/images/dashboard-demo.png)

## Features

**Job discovery**
1. Job search by title and location via the Adzuna API
2. AI match score (0–100) per job with matched and missing skills (Gemini)
3. Job list filtering by status, sorting and pagination
4. Live progress modal while searches and research run
5. "Apply Now" link to the original posting

**Company research and prep**
6. Company research agent: a headless browser (Stagehand) reads the company site and builds a dossier — overview, tech stack, culture, why the role exists, your edge, gaps, questions to ask, sources
7. Interview prep: STAR behavioral answers, technical questions, talking points, questions to ask, day-one readiness, closing strategy
8. Email templates (networking, follow-up, thank-you) with copy to clipboard

**Profile and resume**
9. Profile form: contact info, experience, education, skills, industries, preferences
10. Profile completion indicator
11. Resume upload to a private storage bucket, with in-app viewing
12. AI resume extraction that fills in your profile from a PDF
13. PDF resume generated from your profile

**Tracking and dashboard**
14. Applications board with pipeline columns (Saved → Applied → Interviewing → Closed)
15. Status updates from the board
16. "Needs you" panel and pipeline counts
17. Stats bar: jobs found, average match, companies researched, jobs this week, applications sent
18. Charts: jobs found over time, research activity, match score distribution
19. Skills gap chart (most frequently missing skills)
20. Recent activity feed

**App**
21. Google and GitHub sign-in, protected routes with session refresh, and row-level security on every table
22. Command palette (⌘K / Ctrl+K) for navigation, quick filters and theme switching
23. Dark mode (follows the system, with manual toggle) and PostHog analytics

## Tech Stack

Next.js 16 (App Router) · [InsForge](https://insforge.dev/) (auth, Postgres, storage) · Gemini 2.5 Flash · Adzuna API · Stagehand · Tailwind CSS 4 · Recharts · @react-pdf/renderer · PostHog

## Setup

Requires Node.js 18+, an InsForge project, and Gemini and Adzuna API keys. PostHog is optional.

1. **Install**

   ```bash
   git clone https://github.com/UzairJIqbal/Job_Pilot.git
   cd Job_Pilot
   npm install
   ```

2. **Environment variables.** Copy [`.env.example`](.env.example) to `.env` and fill it in. Never commit `.env`. `INSFORGE_API_KEY` is a server-only admin key.

   ```bash
   cp .env.example .env
   ```

3. **InsForge MCP credentials (optional).** The InsForge MCP server reads `INSFORGE_API_KEY` and `INSFORGE_API_BASE_URL` from your shell, not from `.env` (see [`.mcp.example.json`](.mcp.example.json)). Either export them from `.env`, or keep the key in macOS Keychain and load it in your shell profile:

   ```bash
   security add-generic-password -s jobpilot-insforge -a "$USER" -w   # prompts for the key
   export INSFORGE_API_KEY="$(security find-generic-password -s jobpilot-insforge -w)"
   ```

4. **Database.** The schema is in [`migrations/`](migrations/). Auth settings (OAuth redirect URLs, password rules) are in [`insforge.toml`](insforge.toml).

   ```bash
   npx -y @insforge/cli link                      # once, to pick your project
   npx -y @insforge/cli db migrations up --all
   npx -y @insforge/cli storage create-bucket resumes --private
   ```

5. **Run** with `npm run dev` and open http://localhost:3000.

## License

MIT
