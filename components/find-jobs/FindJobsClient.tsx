"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect, useRef, useCallback } from "react";
import { MATCH_THRESHOLD } from "@/lib/utils";
import { SearchControls } from "./SearchControls";
import { BoardControls } from "./BoardControls";
import { JobFilters } from "./JobFilters";
import { JobsTable } from "./JobsTable";
import { JobsPagination } from "./JobsPagination";
import { ProgressModal } from "@/components/ui/ProgressModal";
import type { ProgressStep } from "@/components/ui/ProgressModal";

type Job = {
  id: string;
  company: string;
  title: string;
  match_score: number | null;
  status: string | null;
  salary: string | null;
  source: string;
  fit_reason: string | null;
  found_at: string;
};

type AgentOutcome = { message: string; type: "success" | "warning" };

const JOBS_PER_PAGE = 6;

const FIND_JOBS_STEPS: ProgressStep[] = [
  { label: "Searching job listings…", durationMs: 3_000 },
  { label: "Analyzing job descriptions…", durationMs: 5_000 },
  { label: "Scoring matches with AI…", durationMs: 15_000 },
  { label: "Saving results…", durationMs: 2_000 },
];

const SCAN_BOARDS_STEPS: ProgressStep[] = [
  { label: "Reading company job boards…", durationMs: 45_000 },
  { label: "Filtering by your titles, level and location…", durationMs: 5_000 },
  { label: "Scoring the best matches with AI…", durationMs: 60_000 },
  { label: "Saving results…", durationMs: 2_000 },
];

const IMPORT_URL_STEPS: ProgressStep[] = [
  { label: "Loading the posting…", durationMs: 2_000 },
  { label: "Scoring it against your profile…", durationMs: 8_000 },
  { label: "Saving…", durationMs: 1_000 },
];

