"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ProfileFormData, WorkExperience } from "@/lib/mock-profile";
import { saveProfile } from "@/actions/profile";

/* ────────────── helpers ────────────── */

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text-primary">
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  id: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-muted"
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextareaInput({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
  }, [inputValue, tags, onChange]);

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag();
      }
      if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      }
    },
    [addTag, inputValue, tags, removeTag]
  );

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium text-text-dark"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-border"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
      />
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
    </div>
  );
}

/* ────────────── experience level options ────────────── */

const experienceLevelOptions = [
  { value: "entry", label: "Entry Level (0-2 years)" },
  { value: "mid", label: "Mid Level (3-5 years)" },
  { value: "senior", label: "Senior (6-9 years)" },
  { value: "lead", label: "Lead / Principal (10+ years)" },
  { value: "executive", label: "Executive (VP / C-Suite)" },
];

const remotePreferenceOptions = [
  { value: "remote-first", label: "Remote First" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on-site", label: "On-site Only" },
  { value: "flexible", label: "Flexible / Open" },
];

const coverLetterToneOptions = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "technical", label: "Technical" },
  { value: "creative", label: "Creative" },
];

const workAuthorizationOptions = [
  { value: "authorized", label: "Authorized to work" },
  { value: "visa-required", label: "Require visa sponsorship" },
  { value: "citizen", label: "Citizen / Permanent Resident" },
];

const degreeOptions = [
  { value: "high-school", label: "High School Diploma" },
  { value: "associate", label: "Associate Degree" },
  { value: "bachelor", label: "Bachelor's Degree" },
  { value: "master", label: "Master's Degree" },
  { value: "phd", label: "PhD" },
  { value: "other", label: "Other" },
];

/* ────────────── main component ────────────── */

type Props = {
  profile: ProfileFormData;
  onChange: (profile: ProfileFormData) => void;
};

