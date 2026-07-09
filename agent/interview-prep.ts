import { getGeminiClient } from "@/lib/gemini-client";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import type { createServerClient } from "@insforge/sdk/ssr";
import type { InterviewPrepMaterial, InterviewPrepResult } from "@/types/agent";

type InsForgeClient = ReturnType<typeof createServerClient>;

/* ── Gemini retry + error logging (same pattern as agent/research.ts) ── */

function extractRetryDelay(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "errorDetails" in error &&
    Array.isArray(error.errorDetails)
  ) {
    const retryInfo = error.errorDetails.find(
      (d: Record<string, unknown>) =>
        d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
    );
    if (retryInfo && typeof retryInfo.retryDelay === "string") {
      const seconds = parseInt(retryInfo.retryDelay.replace("s", ""), 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  }
  return null;
}

async function generateWithRetry(
  model: ReturnType<ReturnType<typeof getGeminiClient>["getGenerativeModel"]>,
  prompt: string[],
  retries = 5,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: number }).status
          : null;

      const isTransient = status === 503 || status === 429 || status === 500;

      if (isTransient && attempt < retries) {
        const apiDelay = extractRetryDelay(error);
        // 503 = sustained demand → longer delays; 429/500 = brief → shorter
        const baseDelay = status === 503 ? 3000 : 1000;
        const delay = apiDelay ?? baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

async function logAgentError(
  client: InsForgeClient,
  runId: string | null,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await client.database.from("agent_logs").insert({
    run_id: runId,
    level: "error",
    message,
    created_at: new Date().toISOString(),
  });
}

/* ── Prompt ── */

const INTERVIEW_PREP_PROMPT = `You are an expert interview coach preparing a candidate for a specific role at a specific company. You have three sources of context:
1. The full job posting (title, responsibilities, requirements, nice-to-have, benefits)
2. Company research (overview, tech stack, culture, why the role exists)
3. The candidate's profile (current title, experience level, skills, work history)

Your job: Generate a complete interview prep package tailored to THIS candidate for THIS role.

RULES:
- Every question must be grounded in the actual job requirements and company context. No generic questions.
- STAR answers must reference the candidate's actual work history — connect their real experience to the role. If the candidate's history doesn't perfectly align, frame how their adjacent experience applies.
- "Your Angle" for each behavioral question must reference a specific skill or project from the candidate's profile.
- Talking points must reference specific things about the company (from research) and the role.
- Questions to ask the interviewer must reference real details — company initiatives, tech choices, team structure — not generic "what's the culture like."
- Day One Readiness must reference the specific skills the candidate already has that map to the role's requirements.
- Keep answers concise and actionable. No filler.

Return ONLY valid JSON matching this shape:
{
  "behavioralQuestions": [
    {
      "question": "string",
      "whyAsked": "string",
      "starAnswer": {
        "situation": "string",
        "task": "string",
        "action": "string",
        "result": "string"
      },
      "yourAngle": "string"
    }
  ],
  "technicalQuestions": [
    {
      "question": "string",
      "whyAsked": "string",
      "suggestedAnswer": "string",
      "depthToGo": "string"
    }
  ],
  "talkingPoints": ["string"],
  "questionsToAsk": ["string"],
  "dayOneReadiness": "string",
  "closingStrategy": "string"
}

Generate 3-4 behavioral questions and 2-3 technical questions (adjust based on role seniority — more behavioral for senior/lead roles, more technical for IC roles).`;

/* ── Main agent function ── */

export async function generateInterviewPrep(params: {
  jobId: string;
  userId: string;
  client: InsForgeClient;
}): Promise<InterviewPrepResult> {
  const { jobId, userId, client } = params;

  try {
    // Step 1: Load job from DB
    const { data: jobs, error: jobError } = await client.database
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .limit(1);

    if (jobError || !jobs || jobs.length === 0) {
      console.error("[agent/interview-prep] job not found:", jobError);
      return { success: false, error: "Job not found" };
    }

    const job = jobs[0];

    // Return cached if exists
    if (job.interview_prep) {
      return { success: true, prep: job.interview_prep as InterviewPrepMaterial };
    }

    // Step 2: Load user profile from DB
    const { data: profiles, error: profileError } = await client.database
      .from("profiles")
      .select("*")
      .eq("id", userId);

    if (profileError || !profiles || profiles.length === 0) {
      return { success: false, error: "Could not load profile" };
    }

    const profile = profiles[0];

    // Step 3: Build context and call Gemini
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const userPrompt = `COMPANY RESEARCH:
${JSON.stringify(job.company_research || {}, null, 2)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
About the role: ${job.about_role || "Not provided"}
Responsibilities: ${(job.responsibilities || []).join("; ")}
Requirements: ${(job.requirements || []).join("; ")}
Nice to have: ${(job.nice_to_have || []).join("; ")}
Matched skills: ${(job.matched_skills || []).join(", ")}
Missing skills: ${(job.missing_skills || []).join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title || "Not specified"}
Experience level: ${profile.experience_level || "Not specified"}
Years: ${profile.years_experience || "Not specified"}
Skills: ${(profile.skills || []).join(", ")}
Work history: ${JSON.stringify(profile.work_experience || [])}`;

    const responseText = await generateWithRetry(model, [
      INTERVIEW_PREP_PROMPT,
      `\n\n${userPrompt}`,
    ]);

    // Step 4: Parse JSON
    let prep: InterviewPrepMaterial;
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      prep = JSON.parse(cleaned);
    } catch {
      console.error("[agent/interview-prep] JSON parse failed");
      return { success: false, error: "Failed to parse interview prep" };
    }

    // Step 5: Save to DB
    const { error: updateError } = await client.database
      .from("jobs")
      .update({ interview_prep: prep })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[agent/interview-prep] failed to save:", updateError);
      return { success: false, error: "Failed to save interview prep" };
    }

    // Step 6: Fire PostHog event
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "interview_prep_generated",
      properties: { userId, jobId, company: job.company },
    });
    await shutdownPostHog();

    return { success: true, prep };
  } catch (error) {
    console.error("[agent/interview-prep] exception:", error);
    try {
      await logAgentError(client, null, error);
    } catch {
      // best effort
    }
    return { success: false, error: "Interview prep generation failed" };
  }
}
