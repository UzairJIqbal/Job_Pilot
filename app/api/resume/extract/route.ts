import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { getGeminiClient } from "@/lib/gemini-client";
import { parseBuffer } from "@/lib/parse-pdf";
import type { ProfileFormData } from "@/lib/mock-profile";

const GEMINI_MODEL = "gemini-2.5-flash";

const EXTRACTION_PROMPT = `You are a resume parser. Extract information from the resume text and return a JSON object that matches the ProfileFormData schema exactly.

Return ONLY valid JSON with these fields:
- fullName: string (full name of the person)
- phone: string
- location: string (city/country)
- linkedinUrl: string (LinkedIn profile URL, empty string if not found)
- portfolioUrl: string (portfolio/GitHub URL, empty string if not found)
- workAuthorization: string (use empty string if not mentioned)
- currentTitle: string (most recent job title)
- experienceLevel: string (one of: "entry", "mid", "senior", "lead", "executive" — infer from years of experience and titles)
- yearsExperience: string (total years as a string number)
- skills: string[] (list of technical and soft skills)
- industries: string[] (industries the person has worked in)
- workExperience: array of objects, each with: id (use "exp-1", "exp-2", etc.), company, title, startDate (YYYY-MM format), endDate (YYYY-MM format, empty string if current), isCurrent (boolean), responsibilities (string)
- education: object with: degree, fieldOfStudy, institution, graduationYear (string)
- jobTitlesSeeking: string[] (if mentioned, otherwise use empty array)
- remotePreference: string (one of: "remote-first", "hybrid", "on-site", empty string if not mentioned)
- salaryExpectation: string (if mentioned, otherwise empty string)
- preferredLocations: string[] (if mentioned, otherwise empty array)
- coverLetterTone: "professional" (default)

Rules:
- Do NOT include email (it comes from OAuth)
- Do NOT include resumePdfUrl
- If a field is not found in the resume, use empty string for strings, empty array for arrays
- Work experience should be in reverse chronological order
- Dates should be in YYYY-MM format. If only year is given, use January (01) as month
- For isCurrent, use true if the end date is "Present" or similar
- Return ONLY the JSON object, no markdown, no explanation`;

export async function POST() {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { client: insforge, userId } = auth;

    // Get resume URL from profile
    const { data: profile } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.resume_pdf_url) {
      return NextResponse.json(
        { error: "No resume uploaded. Please upload a resume first." },
        { status: 404 },
      );
    }

    // Download PDF from storage
    const url = new URL(profile.resume_pdf_url);
    const storagePath = decodeURIComponent(
      url.pathname.split("/objects/")[1] ?? "",
    );

    const { data: blob, error: downloadError } = await insforge.storage
      .from("resumes")
      .download(storagePath);

    if (downloadError || !blob) {
      console.error("[api/resume/extract] download:", downloadError);
      return NextResponse.json(
        { error: "Failed to download resume" },
        { status: 500 },
      );
    }

    // Extract text from PDF
    const buffer = Buffer.from(await blob.arrayBuffer());
    const text = await parseBuffer(buffer);

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from this PDF. It may be image-based or scanned. Please try a different file.",
        },
        { status: 422 },
      );
    }

    // Send to Gemini for structured extraction
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      `\n\nResume text:\n${text}`,
    ]);

    const responseText = result.response.text();

    // Parse the JSON response
    let extracted: Partial<ProfileFormData>;
    try {
      // Strip markdown code fences if present
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("[api/resume/extract] JSON parse failed:", responseText);
      return NextResponse.json(
        { error: "Failed to parse extracted data. Please try again." },
        { status: 500 },
      );
    }

    // Ensure arrays default to empty
    const data: ProfileFormData = {
      fullName: extracted.fullName ?? "",
      email: "", // from OAuth, never from resume
      phone: extracted.phone ?? "",
      location: extracted.location ?? "",
      linkedinUrl: extracted.linkedinUrl ?? "",
      portfolioUrl: extracted.portfolioUrl ?? "",
      workAuthorization: extracted.workAuthorization ?? "",
      currentTitle: extracted.currentTitle ?? "",
      experienceLevel: extracted.experienceLevel ?? "",
      yearsExperience: extracted.yearsExperience ?? "",
      skills: extracted.skills ?? [],
      industries: extracted.industries ?? [],
      workExperience: extracted.workExperience ?? [],
      education: extracted.education ?? {
        degree: "",
        fieldOfStudy: "",
        institution: "",
        graduationYear: "",
      },
      jobTitlesSeeking: extracted.jobTitlesSeeking ?? [],
      remotePreference: extracted.remotePreference ?? "",
      salaryExpectation: extracted.salaryExpectation ?? "",
      preferredLocations: extracted.preferredLocations ?? [],
      coverLetterTone: extracted.coverLetterTone ?? "professional",
      resumePdfUrl: profile.resume_pdf_url,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[api/resume/extract] exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
