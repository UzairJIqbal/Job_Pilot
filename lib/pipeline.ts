import { createInsforgeServer } from "@/lib/insforge-server";
import { normalizeStatus, type JobStatus } from "@/lib/job-status";
import { MATCH_THRESHOLD } from "@/lib/utils";

/** Lightweight job shape used by the dashboard and the applications board. */
export type PipelineJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  matchScore: number;
  status: JobStatus;
  foundAt: string;
  hasResearch: boolean;
  hasPrep: boolean;
  hasEmails: boolean;
};

export type NextAction = {
  id: string;
  kind: "prep" | "apply" | "follow-up";
  title: string;
  detail: string;
  href: string;
  cta: string;
};

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  match_score: number | null;
  status: string | null;
  found_at: string;
  company_research: unknown | null;
  interview_prep: unknown | null;
  email_templates: unknown | null;
};

export async function getPipelineJobs(userId: string): Promise<PipelineJob[]> {
  try {
    const insforge = await createInsforgeServer();
    const { data, error } = await insforge.database
      .from("jobs")
      .select(
        "id, title, company, location, match_score, status, found_at, company_research, interview_prep, email_templates",
      )
      .eq("user_id", userId)
      .order("match_score", { ascending: false });

    if (error) {
      console.error("[pipeline] Jobs query error:", error);
      return [];
    }

    return ((data ?? []) as JobRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      matchScore: row.match_score ?? 0,
      status: normalizeStatus(row.status),
      foundAt: row.found_at,
      hasResearch: row.company_research !== null,
      hasPrep: row.interview_prep !== null,
      hasEmails: row.email_templates !== null,
    }));
  } catch {
    console.error("[pipeline] Jobs query failed");
    return [];
  }
}

const FOLLOW_UP_AFTER_DAYS = 7;

/**
 * Derive the "needs you" queue: the few things worth doing next, most
 * time-sensitive first. Interviews beat fresh applications, which beat
 * follow-ups on roles that have gone quiet.
 */
export function getNextActions(jobs: PipelineJob[], limit = 5): NextAction[] {
  const actions: NextAction[] = [];
  const staleBefore = Date.now() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000;

  for (const job of jobs) {
    if (job.status === "interviewing" && !job.hasPrep) {
      actions.push({
        id: `prep-${job.id}`,
        kind: "prep",
        title: `Prep for your ${job.company} interview`,
        detail: job.title,
        href: `/find-jobs/${job.id}#interview-prep`,
        cta: "Prep",
      });
    }
  }

  for (const job of jobs) {
    if (job.status === "saved" && job.matchScore >= MATCH_THRESHOLD) {
      actions.push({
        id: `apply-${job.id}`,
        kind: "apply",
        title: `${job.title} at ${job.company}`,
        detail: `${job.matchScore}% match — not applied yet`,
        href: `/find-jobs/${job.id}`,
        cta: "Review",
      });
    }
  }

  for (const job of jobs) {
    if (job.status === "applied" && !job.hasEmails && new Date(job.foundAt).getTime() < staleBefore) {
      actions.push({
        id: `follow-${job.id}`,
        kind: "follow-up",
        title: `Follow up with ${job.company}`,
        detail: `${job.title} — no follow-up drafted`,
        href: `/find-jobs/${job.id}#email-templates`,
        cta: "Draft",
      });
    }
  }

  return actions.slice(0, limit);
}

export function countByStatus(jobs: PipelineJob[]): Record<JobStatus, number> {
  const counts: Record<JobStatus, number> = { saved: 0, applied: 0, interviewing: 0, rejected: 0 };
  for (const job of jobs) counts[job.status]++;
  return counts;
}
