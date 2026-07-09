import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { getGeminiClient } from "@/lib/gemini-client";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdf } from "@/lib/resume-pdf";
import type { ProfileFormData } from "@/lib/mock-profile";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function generateWithRetry(
  model: ReturnType<ReturnType<typeof getGeminiClient>["getGenerativeModel"]>,
  prompt: string[],
  retries = MAX_RETRIES,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const isTransient =
        error instanceof Error &&
        "status" in error &&
        (error.status === 503 || error.status === 429 || error.status === 500);

      if (isTransient && attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

const RESUME_PROMPT = `You are a professional resume writer. Given a candidate's profile data, produce a polished resume in JSON format.

Return ONLY valid JSON with these fields:
- summary: string (2-3 sentence professional summary)
- workExperience: array of objects, each with: company, title, startDate, endDate, isCurrent, responsibilities (array of polished bullet points, each starting with a strong action verb, concise and impactful)
- education: object with: degree, fieldOfStudy, institution, graduationYear
- skills: array of strings (organized, deduplicated, prioritized by relevance)
- highlights: array of strings (2-3 career highlights or achievements, inferred from experience if reasonable)

Rules:
- Keep bullet points concise (one line each, max 15 words)
- Use strong action verbs (Led, Built, Optimized, Designed, Implemented)
- Quantify achievements where the data supports it
- Professional, clean tone throughout
- Do NOT fabricate specific metrics — only use numbers present in the original data
- Return ONLY the JSON, no markdown, no explanation`;

export async function POST() {
  const auth = await getAuthenticatedClient();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { client: insforge, userId } = auth;

  try {

    // Get full profile data
    const { data: profile, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Could not load profile. Please save your profile first." },
        { status: 404 },
      );
    }

    // Use Gemini to enhance resume content
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const profileSummary = JSON.stringify(
      {
        fullName: profile.full_name,
        phone: profile.phone,
        location: profile.location,
        currentTitle: profile.current_title,
        experienceLevel: profile.experience_level,
        yearsExperience: profile.years_experience,
        skills: profile.skills,
        industries: profile.industries,
        workExperience: profile.work_experience,
        education: profile.education,
      },
      null,
      2,
    );

    const responseText = await generateWithRetry(model, [
      RESUME_PROMPT,
      `\n\nProfile data:\n${profileSummary}`,
    ]);

    let enhanced: {
      summary: string;
      workExperience: {
        company: string;
        title: string;
        startDate: string;
        endDate: string;
        isCurrent: boolean;
        responsibilities: string[];
      }[];
      education: {
        degree: string;
        fieldOfStudy: string;
        institution: string;
        graduationYear: string;
      };
      skills: string[];
      highlights: string[];
    };

    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      enhanced = JSON.parse(cleaned);
    } catch {
      console.error("[api/resume/generate] JSON parse failed:", responseText);
      return NextResponse.json(
        { error: "Failed to generate resume content. Please try again." },
        { status: 500 },
      );
    }

    // Render PDF using react-pdf
    const pdfBuffer = await renderToBuffer(
      ResumePdf({
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        linkedinUrl: profile.linkedin_url,
        portfolioUrl: profile.portfolio_url,
        summary: enhanced.summary,
        workExperience: enhanced.workExperience,
        education: enhanced.education,
        skills: enhanced.skills,
        highlights: enhanced.highlights,
      }),
    );

    // Upload to InsForge Storage
    const storagePath = `${userId}/resume.pdf`;
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(storagePath, new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }));

    if (uploadError || !uploadData) {
      console.error("[api/resume/generate] storage upload:", uploadError);
      return NextResponse.json(
        { error: "Failed to save generated resume" },
        { status: 500 },
      );
    }

    const resumeUrl = uploadData.url;

    // Update profile with new resume URL
    const { error: updateError } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: resumeUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[api/resume/generate] profile update:", updateError);
    }

    // Return PDF directly with URL in header for client state update
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "X-Resume-Url": resumeUrl,
      },
    });
  } catch (error) {
    console.error("[api/resume/generate] exception:", error);

    const isOverloaded =
      error instanceof Error &&
      "status" in error &&
      (error.status === 503 || error.status === 429);

    return NextResponse.json(
      {
        error: isOverloaded
          ? "AI service is temporarily busy. Please try again in a moment."
          : "Internal server error",
      },
      { status: isOverloaded ? 503 : 500 },
    );
  }
}
