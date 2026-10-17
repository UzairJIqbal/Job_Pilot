import { fetchJson } from "./http";
import type { BoardCompany, BoardJob } from "./types";

// Public Job Postings API: https://developers.ashbyhq.com/docs/public-job-posting-api
const API = "https://api.ashbyhq.com/posting-api/job-board";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  publishedAt?: string;
  jobUrl: string;
  applyUrl: string;
  isListed?: boolean;
  descriptionPlain?: string;
  compensation?: {
    scrapeableCompensationSalarySummary?: string | null;
    compensationTierSummary?: string | null;
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }[];
  };
};

function salaryMax(job: AshbyJob): number | null {
  const salary = job.compensation?.summaryComponents?.find(
    (c) => c.compensationType === "Salary" && c.interval === "1 YEAR" && c.currencyCode === "USD",
  );
  return salary?.maxValue ?? salary?.minValue ?? null;
}

function toBoardJob(company: BoardCompany, job: AshbyJob): BoardJob {
  const location = job.location?.trim() ?? "";
  return {
    ats: "ashby",
    atsJobId: job.id,
    boardToken: company.board_token,
    company: company.name,
    title: job.title.trim(),
    location,
    // isRemote is also set on hybrid roles, so trust workplaceType when present.
    remote: job.workplaceType
      ? job.workplaceType === "Remote"
      : !!job.isRemote || /remote/i.test(location),
    url: job.jobUrl,
    applyUrl: job.applyUrl,
    description: job.descriptionPlain?.trim() ?? "",
    postedAt: job.publishedAt ?? null,
    jobType: job.employmentType ?? null,
    salary:
      job.compensation?.scrapeableCompensationSalarySummary ??
      job.compensation?.compensationTierSummary ??
      null,
    salaryMax: salaryMax(job),
  };
}

export async function fetchAshbyBoard(company: BoardCompany): Promise<BoardJob[] | null> {
  const data = await fetchJson<{ jobs: AshbyJob[] }>(
    `${API}/${encodeURIComponent(company.board_token)}?includeCompensation=true`,
    60_000,
  );
  if (!data?.jobs) return null;
  return data.jobs.filter((j) => j.isListed !== false).map((j) => toBoardJob(company, j));
}

/** Ashby has no single-posting endpoint, so read the board and pick the job. */
export async function fetchAshbyJob(company: BoardCompany, jobId: string): Promise<BoardJob | null> {
  const jobs = await fetchAshbyBoard(company);
  return jobs?.find((j) => j.atsJobId === jobId) ?? null;
}
