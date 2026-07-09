import { searchAdzunaJobs, type AdzunaJob } from "@/lib/adzuna";
import { getGeminiClient } from "@/lib/gemini-client";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import type { createServerClient } from "@insforge/sdk/ssr";

type InsForgeClient = ReturnType<typeof createServerClient>;

type JobScore = {
  matchScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

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

const SCORING_PROMPT = `You are a job matching assistant. Given a job listing and a candidate profile, score how well the candidate matches this job.

Return ONLY valid JSON with these fields:
- matchScore: number (0-100)
- matchReason: string (one paragraph explanation, 2-3 sentences)
- matchedSkills: string[] (skills the user has that this job requires)
- missingSkills: string[] (skills this job requires that the user lacks)

Rules:
- Be honest — not every job is a strong match
- Consider skills, experience level, and role relevance
- matchScore below 40 means poor fit, 40-70 moderate, 70+ strong
- Keep matchReason concise and specific
- Return ONLY the JSON, no markdown, no explanation`;

function extractRetryDelay(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "errorDetails" in error &&
    Array.isArray(error.errorDetails)
  ) {
    const retryInfo = error.errorDetails.find(
      (d: Record<string, unknown>) =>
        d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
    );
    if (retryInfo && typeof retryInfo.retryDelay === "string") {
      const seconds = parseInt(retryInfo.retryDelay.replace("s", ""), 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  }
  return null;
}

async function generateWithRetry(
  model: ReturnType<ReturnType<typeof getGeminiClient>["getGenerativeModel"]>,
  prompt: string[],
  retries = 5,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: number }).status
          : null;

      const isTransient = status === 503 || status === 429 || status === 500;

      if (isTransient && attempt < retries) {
        const apiDelay = extractRetryDelay(error);
        // 503 = sustained demand → longer delays; 429/500 = brief → shorter
        const baseDelay = status === 503 ? 3000 : 1000;
        const delay = apiDelay ?? baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

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
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const profileSummary = JSON.stringify(
      {
        currentTitle: profile.current_title,
        experienceLevel: profile.experience_level,
        yearsExperience: profile.years_experience,
        skills: profile.skills,
        industries: profile.industries,
        workExperience: profile.work_experience,
        jobTitlesSeeking: profile.job_titles_seeking,
      },
      null,
      2,
    );

    const savedJobs: SavedJob[] = [];
    let retryDelay = 15000;

    for (let i = 0; i < adzunaJobs.length; i++) {
      const job = adzunaJobs[i];

      if (i > 0) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }

      try {
        const responseText = await generateWithRetry(model, [
          SCORING_PROMPT,
          `\n\nJob listing:\nTitle: ${job.title}\nCompany: ${job.company.display_name}\nLocation: ${job.location.display_name}\nDescription: ${job.description}\n\nCandidate profile:\n${profileSummary}`,
        ]);

        let score: JobScore;
        try {
          const cleaned = responseText
            .replace(/^```json\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          score = JSON.parse(cleaned);
        } catch {
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
