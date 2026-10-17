import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAdminClient } from "@insforge/sdk";
import type { ApplicationAnswer, ApplicationQuestion } from "../../lib/applications";
import { parseJobUrl } from "../../lib/ats";
import type { Ats, Receipt, SubmissionInput } from "./types";

// The worker acts for every user with the admin key, which bypasses RLS:
// every read and write below names the user or the application explicitly.

export type Admin = ReturnType<typeof createAdminClient>;

export function adminClient(): Admin {
  const baseUrl = process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("INSFORGE_URL and INSFORGE_API_KEY must be set");
  return createAdminClient({ baseUrl, apiKey });
}

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string;
  state: string;
  questions: ApplicationQuestion[];
  answers: ApplicationAnswer[];
  cover_letter: string | null;
  tailored_resume_key: string | null;
  attempts: number;
  approved_at: string | null;
  send_confirmed_at: string | null;
  claim_mode: "preview" | "send" | null;
  receipt: Receipt | null;
};

type JobRow = {
  id: string;
  title: string;
  company: string;
  ats: Ats | null;
  match_score: number | null;
  ats_job_id: string | null;
  source_url: string | null;
  external_apply_url: string | null;
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_experience: { company?: string; isCurrent?: boolean }[] | null;
};

export type ClaimLimits = { dailyCap: number; minMatchScore: number; requireConfirmation: boolean };

/**
 * The database decides what may be claimed: approved rows only, the job's
 * match score at or above the bar, at most 10 live sends per user per day,
 * and (by default) a preview before every send. It clamps these limits so a
 * worker can tighten them but never loosen them.
 */
export async function claimNext(db: Admin, worker: string, limits: ClaimLimits): Promise<ApplicationRow | null> {
  const { data, error } = await db.database.rpc("claim_next_application", {
    p_worker: worker,
    p_daily_cap: limits.dailyCap,
    p_min_match_score: limits.minMatchScore,
    p_require_confirmation: limits.requireConfirmation,
  });
  if (error) throw new Error(`claim failed: ${error.message}`);
  const rows = (data ?? []) as ApplicationRow[];
  return rows[0] ?? null;
}

export async function loadApplication(db: Admin, id: string): Promise<ApplicationRow | null> {
  const { data } = await db.database.from("applications").select("*").eq("id", id).maybeSingle();
  return (data as ApplicationRow | null) ?? null;
}

/** Everything the browser run needs. Throws with a user-facing reason. */
export async function buildInput(db: Admin, app: ApplicationRow, workDir: string): Promise<SubmissionInput> {
  const [jobRes, profileRes, apRes] = await Promise.all([
    db.database.from("jobs").select("id, title, company, ats, match_score, ats_job_id, source_url, external_apply_url").eq("id", app.job_id).eq("user_id", app.user_id).maybeSingle(),
    db.database.from("profiles").select("full_name, email, phone, location, linkedin_url, portfolio_url, work_experience").eq("id", app.user_id).maybeSingle(),
    db.database.from("application_profiles").select("github_url").eq("user_id", app.user_id).maybeSingle(),
  ]);
  const job = jobRes.data as JobRow | null;
  const profile = profileRes.data as ProfileRow | null;
  if (!job) throw new Error("The job for this application no longer exists.");
  if (!profile?.email || !profile.full_name) throw new Error("Your profile needs a name and email before applying.");
  const parsed = parseJobUrl(job.external_apply_url ?? job.source_url ?? "");
  if (!job.ats || !job.ats_job_id || !parsed) {
    throw new Error("JobPilot can only send applications to Greenhouse, Lever and Ashby postings.");
  }

  let resumePath: string | null = null;
  if (app.tailored_resume_key) {
    const { data: blob, error } = await db.storage.from("resumes").download(app.tailored_resume_key);
    if (error || !blob) throw new Error("Couldn't load the tailored resume. Re-tailor this application.");
    const safeName = (profile.full_name.replace(/[^A-Za-z0-9]+/g, "_") || "Resume") + "_Resume.pdf";
    resumePath = join(workDir, safeName);
    await writeFile(resumePath, Buffer.from(await blob.arrayBuffer()));
  }

  const [firstName, ...rest] = profile.full_name.trim().split(/\s+/);
  const current = (profile.work_experience ?? []).find((r) => r.isCurrent) ?? profile.work_experience?.[0];

  return {
    applicationId: app.id,
    userId: app.user_id,
    ats: job.ats,
    boardToken: parsed.boardToken,
    atsJobId: job.ats_job_id,
    company: job.company,
    title: job.title,
    matchScore: job.match_score,
    questions: app.questions,
    answers: app.answers,
    coverLetter: app.cover_letter,
    resumePath,
    resumeKey: app.tailored_resume_key,
    contact: {
      firstName,
      lastName: rest.join(" "),
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      linkedin: profile.linkedin_url ?? "",
      github: (apRes.data as { github_url: string | null } | null)?.github_url ?? "",
      portfolio: profile.portfolio_url ?? "",
      currentCompany: current?.company ?? "",
    },
  };
}

