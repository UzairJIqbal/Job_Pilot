import { fetchJson, htmlToText } from "./http";
import type { BoardCompany, BoardJob } from "./types";

// Public Job Board API: https://developers.greenhouse.io/job-board.html
const API = "https://boards-api.greenhouse.io/v1/boards";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  first_published?: string | null;
  updated_at?: string;
  company_name?: string;
  content?: string;
};

function toBoardJob(company: BoardCompany, job: GreenhouseJob): BoardJob {
  const location = job.location?.name?.trim() ?? "";
  return {
    ats: "greenhouse",
    atsJobId: String(job.id),
    boardToken: company.board_token,
    company: company.name,
    title: job.title.trim(),
    location,
    remote: /remote/i.test(location),
    url: job.absolute_url,
    // absolute_url is often the company careers page; the hosted board has the form.
    applyUrl: `https://job-boards.greenhouse.io/${company.board_token}/jobs/${job.id}`,
    description: job.content ? htmlToText(job.content) : "",
    postedAt: job.first_published ?? job.updated_at ?? null,
    jobType: null,
    salary: null,
    salaryMax: null,
  };
}

/** Lists open jobs without descriptions (the full board with content can be tens of MB). */
export async function fetchGreenhouseBoard(company: BoardCompany): Promise<BoardJob[] | null> {
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
    `${API}/${encodeURIComponent(company.board_token)}/jobs`,
  );
  if (!data?.jobs) return null;
  return data.jobs.map((job) => toBoardJob(company, job));
}

export async function fetchGreenhouseJob(company: BoardCompany, jobId: string): Promise<BoardJob | null> {
  const job = await fetchJson<GreenhouseJob>(
    `${API}/${encodeURIComponent(company.board_token)}/jobs/${encodeURIComponent(jobId)}`,
  );
  if (!job?.id) return null;
  return toBoardJob(
    { ...company, name: company.name || job.company_name || company.board_token },
    job,
  );
}

export async function fetchGreenhouseBoardName(boardToken: string): Promise<string | null> {
  const data = await fetchJson<{ name?: string }>(`${API}/${encodeURIComponent(boardToken)}`);
  return data?.name?.trim() || null;
}
