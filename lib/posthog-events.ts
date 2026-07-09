import posthog from "posthog-js";

export function trackJobSearchStarted(userId: string, jobTitle: string, location: string) {
  posthog.capture("job_search_started", { userId, jobTitle, location });
}

export function trackJobFound(userId: string, source: string, matchScore: number) {
  posthog.capture("job_found", { userId, source, matchScore });
}

export function trackProfileCompleted(userId: string) {
  posthog.capture("profile_completed", { userId });
}

export function trackCompanyResearched(userId: string, jobId: string, company: string) {
  posthog.capture("company_researched", { userId, jobId, company });
}

export function trackInterviewPrepGenerated(userId: string, jobId: string, company: string) {
  posthog.capture("interview_prep_generated", { userId, jobId, company });
}

export function trackEmailTemplatesGenerated(userId: string, jobId: string, company: string) {
  posthog.capture("email_templates_generated", { userId, jobId, company });
}
