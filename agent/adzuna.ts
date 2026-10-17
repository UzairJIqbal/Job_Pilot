import { searchAdzunaJobs, type AdzunaJob } from "@/lib/adzuna";
import {
  extractRetryDelay,
  getScoringModel,
  profileSummary as buildProfileSummary,
  scoreJob,
} from "@/agent/scoring";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import type { createServerClient } from "@insforge/sdk/ssr";

type InsForgeClient = ReturnType<typeof createServerClient>;

type SavedJob = {
  id: string;
  user_id: string;
  run_id: string;
  source: string;
  source_url: string;
  external_apply_url: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  job_type: string;
  about_role: string;
  match_score: number;
  match_reason: string;
  matched_skills: string[];
  missing_skills: string[];
  found_at: string;
};

type DiscoverJobsResult =
  | { success: true; jobs: SavedJob[]; runId: string; message: string }
  | { success: false; error: string };

async function logAgentError(
  client: InsForgeClient,
  runId: string | null,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await client.database.from("agent_logs").insert({
    run_id: runId,
    level: "error",
    message,
    created_at: new Date().toISOString(),
  });
}

function formatSalary(job: AdzunaJob): string | null {
  if (!job.salary_min) return null;
  const min = Math.round(job.salary_min / 1000);
  const max = job.salary_max ? Math.round(job.salary_max / 1000) : min + 20;
  return `$${min}k - $${max}k`;
}

export async function discoverJobs(params: {
  jobTitle: string;
  location: string;
  userId: string;
  client: InsForgeClient;
}): Promise<DiscoverJobsResult> {
  const { jobTitle, location, userId, client } = params;

  try {
    // Create agent_run record
    const { data: runs, error: runError } = await client.database
      .from("agent_runs")
      .insert({
        user_id: userId,
        status: "running",
        job_title_searched: jobTitle,
        location_searched: location,
        jobs_found: 0,
        started_at: new Date().toISOString(),
      })
      .select();

    if (runError || !runs || runs.length === 0) {
      console.error("[agent/adzuna] failed to create run:", runError);
      return { success: false, error: "Failed to start job search" };
    }

    const runId = runs[0].id;

    // Fetch user profile for scoring
    const { data: profiles, error: profileError } = await client.database
      .from("profiles")
      .select("*")
      .eq("id", userId);

    if (profileError || !profiles || profiles.length === 0) {
      await client.database
        .from("agent_runs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", runId);
      return { success: false, error: "Could not load profile" };
    }

    const profile = profiles[0];

    // Fire job_search_started event
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "job_search_started",
      properties: { userId, jobTitle, location },
    });

    // Search Adzuna
    const adzunaJobs = await searchAdzunaJobs(jobTitle, location);

    if (adzunaJobs.length === 0) {
      await client.database
        .from("agent_runs")
        .update({
          status: "completed",
          jobs_found: 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      await shutdownPostHog();
      return {
        success: true,
        jobs: [],
        runId,
        message: "No jobs found matching your criteria",
      };
    }

    // Score each job with Gemini
    const model = getScoringModel();
    const profileSummary = buildProfileSummary(profile);

    const savedJobs: SavedJob[] = [];
    let retryDelay = 15000;

    for (let i = 0; i < adzunaJobs.length; i++) {
      const job = adzunaJobs[i];

      if (i > 0) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }

      try {
        const score = await scoreJob(
          model,
          {
            title: job.title,
            company: job.company.display_name,
            location: job.location.display_name,
            description: job.description,
          },
          profileSummary,
        );
        if (!score) {
          console.error("[agent/adzuna] JSON parse failed for:", job.title);
          continue;
        }

        // Check for existing job (deduplication)
        const { data: existingJobs } = await client.database
          .from("jobs")
          .select("id")
          .eq("user_id", userId)
          .eq("title", job.title)
          .eq("company", job.company.display_name)
          .limit(1);

        if (existingJobs && existingJobs.length > 0) {
          continue;
        }

        // Insert job to database
        const { data: insertedJobs, error: insertError } = await client.database
          .from("jobs")
          .insert({
            user_id: userId,
            run_id: runId,
            source: "search",
            source_url: job.redirect_url,
            external_apply_url: job.redirect_url,
            title: job.title,
            company: job.company.display_name,
            location: job.location.display_name,
            salary: formatSalary(job),
            job_type: job.contract_type || "fulltime",
            about_role: job.description,
            match_score: score.matchScore,
            match_reason: score.matchReason,
            fit_reason: score.fitReason || null,
            matched_skills: score.matchedSkills,
            missing_skills: score.missingSkills,
            found_at: new Date().toISOString(),
          })
          .select();

        if (!insertError && insertedJobs && insertedJobs.length > 0) {
          savedJobs.push(insertedJobs[0] as SavedJob);

          posthog.capture({
            distinctId: userId,
            event: "job_found",
            properties: {
              userId,
              source: "search",
              matchScore: score.matchScore,
            },
          });
        }
      } catch (error) {
        const apiDelay = extractRetryDelay(error);
        if (apiDelay) retryDelay = apiDelay;
        console.error("[agent/adzuna] scoring failed for job:", job.title, error);
        await logAgentError(client, runId, error);
      }
    }

    // Update agent_run
    await client.database
      .from("agent_runs")
      .update({
        status: "completed",
        jobs_found: savedJobs.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await shutdownPostHog();

    return {
      success: true,
      jobs: savedJobs,
      runId,
      message: `Found ${adzunaJobs.length} jobs and saved ${savedJobs.length} matches`,
    };
  } catch (error) {
    console.error("[agent/adzuna] exception:", error);
    try {
      await logAgentError(client, null, error);
    } catch {
      // best effort — don't crash on logging failure
    }
    return { success: false, error: "Job discovery failed" };
  }
}
