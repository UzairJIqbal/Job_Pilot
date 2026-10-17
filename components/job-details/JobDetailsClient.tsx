"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATCH_THRESHOLD, timeAgo, parseMarkdown } from "@/lib/utils";
import { CompanyResearchCard } from "@/components/job-details/CompanyResearchCard";
import { InterviewPrepCard } from "@/components/job-details/InterviewPrepCard";
import { EmailTemplatesCard } from "@/components/job-details/EmailTemplatesCard";
import { TailorCard } from "@/components/job-details/TailorCard";
import type { ApplicationRow } from "@/lib/applications";
import { updateJobStatus } from "@/actions/jobs";
import { JOB_STATUSES, normalizeStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/job-status";
import type { JobStatus } from "@/lib/job-status";
import type { CompanyDossier, InterviewPrepMaterial, EmailTemplates } from "@/types/agent";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  source_url: string | null;
  external_apply_url: string | null;
  about_role: string | null;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  benefits: string[];
  about_company: string | null;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[];
  missing_skills: string[];
  company_research: CompanyDossier | null;
  interview_prep: InterviewPrepMaterial | null;
  email_templates: EmailTemplates | null;
  status: string | null;
  found_at: string;
};

type JobDetailsClientProps = {
  job: Job;
  application: ApplicationRow | null;
};

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

function getMatchScoreColor(score: number): string {
  if (score >= MATCH_THRESHOLD) return "bg-success";
  if (score >= MATCH_THRESHOLD - 10) return "bg-info";
  return "bg-warning";
}

