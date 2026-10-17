import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import type { ApplicationAnswer } from "@/lib/applications";

// Users can edit the cover letter and answers, and approve, skip or reopen.
// The database trigger rejects any other state change from a browser session.
const USER_STATES = new Set(["needs_review", "approved", "skipped"]);

function isAnswer(a: unknown): a is ApplicationAnswer {
  if (!a || typeof a !== "object") return false;
  const v = (a as ApplicationAnswer).value;
  return (
    typeof (a as ApplicationAnswer).questionId === "string" &&
    (typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")))
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }

    const { data: current } = await auth.client.database
      .from("applications")
      .select("state, answers")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }
    if (current.state === "submitting" || current.state === "submitted") {
      return NextResponse.json({ success: false, error: "This application has already been sent." }, { status: 409 });
    }

    const update: Record<string, unknown> = {};

    if (body.coverLetter !== undefined) {
      if (typeof body.coverLetter !== "string" || body.coverLetter.length > 10_000) {
        return NextResponse.json({ success: false, error: "Cover letter must be text under 10,000 characters" }, { status: 400 });
      }
      update.cover_letter = body.coverLetter;
    }

    if (body.answers !== undefined) {
      if (!Array.isArray(body.answers) || !body.answers.every(isAnswer)) {
        return NextResponse.json({ success: false, error: "Invalid answers" }, { status: 400 });
      }
      // Only values change; labels, sources and the question set stay as drafted.
      const edits = new Map((body.answers as ApplicationAnswer[]).map((a) => [a.questionId, a.value]));
      update.answers = (current.answers as ApplicationAnswer[]).map((a) =>
        edits.has(a.questionId)
          ? {
              ...a,
              value: edits.get(a.questionId)!,
              source: JSON.stringify(a.value) === JSON.stringify(edits.get(a.questionId)) ? a.source : "user",
              needsReview: false,
            }
          : a,
      );
    }

    if (body.state !== undefined) {
      if (!USER_STATES.has(body.state)) {
        return NextResponse.json({ success: false, error: "Invalid state" }, { status: 400 });
      }
      const answers = (update.answers ?? current.answers) as ApplicationAnswer[];
      if (body.state === "approved" && answers.some((a) => a.needsReview)) {
        return NextResponse.json(
          { success: false, error: "Review the flagged answers before approving." },
          { status: 400 },
        );
      }
      update.state = body.state;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await auth.client.database
      .from("applications")
      .update(update)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select("id, state, cover_letter, answers, approved_at");

    if (error || !data?.length) {
      console.error("[api/applications] PATCH failed:", error);
      return NextResponse.json({ success: false, error: "Failed to update application" }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error("[api/applications] PATCH exception:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
