"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type ProgressStep = {
  label: string;
  durationMs: number;
};

type ProgressModalProps = {
  isOpen: boolean;
  title: string;
  steps: ProgressStep[];
  activeStep: number;
  isComplete: boolean;
  error: string | null;
  onDismiss: () => void;
};

export function ProgressModal({
  isOpen,
  title,
  steps,
  activeStep,
  isComplete,
  error,
  onDismiss,
}: ProgressModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const canDismiss = error !== null || isComplete;
  const progress = Math.round(
    ((activeStep + (isComplete ? 1 : 0.5)) / steps.length) * 100
  );

  return (
    <div
      ref={backdropRef}
      onClick={canDismiss ? onDismiss : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay/40 backdrop-blur-sm transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border border-border bg-surface px-8 py-7 transition-all duration-300 ease-out ${
          isOpen && !isComplete
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-2"
        } ${isComplete ? "animate-[modal-fade-out_0.5s_ease-in_forwards]" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss button — only during error or after completion */}
        {canDismiss && (
          <button
            onClick={onDismiss}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Title */}
        <p className="mb-6 text-center text-base font-semibold text-text-primary">
          {title}
        </p>

        {/* Progress bar */}
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-surface-tertiary">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isComplete ? "bg-success" : "bg-accent"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Error state */}
        {error ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-lightest">
              <svg
                className="h-6 w-6 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <p className="text-center text-sm text-text-secondary">{error}</p>
          </div>
        ) : (
          /* Step list */
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isCompleted = index < activeStep || isComplete;
              const isActive = index === activeStep && !isComplete;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                    isCompleted
                      ? "bg-success-lightest opacity-100"
                      : isActive
                        ? "bg-accent/5 opacity-100"
                        : "opacity-40"
                  }`}
                >
                  {/* Step indicator */}
                  {isCompleted ? (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success">
                      <svg
                        className="h-3 w-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-[check-draw_0.4s_ease-out_forwards]"
                          style={{
                            strokeDasharray: 12,
                            strokeDashoffset: 12,
                          }}
                        />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                  )}

                  {/* Step label */}
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "font-medium text-success-foreground"
                        : isActive
                          ? "font-medium text-text-primary"
                          : "text-text-muted"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
