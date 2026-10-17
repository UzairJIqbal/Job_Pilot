"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProgressModal } from "@/components/ui/ProgressModal";
import type { ProgressStep } from "@/components/ui/ProgressModal";
import {
  APPLICATION_STATE_LABELS,
  type ApplicationAnswer,
  type ApplicationQuestion,
  type ApplicationRow,
  type ApplicationState,
  type ResumeDiff,
  type SubmissionReceipt,
} from "@/lib/applications";

/* ── Progress Steps ── */

const TAILOR_STEPS: ProgressStep[] = [
  { label: "Reading the application form…", durationMs: 2_000 },
  { label: "Matching your experience to the role…", durationMs: 6_000 },
  { label: "Drafting cover letter and answers…", durationMs: 8_000 },
  { label: "Checking claims against your profile…", durationMs: 2_000 },
  { label: "Rendering tailored resume…", durationMs: 3_000 },
];

const STATE_STYLES: Record<ApplicationState, string> = {
  needs_review: "bg-warning-lightest text-warning-foreground",
  approved: "bg-success-lightest text-success-foreground",
  submitting: "bg-surface-tertiary text-text-primary",
  submitted: "bg-success-lightest text-success-foreground",
  failed: "bg-error-lightest text-error-foreground",
  skipped: "bg-surface-tertiary text-text-secondary",
};

const SOURCE_LABELS: Record<ApplicationAnswer["source"], string> = {
  profile: "Profile",
  application_profile: "Application answers",
  saved: "Saved answer",
  ai: "AI draft",
  eeo: "Self-ID",
  user: "Edited by you",
};

/* ── Props ── */

export type TailorCardProps = {
  jobId: string;
  company: string;
  application: ApplicationRow | null;
};

/* ── Tailor Card ── */

export function TailorCard({ jobId, company, application }: TailorCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progressActive, setProgressActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => stepTimersRef.current.forEach(clearTimeout);
  }, []);

  const handleTailor = useCallback(async () => {
    setProgressActive(true);
    setActiveStep(0);
    setProgressComplete(false);
    setProgressError(null);
    setLoading(true);

    let accumulated = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    TAILOR_STEPS.forEach((step, index) => {
      if (index === 0) return;
      accumulated += TAILOR_STEPS[index - 1].durationMs;
      timers.push(setTimeout(() => setActiveStep(index), accumulated));
    });
    stepTimersRef.current = timers;

    try {
      const res = await fetch("/api/agent/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!data.success) {
        setProgressError(data.error || "Tailoring failed");
        return;
      }

      setProgressComplete(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setProgressActive(false);
      setProgressComplete(false);
      setActiveStep(0);
      router.refresh();
    } catch {
      setProgressError("Network error — please try again");
    } finally {
      timers.forEach(clearTimeout);
      stepTimersRef.current = [];
      setLoading(false);
    }
  }, [jobId, router]);

  const progress = (
    <ProgressModal
      isOpen={progressActive}
      title={`Tailoring your application to ${company}…`}
      steps={TAILOR_STEPS}
      activeStep={activeStep}
      isComplete={progressComplete}
      error={progressError}
      onDismiss={() => {
        setProgressActive(false);
        setProgressError(null);
        setProgressComplete(false);
        setActiveStep(0);
      }}
    />
  );

  if (application) {
    return (
      <>
        <ApplicationReview
          // Remount when a re-tailor or save replaces the row, so drafts reset.
          key={application.updated_at}
          application={application}
          onRetailor={handleTailor}
          retailoring={loading}
        />
        {progress}
      </>
    );
  }

  /* ── Empty state ── */

  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary">
        <DocIcon className="h-6 w-6 text-text-muted" strokeWidth={1.5} />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">Tailored Application</h3>
      <p className="mb-4 text-sm text-text-secondary">
        Draft a tailored resume, cover letter and form answers for {company}. Nothing is sent until
        you approve it.
      </p>
      <button
        onClick={handleTailor}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-info-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-info-darker disabled:cursor-not-allowed disabled:opacity-60"
      >
        <DocIcon className="h-4 w-4" strokeWidth={2} />
        Tailor Application
      </button>
      {progress}
    </div>
  );
}

/* ── Review (filled state) ── */

type ReviewProps = {
  application: ApplicationRow;
  onRetailor: () => void;
  retailoring: boolean;
};

