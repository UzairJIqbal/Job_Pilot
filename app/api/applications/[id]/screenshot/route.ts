import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";

/** The screenshot the submission worker took of the employer's form. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;

    const { data: application } = await auth.client.database
      .from("applications")
      .select("screenshot_key")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();

    const key: string | undefined = application?.screenshot_key;
    // The table constraint already pins keys to the owner's folder; check anyway.
    if (!key || !key.startsWith(`${auth.userId}/`)) {
      return NextResponse.json({ error: "No screenshot" }, { status: 404 });
    }

    const { data: blob, error } = await auth.client.storage.from("resumes").download(key);
    if (error || !blob) {
      console.error("[api/applications/screenshot] download:", error);
      return NextResponse.json({ error: "Failed to load screenshot" }, { status: 500 });
    }

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="application-screenshot.png"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/applications/screenshot] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
