import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { researchCompany } from "@/agent/research";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }
    const { client: insforge, userId } = auth;

    const body = await req.json();
    const { jobId } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, error: "jobId is required" },
        { status: 400 },
      );
    }

    const result = await researchCompany({
      jobId,
      userId,
      client: insforge,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { dossier: result.dossier },
    });
  } catch (error) {
    console.error("[agent/research] POST exception:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
