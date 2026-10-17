import { getGeminiClient } from "@/lib/gemini-client";

export type JobScore = {
  matchScore: number;
  matchReason: string;
  fitReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

export type ScoringModel = ReturnType<ReturnType<typeof getGeminiClient>["getGenerativeModel"]>;

export const SCORING_PROMPT = `You are a job matching assistant. Given a job listing and a candidate profile, score how well the candidate matches this job.

Return ONLY valid JSON with these fields:
- matchScore: number (0-100)
- matchReason: string (one paragraph explanation, 2-3 sentences)
- fitReason: string (one line, under 20 words, the single strongest reason this role fits or doesn't)
- matchedSkills: string[] (skills the user has that this job requires)
- missingSkills: string[] (skills this job requires that the user lacks)

Rules:
- Be honest — not every job is a strong match
- Consider skills, experience level, and role relevance
- matchScore below 40 means poor fit, 40-70 moderate, 70+ strong
- Keep matchReason concise and specific
- Return ONLY the JSON, no markdown, no explanation`;

export function getScoringModel(): ScoringModel {
  return getGeminiClient().getGenerativeModel({ model: "gemini-2.5-flash" });
}

// A daily-quota 429 asks for a retry hours away. Waiting that long hangs the
// request past any timeout, so a longer delay counts as a hard failure.
export const MAX_RETRY_DELAY_MS = 60_000;

export function extractRetryDelay(error: unknown): number | null {
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

export async function generateWithRetry(
  model: ScoringModel,
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
      const apiDelay = extractRetryDelay(error);

      if (isTransient && attempt < retries && (apiDelay ?? 0) <= MAX_RETRY_DELAY_MS) {
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

export function profileSummary(profile: Record<string, unknown>): string {
  return JSON.stringify(
    {
      currentTitle: profile.current_title,
      experienceLevel: profile.experience_level,
      yearsExperience: profile.years_experience,
      skills: profile.skills,
      industries: profile.industries,
      workExperience: profile.work_experience,
      jobTitlesSeeking: profile.job_titles_seeking,
    },
    null,
    2,
  );
}

/** Score one listing. Returns null when the model's reply isn't valid JSON. */
export async function scoreJob(
  model: ScoringModel,
  listing: { title: string; company: string; location: string; description: string },
  summary: string,
): Promise<JobScore | null> {
  const responseText = await generateWithRetry(model, [
    SCORING_PROMPT,
    `\n\nJob listing:\nTitle: ${listing.title}\nCompany: ${listing.company}\nLocation: ${listing.location}\nDescription: ${listing.description.slice(0, 12_000)}\n\nCandidate profile:\n${summary}`,
  ]);

  try {
    const cleaned = responseText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const score = JSON.parse(cleaned) as Partial<JobScore>;
    if (typeof score.matchScore !== "number") return null;
    return {
      matchScore: Math.max(0, Math.min(100, Math.round(score.matchScore))),
      matchReason: score.matchReason ?? "",
      fitReason: score.fitReason ?? "",
      matchedSkills: score.matchedSkills ?? [],
      missingSkills: score.missingSkills ?? [],
    };
  } catch {
    return null;
  }
}