async function uploadScreenshot(db: Admin, app: ApplicationRow, png: Buffer | null): Promise<string | null> {
  if (!png) return null;
  const key = `${app.user_id}/receipts/${app.id}.png`;
  const bucket = db.storage.from("resumes");
  await bucket.remove(key);
  const { error } = await bucket.upload(key, new Blob([new Uint8Array(png)], { type: "image/png" }));
  return error ? null : key;
}

async function log(db: Admin, app: ApplicationRow, level: "success" | "error", message: string) {
  await db.database.from("agent_logs").insert([{ user_id: app.user_id, job_id: app.job_id, level, message }]);
}

export async function markSubmitted(db: Admin, app: ApplicationRow, receipt: Receipt, png: Buffer, label: string) {
  const screenshotKey = await uploadScreenshot(db, app, png);
  const now = new Date().toISOString();
  const { error } = await db.database
    .from("applications")
    .update({ state: "submitted", receipt, screenshot_key: screenshotKey, submitted_at: now, error: null, claimed_by: null, claim_mode: null })
    .eq("id", app.id)
    .eq("state", "submitting");
  if (error) throw new Error(`Couldn't record the submission: ${error.message}`);
  await db.database.from("jobs").update({ status: "applied" }).eq("id", app.job_id).eq("user_id", app.user_id);
  await log(db, app, "success", `Applied to ${label}.`);
}

/** The preview is ready: the user checks the screenshot and clicks Send. Nothing was sent. */
export async function markPreviewReady(db: Admin, app: ApplicationRow, receipt: Receipt, png: Buffer, label: string) {
  const screenshotKey = await uploadScreenshot(db, app, png);
  const { error } = await db.database
    .from("applications")
    .update({
      state: "ready_to_send",
      receipt: { ...receipt, mode: "preview" },
      screenshot_key: screenshotKey,
      error: null,
      claimed_by: null,
      claim_mode: null,
      send_confirmed_at: null,
    })
    .eq("id", app.id)
    .eq("state", "submitting");
  if (error) throw new Error(`Couldn't record the preview: ${error.message}`);
  await log(db, app, "success", `Filled the form for ${label}. Check the preview and click Send.`);
}

export async function markFailed(db: Admin, app: ApplicationRow, reason: string, receipt: Receipt | null, png: Buffer | null, label: string) {
  const screenshotKey = await uploadScreenshot(db, app, png);
  await db.database
    .from("applications")
    .update({ state: "failed", error: reason, receipt, screenshot_key: screenshotKey, claimed_by: null, claim_mode: null, send_confirmed_at: null })
    .eq("id", app.id)
    .eq("state", "submitting");
  await log(db, app, "error", `Couldn't apply to ${label}: ${reason}`);
}
