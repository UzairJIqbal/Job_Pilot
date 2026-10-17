// Shared by the tailoring agent, the job details UI and (later) the
// submission worker. Safe to import from client components.

export type QuestionType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "file";

export type QuestionCategory =
  /** Name, email, phone, links: filled straight from the profile. */
  | "identity"
  /** Resume and cover letter uploads. */
  | "document"
  /** Employer-specific screening questions. */
  | "screening"
  /** Voluntary demographic / EEO questions. */
  | "eeo";

export type ApplicationQuestion = {
  /** The ATS field name or id the worker fills. */
  id: string;
  label: string;
  required: boolean;
  type: QuestionType;
  /** Exact option labels for select types. */
  options: string[];
  category: QuestionCategory;
};

export type AnswerSource = "profile" | "application_profile" | "saved" | "ai" | "eeo" | "user";

export type ApplicationAnswer = {
  questionId: string;
  label: string;
  value: string | string[];
  source: AnswerSource;
  /** True when the agent couldn't answer confidently; the user must look. */
  needsReview: boolean;
  note?: string;
};

export type ApplicationState =
  | "needs_review"
  | "approved"
  | "submitting"
  | "submitted"
  | "failed"
  | "skipped";

export const APPLICATION_STATE_LABELS: Record<ApplicationState, string> = {
  needs_review: "Needs review",
  approved: "Approved",
  submitting: "Submitting",
  submitted: "Submitted",
  failed: "Failed",
  skipped: "Skipped",
};

export type TailoredRole = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
};

export type TailoredResume = {
  summary: string;
  workExperience: TailoredRole[];
  education: { degree: string; fieldOfStudy: string; institution: string; graduationYear: string };
  skills: string[];
  highlights: string[];
};

export type ResumeDiff = {
  summary: { before: string | null; after: string };
  skills: { before: string[]; after: string[]; added: string[]; removed: string[] };
  roles: { company: string; title: string; before: string[]; after: string[] }[];
  highlights: string[];
  /** Claims the agent made that weren't backed by the profile, and were dropped. */
  dropped: string[];
};

/** One form field as the submission worker left it. "skipped" fields were left empty. */
export type ReceiptField = {
  label: string;
  value: string;
  how: "filled" | "fallback" | "skipped" | "dry_run";
  note?: string;
};

/** What the worker did on the employer's form. Stored in applications.receipt. */
export type SubmissionReceipt = {
  mode: "live" | "dry_run";
  formUrl: string;
  finishedAt: string;
  fields: ReceiptField[];
  resume: { key: string | null; uploaded: boolean };
  coverLetter: "file" | "text" | null;
  /** Text the employer showed after submitting. */
  confirmation: string | null;
};

export type ApplicationRow = {
  id: string;
  job_id: string;
  state: ApplicationState;
  tailored_resume: TailoredResume | null;
  resume_diff: ResumeDiff | null;
  tailored_resume_url: string | null;
  tailored_resume_key: string | null;
  cover_letter: string | null;
  questions: ApplicationQuestion[];
  answers: ApplicationAnswer[];
  receipt: SubmissionReceipt | null;
  screenshot_key: string | null;
  error: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  updated_at: string;
};

/* ── EEO ── */

export const EEO_FIELDS = ["gender", "race_ethnicity", "veteran_status", "disability_status"] as const;
export type EeoField = (typeof EEO_FIELDS)[number];

const DECLINE = /decline|don['’]?t wish|do not wish|prefer not|not to (say|answer|disclose)|rather not|choose not/i;

/**
 * Pick the option that matches a stored EEO answer. "decline" (the default)
 * picks the form's opt-out option; anything else must match an option label.
 * Returns null when nothing fits, so the user reviews it.
 */
export function pickEeoOption(stored: string, options: string[]): string | null {
  if (!stored || stored === "decline") return options.find((o) => DECLINE.test(o)) ?? null;
  const want = stored.toLowerCase().trim();
  return (
    options.find((o) => o.toLowerCase().trim() === want) ??
    options.find((o) => o.toLowerCase().startsWith(want)) ??
    null
  );
}

/** Which EEO profile field a demographic question asks about. */
export function eeoFieldFor(label: string): EeoField | null {
  const l = label.toLowerCase();
  if (/veteran/.test(l)) return "veteran_status";
  if (/disab/.test(l)) return "disability_status";
  if (/race|ethnic/.test(l)) return "race_ethnicity";
  if (/gender|sex\b/.test(l)) return "gender";
  return null;
}
