"use client";

import { useMemo } from "react";
import type { ProfileFormData } from "@/lib/mock-profile";

interface CompletionIndicatorProps {
  profile: ProfileFormData;
}

/**
 * Every user-fillable field in the profile form.
 * Each entry is one tracked field — the percentage is derived from this count.
 */
function getCompletionFields(profile: ProfileFormData): string[] {
  const missing: string[] = [];

  // Personal Information
  if (!profile.fullName) missing.push("FULL NAME");
  if (!profile.phone) missing.push("PHONE");
  if (!profile.location) missing.push("LOCATION");
  if (!profile.linkedinUrl) missing.push("LINKEDIN");
  if (!profile.portfolioUrl) missing.push("PORTFOLIO");
  if (!profile.workAuthorization) missing.push("WORK AUTHORIZATION");

  // Professional Information
  if (!profile.currentTitle) missing.push("CURRENT TITLE");
  if (!profile.experienceLevel) missing.push("EXPERIENCE LEVEL");
  if (!profile.yearsExperience) missing.push("YEARS OF EXPERIENCE");
  if (profile.skills.length === 0) missing.push("SKILLS");
  if (profile.industries.length === 0) missing.push("INDUSTRIES");

  // Work Experience
  if (profile.workExperience.length === 0) missing.push("WORK EXPERIENCE");

  // Education
  if (!profile.education.degree) missing.push("DEGREE");
  if (!profile.education.fieldOfStudy) missing.push("FIELD OF STUDY");
  if (!profile.education.institution) missing.push("INSTITUTION");
  if (!profile.education.graduationYear) missing.push("GRADUATION YEAR");

  // Job Preferences
  if (profile.jobTitlesSeeking.length === 0) missing.push("JOB TITLES SEEKING");
  if (!profile.remotePreference) missing.push("REMOTE PREFERENCE");
  if (!profile.salaryExpectation) missing.push("SALARY EXPECTATION");
  if (profile.preferredLocations.length === 0) missing.push("PREFERRED LOCATIONS");
  if (!profile.coverLetterTone) missing.push("COVER LETTER TONE");

  return missing;
}

function getTotalFields(): number {
  return 21;
}

export function CompletionIndicator({ profile }: CompletionIndicatorProps) {
  const missingFields = useMemo(() => getCompletionFields(profile), [profile]);
  const totalFields = getTotalFields();
  const completedFields = totalFields - missingFields.length;
  const percentage = Math.round((completedFields / totalFields) * 100);

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-5">
      <div className="flex items-center gap-6">
        {/* Percentage Ring */}
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="var(--color-warning)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-text-primary">
              {percentage}%
            </span>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1 space-y-1">
          <h3 className="text-sm font-medium text-text-primary">
            {percentage === 100
              ? "Your profile is complete!"
              : "Your profile needs attention"}
          </h3>
          <p className="text-sm text-text-secondary">
            Complete your profile to get matched with the best jobs.
          </p>
        </div>
      </div>

      {/* Missing Fields Tags */}
      {missingFields.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {missingFields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center rounded-full bg-[#fff4ed] px-3 py-1 text-xs font-medium text-warning"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
