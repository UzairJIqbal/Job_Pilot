import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { discoverJobs } from "@/agent/adzuna";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { client: insforge, userId } = auth;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const sort = searchParams.get("sort") || "score";
    const status = searchParams.get("status") || "all";

    let query = insforge.database
      .from("jobs")
      .select("*")
      .eq("user_id", userId);

    if (filter === "high") {
      query = query.gte("match_score", 70);
    } else if (filter === "low") {
      query = query.lt("match_score", 70);
    }

    if (status !== "all") {
      if (status === "saved") {
        query = query.is("status", null);
      } else {
        query = query.eq("status", status);
      }
    }

    if (sort === "score") {
      query = query.order("match_score", { ascending: false, nullsFirst: false });
    } else if (sort === "newest") {
      query = query.order("found_at", { ascending: false });
    } else {
      query = query.order("found_at", { ascending: true });
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("[agent/find] GET query error:", error);
      return NextResponse.json({ success: false, error: "Failed to load jobs" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { jobs: jobs || [] },
    });
  } catch (error) {
    console.error("[agent/find] GET exception:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { client: insforge, userId } = auth;

    const body = await req.json();
    const { jobTitle, location } = body;

    if (!jobTitle || typeof jobTitle !== "string") {
      return NextResponse.json(
        { success: false, error: "jobTitle is required" },
        { status: 400 },
      );
    }

    if (location && typeof location !== "string") {
      return NextResponse.json(
        { success: false, error: "location must be a string" },
        { status: 400 },
      );
    }

    const result = await discoverJobs({
      jobTitle,
      location: location || "",
      userId,
      client: insforge,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobsFound: result.jobs.length,
        runId: result.runId,
        message: result.message,
        jobs: result.jobs,
      },
    });
  } catch (error) {
    console.error("[agent/find] POST exception:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
