export type JobType = "Full-time" | "Remote" | "Contract" | "Design";

export type JobFilter = "all" | "full-time" | "remote" | "design";

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: JobType;
  postedDate: string;
  description: string;
  skills: string[];
  logoColor: string;
  logoInitial: string;
}