export function ProfileForm({ profile, onChange }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const update = useCallback(
    (field: keyof ProfileFormData, value: string | string[]) => {
      onChange({ ...profile, [field]: value });
    },
    [profile, onChange]
  );

  const updateEducation = useCallback(
    (field: keyof ProfileFormData["education"], value: string) => {
      onChange({
        ...profile,
        education: { ...profile.education, [field]: value },
      });
    },
    [profile, onChange]
  );

  const updateExperience = useCallback(
    (id: string, field: keyof WorkExperience, value: string | boolean) => {
      onChange({
        ...profile,
        workExperience: profile.workExperience.map((exp) =>
          exp.id === id ? { ...exp, [field]: value } : exp
        ),
      });
    },
    [profile, onChange]
  );

  const addExperience = useCallback(() => {
    const newExp: WorkExperience = {
      id: `exp-${Date.now()}`,
      company: "",
      title: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      responsibilities: "",
    };
    onChange({
      ...profile,
      workExperience: [...profile.workExperience, newExp],
    });
  }, [profile, onChange]);

  const removeExperience = useCallback((id: string) => {
    onChange({
      ...profile,
      workExperience: profile.workExperience.filter((exp) => exp.id !== id),
    });
  }, [profile, onChange]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setSaveMessage(null);
      setSaveError(null);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const result = await saveProfile(profile);

      if (result.success) {
        setSaveMessage("Profile saved successfully");
        saveTimeoutRef.current = setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveError(result.error ?? "Failed to save profile. Please try again.");
      }

      setIsSaving(false);
    },
    [profile]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Personal Information ── */}
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Personal Information"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
            <TextInput id="fullName" value={profile.fullName} onChange={(v) => update("fullName", v)} placeholder="John Doe" />
          </div>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput id="email" value={profile.email} disabled placeholder="you@example.com" />
          </div>
          <div>
            <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
            <TextInput id="phone" value={profile.phone} onChange={(v) => update("phone", v)} placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <TextInput id="location" value={profile.location} onChange={(v) => update("location", v)} placeholder="San Francisco, CA" />
          </div>
          <div>
            <FieldLabel htmlFor="linkedinUrl">LinkedIn URL</FieldLabel>
            <TextInput id="linkedinUrl" value={profile.linkedinUrl} onChange={(v) => update("linkedinUrl", v)} placeholder="https://linkedin.com/in/yourname" />
          </div>
          <div>
            <FieldLabel htmlFor="portfolioUrl">Portfolio / GitHub URL</FieldLabel>
            <TextInput id="portfolioUrl" value={profile.portfolioUrl} onChange={(v) => update("portfolioUrl", v)} placeholder="https://github.com/yourname" />
          </div>
          <div>
            <FieldLabel htmlFor="workAuthorization">Work Authorization</FieldLabel>
            <SelectInput id="workAuthorization" value={profile.workAuthorization} onChange={(v) => update("workAuthorization", v)} options={workAuthorizationOptions} />
          </div>
        </div>
      </section>

      {/* ── Professional Information ── */}
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Professional Information"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="currentTitle">Current Job Title</FieldLabel>
            <TextInput id="currentTitle" value={profile.currentTitle} onChange={(v) => update("currentTitle", v)} placeholder="Senior Software Engineer" />
          </div>
          <div>
            <FieldLabel htmlFor="experienceLevel">Experience Level</FieldLabel>
            <SelectInput id="experienceLevel" value={profile.experienceLevel} onChange={(v) => update("experienceLevel", v)} options={experienceLevelOptions} placeholder="Select level" />
          </div>
          <div>
            <FieldLabel htmlFor="yearsExperience">Years of Experience</FieldLabel>
            <TextInput id="yearsExperience" value={profile.yearsExperience} onChange={(v) => update("yearsExperience", v)} placeholder="e.g. 5" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Skills</FieldLabel>
            <TagInput tags={profile.skills} onChange={(v) => update("skills", v)} placeholder="Add a skill and press Enter" />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Industries</FieldLabel>
            <TagInput tags={profile.industries} onChange={(v) => update("industries", v)} placeholder="Add an industry and press Enter" />
          </div>
        </div>
      </section>

      {/* ── Work Experience ── */}
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Work Experience"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <div className="space-y-6">
          {profile.workExperience.map((exp, index) => (
            <div key={exp.id} className="rounded-lg border border-border bg-surface-secondary p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                  Role {index + 1}
                </span>
                {profile.workExperience.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExperience(exp.id)}
                    className="text-xs text-text-muted transition-colors hover:text-error"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`company-${exp.id}`}>Company Name</FieldLabel>
                  <TextInput id={`company-${exp.id}`} value={exp.company} onChange={(v) => updateExperience(exp.id, "company", v)} placeholder="Company Inc." />
                </div>
                <div>
                  <FieldLabel htmlFor={`title-${exp.id}`}>Job Title</FieldLabel>
                  <TextInput id={`title-${exp.id}`} value={exp.title} onChange={(v) => updateExperience(exp.id, "title", v)} placeholder="Software Engineer" />
                </div>
                <div>
                  <FieldLabel htmlFor={`start-${exp.id}`}>Start Date</FieldLabel>
                  <TextInput id={`start-${exp.id}`} type="month" value={exp.startDate} onChange={(v) => updateExperience(exp.id, "startDate", v)} />
                </div>
                <div>
                  <FieldLabel htmlFor={`end-${exp.id}`}>End Date</FieldLabel>
                  <TextInput
                    id={`end-${exp.id}`}
                    type="month"
                    value={exp.endDate}
                    onChange={(v) => updateExperience(exp.id, "endDate", v)}
                    disabled={exp.isCurrent}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={exp.isCurrent}
                      onChange={(e) => updateExperience(exp.id, "isCurrent", e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    Currently working here
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor={`resp-${exp.id}`}>Key Responsibilities</FieldLabel>
                  <TextareaInput id={`resp-${exp.id}`} value={exp.responsibilities} onChange={(v) => updateExperience(exp.id, "responsibilities", v)} placeholder="Describe your key responsibilities and achievements..." rows={3} />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Work Experience
          </button>
        </div>
      </section>

      {/* ── Education ── */}
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Education"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="degree">Highest Degree</FieldLabel>
            <SelectInput id="degree" value={profile.education.degree} onChange={(v) => updateEducation("degree", v)} options={degreeOptions} placeholder="Select degree" />
          </div>
          <div>
            <FieldLabel htmlFor="fieldOfStudy">Field of Study</FieldLabel>
            <TextInput id="fieldOfStudy" value={profile.education.fieldOfStudy} onChange={(v) => updateEducation("fieldOfStudy", v)} placeholder="Computer Science" />
          </div>
          <div>
            <FieldLabel htmlFor="institution">Institution Name</FieldLabel>
            <TextInput id="institution" value={profile.education.institution} onChange={(v) => updateEducation("institution", v)} placeholder="MIT" />
          </div>
          <div>
            <FieldLabel htmlFor="gradYear">Graduation Year</FieldLabel>
            <TextInput id="gradYear" value={profile.education.graduationYear} onChange={(v) => updateEducation("graduationYear", v)} placeholder="2019" />
          </div>
        </div>
      </section>

      {/* ── Job Preferences ── */}
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Job Preferences"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
        <div className="space-y-4">
          <div>
            <FieldLabel>Job Titles You're Seeking</FieldLabel>
            <TagInput tags={profile.jobTitlesSeeking} onChange={(v) => update("jobTitlesSeeking", v)} placeholder="Add a job title and press Enter" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="remotePref">Remote Preference</FieldLabel>
              <SelectInput id="remotePref" value={profile.remotePreference} onChange={(v) => update("remotePreference", v)} options={remotePreferenceOptions} placeholder="Select preference" />
            </div>
            <div>
              <FieldLabel htmlFor="salaryExpect">Salary Expectation</FieldLabel>
              <TextInput id="salaryExpect" value={profile.salaryExpectation} onChange={(v) => update("salaryExpectation", v)} placeholder="e.g. $120,000 - $150,000" />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Preferred Locations</FieldLabel>
              <TagInput tags={profile.preferredLocations} onChange={(v) => update("preferredLocations", v)} placeholder="Add a location and press Enter" />
            </div>
            <div>
              <FieldLabel htmlFor="coverTone">Cover Letter Tone</FieldLabel>
              <SelectInput id="coverTone" value={profile.coverLetterTone} onChange={(v) => update("coverLetterTone", v)} options={coverLetterToneOptions} placeholder="Select tone" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Save Button ── */}
      <div className="flex flex-col items-end gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
        {saveMessage && (
          <p className="text-sm text-success-foreground">{saveMessage}</p>
        )}
        {saveError && (
          <p className="text-sm text-error-foreground">{saveError}</p>
        )}
      </div>
    </form>
  );
}
