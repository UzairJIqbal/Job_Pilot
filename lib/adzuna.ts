export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

function detectCountry(location: string): string {
  const lower = location.toLowerCase();
  if (/\b(uk|united kingdom|london|manchester|birmingham|edinburgh|glasgow|bristol|leeds|liverpool)\b/.test(lower)) return "gb";
  if (/\b(canada|toronto|vancouver|montreal|calgary|ottawa|edmonton)\b/.test(lower)) return "ca";
  if (/\b(australia|sydney|melbourne|brisbane|perth|adelaide|auckland|new zealand)\b/.test(lower)) return "au";
  return "us";
}

export async function searchAdzunaJobs(
  jobTitle: string,
  location: string,
): Promise<AdzunaJob[]> {
  const country = detectCountry(location);
  // Adzuna has no place called "Remote": as `where` it matches nothing. Search
  // it as a keyword and keep any real place ("Remote, London" -> London).
  const remote = /\bremote\b/i.test(location);
  if (remote) {
    location = location.replace(/\bremote\b/gi, "").replace(/^[\s,/|-]+|[\s,/|-]+$/g, "");
  }
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_KEY!,
    app_key: process.env.ADZUNA_API_KEY!,
    what: remote ? `${jobTitle} remote` : jobTitle,
    category: "it-jobs",
    results_per_page: "10",
    "content-type": "application/json",
  });

  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
