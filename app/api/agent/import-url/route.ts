import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { fetchJobByUrl, parseJobUrl } from "@/lib/ats";
import { isExcluded } from "@/lib/discovery-filters";
import { getScoringModel, profileSummary, scoreJob } from "@/agent/scoring";
import { boardJobRow, type ProfileRow } from "@/agent/boards";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { client, userId } = auth;

    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url : "";
    const parsed = parseJobUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Paste a job link from a Greenhouse, Lever or Ashby board." },
        { status: 400 },
      );
    }

    const { data: existing } = await client.database
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("ats", parsed.ats)
      .eq("ats_job_id", parsed.jobId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: true, data: { jobId: existing.id, duplicate: true } });
    }

    const { data: profile } = await client.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Save your profile before importing jobs." },
        { status: 400 },
      );
    }

    const { data: company } = await client.database
      .from("companies")
      .select("name")
      .eq("ats", parsed.ats)
      .eq("board_token", parsed.boardToken)
      .maybeSingle();

    const job = await fetchJobByUrl(parsed, company?.name);
    if (!job) {
      return NextResponse.json(
        { success: false, error: "That posting couldn't be loaded. It may have closed." },
        { status: 404 },
      );
    }

    const prefs = profile as ProfileRow;
    const excluded = isExcluded(job, prefs);
    const score = await scoreJob(getScoringModel(), job, profileSummary(prefs)).catch((error) => {
      console.error("[agent/import-url] scoring failed:", error);
      return null;
    });

    const { data: inserted, error } = await client.database
      .from("jobs")
      .insert([
        {
          ...boardJobRow(job, userId, null, "url"),
          match_score: score?.matchScore ?? null,
          match_reason: score?.matchReason ?? null,
          fit_reason: score?.fitReason || null,
          matched_skills: score?.matchedSkills ?? [],
          missing_skills: score?.missingSkills ?? [],
        },
      ])
      .select("id");

    if (error || !inserted?.length) {
      console.error("[agent/import-url] insert failed:", error);
      return NextResponse.json({ success: false, error: "Failed to save the job" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: inserted[0].id,
        title: job.title,
        company: job.company,
        matchScore: score?.matchScore ?? null,
        // An unscored job never reaches the queue, so say so.
        warning: excluded ?? (score ? null : "it couldn't be scored right now, so it won't be drafted"),
      },
    });
  } catch (error) {
    console.error("[agent/import-url] POST exception:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
