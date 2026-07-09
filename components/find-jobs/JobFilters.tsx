"use client";

import { useState } from "react";

type JobFiltersProps = {
  filter: string;
  sort: string;
  status: string;
  searchQuery: string;
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (query: string) => void;
};

export function JobFilters({
  filter,
  sort,
  status,
  searchQuery,
  onFilterChange,
  onSortChange,
  onStatusChange,
  onSearchChange,
}: JobFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input */}
      <div className="relative flex-1">
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
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by company or role..."
          className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Filter Dropdown */}
      <div className="flex gap-3">
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-10 appearance-none rounded-lg border border-border bg-surface pr-8 pl-3 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Matches</option>
            <option value="high">High Match</option>
            <option value="low">Low Match</option>
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-10 appearance-none rounded-lg border border-border bg-surface pr-8 pl-3 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Statuses</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
            <option value="interviewing">Interviewing</option>
            <option value="rejected">Rejected</option>
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="h-10 appearance-none rounded-lg border border-border bg-surface pr-8 pl-3 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="score">Match Score</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
