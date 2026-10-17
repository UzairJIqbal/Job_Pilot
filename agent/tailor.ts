import type { InsForgeClient } from "@insforge/sdk";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdf } from "@/lib/resume-pdf";
import { parseJobUrl, type Ats } from "@/lib/ats";
import { fetchApplicationQuestions } from "@/lib/ats/questions";
import { generateWithRetry, getScoringModel } from "@/agent/scoring";
import { getPostHogClient, shutdownPostHog } from "@/lib/posthog-server";
import {
  eeoFieldFor,
  pickEeoOption,
  type ApplicationAnswer,
  type ApplicationQuestion,
  type ResumeDiff,
  type TailoredResume,
  type TailoredRole,
} from "@/lib/applications";
import type { ApplicationProfileRow } from "@/lib/application-profile";
import type { Education, WorkExperience } from "@/lib/mock-profile";

export type TailorResult =
  | { success: true; applicationId: string }
  | { success: false; error: string; status: number };

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  about_role: string | null;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  ats: Ats | null;
  ats_job_id: string | null;
  source_url: string | null;
  external_apply_url: string | null;
};

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_authorization: string | null;
  current_title: string | null;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperience[];
  education: Education | null;
  salary_expectation: string | null;
  cover_letter_tone: string | null;
};

type ModelOutput = {
  summary?: string;
  skills?: string[];
  highlights?: string[];
  roles?: { index: number; bullets: string[] }[];
  coverLetter?: string;
  answers?: ModelAnswer[];
};

type ModelAnswer = { questionId: string; value: string | string[]; confident?: boolean; basis?: string; note?: string };

const TAILOR_PROMPT = `You tailor a job application for one candidate and one job. You never invent facts.

You get the job posting, the candidate's profile (work history with an index per role), their application answers, saved answers, and the employer's screening questions.

Return ONLY valid JSON:
{
  "summary": string,            // 2-3 resume-style sentences aimed at this role, using only facts from the profile; no name, no "I", no pronouns
  "skills": string[],           // the candidate's own skills, most relevant to this job first; at most 20
  "highlights": string[],       // 2-3 achievements taken from the work history
  "roles": [{ "index": number, "bullets": string[] }],   // one entry per role in the profile, same index
  "coverLetter": string,        // plain text, 180-280 words, no placeholders, signed with the candidate's name
  "answers": [{ "questionId": string, "value": string | string[], "confident": boolean, "basis": "profile" | "saved" | "inferred", "note": string }]
}

Resume rules:
- Rewrite each role's bullets to lead with what this job cares about. Keep 3-6 bullets per role, one line each, strong action verbs.
- Use only facts in that role's original text. Never add employers, titles, dates, tools, numbers or outcomes that aren't there.
- Only list skills the candidate already has (from their skills or work history).

Cover letter rules:
- Match the requested tone. Reference the company and role specifically.
- Open with a specific first sentence about what the candidate would bring to this role. Never open with "I am writing to", "I hope this finds you well" or "I am excited to apply".

Answer rules (one answer for every screening question given):
- select: value must be exactly one of the listed options. multiselect: an array of listed options. boolean: "Yes" or "No".
- text: short. textarea: under 120 words, first person.
- Use the application answers and saved answers first ("basis": "profile" or "saved").
- If the answer depends on something you weren't told, give your best guess with "confident": false and say what to check in "note".
- Consent, terms, privacy notice and recording questions: "confident": false so the candidate decides. Marketing opt-ins: "No".
- Never claim a qualification, clearance, degree or right to work that isn't stated.`;

/* ── helpers ── */

function splitBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•*–·]\s*/, "").trim())
    .filter(Boolean);
}

const NUMBER = /(?<![A-Za-z])\d[\d,.]*%?(?![A-Za-z])/g;

function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map((n) => n.replace(/[,.%]+$/, "").replace(/,/g, ""));
}

