"use client";

import { useState } from "react";
import { Building2, Link2 } from "lucide-react";

type BoardControlsProps = {
  onScan: () => void;
  onImportUrl: (url: string) => void;
  isLoading?: boolean;
};

export function BoardControls({ onScan, onImportUrl, isLoading = false }: BoardControlsProps) {
  const [url, setUrl] = useState("");

  const handleImport = () => {
    if (!url.trim()) return;
    onImportUrl(url.trim());
    setUrl("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface px-6 py-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
          COMPANY BOARDS
        </label>
        <p className="mb-4 text-sm text-text-secondary">
          Check 250+ tech company career pages for new roles that fit the titles, level, location
          and pay floor in your profile.
        </p>
        <button
          onClick={onScan}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Building2 className="h-4 w-4" />
          {isLoading ? "Working..." : "Scan company boards"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface px-6 py-5">
        <label
          htmlFor="import-job-url"
          className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted"
        >
          ADD A JOB BY LINK
        </label>
        <p className="mb-4 text-sm text-text-secondary">
          Paste a posting from a Greenhouse, Lever or Ashby job board.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id="import-job-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImport()}
              placeholder="https://jobs.ashbyhq.com/company/..."
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleImport}
            disabled={isLoading || !url.trim()}
            className="rounded-lg border border-border px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