export function FindJobsClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "warning">("success");
  const [isLoading, setIsLoading] = useState(false);
  const [progressActive, setProgressActive] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressTitle, setProgressTitle] = useState("Finding jobs…");
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>(FIND_JOBS_STEPS);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const filterRef = useRef(filter);
  const sortRef = useRef(sort);
  const statusRef = useRef(status);
  const searchRef = useRef(searchQuery);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fetchJobs = useCallback(async (activeFilter: string, activeSort: string, activeStatus: string) => {
    try {
      const params = new URLSearchParams({
        filter: activeFilter,
        sort: activeSort,
        status: activeStatus,
      });
      const res = await fetch(`/api/agent/find?${params}`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.data.jobs || []);
      }
    } catch {
      // silent — keep existing data
    }
  }, []);

  useEffect(() => {
    if (!isInitialLoad) return;
    fetchJobs("all", "score", "all").then(() => setIsInitialLoad(false));
  }, [fetchJobs, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchJobs(filterRef.current, sortRef.current, statusRef.current);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, fetchJobs, isInitialLoad]);

  useEffect(() => {
    return () => {
      stepTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    filterRef.current = newFilter;
    setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchJobs(newFilter, sortRef.current, statusRef.current);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    sortRef.current = newSort;
    setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchJobs(filterRef.current, newSort, statusRef.current);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    statusRef.current = newStatus;
    setCurrentPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    fetchJobs(filterRef.current, sortRef.current, newStatus);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    searchRef.current = query;
    setCurrentPage(1);
  };

  /** Run one agent request behind the progress modal, then reload the list. */
  const runAgentTask = async (
    title: string,
    steps: ProgressStep[],
    request: () => Promise<Response>,
    onSuccess: (data: Record<string, unknown>) => AgentOutcome,
  ) => {
    setProgressTitle(title);
    setProgressSteps(steps);
    setProgressActive(true);
    setActiveStep(0);
    setProgressComplete(false);
    setProgressError(null);
    setSearchMessage(null);
    setIsLoading(true);

    let accumulated = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, index) => {
      if (index === 0) return;
      accumulated += steps[index - 1].durationMs;
      timers.push(setTimeout(() => setActiveStep(index), accumulated));
    });
    stepTimersRef.current = timers;

    try {
      const res = await request();
      const data = await res.json();

      if (!data.success) {
        setProgressError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setProgressComplete(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setProgressActive(false);
      setProgressComplete(false);
      setActiveStep(0);

      const outcome = onSuccess(data.data);
      setSearchMessage(outcome.message);
      setMessageType(outcome.type);

      setFilter("all");
      setSort("score");
      setStatus("all");
      setSearchQuery("");
      setCurrentPage(1);
      filterRef.current = "all";
      sortRef.current = "score";
      statusRef.current = "all";
      searchRef.current = "";
      await fetchJobs("all", "score", "all");
    } catch {
      setProgressError("Something went wrong. Please try again.");
    } finally {
      timers.forEach(clearTimeout);
      stepTimersRef.current = [];
      setIsLoading(false);
    }
  };

  const handleSearch = (jobTitle: string, location: string) =>
    runAgentTask(
      "Finding jobs…",
      FIND_JOBS_STEPS,
      () =>
        fetch("/api/agent/find", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobTitle, location }),
        }),
      (data) => {
        const found = (data.jobsFound as number) ?? 0;
        const saved = (data.jobs as unknown[] | undefined)?.length ?? 0;
        return { message: data.message as string, type: found > 0 && saved === 0 ? "warning" : "success" };
      },
    );

  const handleScanBoards = () =>
    runAgentTask(
      "Scanning company boards…",
      SCAN_BOARDS_STEPS,
      () => fetch("/api/agent/boards", { method: "POST" }),
      (data) => ({
        message: data.message as string,
        type: (data.saved as number) > 0 ? "success" : "warning",
      }),
    );

  const handleImportUrl = (url: string) =>
    runAgentTask(
      "Importing job…",
      IMPORT_URL_STEPS,
      () =>
        fetch("/api/agent/import-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }),
      (data) => {
        if (data.duplicate) return { message: "That job is already in your list.", type: "warning" };
        const score = data.matchScore == null ? "" : ` (${data.matchScore}% match)`;
        const saved = `Saved ${data.title} at ${data.company}${score}.`;
        return data.warning
          ? { message: `${saved} Heads up: ${data.warning}.`, type: "warning" }
          : { message: saved, type: "success" };
      },
    );

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.company.toLowerCase().includes(query) ||
      job.title.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE,
  );

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Find jobs"
          description="Search live listings or scan company career boards. Every result is scored against your profile."
        />

        <SearchControls
          onSearch={handleSearch}
          searchMessage={searchMessage}
          messageType={messageType}
          isLoading={isLoading}
        />

        <BoardControls
          onScan={handleScanBoards}
          onImportUrl={handleImportUrl}
          isLoading={isLoading}
        />

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <JobFilters
              filter={filter}
              sort={sort}
              status={status}
              searchQuery={searchQuery}
              onFilterChange={handleFilterChange}
              onSortChange={handleSortChange}
              onStatusChange={handleStatusChange}
              onSearchChange={handleSearchChange}
            />
          </div>

          <JobsTable jobs={paginatedJobs} />

          {filteredJobs.length > 0 && (
            <JobsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalJobs={filteredJobs.length}
              jobsPerPage={JOBS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}

          {filteredJobs.length === 0 && !progressActive && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-text-secondary">
                {jobs.length === 0
                  ? "Search for jobs to get started."
                  : "No jobs match your current filters. Try adjusting your search."}
              </p>
            </div>
          )}

        </div>

        <p className="text-center text-xs text-text-muted">
          Jobs from Adzuna and public Greenhouse, Lever and Ashby job boards
        </p>
      </div>

      <ProgressModal
        isOpen={progressActive}
        title={progressTitle}
        steps={progressSteps}
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
    </>
  );
}