function cleanJson(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Answers that come straight from the profile, no AI needed. */
function directAnswer(q: ApplicationQuestion, p: Profile, ap: ApplicationProfileRow | null): ApplicationAnswer | null {
  const base = { questionId: q.id, label: q.label };
  const [first, ...rest] = (p.full_name ?? "").trim().split(/\s+/);
  const label = q.label.toLowerCase();

  if (q.category === "document") {
    const isResume = /resume|cv/i.test(q.id + q.label);
    const isCover = /cover/i.test(q.id + q.label);
    if (isResume || isCover) {
      return { ...base, value: isResume ? "Tailored resume (PDF)" : "Cover letter below", source: "profile", needsReview: false };
    }
    return { ...base, value: "", source: "profile", needsReview: q.required, note: q.required ? "Upload this file yourself" : undefined };
  }

  if (q.category === "eeo") {
    const field = eeoFieldFor(q.label);
    const stored = field && ap ? ap[field] : "decline";
    const option = pickEeoOption(stored, q.options);
    const value = q.type === "multiselect" ? (option ? [option] : []) : (option ?? "");
    return { ...base, value, source: "eeo", needsReview: !option, note: option ? undefined : "Pick an option" };
  }

  if (q.category !== "identity") return null;

  let value: string | null = null;
  if (q.id === "first_name") value = first ?? null;
  else if (q.id === "last_name") value = rest.join(" ") || null;
  else if (q.id === "_systemfield_name" || label === "name" || label === "full name") value = p.full_name;
  else if (q.id.includes("email") || label.includes("email")) value = p.email;
  else if (q.id === "phone" || /phone|contact number|mobile/.test(label)) value = p.phone;
  else if (q.id.includes("location") || label.startsWith("location")) value = p.location;
  else if (label.includes("linkedin")) value = p.linkedin_url;
  else if (label.includes("github")) value = ap?.github_url || p.portfolio_url;
  else if (/website|portfolio/.test(label)) value = p.portfolio_url || ap?.github_url || null;
  else if (q.id === "preferred_name") value = first ?? null;

  return {
    ...base,
    value: value ?? "",
    source: "profile",
    needsReview: !value && q.required,
    note: !value && q.required ? "Missing from your profile" : undefined,
  };
}

/** Make a model answer fit its question, or flag it for review. */
function checkAnswer(q: ApplicationQuestion, raw: ModelAnswer | undefined): ApplicationAnswer {
  const base = { questionId: q.id, label: q.label };
  if (!raw) {
    return { ...base, value: "", source: "ai", needsReview: q.required, note: "No answer drafted" };
  }
  // Essays are composed by the model even when they draw on the profile.
  const source: ApplicationAnswer["source"] =
    raw.basis === "saved" ? "saved" : raw.basis === "profile" && q.type !== "textarea" ? "application_profile" : "ai";
  let needsReview = raw.confident === false;
  let note = raw.note?.trim() || undefined;
  let value: string | string[] = raw.value ?? "";

  if (q.type === "select" || (q.type === "boolean" && q.options.length > 0)) {
    const pick = q.options.find((o) => same(o, String(value)));
    if (!pick) {
      needsReview = true;
      note = note ?? "Pick one of the form's options";
    }
    value = pick ?? "";
  } else if (q.type === "boolean") {
    const v = String(value).trim().toLowerCase();
    value = v === "yes" || v === "true" ? "Yes" : v === "no" || v === "false" ? "No" : "";
    if (!value) needsReview = true;
  } else if (q.type === "multiselect") {
    const list = Array.isArray(value) ? value : [value];
    value = list.map((v) => q.options.find((o) => same(o, String(v)))).filter((v): v is string => !!v);
    if (value.length === 0 && q.required) needsReview = true;
  } else {
    value = Array.isArray(value) ? value.join(", ") : String(value).trim();
    if (!value && q.required) needsReview = true;
  }

  return { ...base, value, source, needsReview, note };
}

/* ── main ── */

export async function tailorApplication(params: {
  client: InsForgeClient;
  userId: string;
  jobId: string;
}): Promise<TailorResult> {
  const { client, userId, jobId } = params;

  const [jobRes, profileRes, apRes, existingRes] = await Promise.all([
    client.database.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle(),
    client.database.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.database.from("application_profiles").select("*").eq("user_id", userId).maybeSingle(),
    client.database.from("applications").select("id, state").eq("job_id", jobId).eq("user_id", userId).maybeSingle(),
  ]);

  const job = jobRes.data as JobRow | null;
  const profile = profileRes.data as Profile | null;
  const ap = apRes.data as ApplicationProfileRow | null;
  if (!job) return { success: false, error: "Job not found", status: 404 };
  if (!profile) return { success: false, error: "Save your profile before tailoring an application.", status: 400 };
  if (!profile.work_experience?.length) {
    return { success: false, error: "Add your work experience to your profile first.", status: 400 };
  }
  const existing = existingRes.data as { id: string; state: string } | null;
  if (existing && (existing.state === "submitting" || existing.state === "submitted")) {
    return { success: false, error: "This application has already been sent.", status: 409 };
  }

  // Form questions, when the posting's ATS publishes them.
  const parsed = parseJobUrl(job.external_apply_url ?? job.source_url ?? "");
  const questions =
    (parsed && job.ats && job.ats_job_id
      ? await fetchApplicationQuestions(job.ats, parsed.boardToken, job.ats_job_id)
      : null) ?? [];

  const direct = new Map<string, ApplicationAnswer>();
  for (const q of questions) {
    const a = directAnswer(q, profile, ap);
    if (a) direct.set(q.id, a);
  }
  const screening = questions.filter((q) => !direct.has(q.id));

  const roles = profile.work_experience.map((r, index) => ({
    index,
    company: r.company,
    title: r.title,
    startDate: r.startDate,
    endDate: r.isCurrent ? "Present" : r.endDate,
    bullets: splitBullets(r.responsibilities ?? ""),
  }));

  const candidate = {
    name: profile.full_name,
    location: profile.location,
    currentTitle: profile.current_title,
    yearsExperience: profile.years_experience,
    workAuthorization: profile.work_authorization,
    salaryExpectation: profile.salary_expectation,
    skills: profile.skills,
    industries: profile.industries,
    education: profile.education,
    roles,
  };
  const applicationAnswers = ap
    ? {
        countriesAuthorizedToWorkIn: ap.authorized_countries,
        needsVisaSponsorship: ap.needs_sponsorship,
        willingToRelocate: ap.willing_to_relocate,
        noticePeriod: ap.notice_period,
        earliestStartDate: ap.earliest_start_date,
        pronouns: ap.pronouns,
      }
    : null;
  const posting = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location ?? ""}`,
    `Description: ${(job.about_role ?? "").slice(0, 12_000)}`,
    job.responsibilities?.length ? `Responsibilities:\n- ${job.responsibilities.join("\n- ")}` : "",
    job.requirements?.length ? `Requirements:\n- ${job.requirements.join("\n- ")}` : "",
    job.nice_to_have?.length ? `Nice to have:\n- ${job.nice_to_have.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let output: ModelOutput;
  try {
    const text = await generateWithRetry(getScoringModel(), [
      TAILOR_PROMPT,
      `\n\nJOB POSTING\n${posting}`,
      `\n\nCANDIDATE PROFILE\n${JSON.stringify(candidate, null, 2)}`,
      `\n\nAPPLICATION ANSWERS\n${JSON.stringify(applicationAnswers, null, 2)}`,
      `\n\nSAVED ANSWERS\n${JSON.stringify(ap?.saved_answers ?? [], null, 2)}`,
      `\n\nCOVER LETTER TONE: ${profile.cover_letter_tone || "professional"}`,
      `\n\nSCREENING QUESTIONS\n${JSON.stringify(
        screening.map((q) => ({ id: q.id, label: q.label, type: q.type, required: q.required, options: q.options })),
        null,
        2,
      )}`,
    ]);
    output = JSON.parse(cleanJson(text)) as ModelOutput;
  } catch (error) {
    console.error("[agent/tailor] model failed:", error);
    const status =
      error && typeof error === "object" && "status" in error ? (error as { status: number }).status : null;
    return {
      success: false,
      error: status === 429 || status === 503
        ? "The AI service is busy or out of quota. Try again in a minute."
        : "Couldn't draft this application. Please try again.",
      status: status === 429 || status === 503 ? 503 : 500,
    };
  }

  /* ── keep only what the profile backs ── */

  const dropped: string[] = [];
  const profileText = JSON.stringify(candidate).toLowerCase();
  const knownNumbers = new Set(numbersIn(JSON.stringify(candidate)));
  const backed = (text: string) => numbersIn(text).every((n) => knownNumbers.has(n));

  const tailoredRoles: TailoredRole[] = roles.map((r) => {
    const fromModel = output.roles?.find((m) => m.index === r.index)?.bullets ?? [];
    const kept = fromModel
      .map((b) => String(b).replace(/^\s*[-•*]\s*/, "").trim())
      .filter((b) => {
        if (backed(b)) return true;
        dropped.push(`${r.company}: "${b}" (a figure not in your profile)`);
        return false;
      })
      .slice(0, 6);
    return {
      company: r.company,
      title: r.title,
      startDate: profile.work_experience[r.index].startDate,
      endDate: profile.work_experience[r.index].endDate,
      isCurrent: profile.work_experience[r.index].isCurrent,
      responsibilities: kept.length ? kept : r.bullets,
    };
  });

  const ownSkills = new Map(profile.skills.map((s) => [s.toLowerCase(), s]));
  const skills: string[] = [];
  for (const s of output.skills ?? []) {
    const key = String(s).trim().toLowerCase();
    if (!key || skills.some((k) => k.toLowerCase() === key)) continue;
    if (ownSkills.has(key)) skills.push(ownSkills.get(key)!);
    else if (profileText.includes(key)) skills.push(String(s).trim());
    else dropped.push(`Skill "${s}" (not in your profile)`);
  }
  for (const s of profile.skills) if (!skills.some((k) => same(k, s))) skills.push(s);

  const highlights = (output.highlights ?? []).map(String).filter((h) => {
    if (backed(h)) return true;
    dropped.push(`Highlight "${h}" (a figure not in your profile)`);
    return false;
  }).slice(0, 3);

  const summary = String(output.summary ?? "").trim();
  const resume: TailoredResume = {
    summary,
    workExperience: tailoredRoles,
    education: profile.education ?? { degree: "", fieldOfStudy: "", institution: "", graduationYear: "" },
    skills: skills.slice(0, 25),
    highlights,
  };

  const diff: ResumeDiff = {
    summary: { before: null, after: summary },
    skills: {
      before: profile.skills,
      after: resume.skills,
      added: resume.skills.filter((s) => !profile.skills.some((p) => same(p, s))),
      removed: profile.skills.filter((p) => !resume.skills.some((s) => same(p, s))),
    },
    roles: roles.map((r, i) => ({
      company: r.company,
      title: r.title,
      before: r.bullets,
      after: tailoredRoles[i].responsibilities,
    })),
    highlights,
    dropped,
  };

  const answers: ApplicationAnswer[] = questions.map(
    (q) => direct.get(q.id) ?? checkAnswer(q, output.answers?.find((a) => a.questionId === q.id)),
  );

  /* ── render and store the PDF ── */

  const pdf = await renderToBuffer(
    ResumePdf({
      fullName: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      location: profile.location ?? "",
      linkedinUrl: profile.linkedin_url ?? "",
      portfolioUrl: profile.portfolio_url ?? "",
      ...resume,
    }),
  );

  const path = `${userId}/tailored/${jobId}.pdf`;
  const bucket = client.storage.from("resumes");
  await bucket.remove(path); // replace any earlier version; a missing file is fine
  const { data: upload, error: uploadError } = await bucket.upload(
    path,
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
  );
  if (uploadError || !upload) {
    console.error("[agent/tailor] upload failed:", uploadError);
    return { success: false, error: "Couldn't save the tailored resume.", status: 500 };
  }

  const row = {
    user_id: userId,
    job_id: jobId,
    state: "needs_review",
    tailored_resume: resume,
    resume_diff: diff,
    tailored_resume_url: upload.url,
    tailored_resume_key: upload.key,
    cover_letter: String(output.coverLetter ?? "").trim(),
    questions,
    answers,
  };

  const { data: saved, error: saveError } = existing
    ? await client.database.from("applications").update(row).eq("id", existing.id).select("id")
    : await client.database.from("applications").insert([row]).select("id");

  if (saveError || !saved?.length) {
    console.error("[agent/tailor] save failed:", saveError);
    return { success: false, error: "Couldn't save the application.", status: 500 };
  }

  const flagged = answers.filter((a) => a.needsReview).length;
  await client.database.from("agent_logs").insert([
    {
      user_id: userId,
      job_id: jobId,
      level: "success",
      message:
        `Tailored application for ${job.title} at ${job.company}: ${questions.length} form questions, ` +
        `${flagged} to review${dropped.length ? `, ${dropped.length} unbacked claims removed` : ""}.`,
    },
  ]);

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "application_tailored",
    properties: { userId, jobId, ats: job.ats, questions: questions.length, flagged, dropped: dropped.length },
  });
  await shutdownPostHog();

  return { success: true, applicationId: saved[0].id };
}
