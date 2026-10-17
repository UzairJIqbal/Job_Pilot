import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { tailorApplication } from "@/agent/tailor";

// One model call plus a PDF render; Gemini retries can stretch it.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const jobId = body?.jobId;
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ success: false, error: "jobId is required" }, { status: 400 });
    }

    const result = await tailorApplication({ client: auth.client, userId: auth.userId, jobId });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: { applicationId: result.applicationId } });
  } catch (error) {
    console.error("[agent/tailor] POST exception:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
