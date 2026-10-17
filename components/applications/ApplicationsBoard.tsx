"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Search, Building2, CalendarCheck, Mail } from "lucide-react";
import { updateJobStatus } from "@/actions/jobs";
import { PIPELINE_STAGES, STATUS_LABELS, JOB_STATUSES, type JobStatus } from "@/lib/job-status";
import type { PipelineJob } from "@/lib/pipeline";
import { CompanyAvatar, MatchBadge } from "@/components/ui/JobBits";
import { timeAgo } from "@/lib/utils";

const STAGE_DOT: Record<JobStatus, string> = {
  saved: "bg-text-muted",
  applied: "bg-info",
  replied: "bg-warning",
  interviewing: "bg-success",
  offer: "bg-success-dark",
  rejected: "bg-error",
};

function ReadinessChips({ job }: { job: PipelineJob }) {
  const chips = [
    { on: job.hasResearch, icon: Building2, label: "Research" },
    { on: job.hasPrep, icon: CalendarCheck, label: "Prep" },
    { on: job.hasEmails, icon: Mail, label: "Emails" },
  ].filter((c) => c.on);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-sm bg-surface-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-secondary"
        >
          <Icon className="h-3 w-3" />
          {label}
        </span>
      ))}
    </div>
  );
}

function JobCard({
  job,
  onMove,
  pending,
}: {
  job: PipelineJob;
  onMove: (status: JobStatus) => void;
  pending: boolean;
}) {
  return (
    <li className={`rounded-lg border border-border bg-surface p-3 shadow-card transition-opacity ${pending ? "opacity-60" : ""}`}>
      <Link href={`/find-jobs/${job.id}`} className="group flex items-start gap-3">
        <CompanyAvatar company={job.company} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-text-primary group-hover:text-accent">{job.title}</p>
          <p className="truncate text-xs text-text-secondary">{job.company}</p>
        </div>
        <MatchBadge score={job.matchScore} />
      </Link>

      <div className="mt-3 space-y-2.5">
        <ReadinessChips job={job} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-muted">Found {timeAgo(job.foundAt)}</span>
          <label className="sr-only" htmlFor={`move-${job.id}`}>
            Move {job.title}
          </label>
          <select
            id={`move-${job.id}`}
            value={job.status}
            disabled={pending}
            onChange={(e) => onMove(e.target.value as JobStatus)}
            className="h-7 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text-secondary outline-none focus:border-accent"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}

export function ApplicationsBoard({ initialJobs }: { initialJobs: PipelineJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q));
  }, [jobs, query]);

  const move = (id: string, status: JobStatus) => {
    const previous = jobs;
    setError(null);
    setPendingId(id);
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, status } : j)));

    startTransition(async () => {
      const result = await updateJobStatus(id, status);
      if (!result.success) {
        setJobs(previous);
        setError(result.error ?? "Couldn't update that job. Try again.");
      }
      setPendingId(null);
    });
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <p className="text-sm font-medium text-text-primary">No applications yet</p>
        <p className="mt-1 text-sm text-text-secondary">Search for jobs and they&apos;ll show up here, ready to track.</p>
        <Link
          href="/find-jobs"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-dark"
        >
          <Search className="h-4 w-4" />
          Find jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title or company"
          aria-label="Filter applications"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-error-light bg-error-lightest px-3 py-2 text-sm text-error-foreground">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PIPELINE_STAGES.map((stage) => {
          const items = visible.filter((j) => j.status === stage.status);
          return (
            <section
              key={stage.status}
              id={stage.status}
              aria-labelledby={`stage-${stage.status}`}
              className="scroll-mt-20 rounded-xl border border-border bg-surface-secondary p-3"
            >
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stage.status]}`} />
                <h2 id={`stage-${stage.status}`} className="text-sm font-semibold text-text-primary">
                  {stage.title}
                </h2>
                <span className="ml-auto text-xs font-medium tabular-nums text-text-muted">{items.length}</span>
              </header>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
                  {query ? "No matches in this stage." : stage.empty}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      pending={pendingId === job.id}
                      onMove={(status) => move(job.id, status)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
