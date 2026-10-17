import { fetchJson, formatPayRange, htmlToText } from "./http";
import type { BoardCompany, BoardJob } from "./types";

// Public Postings API: https://github.com/lever/postings-api
const API = "https://api.lever.co/v0/postings";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

function yearly(amount: number | undefined, interval: string | undefined): number | null {
  if (!amount) return null;
  if (interval === "per-hour-wage") return amount * 2080;
  if (interval === "per-month-salary") return amount * 12;
  return amount;
}

function toBoardJob(company: BoardCompany, p: LeverPosting): BoardJob {
  const location = p.categories?.location?.trim() ?? "";
  const lists = (p.lists ?? [])
    .map((l) => `${l.text}\n${htmlToText(l.content)}`)
    .join("\n\n");
  const range = p.salaryRange;
  const min = yearly(range?.min, range?.interval);
  const max = yearly(range?.max, range?.interval);
  return {
    ats: "lever",
    atsJobId: p.id,
    boardToken: company.board_token,
    company: company.name,
    title: p.text.trim(),
    location,
    remote: p.workplaceType === "remote" || /remote/i.test(location),
    url: p.hostedUrl,
    applyUrl: p.applyUrl,
    description: [p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n\n").trim(),
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    jobType: p.categories?.commitment ?? null,
    salary: formatPayRange(min, max, range?.currency),
    salaryMax: !range?.currency || range.currency === "USD" ? (max ?? min) : null,
  };
}

export async function fetchLeverBoard(company: BoardCompany): Promise<BoardJob[] | null> {
  // Lever is slow to serve large boards (several seconds alone, more under load).
  const data = await fetchJson<LeverPosting[]>(
    `${API}/${encodeURIComponent(company.board_token)}?mode=json`,
    60_000,
  );
  if (!Array.isArray(data)) return null;
  return data.map((p) => toBoardJob(company, p));
}

export async function fetchLeverJob(company: BoardCompany, jobId: string): Promise<BoardJob | null> {
  const p = await fetchJson<LeverPosting>(
    `${API}/${encodeURIComponent(company.board_token)}/${encodeURIComponent(jobId)}?mode=json`,
  );
  if (!p?.id) return null;
  return toBoardJob(company, p);
}
