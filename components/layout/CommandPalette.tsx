"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { APP_NAV } from "./nav-items";

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

type CommandPaletteProps = {
  onClose: () => void;
};

/** Mounted only while open, so every open starts with a fresh query. */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<PaletteAction[]>(
    () => [
      ...APP_NAV.map((item) => ({
        id: item.href,
        label: item.label,
        hint: item.description,
        run: () => router.push(item.href),
      })),
      {
        id: "pipeline-applied",
        label: "Show applied jobs",
        hint: "Applications → Applied",
        run: () => router.push("/applications#applied"),
      },
      {
        id: "pipeline-interviewing",
        label: "Show interviews",
        hint: "Applications → Interviewing",
        run: () => router.push("/applications#interviewing"),
      },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        hint: "Appearance",
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ],
    [router, resolvedTheme, setTheme],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runAt = (index: number) => {
    const action = filtered[index];
    if (!action) return;
    onClose();
    action.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(cursor);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-overlay/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Where do you want to go?"
            className="h-12 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-muted">No matches</li>
          )}
          {filtered.map((action, i) => (
            <li key={action.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => runAt(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${
                  i === cursor ? "bg-surface-tertiary" : ""
                }`}
              >
                <span className="text-sm font-medium text-text-primary">{action.label}</span>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  {action.hint}
                  {i === cursor && <CornerDownLeft className="h-3 w-3" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
