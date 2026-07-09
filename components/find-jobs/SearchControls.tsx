"use client";

import { useState } from "react";

type SearchControlsProps = {
  onSearch?: (jobTitle: string, location: string) => void;
  searchMessage?: string | null;
  messageType?: "success" | "error" | "warning";
  isLoading?: boolean;
};

export function SearchControls({
  onSearch,
  searchMessage,
  messageType = "success",
  isLoading = false,
}: SearchControlsProps) {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");

  const handleSearch = () => {
    onSearch?.(jobTitle, location);
  };

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Job Title */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
            JOB TITLE
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
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
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Frontend Engineer"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">
            LOCATION
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
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
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote, New York..."
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* Find Jobs Button */}
      <div className="mt-4">
        <button
          onClick={handleSearch}
          disabled={isLoading || !jobTitle.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-success-dark px-6 py-2.5 text-sm font-medium text-white hover:bg-success-darker disabled:cursor-not-allowed disabled:opacity-60"
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
          {isLoading ? "Searching..." : "Find Jobs"}
        </button>
      </div>

      {/* Message Banner */}
      {searchMessage && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            messageType === "error"
              ? "bg-error-lightest text-error-foreground"
              : messageType === "warning"
                ? "bg-warning-lightest text-warning-foreground"
                : "bg-success-lightest text-success-foreground"
          }`}
        >
          {messageType === "error" ? (
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ) : messageType === "warning" ? (
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 shrink-0"
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
          )}
          {searchMessage}
        </div>
      )}
    </div>
  );
}
