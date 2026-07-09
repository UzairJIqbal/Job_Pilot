export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string;
}

export interface Education {
  degree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
}

export interface ProfileFormData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuthorization: string;
  currentTitle: string;
  experienceLevel: string;
  yearsExperience: string;
  skills: string[];
  industries: string[];
  workExperience: WorkExperience[];
  education: Education;
  jobTitlesSeeking: string[];
  remotePreference: string;
  salaryExpectation: string;
  preferredLocations: string[];
  coverLetterTone: string;
  resumePdfUrl: string | null;
}

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_title: string;
  experience_level: string;
  years_experience: number;
  skills: string[];
  industries: string[];
  work_experience: WorkExperience[];
  education: Education;
  job_titles_seeking: string[];
  remote_preference: string;
  preferred_locations: string[];
  salary_expectation: string;
  cover_letter_tone: string;
  linkedin_url: string;
  portfolio_url: string;
  work_authorization: string;
  resume_pdf_url: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export function rowToFormData(row: ProfileRow): ProfileFormData {
  return {
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    workAuthorization: row.work_authorization,
    currentTitle: row.current_title,
    experienceLevel: row.experience_level,
    yearsExperience: row.years_experience?.toString() ?? "",
    skills: row.skills ?? [],
    industries: row.industries ?? [],
    workExperience: row.work_experience ?? [],
    education: row.education ?? {
      degree: "",
      fieldOfStudy: "",
      institution: "",
      graduationYear: "",
    },
    jobTitlesSeeking: row.job_titles_seeking ?? [],
    remotePreference: row.remote_preference,
    salaryExpectation: row.salary_expectation,
    preferredLocations: row.preferred_locations ?? [],
    coverLetterTone: row.cover_letter_tone,
    resumePdfUrl: row.resume_pdf_url ?? null,
  };
}

export function calculateIsComplete(data: ProfileFormData): boolean {
  return !!(
    data.fullName &&
    data.phone &&
    data.location &&
    data.linkedinUrl &&
    data.portfolioUrl &&
    data.workAuthorization &&
    data.currentTitle &&
    data.experienceLevel &&
    data.yearsExperience &&
    data.skills.length > 0 &&
    data.industries.length > 0 &&
    data.workExperience.length > 0 &&
    data.education.degree &&
    data.education.fieldOfStudy &&
    data.education.institution &&
    data.education.graduationYear &&
    data.jobTitlesSeeking.length > 0 &&
    data.remotePreference &&
    data.salaryExpectation &&
    data.preferredLocations.length > 0 &&
    data.coverLetterTone
  );
}

export function formDataToRow(
  data: ProfileFormData,
  userId: string,
): Record<string, unknown> {
  return {
    id: userId,
    full_name: data.fullName,
    email: data.email,
    phone: data.phone,
    location: data.location,
    current_title: data.currentTitle,
    experience_level: data.experienceLevel,
    years_experience: data.yearsExperience
      ? parseInt(data.yearsExperience, 10)
      : null,
    skills: data.skills,
    industries: data.industries,
    work_experience: data.workExperience,
    education: data.education,
    job_titles_seeking: data.jobTitlesSeeking,
    remote_preference: data.remotePreference,
    preferred_locations: data.preferredLocations,
    salary_expectation: data.salaryExpectation,
    cover_letter_tone: data.coverLetterTone,
    linkedin_url: data.linkedinUrl,
    portfolio_url: data.portfolioUrl,
    work_authorization: data.workAuthorization,
    resume_pdf_url: data.resumePdfUrl,
    is_complete: calculateIsComplete(data),
    updated_at: new Date().toISOString(),
  };
}

export const mockProfile: ProfileFormData = {
  fullName: "Rahul Sharma",
  email: "rahulsharma@gmail.com",
  phone: "",
  location: "",
  linkedinUrl: "https://linkedin.com/in/rahulsharma",
  portfolioUrl: "https://github.com/rahulsharma",
  workAuthorization: "authorized",
  currentTitle: "Senior Software Engineer",
  experienceLevel: "senior",
  yearsExperience: "7",
  skills: ["React", "TypeScript", "Node.js", "Python", "AWS", "Docker", "GraphQL"],
  industries: ["SaaS", "FinTech", "AI/ML"],
  workExperience: [
    {
      id: "exp-1",
      company: "TechCorp Inc.",
      title: "Senior Software Engineer",
      startDate: "2021-03",
      endDate: "",
      isCurrent: true,
      responsibilities:
        "Led development of microservices architecture serving 10M+ users. Mentored junior engineers and drove adoption of TypeScript across the team.",
    },
    {
      id: "exp-2",
      company: "StartupXYZ",
      title: "Software Engineer",
      startDate: "2019-06",
      endDate: "2021-02",
      isCurrent: false,
      responsibilities:
        "Built real-time collaboration features using WebSockets. Optimized database queries resulting in 40% performance improvement.",
    },
  ],
  education: {
    degree: "",
    fieldOfStudy: "",
    institution: "",
    graduationYear: "",
  },
  jobTitlesSeeking: [],
  remotePreference: "remote-first",
  salaryExpectation: "25-35 LPA",
  preferredLocations: ["Bangalore", "Remote (Global)", "San Francisco"],
  coverLetterTone: "professional",
  resumePdfUrl: null,
};

export const allMissingFields: string[] = [
  "PHONE",
  "LOCATION",
  "LINKEDIN",
  "PORTFOLIO",
  "DEGREE",
  "FIELD OF STUDY",
  "INSTITUTION",
  "GRADUATION YEAR",
  "JOB TITLES SEEKING",
];
