"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseMarkdown } from "@/lib/utils";
import { ProgressModal } from "@/components/ui/ProgressModal";
import type { ProgressStep } from "@/components/ui/ProgressModal";
import type { InterviewPrepMaterial } from "@/types/agent";

/* ── MarkdownText — renders parsed markdown safely ── */

function MarkdownText({ text }: { text: string }) {
  return (
    <div
      className="text-sm leading-relaxed text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary [&_code]:rounded [&_code]:bg-surface-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-medium [&_code]:text-text-dark [&_ul]:space-y-1.5 [&_li]:flex [&_li]:items-start [&_li]:gap-2"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
    />
  );
}

/* ── Section Card ── */

function SectionCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 ${accentColor}`}
    >
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

/* ── STAR Answer Card ── */

function StarCard({
  question,
  whyAsked,
  starAnswer,
  yourAngle,
}: {
  question: string;
  whyAsked: string;
  starAnswer: { situation: string; task: string; action: string; result: string };
  yourAngle: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">{question}</p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-xs font-medium text-accent hover:text-accent-dark"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <p className="mb-3 text-xs text-text-muted">{whyAsked}</p>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Situation
            </span>
            <p className="mt-1 text-sm text-text-secondary">
              {starAnswer.situation}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Task
            </span>
            <p className="mt-1 text-sm text-text-secondary">
              {starAnswer.task}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Action
            </span>
            <p className="mt-1 text-sm text-text-secondary">
              {starAnswer.action}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Result
            </span>
            <p className="mt-1 text-sm text-text-secondary">
              {starAnswer.result}
            </p>
          </div>
          <div className="rounded-lg bg-accent/5 p-3">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Your Angle
            </span>
            <MarkdownText text={yourAngle} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Progress Steps ── */

const INTERVIEW_PREP_STEPS: ProgressStep[] = [
  { label: "Loading context…", durationMs: 1_000 },
  { label: "Analyzing job requirements…", durationMs: 5_000 },
  { label: "Generating prep materials…", durationMs: 8_000 },
  { label: "Structuring answers…", durationMs: 3_000 },
];

/* ── Props ── */

export type InterviewPrepCardProps = {
  jobId: string;
  company: string;
  hasPrep: boolean;
  prep: InterviewPrepMaterial | null;
};

/* ── Interview Prep Card ── */

export function InterviewPrepCard({
  jobId,
  company,
  hasPrep,
  prep,
}: InterviewPrepCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressActive, setProgressActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      stepTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setProgressActive(true);
    setActiveStep(0);
    setProgressComplete(false);
    setProgressError(null);
    setError(null);
    setLoading(true);

    let accumulated = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    INTERVIEW_PREP_STEPS.forEach((step, index) => {
      if (index === 0) return;
      accumulated += INTERVIEW_PREP_STEPS[index - 1].durationMs;
      const timer = setTimeout(() => {
        setActiveStep(index);
      }, accumulated);
      timers.push(timer);
    });
    stepTimersRef.current = timers;

    try {
      const res = await fetch("/api/agent/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!data.success) {
        setProgressError(data.error || "Generation failed");
        setLoading(false);
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

  if (hasPrep && prep) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
            <svg
              className="h-4 w-4 text-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            Interview Prep
          </h3>
        </div>

        {/* Behavioral Questions */}
        {prep.behavioralQuestions && prep.behavioralQuestions.length > 0 && (
          <SectionCard title="Behavioral Questions" accentColor="border-l-accent">
            <div className="space-y-3">
              {prep.behavioralQuestions.map((q, i) => (
                <StarCard
                  key={i}
                  question={q.question}
                  whyAsked={q.whyAsked}
                  starAnswer={q.starAnswer}
                  yourAngle={q.yourAngle}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Technical Questions */}
        {prep.technicalQuestions && prep.technicalQuestions.length > 0 && (
          <SectionCard title="Technical Questions" accentColor="border-l-info">
            <div className="space-y-3">
              {prep.technicalQuestions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface-secondary p-4"
                >
                  <p className="mb-1 text-sm font-medium text-text-primary">
                    {q.question}
                  </p>
                  <p className="mb-2 text-xs text-text-muted">{q.whyAsked}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Suggested Answer
                      </span>
                      <MarkdownText text={q.suggestedAnswer} />
                    </div>
                    <div className="rounded-lg bg-info/5 p-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-info">
                        Depth to Go
                      </span>
                      <p className="mt-1 text-sm text-text-secondary">
                        {q.depthToGo}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Talking Points */}
        {prep.talkingPoints && prep.talkingPoints.length > 0 && (
          <SectionCard title="Talking Points" accentColor="border-l-success">
            <ul className="space-y-1.5">
              {prep.talkingPoints.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <MarkdownText text={item} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Questions to Ask */}
        {prep.questionsToAsk && prep.questionsToAsk.length > 0 && (
          <SectionCard
            title="Questions to Ask the Interviewer"
            accentColor="border-l-warning"
          >
            <ul className="space-y-1.5">
              {prep.questionsToAsk.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <MarkdownText text={item} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Day One Readiness */}
        {prep.dayOneReadiness && (
          <SectionCard title="Day One Readiness" accentColor="border-l-info">
            <MarkdownText text={prep.dayOneReadiness} />
          </SectionCard>
        )}

        {/* Closing Strategy */}
        {prep.closingStrategy && (
          <SectionCard title="Closing Strategy" accentColor="border-l-accent">
            <MarkdownText text={prep.closingStrategy} />
          </SectionCard>
        )}
      </div>
    );
  }

  /* ── Empty state ── */

  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary">
        <svg
          className="h-6 w-6 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">
        Interview Prep
      </h3>
      <p className="mb-4 text-sm text-text-secondary">
        Generate tailored interview prep for {company}.
      </p>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        Generate Interview Prep
      </button>

      <ProgressModal
        isOpen={progressActive}
        title={`Preparing interview for ${company}…`}
        steps={INTERVIEW_PREP_STEPS}
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
    </div>
  );
}
