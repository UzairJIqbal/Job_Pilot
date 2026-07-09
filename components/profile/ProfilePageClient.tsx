"use client";

import { useState, useCallback } from "react";
import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { ProfileFormData } from "@/lib/mock-profile";

type Props = {
  profile: ProfileFormData | null;
  authEmail: string | undefined;
};

export function ProfilePageClient({ profile: initialProfile, authEmail }: Props) {
  const [profile, setProfile] = useState<ProfileFormData>(() => {
    if (initialProfile) {
      return initialProfile.email ? initialProfile : { ...initialProfile, email: authEmail ?? "" };
    }
    return {
      fullName: "",
      email: authEmail ?? "",
      phone: "",
      location: "",
      linkedinUrl: "",
      portfolioUrl: "",
      workAuthorization: "",
      currentTitle: "",
      experienceLevel: "",
      yearsExperience: "",
      skills: [],
      industries: [],
      workExperience: [],
      education: { degree: "", fieldOfStudy: "", institution: "", graduationYear: "" },
      jobTitlesSeeking: [],
      remotePreference: "",
      salaryExpectation: "",
      preferredLocations: [],
      coverLetterTone: "",
      resumePdfUrl: null,
    };
  });

  const handleProfileChange = useCallback((updated: ProfileFormData) => {
    setProfile(updated);
  }, []);

  const handleResumeUploadComplete = useCallback((url: string) => {
    setProfile((prev) => ({ ...prev, resumePdfUrl: url }));
  }, []);

  const handleExtractComplete = useCallback((data: Partial<ProfileFormData>) => {
    setProfile((prev) => ({
      ...prev,
      ...data,
      email: prev.email, // preserve OAuth email
      resumePdfUrl: prev.resumePdfUrl, // preserve current resume URL
    }));
  }, []);

  const handleGenerateComplete = useCallback((url: string) => {
    setProfile((prev) => ({ ...prev, resumePdfUrl: url }));
  }, []);

  return (
    <div className="space-y-6">
      <CompletionIndicator profile={profile} />
      <ResumeUpload
        resumeUrl={profile.resumePdfUrl}
        onUploadComplete={handleResumeUploadComplete}
        onExtractComplete={handleExtractComplete}
        onGenerateComplete={handleGenerateComplete}
      />
      <ProfileForm profile={profile} onChange={handleProfileChange} />
    </div>
  );
}
