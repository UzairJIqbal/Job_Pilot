import Link from "next/link";
import { ArrowRight, CalendarCheck, Inbox, Mail, Sparkles, CheckCircle2 } from "lucide-react";
import type { NextAction, PipelineJob } from "@/lib/pipeline";
import { PIPELINE_STAGES, type JobStatus } from "@/lib/job-status";
import { CompanyAvatar, MatchBadge } from "@/components/ui/JobBits";
import { timeAgo } from "@/lib/utils";

const ACTION_ICONS: Record<NextAction["kind"], React.ElementType> = {
  review: Inbox,
  prep: CalendarCheck,
  apply: Sparkles,
  "follow-up": Mail,
};

const ACTION_TONES: Record<NextAction["kind"], string> = {
  review: "bg-warning-lightest text-warning-foreground",
  prep: "bg-success-lightest text-success-foreground",
  apply: "bg-accent-light text-accent",
  "follow-up": "bg-info-lightest text-info-foreground",
};

export function NeedsYou({ actions }: { actions: NextAction[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Needs you</h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-semibold text-accent">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-8">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium text-text-primary">Nothing needs you right now.</p>
            <p className="text-sm text-text-secondary">Run a new search to find fresh matches.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.kind];
            return (
              <li key={action.id}>
                <Link
                  href={action.href}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-secondary"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACTION_TONES[action.kind]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{action.title}</p>
                    <p className="truncate text-xs text-text-secondary">{action.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    {action.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PipelineStrip({ counts }: { counts: Record<JobStatus, number> }) {
  return (
    <section aria-label="Pipeline" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {PIPELINE_STAGES.map((stage) => (
        <Link
          key={stage.status}
          href={`/applications#${stage.status}`}
          className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-card transition-colors hover:border-border-strong"
        >
          <p className="text-xs font-medium text-text-secondary">{stage.title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{counts[stage.status]}</p>
        </Link>
      ))}
    </section>
  );
}

export function TopMatches({ jobs }: { jobs: PipelineJob[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Top matches</h2>
        <Link href="/find-jobs" className="text-xs font-medium text-accent hover:text-accent-dark">
          See all
        </Link>
      </div>
      {jobs.length === 0 ? (
        <p className="px-5 py-8 text-sm text-text-secondary">
          No saved matches yet.{" "}
          <Link href="/find-jobs" className="font-medium text-accent hover:text-accent-dark">
            Search for jobs
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/find-jobs/${job.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-secondary"
              >
                <CompanyAvatar company={job.company} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{job.title}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ""} · {timeAgo(job.foundAt)}
                  </p>
                </div>
                <MatchBadge score={job.matchScore} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
