import type { ApplicationAnswer, ApplicationQuestion, SubmissionReceipt as Receipt } from "../../lib/applications";

export type Ats = "greenhouse" | "lever" | "ashby";

/** Everything one run needs, loaded before the browser starts. */
export type SubmissionInput = {
  applicationId: string;
  userId: string;
  ats: Ats;
  boardToken: string;
  atsJobId: string;
  company: string;
  title: string;
  questions: ApplicationQuestion[];
  answers: ApplicationAnswer[];
  coverLetter: string | null;
  /** Local path of the tailored resume PDF. */
  resumePath: string | null;
  resumeKey: string | null;
  contact: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
    currentCompany: string;
  };
};

// Shared with the app, which shows the receipt on job details.
export type { ReceiptField as FieldRecord, SubmissionReceipt as Receipt } from "../../lib/applications";

export type SubmissionResult =
  | { ok: true; receipt: Receipt; screenshot: Buffer }
  | { ok: false; error: string; receipt: Receipt | null; screenshot: Buffer | null };

export type RunOptions = {
  /** Fill the form and take a screenshot, but never upload files or submit. */
  dryRun: boolean;
  /** Let Stagehand fill fields the deterministic pass couldn't find. Needs GEMINI_API_KEY. */
  aiFallback: boolean;
  headless: boolean;
  log: (message: string) => void;
};
