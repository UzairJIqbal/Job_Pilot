import type { BoardJob } from "@/lib/ats";

export const SENIORITY_LEVELS = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior / Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff / Principal" },
  { value: "lead", label: "Lead / Manager" },
  { value: "executive", label: "Director and above" },
] as const;

export type Seniority = (typeof SENIORITY_LEVELS)[number]["value"];

export type DiscoveryPrefs = {
  job_titles_seeking: string[] | null;
  current_title: string | null;
  skills: string[] | null;
  remote_preference: string | null;
  preferred_locations: string[] | null;
  salary_min: number | null;
  seniority: string[] | null;
  excluded_companies: string[] | null;
  excluded_keywords: string[] | null;
};

// Words that describe level, not role, so "Senior Frontend Engineer" still
// matches a search for "Frontend Engineer".
const LEVEL_WORDS = new Set([
  "senior", "sr", "junior", "jr", "staff", "principal", "lead", "head", "intern",
  "entry", "level", "associate", "mid", "i", "ii", "iii", "iv", "of", "the", "and", "a",
]);

const SYNONYMS: Record<string, string> = {
  developer: "engineer",
  dev: "engineer",
  swe: "engineer",
  programmer: "engineer",
  "front-end": "frontend",
  "back-end": "backend",
  "full-stack": "fullstack",
  ml: "machine-learning",
};

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bfront[\s-]end\b/g, "frontend")
    .replace(/\bback[\s-]end\b/g, "backend")
    .replace(/\bfull[\s-]stack\b/g, "fullstack")
    .replace(/\bmachine learning\b/g, "machine-learning");
}

function words(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9+#.-]+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w);
}

function coreWords(title: string): string[] {
  return words(title).filter((w) => !LEVEL_WORDS.has(w));
}

/** Every role word of at least one wanted title appears in the job title. */
export function titleMatches(jobTitle: string, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const have = new Set(words(jobTitle));
  return wanted.some((w) => {
    const core = coreWords(w);
    return core.length > 0 && core.every((c) => have.has(c));
  });
}

export function inferSeniority(title: string): Seniority {
  const t = normalise(title);
  if (/\b(intern|internship|co-?op)\b/.test(t)) return "intern";
  if (/\b(director|vp|vice president|head of|chief|cto|ceo)\b/.test(t)) return "executive";
  if (/\b(manager|lead)\b/.test(t)) return "lead";
  if (/\b(staff|principal|distinguished|architect)\b/.test(t)) return "staff";
  if (/\b(senior|sr\.?)\b|\b(iii|iv)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|new grad|graduate|associate)\b|\bi\b/.test(t)) return "junior";
  return "mid";
}

function locationOk(job: BoardJob, prefs: DiscoveryPrefs): boolean {
  const remotePref = prefs.remote_preference ?? "";
  const places = (prefs.preferred_locations ?? []).map((p) => p.toLowerCase().trim()).filter(Boolean);
  const wantsOnlyRemote = remotePref === "remote-first" && places.every((p) => p === "remote");
  const loc = job.location.toLowerCase();

  if (remotePref === "on-site" && job.remote && !places.some((p) => loc.includes(p))) return false;
  if (wantsOnlyRemote) return job.remote;
  if (places.length === 0) return true;
  if (job.remote && remotePref !== "on-site") return true;
  return places.some((p) => p !== "remote" && loc.includes(p));
}

export type FilterResult = { job: BoardJob; rank: number };

/**
 * Hard filters from the profile, then a cheap local rank so the AI only
 * scores the most promising few. Returns survivors best-first.
 */
export function filterAndRank(jobs: BoardJob[], prefs: DiscoveryPrefs): FilterResult[] {
  const wanted = (prefs.job_titles_seeking?.length ? prefs.job_titles_seeking : [prefs.current_title ?? ""])
    .map((t) => t.trim())
    .filter(Boolean);
  const levels = new Set(prefs.seniority ?? []);
  const excludedCompanies = (prefs.excluded_companies ?? []).map((c) => c.toLowerCase().trim()).filter(Boolean);
  const excludedKeywords = (prefs.excluded_keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const skills = (prefs.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const now = Date.now();

  const results: FilterResult[] = [];
  for (const job of jobs) {
    if (!titleMatches(job.title, wanted)) continue;
    if (levels.size > 0 && !levels.has(inferSeniority(job.title))) continue;
    if (!locationOk(job, prefs)) continue;
    const company = job.company.toLowerCase();
    if (excludedCompanies.some((c) => company === c || company.includes(c))) continue;
    const text = `${job.title}\n${job.description}`.toLowerCase();
    if (excludedKeywords.some((k) => text.includes(k))) continue;
    if (prefs.salary_min && job.salaryMax && job.salaryMax < prefs.salary_min) continue;

    // Greenhouse list results have no description yet, so give them a neutral
    // skill score rather than zero. Cap hits so long postings don't win on size.
    const skillScore = job.description ? Math.min(4, skills.filter((s) => text.includes(s)).length) : 2;
    const ageDays = job.postedAt ? (now - new Date(job.postedAt).getTime()) / 86_400_000 : 60;
    const freshness = Math.max(0, 1 - ageDays / 45);
    results.push({ job, rank: skillScore + freshness * 6 });
  }

  // Many companies post one role per location; keep the best-ranked copy.
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.rank - a.rank)
    .filter(({ job }) => {
      const key = `${job.company.toLowerCase()}|${job.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Excluded-keyword and company checks for a single pasted URL (title/level/location are the user's call). */
export function isExcluded(job: BoardJob, prefs: DiscoveryPrefs): string | null {
  const company = job.company.toLowerCase();
  const hitCompany = (prefs.excluded_companies ?? []).find((c) => c.trim() && company.includes(c.toLowerCase().trim()));
  if (hitCompany) return `${job.company} is on your excluded companies list`;
  const text = `${job.title}\n${job.description}`.toLowerCase();
  const hitKeyword = (prefs.excluded_keywords ?? []).find((k) => k.trim() && text.includes(k.toLowerCase().trim()));
  if (hitKeyword) return `The posting mentions "${hitKeyword}", which you excluded`;
  return null;
}
