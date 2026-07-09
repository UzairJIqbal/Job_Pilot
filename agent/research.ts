import { z } from "zod";
import { getGeminiClient } from "@/lib/gemini-client";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import { createStagehand } from "@/lib/stagehand";
import type { createServerClient } from "@insforge/sdk/ssr";
import type { CompanyDossier, ResearchResult } from "@/types/agent";

type InsForgeClient = ReturnType<typeof createServerClient>;

/* ── Gemini retry + error logging (same pattern as agent/adzuna.ts) ── */

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

/* ── Homepage URL derivation ── */

async function deriveHomepageUrl(
  redirectUrl: string,
  companyName: string,
): Promise<string> {
  try {
    const response = await fetch(redirectUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JobPilot/1.0)" },
    });

    const finalUrl = response.url;
    const hostname = new URL(finalUrl).hostname;

    // If still on Adzuna, fallback
    if (hostname.includes("adzuna.com")) {
      return `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    }

    // Strip subdomain: jobs.stripe.com → stripe.com
    const parts = hostname.split(".");
    const rootDomain =
      parts.length > 2 ? parts.slice(-2).join(".") : hostname;

    return `https://${rootDomain}`;
  } catch {
    return `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
  }
}

/* ── Browser research ── */

const HOMEPAGE_SCHEMA = z.object({
  oneLiner: z.string().describe("What the company does in one sentence"),
  productSummary: z
    .string()
    .describe("What they build/sell and who it's for"),
  signals: z
    .array(z.string())
    .describe("Funding, notable customers, scale, mission, recent news"),
  pageLinks: z
    .array(
      z.object({
        url: z.string(),
        kind: z.enum([
          "about",
          "careers",
          "blog",
          "engineering",
          "product",
          "team",
          "other",
        ]),
      }),
    )
    .describe("Internal links worth visiting"),
});

const SUBPAGE_SCHEMA = z.object({
  keyPoints: z.array(z.string()),
  technologies: z
    .array(z.string())
    .describe("Specific languages, frameworks, tools, platforms"),
  valuesOrCulture: z
    .array(z.string())
    .describe("Stated values, working style, team norms"),
  notable: z
    .array(z.string())
    .describe("Customers, funding, scale, projects, awards"),
});

type HomepageData = z.infer<typeof HOMEPAGE_SCHEMA>;
type SubPageData = z.infer<typeof SUBPAGE_SCHEMA>;

const PAGE_KIND_PRIORITY = ["about", "blog", "engineering", "product"];

function pickSubPages(links: HomepageData["pageLinks"]): string[] {
  const nonCareers = links.filter((l) => l.kind !== "careers");

  // Sort by priority
  const sorted = nonCareers.sort((a, b) => {
    const aIdx = PAGE_KIND_PRIORITY.indexOf(a.kind);
    const bIdx = PAGE_KIND_PRIORITY.indexOf(b.kind);
    const aScore = aIdx === -1 ? 99 : aIdx;
    const bScore = bIdx === -1 ? 99 : bIdx;
    return aScore - bScore;
  });

  // Deduplicate by hostname+pathname, take top 3
  const seen = new Set<string>();
  const result: string[] = [];

  for (const link of sorted) {
    try {
      const url = new URL(link.url);
      const key = `${url.hostname}${url.pathname}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(link.url);
      }
    } catch {
      // skip invalid URLs
    }
    if (result.length >= 3) break;
  }

  return result;
}

async function researchWithBrowser(homepageUrl: string): Promise<{
  homepage: HomepageData;
  subPages: SubPageData[];
}> {
  const stagehand = await createStagehand();

  try {
    const page = stagehand.context.activePage()!;

    // Homepage extraction
    await page.goto(homepageUrl, { waitUntil: "domcontentloaded", timeoutMs: 15000 });

    const homepage = await stagehand.extract(
      "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
      HOMEPAGE_SCHEMA,
    );

    // If no meaningful content, bail
    if (!homepage.oneLiner && !homepage.productSummary) {
      return { homepage, subPages: [] };
    }

    // Sub-page extraction (max 3)
    const subPageUrls = pickSubPages(homepage.pageLinks);
    const subPages: SubPageData[] = [];

    for (const url of subPageUrls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeoutMs: 12000 });

        const subPageData = await stagehand.extract(
          "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
          SUBPAGE_SCHEMA,
        );

        subPages.push(subPageData);
      } catch {
        // skip failed sub-pages
      }
    }

    return { homepage, subPages };
  } finally {
    await stagehand.close();
  }
}

/* ── Synthesis prompt ── */

const SYNTHESIS_SYSTEM_PROMPT = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": "string",
  "techStack": ["string"],
  "culture": ["string"],
  "whyThisRole": "string",
  "yourEdge": ["string"],
  "gapsToAddress": ["string"],
  "smartQuestions": ["string"],
  "interviewPrep": ["string"],
  "sources": ["string"]
}`;

/* ── Main agent function ── */

export async function researchCompany(params: {
  jobId: string;
  userId: string;
  client: InsForgeClient;
}): Promise<ResearchResult> {
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
      console.error("[agent/research] job not found:", jobError);
      return { success: false, error: "Job not found" };
    }

    const job = jobs[0];

    // Don't re-research if dossier already exists
    if (job.company_research) {
      return { success: true, dossier: job.company_research as CompanyDossier };
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

    // Step 3: Derive homepage URL
    const homepageUrl = job.source_url
      ? await deriveHomepageUrl(job.source_url, job.company)
      : `https://www.${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;

    // Step 4: Browser research
    let companyResearch: {
      homepage: HomepageData;
      subPages: SubPageData[];
    } = { homepage: { oneLiner: "", productSummary: "", signals: [], pageLinks: [] }, subPages: [] };

    try {
      companyResearch = await researchWithBrowser(homepageUrl);
    } catch (error) {
      console.error("[agent/research] browser research failed:", error);
      // Continue — synthesis will work with empty research
    }

    // Step 5: Gemini synthesis
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const companyResearchJson = JSON.stringify(companyResearch, null, 2);

    const userPrompt = `COMPANY RESEARCH (from their website):
${companyResearchJson}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.about_role || "Not provided"}
Matched skills (already computed): ${(job.matched_skills || []).join(", ")}
Missing skills (already computed): ${(job.missing_skills || []).join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title || "Not specified"}
Experience: ${profile.years_experience || "Not specified"} years, level ${profile.experience_level || "Not specified"}
Skills: ${(profile.skills || []).join(", ")}
Work history: ${JSON.stringify(profile.work_experience || [])}`;

    const responseText = await generateWithRetry(model, [
      SYNTHESIS_SYSTEM_PROMPT,
      `\n\n${userPrompt}`,
    ]);

    let dossier: CompanyDossier;
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      dossier = JSON.parse(cleaned);
    } catch {
      console.error("[agent/research] JSON parse failed for synthesis");
      return { success: false, error: "Failed to parse research synthesis" };
    }

    // Step 6: Save dossier to DB
    const { error: updateError } = await client.database
      .from("jobs")
      .update({ company_research: dossier })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[agent/research] failed to save dossier:", updateError);
      return { success: false, error: "Failed to save research" };
    }

    // Step 7: Fire PostHog event
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "company_researched",
      properties: { userId, jobId, company: job.company },
    });
    await shutdownPostHog();

    return { success: true, dossier };
  } catch (error) {
    console.error("[agent/research] exception:", error);
    try {
      await logAgentError(client, null, error);
    } catch {
      // best effort — don't crash on logging failure
    }
    return { success: false, error: "Company research failed" };
  }
}
