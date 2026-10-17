import { fetchAshbyBoard, fetchAshbyJob } from "./ashby";
import { fetchGreenhouseBoard, fetchGreenhouseBoardName, fetchGreenhouseJob } from "./greenhouse";
import { fetchLeverBoard, fetchLeverJob } from "./lever";
import type { Ats, BoardCompany, BoardJob } from "./types";

export type { Ats, BoardCompany, BoardJob } from "./types";
export { ATS_LIST } from "./types";

// Boards are shared by every user, so one fetch serves all scans in this
// process for a while. Big boards (OpenAI on Ashby) are over 10 MB.
const BOARD_TTL_MS = 30 * 60 * 1000;
const boardCache = new Map<string, { at: number; jobs: BoardJob[] }>();

export async function fetchBoard(company: BoardCompany): Promise<BoardJob[] | null> {
  const key = `${company.ats}:${company.board_token}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_TTL_MS) {
    return hit.jobs.map((j) => ({ ...j, company: company.name }));
  }

  const jobs =
    company.ats === "greenhouse"
      ? await fetchGreenhouseBoard(company)
      : company.ats === "lever"
        ? await fetchLeverBoard(company)
        : await fetchAshbyBoard(company);

  if (jobs) boardCache.set(key, { at: Date.now(), jobs });
  return jobs;
}

/** Fetch many boards with bounded concurrency. Failed boards are counted, not thrown. */
export async function fetchBoards(
  companies: BoardCompany[],
  concurrency = 8,
): Promise<{ jobs: BoardJob[]; failed: string[] }> {
  const jobs: BoardJob[] = [];
  const failed: string[] = [];
  let next = 0;

  async function worker() {
    while (next < companies.length) {
      const company = companies[next++];
      const result = await fetchBoard(company);
      if (result) jobs.push(...result);
      else failed.push(company.name);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, companies.length) }, worker));
  return { jobs, failed };
}

/** Greenhouse list results carry no description; fetch it for the jobs we keep. */
export async function hydrateJob(job: BoardJob): Promise<BoardJob> {
  if (job.description || job.ats !== "greenhouse") return job;
  const full = await fetchGreenhouseJob(
    { name: job.company, ats: job.ats, board_token: job.boardToken },
    job.atsJobId,
  );
  return full ? { ...job, description: full.description } : job;
}

export type ParsedJobUrl = { ats: Ats; boardToken: string; jobId: string };

const TOKEN = /^[A-Za-z0-9._-]+$/;

/** Recognise a posting URL on a Greenhouse, Lever or Ashby hosted board. */
export function parseJobUrl(input: string): ParsedJobUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let parsed: ParsedJobUrl | null = null;

  if (host === "boards.greenhouse.io" || /^job-boards(\.[a-z]+)?\.greenhouse\.io$/.test(host)) {
    const forToken = url.searchParams.get("for");
    const jid = url.searchParams.get("token") ?? url.searchParams.get("gh_jid");
    if (parts[0] === "embed" && forToken && jid) {
      parsed = { ats: "greenhouse", boardToken: forToken, jobId: jid };
    } else if (parts.length >= 3 && parts[1] === "jobs") {
      parsed = { ats: "greenhouse", boardToken: parts[0], jobId: parts[2] };
    }
  } else if (host === "jobs.lever.co" && parts.length >= 2) {
    parsed = { ats: "lever", boardToken: parts[0], jobId: parts[1] };
  } else if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    parsed = { ats: "ashby", boardToken: parts[0], jobId: parts[1] };
  }

  if (!parsed || !TOKEN.test(parsed.boardToken) || !TOKEN.test(parsed.jobId)) return null;
  if (parsed.ats === "greenhouse" && !/^\d+$/.test(parsed.jobId)) return null;
  return parsed;
}

export async function fetchJobByUrl(
  parsed: ParsedJobUrl,
  knownName?: string | null,
): Promise<BoardJob | null> {
  let name = knownName ?? null;
  if (!name && parsed.ats === "greenhouse") name = await fetchGreenhouseBoardName(parsed.boardToken);
  const company: BoardCompany = {
    name: name ?? titleCase(parsed.boardToken),
    ats: parsed.ats,
    board_token: parsed.boardToken,
  };

  if (parsed.ats === "greenhouse") return fetchGreenhouseJob(company, parsed.jobId);
  if (parsed.ats === "lever") return fetchLeverJob(company, parsed.jobId);
  return fetchAshbyJob(company, parsed.jobId);
}

function titleCase(token: string): string {
  return token
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
