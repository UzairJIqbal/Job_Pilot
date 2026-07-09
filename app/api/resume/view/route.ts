import { NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function GET() {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData } = await insforge.auth.getCurrentUser();
    const userId = authData?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.resume_pdf_url) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    const url = new URL(profile.resume_pdf_url);
    const storagePath = decodeURIComponent(
      url.pathname.split("/objects/")[1] ?? "",
    );

    const { data: blob, error } = await insforge.storage
      .from("resumes")
      .download(storagePath);

    if (error || !blob) {
      console.error("[api/resume/view] download:", error);
      return NextResponse.json(
        { error: "Failed to load resume" },
        { status: 500 },
      );
    }

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"',
      },
    });
  } catch (error) {
    console.error("[api/resume/view] exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