function ApplicationReview({ application, onRetailor, retailoring }: ReviewProps) {
  const router = useRouter();
  const locked = application.state === "submitting" || application.state === "submitted";
  const [coverLetter, setCoverLetter] = useState(application.cover_letter ?? "");
  const [values, setValues] = useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(application.answers.map((a) => [a.questionId, a.value])),
  );
  // Answers the user changed or confirmed; only these are sent on save.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questions = new Map(application.questions.map((q) => [q.id, q]));
  const coverChanged = coverLetter !== (application.cover_letter ?? "");
  const dirty = coverChanged || touched.size > 0;
  const flagged = application.answers.filter((a) => a.needsReview && !touched.has(a.questionId));

  function setAnswer(id: string, value: string | string[]) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setTouched((prev) => new Set(prev).add(id));
  }

  async function patch(extra: { state?: ApplicationState } = {}) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const body: Record<string, unknown> = { ...extra };
    if (coverChanged) body.coverLetter = coverLetter;
    if (touched.size > 0) {
      body.answers = [...touched].map((questionId) => ({ questionId, value: values[questionId] }));
    }
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Couldn't save changes");
        return;
      }
      setMessage(extra.state ? `Marked as ${APPLICATION_STATE_LABELS[extra.state].toLowerCase()}` : "Saved");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
          <DocIcon className="h-4 w-4 text-text-secondary" strokeWidth={2} />
        </div>
        <h3 className="text-base font-semibold text-text-primary">Tailored Application</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[application.state]}`}>
          {APPLICATION_STATE_LABELS[application.state]}
        </span>
        {application.tailored_resume_key && (
          <a
            href={`/api/applications/${application.id}/resume`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-medium text-accent hover:underline"
          >
            View tailored resume ↗
          </a>
        )}
      </div>

      {application.state === "failed" && application.error && (
        <p className="rounded-lg bg-error-lightest px-4 py-3 text-sm text-error-foreground">{application.error}</p>
      )}

      {application.receipt && (
        <ReceiptSection
          receipt={application.receipt}
          submittedAt={application.state === "submitted" ? application.submitted_at : null}
          screenshotHref={application.screenshot_key ? `/api/applications/${application.id}/screenshot` : null}
        />
      )}

      {application.resume_diff && <DiffSection diff={application.resume_diff} />}

      {/* Cover letter */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-3 text-sm font-semibold text-text-primary">Cover Letter</h4>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          disabled={locked}
          rows={10}
          className="w-full rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm leading-relaxed text-text-primary focus:border-accent focus:outline-none disabled:opacity-70"
        />
      </div>

      {/* Answers */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-text-primary">Form Answers</h4>
          {flagged.length > 0 && (
            <span className="rounded-full bg-warning-lightest px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
              {flagged.length} to review
            </span>
          )}
        </div>
        {application.answers.length === 0 ? (
          <p className="text-sm text-text-secondary">
            The form asks nothing beyond your contact details and resume.
          </p>
        ) : (
          <ul className="space-y-4">
            {application.answers.map((answer) => (
              <AnswerRow
                key={answer.questionId}
                answer={answer}
                question={questions.get(answer.questionId)}
                value={values[answer.questionId] ?? ""}
                confirmed={touched.has(answer.questionId)}
                disabled={locked}
                onChange={(v) => setAnswer(answer.questionId, v)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => patch({ state: "approved" })}
            disabled={busy || flagged.length > 0}
            title={flagged.length > 0 ? "Review the flagged answers first" : undefined}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {application.state === "approved" ? "Approved" : "Approve"}
          </button>
          {dirty && (
            <button
              onClick={() => patch()}
              disabled={busy}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:opacity-60"
            >
              Save changes
            </button>
          )}
          {application.state !== "skipped" ? (
            <button
              onClick={() => patch({ state: "skipped" })}
              disabled={busy}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-60"
            >
              Skip
            </button>
          ) : (
            <button
              onClick={() => patch({ state: "needs_review" })}
              disabled={busy}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-60"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onRetailor}
            disabled={busy || retailoring}
            className="ml-auto rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-60"
          >
            Re-tailor
          </button>
        </div>
      )}
      {message && <p className="text-sm text-success-foreground">{message}</p>}
      {error && <p className="text-sm text-error-foreground">{error}</p>}
    </div>
  );
}

/* ── Receipt ── */

const HOW_LABELS: Record<SubmissionReceipt["fields"][number]["how"], string> = {
  filled: "Filled",
  fallback: "Filled by AI",
  skipped: "Left empty",
  dry_run: "Test run",
};

function ReceiptSection({
  receipt,
  submittedAt,
  screenshotHref,
}: {
  receipt: SubmissionReceipt;
  submittedAt: string | null;
  screenshotHref: string | null;
}) {
  const when = new Date(submittedAt ?? receipt.finishedAt).toLocaleString();
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold text-text-primary">Receipt</h4>
        <span className="text-xs text-text-muted">
          {submittedAt ? `Sent ${when}` : `Attempted ${when}`}
        </span>
        <span className="ml-auto flex gap-3 text-sm font-medium">
          {screenshotHref && (
            <a href={screenshotHref} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Screenshot ↗
            </a>
          )}
          <a href={receipt.formUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Employer form ↗
          </a>
        </span>
      </div>
      {receipt.confirmation && (
        <p className="mb-3 rounded-lg bg-success-lightest px-4 py-3 text-sm text-success-foreground">
          {receipt.confirmation}
        </p>
      )}
      <p className="mb-3 text-sm text-text-secondary">
        Resume {receipt.resume.uploaded ? "attached" : "not attached"}
        {receipt.coverLetter ? ` · cover letter ${receipt.coverLetter === "file" ? "attached" : "pasted"}` : ""}
      </p>
      {receipt.fields.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-text-primary">
            {receipt.fields.length} fields
          </summary>
          <ul className="mt-3 divide-y divide-border-light">
            {receipt.fields.map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-text-secondary">{f.label}</span>
                <span className="min-w-0 flex-1 break-words text-text-primary">{f.value || "—"}</span>
                <span
                  className={`text-xs ${f.how === "skipped" ? "text-warning-foreground" : "text-text-muted"}`}
                  title={f.note}
                >
                  {HOW_LABELS[f.how]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ── Answer row ── */

type AnswerRowProps = {
  answer: ApplicationAnswer;
  question: ApplicationQuestion | undefined;
  value: string | string[];
  confirmed: boolean;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
};

function AnswerRow({ answer, question, value, confirmed, disabled, onChange }: AnswerRowProps) {
  const needsLook = answer.needsReview && !confirmed;
  const type = question?.type ?? "text";
  const options = question?.options ?? [];
  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none disabled:opacity-70";

  let input: React.ReactNode;
  if (type === "file") {
    input = <p className="text-sm text-text-secondary">{String(value) || "Attached when submitting"}</p>;
  } else if (type === "multiselect" && options.length > 0) {
    const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
    input = (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="inline-flex items-center gap-1.5 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={selected.has(o)}
              disabled={disabled}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(o);
                else next.delete(o);
                onChange(options.filter((x) => next.has(x)));
              }}
            />
            {o}
          </label>
        ))}
      </div>
    );
  } else if ((type === "select" || type === "boolean") && options.length > 0) {
    input = (
      <select
        value={Array.isArray(value) ? value[0] ?? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (type === "textarea") {
    input = (
      <textarea
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className={inputClass}
      />
    );
  } else {
    input = (
      <input
        type="text"
        value={Array.isArray(value) ? value.join(", ") : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      />
    );
  }

  return (
    <li className={`rounded-lg border p-3 ${needsLook ? "border-warning bg-warning-lightest/40" : "border-border"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-primary">
          {answer.label}
          {question?.required && <span className="text-error"> *</span>}
        </span>
        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[11px] text-text-secondary">
          {confirmed ? SOURCE_LABELS.user : SOURCE_LABELS[answer.source]}
        </span>
        {needsLook && !disabled && (
          <button
            type="button"
            onClick={() => onChange(value)}
            className="ml-auto text-xs font-medium text-accent hover:underline"
          >
            Looks right
          </button>
        )}
      </div>
      {input}
      {answer.note && needsLook && <p className="mt-1.5 text-xs text-warning-foreground">{answer.note}</p>}
    </li>
  );
}

