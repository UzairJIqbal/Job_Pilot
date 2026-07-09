"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseMarkdown } from "@/lib/utils";
import { ProgressModal } from "@/components/ui/ProgressModal";
import type { ProgressStep } from "@/components/ui/ProgressModal";
import type { EmailTemplates } from "@/types/agent";

/* ── MarkdownText — renders parsed markdown safely ── */

function MarkdownText({ text }: { text: string }) {
  return (
    <div
      className="text-sm leading-relaxed text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary [&_code]:rounded [&_code]:bg-surface-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-medium [&_code]:text-text-dark [&_ul]:space-y-1.5 [&_li]:flex [&_li]:items-start [&_li]:gap-2"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
    />
  );
}

/* ── Progress Steps ── */

const EMAIL_TEMPLATES_STEPS: ProgressStep[] = [
  { label: "Loading profile…", durationMs: 1_000 },
  { label: "Analyzing role and company…", durationMs: 4_000 },
  { label: "Drafting emails…", durationMs: 7_000 },
  { label: "Finalizing templates…", durationMs: 2_000 },
];

/* ── Tab Config ── */

const TABS = [
  { key: "networking" as const, label: "Networking" },
  { key: "followUp" as const, label: "Follow-up" },
  { key: "thankYou" as const, label: "Thank You" },
];

/* ── Props ── */

export type EmailTemplatesCardProps = {
  jobId: string;
  company: string;
  hasTemplates: boolean;
  templates: EmailTemplates | null;
};

/* ── Email Templates Card ── */

export function EmailTemplatesCard({
  jobId,
  company,
  hasTemplates,
  templates,
}: EmailTemplatesCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressActive, setProgressActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<"networking" | "followUp" | "thankYou">("networking");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      stepTimersRef.current.forEach(clearTimeout);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
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
    EMAIL_TEMPLATES_STEPS.forEach((step, index) => {
      if (index === 0) return;
      accumulated += EMAIL_TEMPLATES_STEPS[index - 1].durationMs;
      const timer = setTimeout(() => {
        setActiveStep(index);
      }, accumulated);
      timers.push(timer);
    });
    stepTimersRef.current = timers;

    try {
      const res = await fetch("/api/agent/email-templates", {
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

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently fail
    }
  }, []);

  if (hasTemplates && templates) {
    const currentTemplate = templates[activeTab];

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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            Email Templates
          </h3>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 rounded-lg bg-surface-secondary p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Email Content */}
        <div className="rounded-xl border border-border bg-surface p-5">
          {/* Subject Line */}
          <div className="mb-4">
            <span className="rounded-full bg-surface-tertiary px-3 py-1 text-xs font-medium text-text-primary">
              Subject: {currentTemplate.subject}
            </span>
          </div>

          {/* Email Body */}
          <div className="rounded-lg border border-border bg-surface-secondary p-5">
            <MarkdownText text={currentTemplate.body} />
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => handleCopy(`Subject: ${currentTemplate.subject}\n\n${currentTemplate.body}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary"
            >
              {copied ? (
                <>
                  <svg
                    className="h-4 w-4 text-success"
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
                  Copied!
                </>
              ) : (
                <>
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
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
        </div>
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">
        Email Templates
      </h3>
      <p className="mb-4 text-sm text-text-secondary">
        Generate tailored outreach emails for {company}.
      </p>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-info-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-info-darker disabled:cursor-not-allowed disabled:opacity-60"
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        Generate Email Templates
      </button>

      <ProgressModal
        isOpen={progressActive}
        title={`Drafting emails for ${company}…`}
        steps={EMAIL_TEMPLATES_STEPS}
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
