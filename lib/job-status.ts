export type JobStatus = "saved" | "applied" | "replied" | "interviewing" | "offer" | "rejected";

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  replied: "Replied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  saved: { bg: "bg-surface-tertiary", text: "text-text-secondary" },
  applied: { bg: "bg-info-lightest", text: "text-info-foreground" },
  replied: { bg: "bg-warning-lightest", text: "text-warning-foreground" },
  interviewing: { bg: "bg-success-lightest", text: "text-success-foreground" },
  offer: { bg: "bg-success-light", text: "text-success-darker" },
  rejected: { bg: "bg-error-lightest", text: "text-error-foreground" },
};

export const JOB_STATUSES: JobStatus[] = ["saved", "applied", "replied", "interviewing", "offer", "rejected"];

export function normalizeStatus(dbStatus: string | null | undefined): JobStatus {
  return (JOB_STATUSES as (string | null | undefined)[]).includes(dbStatus) ? (dbStatus as JobStatus) : "saved";
}

/** Pipeline columns, in the order a job moves through them. */
export const PIPELINE_STAGES: Array<{ status: JobStatus; title: string; empty: string }> = [
  { status: "saved", title: "Saved", empty: "Jobs you keep from a search land here." },
  { status: "applied", title: "Applied", empty: "Sent applications land here, from JobPilot or marked by you." },
  { status: "replied", title: "Replied", empty: "Move a job here when the company writes back." },
  { status: "interviewing", title: "Interviewing", empty: "No interviews yet — they'll show up here." },
  { status: "offer", title: "Offer", empty: "Offers you've received." },
  { status: "rejected", title: "Closed", empty: "Roles that didn't work out." },
];
