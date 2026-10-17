import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NeedsYou, PipelineStrip, TopMatches } from "@/components/dashboard/MissionControl";
import { getPipelineJobs, getNextActions, countByStatus } from "@/lib/pipeline";
import { createInsforgeServer } from "@/lib/insforge-server";
import { StatsBar } from "@/components/dashboard/StatsBar";
import type { DashboardStats } from "@/components/dashboard/StatsBar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import type { Activity } from "@/components/dashboard/RecentActivity";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";
import type { ChartData } from "@/components/dashboard/AnalyticsCharts";
import { SkillsGapChart } from "@/components/dashboard/SkillsGapChart";
import type { SkillsGapData } from "@/components/dashboard/SkillsGapChart";

type JobRow = {
  match_score: number | null;
  company_research: unknown | null;
  found_at: string | null;
  missing_skills: string[] | null;
  status: string | null;
};

type DashboardResult = {
  stats: DashboardStats;
  jobs: JobRow[];
};

async function getDashboardData(userId: string): Promise<DashboardResult> {
  const empty: DashboardResult = {
    stats: { totalJobs: 0, avgMatchRate: 0, companiesResearched: 0, jobsThisWeek: 0, appliedCount: 0 },
    jobs: [],
  };

  try {
    const insforge = await createInsforgeServer();
    const { data: jobs, error } = await insforge.database
      .from("jobs")
      .select("match_score, company_research, found_at, missing_skills, status")
      .eq("user_id", userId);

    if (error) {
      console.error("[dashboard] Jobs query error:", error);
      return empty;
    }

    const list = (jobs ?? []) as JobRow[];
    const totalJobs = list.length;

    const avgMatchRate =
      totalJobs > 0
        ? Math.round(
            list.reduce((sum, j) => sum + ((j.match_score as number) ?? 0), 0) /
              totalJobs,
          )
        : 0;

    const companiesResearched = list.filter(
      (j) => j.company_research !== null,
    ).length;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const jobsThisWeek = list.filter(
      (j) => new Date(j.found_at as string) >= oneWeekAgo,
    ).length;

    const appliedCount = list.filter((j) => j.status === "applied").length;

    return {
      stats: { totalJobs, avgMatchRate, companiesResearched, jobsThisWeek, appliedCount },
      jobs: list,
    };
  } catch {
    console.error("[dashboard] Data query failed");
    return empty;
  }
}