/* ── Resume diff ── */

function DiffSection({ diff }: { diff: ResumeDiff }) {
  const [open, setOpen] = useState(false);
  const changedRoles = diff.roles.filter((r) => JSON.stringify(r.before) !== JSON.stringify(r.after));

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <h4 className="text-sm font-semibold text-text-primary">What changed in your resume</h4>
        <span className="text-xs text-text-secondary">
          {changedRoles.length} role{changedRoles.length === 1 ? "" : "s"} reworded
          {diff.skills.added.length > 0 && ` · ${diff.skills.added.length} skills surfaced`}
          {open ? " ▲" : " ▼"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Summary</p>
            {diff.summary.before && (
              <p className="mb-1 text-text-muted line-through decoration-text-muted/50">{diff.summary.before}</p>
            )}
            <p className="text-text-primary">{diff.summary.after}</p>
          </div>

          {(diff.skills.added.length > 0 || diff.skills.removed.length > 0) && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {diff.skills.added.map((s) => (
                  <span key={`+${s}`} className="rounded-full bg-success-lightest px-2 py-0.5 text-xs text-success-foreground">
                    + {s}
                  </span>
                ))}
                {diff.skills.removed.map((s) => (
                  <span key={`-${s}`} className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-muted line-through">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {changedRoles.map((role) => (
            <div key={`${role.company}-${role.title}`}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                {role.title} · {role.company}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <ul className="list-disc space-y-1 pl-4 text-text-muted">
                  {role.before.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1 pl-4 text-text-primary">
                  {role.after.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {diff.highlights.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Highlights</p>
              <ul className="list-disc space-y-1 pl-4 text-text-primary">
                {diff.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {diff.dropped.length > 0 && (
            <div className="rounded-lg bg-warning-lightest px-3 py-2">
              <p className="mb-1 text-xs font-medium text-warning-foreground">
                Removed because your profile doesn&apos;t back them up
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-warning-foreground">
                {diff.dropped.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Icon ── */

function DocIcon({ className, strokeWidth }: { className: string; strokeWidth: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
