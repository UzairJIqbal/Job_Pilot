"use client";

import { useRouter } from "next/navigation";
import { MATCH_THRESHOLD } from "@/lib/utils";
import { normalizeStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/job-status";

type Job = {
  id: string;
  company: string;
  title: string;
  match_score: number;
  status: string | null;
  salary: string | null;
  source: string;
  found_at: string;
};

type JobsTableProps = {
  jobs: Job[];
};

function getMatchScoreColor(score: number): string {
  if (score >= MATCH_THRESHOLD) return "bg-success";
  if (score >= MATCH_THRESHOLD - 10) return "bg-info";
  return "bg-warning";
}

function getCompanyColor(company: string): string {
  const colors = [
    "bg-accent",
    "bg-info",
    "bg-success",
    "bg-warning",
    "bg-error",
    "bg-info-dark",
    "bg-success-dark",
    "bg-accent-dark",
  ];
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getCompanyInitial(company: string): string {
  return company.charAt(0).toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function JobsTable({ jobs }: JobsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Match Score
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Salary Est.
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
              Date Found
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              onClick={() => router.push(`/find-jobs/${job.id}`)}
              className="cursor-pointer border-b border-border transition-colors hover:bg-surface-secondary"
            >
              {/* Company */}
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getCompanyColor(job.company)}`}
                  >
                    {getCompanyInitial(job.company)}
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {job.company}
                  </span>
                </div>
              </td>

              {/* Role */}
              <td className="px-4 py-4">
                <span className="text-sm text-text-primary">{job.title}</span>
              </td>

              {/* Match Score */}
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-border-light">
                    <div
                      className={`h-full rounded-full ${getMatchScoreColor(job.match_score)}`}
                      style={{ width: `${job.match_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {job.match_score}%
                  </span>
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-4">
                {(() => {
                  const status = normalizeStatus(job.status);
                  const colors = STATUS_COLORS[status];
                  return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  );
                })()}
              </td>

              {/* Salary */}
              <td className="px-4 py-4">
                <span className="text-sm text-text-primary">
                  {job.salary || "Not specified"}
                </span>
              </td>

              {/* Source */}
              <td className="px-4 py-4">
                <span className="inline-flex items-center rounded-full bg-success-lightest px-2.5 py-0.5 text-xs font-medium text-success-foreground">
                  {job.source === "url" ? "URL" : "Search"}
                </span>
              </td>

              {/* Date Found */}
              <td className="px-4 py-4">
                <span className="text-sm text-text-secondary">
                  {formatDate(job.found_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
