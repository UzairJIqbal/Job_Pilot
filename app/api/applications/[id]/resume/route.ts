import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;

    const { data: application } = await auth.client.database
      .from("applications")
      .select("tailored_resume_key")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();

    const key: string | undefined = application?.tailored_resume_key;
    // The table constraint already pins keys to the owner's folder; check anyway.
    if (!key || !key.startsWith(`${auth.userId}/`)) {
      return NextResponse.json({ error: "No tailored resume" }, { status: 404 });
    }

    const { data: blob, error } = await auth.client.storage.from("resumes").download(key);
    if (error || !blob) {
      console.error("[api/applications/resume] download:", error);
      return NextResponse.json({ error: "Failed to load resume" }, { status: 500 });
    }

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="tailored-resume.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/applications/resume] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
