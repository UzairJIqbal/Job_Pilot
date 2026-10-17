import type { InsForgeClient } from "@insforge/sdk";
import { fetchBoards, hydrateJob, type BoardCompany, type BoardJob } from "@/lib/ats";
import { filterAndRank, isExcluded, type DiscoveryPrefs } from "@/lib/discovery-filters";
import { MAX_RETRY_DELAY_MS, extractRetryDelay, getScoringModel, profileSummary, scoreJob } from "@/agent/scoring";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";

// Gemini's free tier allows 5 requests a minute, so space calls out and keep
// each run small. Raise both with a paid key.
const SCORE_LIMIT = Number(process.env.DISCOVERY_SCORE_LIMIT) || 5;
const SCORE_DELAY_MS = Number(process.env.DISCOVERY_SCORE_DELAY_MS ?? 13_000);

export type BoardDiscoveryResult =
  | {
      success: true;
      runId: string;
      scanned: number;
      matched: number;
      saved: number;
      failedBoards: string[];
      message: string;
    }
  | { success: false; error: string };

export type ProfileRow = DiscoveryPrefs & Record<string, unknown> & { id: string };

async function log(
  client: InsForgeClient,
  userId: string,
  runId: string | null,
  level: "info" | "success" | "warning" | "error",
  message: string,
  jobId: string | null = null,
) {
  await client.database
    .from("agent_logs")
    .insert([{ user_id: userId, run_id: runId, job_id: jobId, level, message }]);
}

/** Map a normalised board posting onto a jobs row. */
export function boardJobRow(job: BoardJob, userId: string, runId: string | null, source: "board" | "url") {
  return {
    user_id: userId,
    run_id: runId,
    source,
    ats: job.ats,
    ats_job_id: job.atsJobId,
    source_url: job.url,
    external_apply_url: job.applyUrl,
    title: job.title,
    company: job.company,
    location: job.location || (job.remote ? "Remote" : null),
    salary: job.salary,
    job_type: job.jobType,
    about_role: job.description,
    posted_at: job.postedAt,
    found_at: new Date().toISOString(),
  };
}

/**
 * Scan every active company board, drop what the profile rules out, and
 * AI-score the best few new postings. Works with a user session client or an
 * admin client (cron); rows always carry an explicit user_id.
 */
export async function discoverFromBoards(params: {
  client: InsForgeClient;
  userId: string;
  scoreLimit?: number;
}): Promise<BoardDiscoveryResult> {
  const { client, userId } = params;
  const scoreLimit = params.scoreLimit ?? SCORE_LIMIT;

  const { data: profile, error: profileError } = await client.database
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: "Save your profile before scanning company boards." };
  }
  const prefs = profile as ProfileRow;
  if (!prefs.job_titles_seeking?.length && !prefs.current_title) {
    return { success: false, error: "Add the job titles you're seeking in your profile first." };
  }

  const { data: runs, error: runError } = await client.database
    .from("agent_runs")
    .insert([
      {
        user_id: userId,
        status: "running",
        job_title_searched: (prefs.job_titles_seeking?.length
          ? prefs.job_titles_seeking
          : [prefs.current_title]
        ).join(", "),
        location_searched: (prefs.preferred_locations ?? []).join(", ") || "Company boards",
      },
    ])
    .select();

  if (runError || !runs?.length) {
    console.error("[agent/boards] failed to create run:", runError);
    return { success: false, error: "Failed to start the board scan" };
  }
  const runId: string = runs[0].id;

  const finish = async (status: "completed" | "failed", jobsFound: number) => {
    await client.database
      .from("agent_runs")
      .update({ status, jobs_found: jobsFound, completed_at: new Date().toISOString() })
      .eq("id", runId);
  };

  try {
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: "board_scan_started", properties: { userId } });

    const { data: companies, error: companiesError } = await client.database
      .from("companies")
      .select("name, ats, board_token")
      .eq("active", true);
    if (companiesError || !companies?.length) throw new Error("No company boards configured");

    const { jobs, failed } = await fetchBoards(companies as BoardCompany[]);

    const { data: existing } = await client.database
      .from("jobs")
      .select("ats, ats_job_id")
      .eq("user_id", userId)
      .not("ats_job_id", "is", null);
    const seen = new Set((existing ?? []).map((j: { ats: string; ats_job_id: string }) => `${j.ats}:${j.ats_job_id}`));

    const ranked = filterAndRank(
      jobs.filter((j) => !seen.has(`${j.ats}:${j.atsJobId}`)),
      prefs,
    );

    const model = getScoringModel();
    const summary = profileSummary(prefs);
    let saved = 0;
    let scored = 0;
    let delay = SCORE_DELAY_MS;
    let outOfQuota = false;

    for (const { job: listed } of ranked) {
      if (scored >= scoreLimit) break;

      const job = await hydrateJob(listed);
      const excluded = isExcluded(job, prefs);
      if (excluded) continue;

      if (scored > 0 && delay > 0) await new Promise((r) => setTimeout(r, delay));
      scored++;

      try {
        const score = await scoreJob(model, job, summary);
        if (!score) continue;

        const { data: inserted, error: insertError } = await client.database
          .from("jobs")
          .insert([
            {
              ...boardJobRow(job, userId, runId, "board"),
              match_score: score.matchScore,
              match_reason: score.matchReason,
              fit_reason: score.fitReason || null,
              matched_skills: score.matchedSkills,
              missing_skills: score.missingSkills,
            },
          ])
          .select("id");

        if (insertError || !inserted?.length) {
          // A concurrent scan may have saved it first (unique per user + ATS id).
          console.error("[agent/boards] insert failed:", job.company, job.title, insertError);
          continue;
        }
        saved++;
        posthog.capture({
          distinctId: userId,
          event: "job_found",
          properties: { userId, source: "board", ats: job.ats, matchScore: score.matchScore },
        });
      } catch (error) {
        const apiDelay = extractRetryDelay(error);
        console.error("[agent/boards] scoring failed:", job.company, job.title, error);
        await log(client, userId, runId, "error", error instanceof Error ? error.message : String(error));
        // Out of quota for hours: stop scoring rather than sleep through it.
        if (apiDelay && apiDelay > MAX_RETRY_DELAY_MS) {
          outOfQuota = true;
          break;
        }
        if (apiDelay) delay = apiDelay;
      }
    }

    await finish("completed", saved);
    await client.database
      .from("profiles")
      .update({ last_discovered_at: new Date().toISOString() })
      .eq("id", userId);

    const remaining = Math.max(0, ranked.length - scored);
    const message =
      ranked.length === 0
        ? `Scanned ${jobs.length.toLocaleString()} open roles at ${companies.length - failed.length} companies. None matched your titles, level and location.`
        : `Scanned ${jobs.length.toLocaleString()} open roles. ${ranked.length} matched your filters; scored and saved the top ${saved}.` +
          (outOfQuota
            ? " Scoring stopped early: the AI service is out of quota. Try again later."
            : remaining > 0 ? ` Scan again to score ${remaining} more.` : "");

    await log(client, userId, runId, "success", message);
    await shutdownPostHog();

    return {
      success: true,
      runId,
      scanned: jobs.length,
      matched: ranked.length,
      saved,
      failedBoards: failed,
      message,
    };
  } catch (error) {
    console.error("[agent/boards] exception:", error);
    await finish("failed", 0).catch(() => {});
    await log(client, userId, runId, "error", error instanceof Error ? error.message : String(error)).catch(() => {});
    return { success: false, error: "Board scan failed" };
  }
}
