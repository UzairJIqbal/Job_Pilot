"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPLICATION_STATE_LABELS, type ApplicationState } from "@/lib/applications";
import type { DraftCandidate, QueueItem } from "@/lib/queue";

type Tab = "needs_review" | "ready_to_send" | "approved" | "failed" | "skipped";

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "needs_review", label: "Needs review", empty: "Nothing waiting. Draft applications for your top matches below." },
  {
    key: "ready_to_send",
    label: "Ready to send",
    empty: "Approved applications appear here once the worker has filled the form. Open one to check the preview and send it.",
  },
  { key: "approved", label: "Approved", empty: "Approved applications wait here for their preview, then until they're sent." },
  { key: "failed", label: "Failed", empty: "No failed submissions." },
  { key: "skipped", label: "Skipped", empty: "Applications you skip land here." },
];

// Approved also lists rows in flight or sent, so the user sees them leave.
const TAB_STATES: Record<Tab, ApplicationState[]> = {
  needs_review: ["needs_review"],
  ready_to_send: ["ready_to_send"],
  approved: ["approved", "submitting", "submitted"],
  failed: ["failed"],
  skipped: ["skipped"],
};

const DRAFT_BATCH = 3;

type Props = { items: QueueItem[]; candidates: DraftCandidate[] };

export function QueueClient({ items, candidates }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("needs_review");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<{ done: number; total: number; current: string } | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  const visible = items.filter((i) => TAB_STATES[tab].includes(i.state));
  const selectable = visible.filter((i) => i.state !== "submitting" && i.state !== "submitted");
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, items.filter((i) => TAB_STATES[t.key].includes(i.state)).length]),
  ) as Record<Tab, number>;

  function switchTab(next: Tab) {
    setTab(next);
    setSelected(new Set());
    setMessage(null);
    setError(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(state: ApplicationState) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], state }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Couldn't update applications");
        return;
      }
      const { updated, rejected } = data.data as { updated: string[]; rejected: { id: string; reason: string }[] };
      const verb = APPLICATION_STATE_LABELS[state].toLowerCase();
      const parts = [`${updated.length} ${verb}`];
      const needsReview = rejected.filter((r) => r.reason === "Has answers to review").length;
      if (needsReview) parts.push(`${needsReview} still ${needsReview === 1 ? "has" : "have"} answers to review`);
      const other = rejected.length - needsReview;
      if (other) parts.push(`${other} couldn't be changed`);
      setMessage(parts.join(" · "));
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  // One job at a time from the browser: each call is a single Gemini request,
  // and the agent waits out free-tier rate limits on its own.
  async function draftNext() {
    const batch = candidates.slice(0, DRAFT_BATCH);
    cancelRef.current = false;
    setError(null);
    setMessage(null);
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      if (cancelRef.current) break;
      setDrafting({ done: i, total: batch.length, current: `${batch[i].title} at ${batch[i].company}` });
      try {
        const res = await fetch("/api/agent/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: batch[i].jobId }),
        });
        const data = await res.json();
        if (data.success) {
          ok++;
        } else {
          failures.push(`${batch[i].company}: ${data.error ?? "failed"}`);
          // Missing profile data fails every job the same way; stop early.
          if (res.status === 400) break;
        }
      } catch {
        failures.push(`${batch[i].company}: network error`);
      }
    }
    setDrafting(null);
    if (ok) setMessage(`Drafted ${ok} application${ok === 1 ? "" : "s"}`);
    if (failures.length) setError(failures.join(" · "));
    setTab("needs_review");
    setSelected(new Set());
    router.refresh();
  }

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-4">
      {/* Draft more */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {candidates.length > 0
              ? `${candidates.length} strong match${candidates.length === 1 ? "" : "es"} not drafted yet`
              : "Every strong match has a draft"}
          </p>
          <p className="text-sm text-text-secondary">
            {drafting
              ? `Drafting ${drafting.done + 1} of ${drafting.total}: ${drafting.current}…`
              : candidates.length > 0
                ? `Top: ${candidates
                    .slice(0, DRAFT_BATCH)
                    .map((c) => c.company)
                    .join(", ")}`
                : "Scan company boards on Find jobs to find more."}
          </p>
        </div>
        {drafting ? (
          <button
            onClick={() => {
              cancelRef.current = true;
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
          >
            Stop after this one
          </button>
        ) : candidates.length > 0 ? (
          <button
            onClick={draftNext}
            disabled={busy}
            className="rounded-lg bg-info-dark px-4 py-2 text-sm font-medium text-white hover:bg-info-darker disabled:opacity-60"
          >
            Draft next {Math.min(DRAFT_BATCH, candidates.length)}
          </button>
        ) : (
          <Link
            href="/find-jobs"
            className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium text-text-primary hover:bg-surface-secondary"
          >
            Find jobs
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-surface-tertiary px-1.5 text-xs text-text-secondary">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      {selectable.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.id)))}
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {(tab === "needs_review" || tab === "failed") && (
                <button
                  onClick={() => bulk("approved")}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
                >
                  Approve
                </button>
              )}
              {tab !== "skipped" && (
                <button
                  onClick={() => bulk("skipped")}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:opacity-60"
                >
                  Skip
                </button>
              )}
              {tab !== "needs_review" && (
                <button
                  onClick={() => bulk("needs_review")}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:opacity-60"
                >
                  Back to review
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {message && <p className="px-1 text-sm text-success-foreground">{message}</p>}
      {error && <p className="px-1 text-sm text-error-foreground">{error}</p>}

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-text-secondary">
          {current.empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const locked = item.state === "submitting" || item.state === "submitted";
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`Select ${item.title} at ${item.company}`}
                  checked={selected.has(item.id)}
                  disabled={locked}
                  onChange={() => toggle(item.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/find-jobs/${item.jobId}#application`}
                      className="truncate text-sm font-semibold text-text-primary hover:text-accent"
                    >
                      {item.title}
                    </Link>
                    <span className="text-sm text-text-secondary">· {item.company}</span>
                    {item.matchScore !== null && (
                      <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                        {item.matchScore}% match
                      </span>
                    )}
                    {item.state !== tab && (
                      <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-primary">
                        {APPLICATION_STATE_LABELS[item.state]}
                      </span>
                    )}
                    {item.flagged > 0 && !locked && (
                      <span className="rounded-full bg-warning-lightest px-2 py-0.5 text-xs font-medium text-warning-foreground">
                        {item.flagged} to review
                      </span>
                    )}
                  </div>
                  {item.state === "failed" && item.error ? (
                    <p className="mt-1 text-sm text-error-foreground">{item.error}</p>
                  ) : (
                    item.coverPreview && (
                      <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{item.coverPreview}…</p>
                    )
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    {item.answered} form answer{item.answered === 1 ? "" : "s"}
                    {item.location && ` · ${item.location}`}
                    {item.ats && ` · ${item.ats[0].toUpperCase()}${item.ats.slice(1)}`}
                  </p>
                </div>
                <Link
                  href={`/find-jobs/${item.jobId}#application`}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-surface-secondary"
                >
                  {item.state === "ready_to_send" ? "Check & send" : item.flagged > 0 && !locked ? "Review" : "Open"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
