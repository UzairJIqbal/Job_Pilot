export type Ats = "greenhouse" | "lever" | "ashby";

export const ATS_LIST: Ats[] = ["greenhouse", "lever", "ashby"];

export type BoardCompany = {
  name: string;
  ats: Ats;
  board_token: string;
};

/** One open posting from a public ATS job board, normalised across providers. */
export type BoardJob = {
  ats: Ats;
  atsJobId: string;
  boardToken: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  applyUrl: string;
  /** Plain text. Empty for Greenhouse list results until hydrated. */
  description: string;
  postedAt: string | null;
  jobType: string | null;
  salary: string | null;
  /** Upper bound of the posted pay range in USD per year, when the board publishes one. */
  salaryMax: number | null;
};
