"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseMarkdown } from "@/lib/utils";
import { ProgressModal } from "@/components/ui/ProgressModal";
import type { ProgressStep } from "@/components/ui/ProgressModal";
import type { CompanyDossier } from "@/types/agent";

/* ── Normalize Gemini type drift ── */

function normalizeDossier(raw: CompanyDossier): CompanyDossier {
  return {
    companyOverview:
      typeof raw.companyOverview === "string" ? raw.companyOverview : "",
    techStack: Array.isArray(raw.techStack) ? raw.techStack : [],
    culture: Array.isArray(raw.culture) ? raw.culture : [],
    whyThisRole:
      typeof raw.whyThisRole === "string" ? raw.whyThisRole : "",
    yourEdge: Array.isArray(raw.yourEdge) ? raw.yourEdge : [],
    gapsToAddress: Array.isArray(raw.gapsToAddress)
      ? raw.gapsToAddress
      : [],
    smartQuestions: Array.isArray(raw.smartQuestions)
      ? raw.smartQuestions
      : [],
    interviewPrep: Array.isArray(raw.interviewPrep)
      ? raw.interviewPrep
      : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
  };
}

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

const COMPANY_RESEARCH_STEPS: ProgressStep[] = [
  { label: "Loading profile data…", durationMs: 1_000 },
  { label: "Browsing company website…", durationMs: 15_000 },
  { label: "Analyzing with AI…", durationMs: 10_000 },
  { label: "Compiling research…", durationMs: 3_000 },
];

/* ── Props ── */

export type CompanyResearchCardProps = {
  jobId: string;
  company: string;
  hasResearch: boolean;
  research: CompanyDossier | null;
};

/* ── Company Research Card ── */

export function CompanyResearchCard({
  jobId,
  company,
  hasResearch,
  research,
}: CompanyResearchCardProps) {
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

  const handleResearch = useCallback(async () => {
    setProgressActive(true);
    setActiveStep(0);
    setProgressComplete(false);
    setProgressError(null);
    setError(null);
    setLoading(true);

    let accumulated = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    COMPANY_RESEARCH_STEPS.forEach((step, index) => {
      if (index === 0) return;
      accumulated += COMPANY_RESEARCH_STEPS[index - 1].durationMs;
      const timer = setTimeout(() => {
        setActiveStep(index);
      }, accumulated);
      timers.push(timer);
    });
    stepTimersRef.current = timers;

    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!data.success) {
        setProgressError(data.error || "Research failed");
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

  if (hasResearch && research) {
    const d = normalizeDossier(research);

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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            Company Research
          </h3>
        </div>

        {/* Overview */}
        {d.companyOverview && (
          <SectionCard title="Overview" accentColor="border-l-accent">
            <MarkdownText text={d.companyOverview} />
          </SectionCard>
        )}

        {/* Tech Stack */}
        {d.techStack.length > 0 && (
          <SectionCard title="Tech Stack" accentColor="border-l-info">
            <div className="flex flex-wrap gap-2">
              {d.techStack.map((tech, i) => (
                <span
                  key={i}
                  className="rounded-full bg-surface-tertiary px-3 py-1 text-xs font-medium text-text-primary"
                >
                  <MarkdownText text={tech} />
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Culture */}
        {d.culture.length > 0 && (
          <SectionCard title="Culture" accentColor="border-l-warning">
            <ul className="space-y-1.5">
              {d.culture.map((item, i) => (
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

        {/* Why This Role */}
        {d.whyThisRole && (
          <SectionCard title="Why This Role" accentColor="border-l-accent">
            <MarkdownText text={d.whyThisRole} />
          </SectionCard>
        )}

        {/* Your Edge */}
        {d.yourEdge.length > 0 && (
          <SectionCard title="Your Edge" accentColor="border-l-success">
            <ul className="space-y-1.5">
              {d.yourEdge.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-lightest">
                    <svg
                      className="h-2.5 w-2.5 text-success"
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
                  <MarkdownText text={item} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Gaps to Address */}
        {d.gapsToAddress.length > 0 && (
          <SectionCard title="Gaps to Address" accentColor="border-l-warning">
            <ul className="space-y-1.5">
              {d.gapsToAddress.map((item, i) => (
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

        {/* Smart Questions */}
        {d.smartQuestions.length > 0 && (
          <SectionCard
            title="Smart Questions to Ask"
            accentColor="border-l-info"
          >
            <ul className="space-y-1.5">
              {d.smartQuestions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                  <MarkdownText text={item} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Interview Prep */}
        {d.interviewPrep.length > 0 && (
          <SectionCard
            title="Interview Prep"
            accentColor="border-l-accent"
          >
            <ul className="space-y-1.5">
              {d.interviewPrep.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <MarkdownText text={item} />
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Sources */}
        {d.sources.length > 0 && (
          <SectionCard title="Sources" accentColor="border-l-border">
            <div className="flex flex-wrap gap-2">
              {d.sources.map((source, i) => {
                const isUrl = /^https?:\/\//.test(source);
                return (
                  <span key={i} className="text-xs text-text-muted">
                    {isUrl ? (
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-dark hover:underline"
                      >
                        {source}
                      </a>
                    ) : (
                      source
                    )}
                    {i < d.sources.length - 1 && " ·"}
                  </span>
                );
              })}
            </div>
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
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">
        Company Research
      </h3>
      <p className="mb-4 text-sm text-text-secondary">
        No research available for {company} yet.
      </p>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <button
        onClick={handleResearch}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-success-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-success-darker disabled:cursor-not-allowed disabled:opacity-60"
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Research Company
      </button>

      <ProgressModal
        isOpen={progressActive}
        title={`Researching ${company}…`}
        steps={COMPANY_RESEARCH_STEPS}
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
