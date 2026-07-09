export type JobStatus = "saved" | "applied" | "interviewing" | "rejected";

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  saved: { bg: "bg-surface-tertiary", text: "text-text-secondary" },
  applied: { bg: "bg-info-lightest", text: "text-info-foreground" },
  interviewing: { bg: "bg-success-lightest", text: "text-success-foreground" },
  rejected: { bg: "bg-error-lightest", text: "text-error-foreground" },
};

export function normalizeStatus(dbStatus: string | null | undefined): JobStatus {
  if (!dbStatus || dbStatus === "null") return "saved";
  if (dbStatus === "applied" || dbStatus === "interviewing" || dbStatus === "rejected") return dbStatus;
  return "saved";
}
