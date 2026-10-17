import type { InsForgeClient } from "@insforge/sdk";
import { MATCH_THRESHOLD } from "@/lib/utils";
import type { ApplicationAnswer, ApplicationState } from "@/lib/applications";

/** One drafted application, as the queue lists it. */
export type QueueItem = {
  id: string;
  jobId: string;
  state: ApplicationState;
  title: string;
  company: string;
  location: string | null;
  matchScore: number | null;
  ats: string | null;
  flagged: number;
  answered: number;
  coverPreview: string;
  error: string | null;
  updatedAt: string;
};

/** A strong match with a known ATS that hasn't been tailored yet. */
export type DraftCandidate = {
  jobId: string;
  title: string;
  company: string;
  matchScore: number;
};

type ApplicationListRow = {
  id: string;
  job_id: string;
  state: ApplicationState;
  answers: ApplicationAnswer[];
  cover_letter: string | null;
  error: string | null;
  updated_at: string;
};

type JobListRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  match_score: number | null;
  ats: string | null;
  status: string | null;
};

export async function getQueue(
  client: InsForgeClient,
  userId: string,
): Promise<{ items: QueueItem[]; candidates: DraftCandidate[] }> {
  const [appsRes, jobsRes] = await Promise.all([
    client.database
      .from("applications")
      .select("id, job_id, state, answers, cover_letter, error, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500),
    client.database
      .from("jobs")
      .select("id, title, company, location, match_score, ats, status")
      .eq("user_id", userId)
      .limit(1000),
  ]);

  const apps = (appsRes.data ?? []) as ApplicationListRow[];
  const jobs = new Map(((jobsRes.data ?? []) as JobListRow[]).map((j) => [j.id, j]));

  const items: QueueItem[] = [];
  for (const a of apps) {
    const job = jobs.get(a.job_id);
    if (!job) continue;
    items.push({
      id: a.id,
      jobId: a.job_id,
      state: a.state,
      title: job.title,
      company: job.company,
      location: job.location,
      matchScore: job.match_score,
      ats: job.ats,
      flagged: a.answers.filter((x) => x.needsReview).length,
      answered: a.answers.length,
      coverPreview: (a.cover_letter ?? "").replace(/\s+/g, " ").slice(0, 180),
      error: a.error,
      updatedAt: a.updated_at,
    });
  }

  const tailored = new Set(apps.map((a) => a.job_id));
  const candidates = [...jobs.values()]
    .filter(
      (j) =>
        !tailored.has(j.id) &&
        j.ats &&
        (j.match_score ?? 0) >= MATCH_THRESHOLD &&
        (!j.status || j.status === "saved"),
    )
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, 10)
    .map((j) => ({ jobId: j.id, title: j.title, company: j.company, matchScore: j.match_score ?? 0 }));

  return { items, candidates };
}