function getMatchScoreLabel(score: number): string {
  if (score >= MATCH_THRESHOLD) return "High Match";
  if (score >= MATCH_THRESHOLD - 10) return "Good Match";
  return "Fair Match";
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

export function JobDetailsClient({ job, application }: JobDetailsClientProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<JobStatus>(normalizeStatus(job.status));
  const [statusError, setStatusError] = useState<string | null>(null);

  // Optimistic, but a failed save puts the old status back and says so.
  const handleStatusChange = async (newStatus: JobStatus) => {
    const previous = localStatus;
    setLocalStatus(newStatus);
    setStatusError(null);
    const result = await updateJobStatus(job.id, newStatus).catch(() => ({ success: false, error: undefined }));
    if (!result.success) {
      setLocalStatus(previous);
      setStatusError(result.error ?? "Couldn't update the status. Please try again.");
    }
  };

  const applyUrl = job.external_apply_url || job.source_url;
  const hasResearch = job.company_research !== null;

  return (
    <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface px-6 py-5">
          {/* Back Link */}
          <button
            onClick={() => router.push("/find-jobs")}
            className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Jobs
          </button>

          {/* Job Header */}
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              {/* Company Info */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white ${getCompanyColor(job.company)}`}
                >
                  {getCompanyInitial(job.company)}
                </div>
                <span className="rounded-full bg-surface-secondary px-3 py-1 text-sm font-medium text-text-primary">
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {job.location}
                  </span>
                )}
                <span className="text-sm text-text-muted">
                  Posted {timeAgo(job.found_at)}
                </span>
              </div>

              {/* Job Title */}
              <h2 className="text-3xl font-bold text-text-slate">
                {job.title}
              </h2>

              {/* Salary */}
              {job.salary && (
                <p className="mt-2 text-sm text-text-secondary">
                  {job.salary}
                </p>
              )}
            </div>

            {/* Match Score + Actions */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              {/* Match Score Badge */}
              {job.match_score != null && (
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white ${getMatchScoreColor(job.match_score)}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {getMatchScoreLabel(job.match_score)}
                  </div>
                  <span className="text-lg font-bold text-text-slate">
                    {job.match_score}/100
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {job.source_url && (
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-secondary"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Visit Job Post
                  </a>
                )}
                {applyUrl && (
                  <a
                    href={applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-success-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-success-darker"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    Apply Now
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Application Status Selector */}
          <div className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Application Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {JOB_STATUSES.map((status) => {
                const isActive = localStatus === status;
                const colors = STATUS_COLORS[status];
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? `${colors.bg} ${colors.text}`
                        : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                );
              })}
            </div>
            {statusError && <p className="mt-2 text-sm text-error-foreground">{statusError}</p>}
          </div>

          {/* Four Summary Boxes */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryBox
              title="About the Role"
              content={job.about_role}
            />
            <SummaryBox
              title="Responsibilities"
              count={job.responsibilities?.length}
              items={job.responsibilities?.slice(0, 2)}
            />
            <SummaryBox
              title="Requirements"
              count={job.requirements?.length}
              items={job.requirements?.slice(0, 2)}
            />
            <SummaryBox
              title="Nice to Have"
              count={job.nice_to_have?.length}
              items={job.nice_to_have?.slice(0, 2)}
            />
          </div>

          {/* Divider */}
          <div className="mb-8 border-t border-border" />

          {/* Role Description */}
          {job.about_role && (
            <section className="mb-8">
              <h3 className="mb-3 text-lg font-semibold text-text-slate">
                Role Description
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                {job.about_role}
              </p>
              {job.source_url && (
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
                >
                  View Full Posting
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </section>
          )}

          {/* AI Match Analysis */}
          {job.match_score != null && (
            <AiMatchAnalysis
              matchScore={job.match_score}
              matchReason={job.match_reason}
              matchedSkills={job.matched_skills}
              missingSkills={job.missing_skills}
            />
          )}

          {/* Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-lg font-semibold text-text-slate">
                Responsibilities
              </h3>
              <ul className="space-y-2">
                {job.responsibilities.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Your Ideal Profile */}
          <section className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-text-slate">
              Your Ideal Profile
            </h3>

            {/* Requirements */}
            {job.requirements && job.requirements.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-sm font-semibold text-text-primary">
                  Requirements
                </h4>
                <ul className="space-y-2">
                  {job.requirements.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Nice to Have */}
            {job.nice_to_have && job.nice_to_have.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-text-primary">
                  Nice to Have
                </h4>
                <ul className="space-y-2">
                  {job.nice_to_have.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <section className="mb-8">
              <h3 className="mb-3 text-lg font-semibold text-text-slate">
                Benefits
              </h3>
              <ul className="space-y-2">
                {job.benefits.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Divider */}
          <div className="mb-8 border-t border-border" />

          {/* Large Apply Now Button */}
          {applyUrl && (
            <div className="mb-8">
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success-dark px-6 py-3.5 text-sm font-medium text-white hover:bg-success-darker sm:w-auto"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
                Apply Now
              </a>
            </div>
          )}

        </div>

        {/* Tailored application — resume, cover letter and form answers to approve */}
        <div id="application" className="scroll-mt-20">
          <TailorCard jobId={job.id} company={job.company} application={application} />
        </div>

        {/* Company Research — separate card below main job card */}
        <div id="company-research" className="scroll-mt-20">
          <CompanyResearchCard
            jobId={job.id}
            company={job.company}
            hasResearch={hasResearch}
            research={job.company_research}
          />
        </div>

        {/* Interview Prep — separate card below company research */}
        <div id="interview-prep" className="scroll-mt-20">
          <InterviewPrepCard
            jobId={job.id}
            company={job.company}
            hasPrep={job.interview_prep !== null}
            prep={job.interview_prep}
          />
        </div>

        {/* Email Templates — separate card below interview prep */}
        <div id="email-templates" className="scroll-mt-20">
          <EmailTemplatesCard
            jobId={job.id}
            company={job.company}
            hasTemplates={job.email_templates !== null}
            templates={job.email_templates}
          />
        </div>

        <p className="text-center text-xs text-text-muted">
          Jobs from Adzuna and company career pages
        </p>
    </div>
  );
}

/* ── AI Match Analysis ── */

type AiMatchAnalysisProps = {
  matchScore: number;
  matchReason: string | null;
  matchedSkills: string[];
  missingSkills: string[];
};

function AiMatchAnalysis({
  matchScore,
  matchReason,
  matchedSkills,
  missingSkills,
}: AiMatchAnalysisProps) {
  const hasContent =
    matchReason ||
    (matchedSkills && matchedSkills.length > 0) ||
    (missingSkills && missingSkills.length > 0);

  if (!hasContent) return null;

  return (
    <section className="mb-8">
      <h3 className="mb-4 text-lg font-semibold text-text-slate">
        AI Match Analysis
      </h3>

      <div className="rounded-lg border border-border bg-surface-secondary p-5">
        {/* Score Bar */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              Match Score
            </span>
            <span className="text-sm font-semibold text-text-slate">
              {matchScore}/100
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full ${getMatchScoreColor(matchScore)}`}
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>

        {/* Match Reasoning */}
        {matchReason && (
          <div
            className="mb-5 text-sm leading-relaxed text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(matchReason) }}
          />
        )}

        {/* Skills Comparison */}
        {((matchedSkills && matchedSkills.length > 0) ||
          (missingSkills && missingSkills.length > 0)) && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Matched Skills */}
            {matchedSkills && matchedSkills.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-text-primary">
                  Required Skills
                </h4>
                <ul className="space-y-2">
                  {matchedSkills.map((skill, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-lightest">
                        <svg
                          className="h-3 w-3 text-success"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Skills */}
            {missingSkills && missingSkills.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-text-primary">
                  Skills Gap
                </h4>
                <ul className="space-y-2">
                  {missingSkills.map((skill, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-lightest">
                        <svg
                          className="h-3 w-3 text-error"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Summary Box ── */

type SummaryBoxProps = {
  title: string;
  content?: string | null;
  count?: number;
  items?: string[];
};

function SummaryBox({ title, content, count, items }: SummaryBoxProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        {title}
      </h4>
      {content && (
        <>
          <p
            className={`text-sm leading-relaxed text-text-secondary ${expanded ? "" : "line-clamp-3"}`}
          >
            {content}
          </p>
          {content.length > 150 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs font-medium text-accent hover:text-accent-dark"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="line-clamp-1 text-sm text-text-secondary"
            >
              • {item}
            </li>
          ))}
          {count && count > 2 && (
            <li className="text-xs text-text-muted">
              +{count - 2} more
            </li>
          )}
        </ul>
      )}
      {!content && (!items || items.length === 0) && (
        <p className="text-sm text-text-muted">No information available</p>
      )}
    </div>
  );
}
