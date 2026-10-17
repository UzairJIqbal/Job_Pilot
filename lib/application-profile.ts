// Answers reused on every application form: work authorization, notice
// period, EEO choices and the user's own saved answers.

export type SavedAnswer = { question: string; answer: string };

export type YesNo = "" | "yes" | "no";

export interface ApplicationProfileFormData {
  authorizedCountries: string[];
  needsSponsorship: YesNo;
  willingToRelocate: YesNo;
  noticePeriod: string;
  earliestStartDate: string;
  githubUrl: string;
  pronouns: string;
  gender: string;
  raceEthnicity: string;
  veteranStatus: string;
  disabilityStatus: string;
  savedAnswers: SavedAnswer[];
}

export type ApplicationProfileRow = {
  user_id: string;
  authorized_countries: string[];
  needs_sponsorship: boolean | null;
  willing_to_relocate: boolean | null;
  notice_period: string | null;
  earliest_start_date: string | null;
  github_url: string | null;
  pronouns: string | null;
  gender: string;
  race_ethnicity: string;
  veteran_status: string;
  disability_status: string;
  saved_answers: SavedAnswer[];
};

export const EMPTY_APPLICATION_PROFILE: ApplicationProfileFormData = {
  authorizedCountries: [],
  needsSponsorship: "",
  willingToRelocate: "",
  noticePeriod: "",
  earliestStartDate: "",
  githubUrl: "",
  pronouns: "",
  gender: "decline",
  raceEthnicity: "decline",
  veteranStatus: "decline",
  disabilityStatus: "decline",
  savedAnswers: [],
};

// Values match the start of the usual US EEO option labels; "decline" picks
// whichever "don't wish to answer" option the form offers.
export const EEO_OPTIONS = {
  gender: ["Male", "Female", "Non-binary"],
  raceEthnicity: [
    "American Indian or Alaska Native",
    "Asian",
    "Black or African American",
    "Hispanic or Latino",
    "Native Hawaiian or Other Pacific Islander",
    "White",
    "Two or More Races",
  ],
  veteranStatus: [
    "I am not a protected veteran",
    "I identify as one or more of the classifications of a protected veteran",
  ],
  disabilityStatus: ["No, I do not have a disability", "Yes, I have a disability"],
} as const;

const toYesNo = (v: boolean | null): YesNo => (v === null ? "" : v ? "yes" : "no");
const fromYesNo = (v: YesNo): boolean | null => (v === "" ? null : v === "yes");

export function rowToApplicationProfile(row: ApplicationProfileRow): ApplicationProfileFormData {
  return {
    authorizedCountries: row.authorized_countries ?? [],
    needsSponsorship: toYesNo(row.needs_sponsorship),
    willingToRelocate: toYesNo(row.willing_to_relocate),
    noticePeriod: row.notice_period ?? "",
    earliestStartDate: row.earliest_start_date ?? "",
    githubUrl: row.github_url ?? "",
    pronouns: row.pronouns ?? "",
    gender: row.gender || "decline",
    raceEthnicity: row.race_ethnicity || "decline",
    veteranStatus: row.veteran_status || "decline",
    disabilityStatus: row.disability_status || "decline",
    savedAnswers: Array.isArray(row.saved_answers) ? row.saved_answers : [],
  };
}

export function applicationProfileToRow(data: ApplicationProfileFormData, userId: string): ApplicationProfileRow {
  const blank = (s: string) => s.trim() || null;
  return {
    user_id: userId,
    authorized_countries: data.authorizedCountries.map((c) => c.trim()).filter(Boolean),
    needs_sponsorship: fromYesNo(data.needsSponsorship),
    willing_to_relocate: fromYesNo(data.willingToRelocate),
    notice_period: blank(data.noticePeriod),
    earliest_start_date: blank(data.earliestStartDate),
    github_url: blank(data.githubUrl),
    pronouns: blank(data.pronouns),
    gender: data.gender || "decline",
    race_ethnicity: data.raceEthnicity || "decline",
    veteran_status: data.veteranStatus || "decline",
    disability_status: data.disabilityStatus || "decline",
    saved_answers: data.savedAnswers
      .map((a) => ({ question: a.question.trim(), answer: a.answer.trim() }))
      .filter((a) => a.question && a.answer),
  };
}
