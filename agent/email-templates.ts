import { getGeminiClient } from "@/lib/gemini-client";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import type { createServerClient } from "@insforge/sdk/ssr";
import type { EmailTemplates, EmailTemplatesResult } from "@/types/agent";

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

const EMAIL_TEMPLATES_PROMPT = `You are an expert career communications coach. Generate three ready-to-send email templates for a candidate applying to a specific role at a specific company.

CONTEXT PROVIDED:
1. The job posting (title, responsibilities, requirements)
2. Company research (overview, tech stack, culture, why the role exists)
3. The candidate's profile (current title, experience, skills, work history)
4. The user's cover letter tone preference

RULES:
- Every email must be personalized to THIS role and THIS company. No generic templates.
- Reference specific details from the company research and job posting — the kind of detail that shows the candidate did their homework.
- Match the tone to the user's cover_letter_tone preference (formal / casual / enthusiastic).
- Keep emails concise — recruiters and hiring managers skim. No paragraphs longer than 3 sentences.
- The networking email should be a cold outreach to a hiring manager or team lead (not a recruiter). Reference something specific about the company's work or the team's public output.
- The follow-up email should be sent 5-7 days after applying. Reference the specific role and a value proposition.
- The thank-you email should be sent after an interview. Reference specific discussion points (make reasonable assumptions based on the role).
- All emails must sound like a real human wrote them, not AI. No "I hope this email finds you well" opener.
- Subject lines should be specific and compelling, not generic.

Return ONLY valid JSON matching this shape:
{
  "networking": {
    "subject": "string",
    "body": "string"
  },
  "followUp": {
    "subject": "string",
    "body": "string"
  },
  "thankYou": {
    "subject": "string",
    "body": "string"
  }
}`;

/* ── Main agent function ── */

export async function generateEmailTemplates(params: {
  jobId: string;
  userId: string;
  client: InsForgeClient;
}): Promise<EmailTemplatesResult> {
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
      console.error("[agent/email-templates] job not found:", jobError);
      return { success: false, error: "Job not found" };
    }

    const job = jobs[0];

    // Return cached if exists
    if (job.email_templates) {
      return { success: true, templates: job.email_templates as EmailTemplates };
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

CANDIDATE PROFILE:
Name: ${profile.full_name || "The candidate"}
Current title: ${profile.current_title || "Not specified"}
Experience: ${profile.years_experience || "Not specified"} years, ${profile.experience_level || "Not specified"} level
Skills: ${(profile.skills || []).join(", ")}
Work history: ${JSON.stringify(profile.work_experience || [])}
LinkedIn: ${profile.linkedin_url || "Not provided"}
Portfolio: ${profile.portfolio_url || "Not provided"}

TONE PREFERENCE: ${profile.cover_letter_tone || "enthusiastic"}`;

    const responseText = await generateWithRetry(model, [
      EMAIL_TEMPLATES_PROMPT,
      `\n\n${userPrompt}`,
    ]);

    // Step 4: Parse JSON
    let rawTemplates: {
      networking: { subject: string; body: string };
      followUp: { subject: string; body: string };
      thankYou: { subject: string; body: string };
    };
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      rawTemplates = JSON.parse(cleaned);
    } catch {
      console.error("[agent/email-templates] JSON parse failed");
      return { success: false, error: "Failed to parse email templates" };
    }

    const templates: EmailTemplates = {
      ...rawTemplates,
      generatedAt: new Date().toISOString(),
    };

    // Step 5: Save to DB
    const { error: updateError } = await client.database
      .from("jobs")
      .update({ email_templates: templates })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[agent/email-templates] failed to save:", updateError);
      return { success: false, error: "Failed to save email templates" };
    }

    // Step 6: Fire PostHog event
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "email_templates_generated",
      properties: { userId, jobId, company: job.company },
    });
    await shutdownPostHog();

    return { success: true, templates };
  } catch (error) {
    console.error("[agent/email-templates] exception:", error);
    try {
      await logAgentError(client, null, error);
    } catch {
      // best effort
    }
    return { success: false, error: "Email template generation failed" };
  }
}