function computeChartData(jobs: JobRow[]): ChartData {
  // Jobs Found Over Time — last 30 days, grouped by day
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const jobsByDay: Record<string, number> = {};

  for (const job of jobs) {
    if (!job.found_at) continue;
    const date = new Date(job.found_at);
    if (date < thirtyDaysAgo) continue;
    const key = job.found_at.slice(0, 10); // "YYYY-MM-DD"
    jobsByDay[key] = (jobsByDay[key] ?? 0) + 1;
  }

  const jobsFoundData = Object.entries(jobsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Match Score Distribution — bucket all match scores
  const buckets: Record<string, number> = {
    "50-60": 0,
    "60-70": 0,
    "70-80": 0,
    "80-90": 0,
    "90-100": 0,
  };

  for (const job of jobs) {
    const score = job.match_score;
    if (score == null) continue;
    if (score >= 50 && score < 60) buckets["50-60"]++;
    else if (score >= 60 && score < 70) buckets["60-70"]++;
    else if (score >= 70 && score < 80) buckets["70-80"]++;
    else if (score >= 80 && score < 90) buckets["80-90"]++;
    else if (score >= 90 && score <= 100) buckets["90-100"]++;
    else if (score < 50) buckets["50-60"]++;
    else if (score > 100) buckets["90-100"]++;
  }

  const matchScoreData = Object.entries(buckets).map(
    ([range, count]) => ({ range, count }),
  );

  // Company Research Activity — last 7 days, grouped by day
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const researchByDay: Record<string, number> = {};

  for (const job of jobs) {
    if (!job.company_research || !job.found_at) continue;
    const date = new Date(job.found_at);
    if (date < sevenDaysAgo) continue;
    const key = job.found_at.slice(0, 10);
    researchByDay[key] = (researchByDay[key] ?? 0) + 1;
  }

  const companyResearchData = Object.entries(researchByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { jobsFoundData, matchScoreData, companyResearchData };
}

function computeSkillsGap(jobs: JobRow[]): SkillsGapData {
  const freq: Record<string, number> = {};
  for (const job of jobs) {
    const skills = job.missing_skills ?? [];
    for (const s of skills) {
      if (typeof s !== "string") continue;
      const normalised = s.trim().toLowerCase();
      if (normalised) freq[normalised] = (freq[normalised] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }));
}

async function getRecentActivity(userId: string): Promise<Activity[]> {
  try {
    const insforge = await createInsforgeServer();

    // Query completed job searches from agent_runs
    const { data: runs } = await insforge.database
      .from("agent_runs")
      .select("id, job_title_searched, jobs_found, started_at, status")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(10);

    // Query jobs with company research populated
    const { data: researchedJobs } = await insforge.database
      .from("jobs")
      .select("id, company, company_research, found_at")
      .eq("user_id", userId)
      .not("company_research", "is", null)
      .order("found_at", { ascending: false })
      .limit(10);

    const activities: Activity[] = [];

    for (const run of runs ?? []) {
      activities.push({
        id: `run-${run.id}`,
        text: `Found ${run.jobs_found} jobs for ${run.job_title_searched}`,
        timestamp: run.started_at,
        type: "search",
      });
    }

    for (const job of researchedJobs ?? []) {
      activities.push({
        id: `research-${job.id}`,
        text: `Researched ${job.company}`,
        timestamp: job.found_at,
        type: "research",
      });
    }

    // Sort by timestamp descending, take top 8
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return activities.slice(0, 8);
  } catch {
    console.error("[dashboard] Recent activity query failed");
    return [];
  }
}

export default async function DashboardPage() {
  let userId: string | undefined;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    userId = data?.user?.id;
  } catch {
    // Not authenticated — proxy.ts redirects before we get here
  }

  const emptyStats: DashboardStats = { totalJobs: 0, avgMatchRate: 0, companiesResearched: 0, jobsThisWeek: 0, appliedCount: 0 };

  const [{ stats, jobs }, pipelineJobs, activities] = userId
    ? await Promise.all([getDashboardData(userId), getPipelineJobs(userId), getRecentActivity(userId)])
    : [{ stats: emptyStats, jobs: [] }, [], []];

  const chartData = computeChartData(jobs);
  const skillsGap = computeSkillsGap(jobs);

  const nextActions = getNextActions(pipelineJobs);
  const counts = countByStatus(pipelineJobs);
  const topMatches = pipelineJobs.filter((j) => j.status === "saved").slice(0, 5);

  const summary =
    nextActions.length === 0
      ? "You're all caught up."
      : `${nextActions.length} ${nextActions.length === 1 ? "thing needs" : "things need"} your attention.`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Home"
        description={summary}
        actions={
          <Link
            href="/find-jobs"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-dark"
          >
            <Search className="h-4 w-4" />
            Find jobs
          </Link>
        }
      />

      <PipelineStrip counts={counts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NeedsYou actions={nextActions} />
        </div>
        <div className="lg:col-span-2">
          <TopMatches jobs={topMatches} />
        </div>
      </div>

      <section aria-labelledby="insights-heading" className="space-y-6">
        <h2 id="insights-heading" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Insights
        </h2>
        <StatsBar stats={stats} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecentActivity activities={activities} />
          <AnalyticsCharts
            jobsFoundData={chartData.jobsFoundData}
            matchScoreData={chartData.matchScoreData}
            companyResearchData={chartData.companyResearchData}
          />
        </div>
        <SkillsGapChart skills={skillsGap} />
      </section>
    </div>
  );
}
