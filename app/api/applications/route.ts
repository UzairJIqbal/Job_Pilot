import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import type { ApplicationAnswer, ApplicationState } from "@/lib/applications";

// Bulk state change from the queue. Same rules as PATCH /api/applications/{id}:
// sent rows are locked, and a row with flagged answers can't be approved.
const USER_STATES = new Set<ApplicationState>(["needs_review", "approved", "skipped"]);
const MAX_IDS = 100;

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;
    const state: unknown = body?.state;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_IDS ||
      !ids.every((id) => typeof id === "string")
    ) {
      return NextResponse.json({ success: false, error: `Send 1 to ${MAX_IDS} application ids` }, { status: 400 });
    }
    if (typeof state !== "string" || !USER_STATES.has(state as ApplicationState)) {
      return NextResponse.json({ success: false, error: "Invalid state" }, { status: 400 });
    }

    const { data: rows, error: readError } = await auth.client.database
      .from("applications")
      .select("id, state, answers")
      .in("id", ids)
      .eq("user_id", auth.userId);
    if (readError) {
      console.error("[api/applications] bulk read failed:", readError);
      return NextResponse.json({ success: false, error: "Failed to load applications" }, { status: 500 });
    }

    const eligible: string[] = [];
    const rejected: { id: string; reason: string }[] = [];
    const found = new Set<string>();
    for (const row of (rows ?? []) as { id: string; state: ApplicationState; answers: ApplicationAnswer[] }[]) {
      found.add(row.id);
      if (row.state === "submitting" || row.state === "submitted") {
        rejected.push({ id: row.id, reason: "Already sent" });
      } else if (state === "approved" && row.answers.some((a) => a.needsReview)) {
        rejected.push({ id: row.id, reason: "Has answers to review" });
      } else if (row.state !== state) {
        eligible.push(row.id);
      }
    }
    for (const id of ids as string[]) {
      if (!found.has(id)) rejected.push({ id, reason: "Not found" });
    }

    if (eligible.length > 0) {
      const { error } = await auth.client.database
        .from("applications")
        .update({ state })
        .in("id", eligible)
        .eq("user_id", auth.userId);
      if (error) {
        console.error("[api/applications] bulk update failed:", error);
        return NextResponse.json({ success: false, error: "Failed to update applications" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, data: { updated: eligible, rejected } });
  } catch (error) {
    console.error("[api/applications] bulk PATCH exception:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
