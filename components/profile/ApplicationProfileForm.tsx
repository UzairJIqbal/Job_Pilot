"use client";

import { useState, useRef, useEffect } from "react";
import { saveApplicationProfile } from "@/actions/application-profile";
import {
  EEO_OPTIONS,
  EMPTY_APPLICATION_PROFILE,
  type ApplicationProfileFormData,
  type SavedAnswer,
} from "@/lib/application-profile";
import {
  FieldLabel,
  SectionHeader,
  SelectInput,
  TagInput,
  TextInput,
  TextareaInput,
} from "@/components/profile/ProfileForm";

const yesNoOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const eeoOptions = (values: readonly string[]) => [
  { value: "decline", label: "Decline to answer" },
  ...values.map((v) => ({ value: v, label: v })),
];

type Props = { initial: ApplicationProfileFormData | null };

export function ApplicationProfileForm({ initial }: Props) {
  const [data, setData] = useState<ApplicationProfileFormData>(initial ?? EMPTY_APPLICATION_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function update<K extends keyof ApplicationProfileFormData>(field: K, value: ApplicationProfileFormData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateAnswer(index: number, field: keyof SavedAnswer, value: string) {
    setData((prev) => ({
      ...prev,
      savedAnswers: prev.savedAnswers.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    const result = await saveApplicationProfile(data);
    setIsSaving(false);
    if (result.success) {
      setSaveMessage("Application answers saved");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveError(result.error ?? "Failed to save application answers");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Application Answers"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
        <p className="mb-4 text-sm text-text-secondary">
          Used to fill application forms. Anything the agent can&apos;t answer from here is flagged for
          you to review before an application is sent.
        </p>
        <div className="space-y-4">
          <div>
            <FieldLabel>Countries You Can Work In Without Sponsorship</FieldLabel>
            <TagInput
              tags={data.authorizedCountries}
              onChange={(v) => update("authorizedCountries", v)}
              placeholder="Add a country and press Enter"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="needsSponsorship">Need Visa Sponsorship?</FieldLabel>
              <SelectInput
                id="needsSponsorship"
                value={data.needsSponsorship}
                onChange={(v) => update("needsSponsorship", v as ApplicationProfileFormData["needsSponsorship"])}
                options={yesNoOptions}
                placeholder="Select"
              />
            </div>
            <div>
              <FieldLabel htmlFor="willingToRelocate">Willing to Relocate?</FieldLabel>
              <SelectInput
                id="willingToRelocate"
                value={data.willingToRelocate}
                onChange={(v) => update("willingToRelocate", v as ApplicationProfileFormData["willingToRelocate"])}
                options={yesNoOptions}
                placeholder="Select"
              />
            </div>
            <div>
              <FieldLabel htmlFor="noticePeriod">Notice Period</FieldLabel>
              <TextInput
                id="noticePeriod"
                value={data.noticePeriod}
                onChange={(v) => update("noticePeriod", v)}
                placeholder="e.g. 2 weeks"
              />
            </div>
            <div>
              <FieldLabel htmlFor="earliestStart">Earliest Start Date</FieldLabel>
              <TextInput
                id="earliestStart"
                type="date"
                value={data.earliestStartDate}
                onChange={(v) => update("earliestStartDate", v)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="githubUrl">GitHub</FieldLabel>
              <TextInput
                id="githubUrl"
                type="url"
                value={data.githubUrl}
                onChange={(v) => update("githubUrl", v)}
                placeholder="https://github.com/..."
              />
            </div>
            <div>
              <FieldLabel htmlFor="pronouns">Pronouns</FieldLabel>
              <TextInput
                id="pronouns"
                value={data.pronouns}
                onChange={(v) => update("pronouns", v)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Voluntary Self-Identification"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          }
        />
        <p className="mb-4 text-sm text-text-secondary">
          These questions are optional on every form. Unless you change them, the agent picks
          &quot;decline to answer&quot;.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="gender">Gender</FieldLabel>
            <SelectInput id="gender" value={data.gender} onChange={(v) => update("gender", v)} options={eeoOptions(EEO_OPTIONS.gender)} />
          </div>
          <div>
            <FieldLabel htmlFor="race">Race / Ethnicity</FieldLabel>
            <SelectInput id="race" value={data.raceEthnicity} onChange={(v) => update("raceEthnicity", v)} options={eeoOptions(EEO_OPTIONS.raceEthnicity)} />
          </div>
          <div>
            <FieldLabel htmlFor="veteran">Veteran Status</FieldLabel>
            <SelectInput id="veteran" value={data.veteranStatus} onChange={(v) => update("veteranStatus", v)} options={eeoOptions(EEO_OPTIONS.veteranStatus)} />
          </div>
          <div>
            <FieldLabel htmlFor="disability">Disability Status</FieldLabel>
            <SelectInput id="disability" value={data.disabilityStatus} onChange={(v) => update("disabilityStatus", v)} options={eeoOptions(EEO_OPTIONS.disabilityStatus)} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-5">
        <SectionHeader
          title="Saved Answers"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
        <p className="mb-4 text-sm text-text-secondary">
          Answers to questions that come up often, such as &quot;Why are you interested?&quot; or
          &quot;How did you hear about us?&quot;. The agent reuses them where a question matches.
        </p>
        <div className="space-y-4">
          {data.savedAnswers.map((answer, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <TextInput
                    id={`saved-q-${i}`}
                    value={answer.question}
                    onChange={(v) => updateAnswer(i, "question", v)}
                    placeholder="Question"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => update("savedAnswers", data.savedAnswers.filter((_, j) => j !== i))}
                  className="h-10 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-secondary hover:text-error-foreground"
                >
                  Remove
                </button>
              </div>
              <TextareaInput
                id={`saved-a-${i}`}
                value={answer.answer}
                onChange={(v) => updateAnswer(i, "answer", v)}
                placeholder="Your answer"
                rows={3}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("savedAnswers", [...data.savedAnswers, { question: "", answer: "" }])}
            className="rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-text-secondary hover:border-accent hover:text-accent"
          >
            + Add an answer
          </button>
        </div>
      </section>

      <div className="flex flex-col items-end gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Application Answers"}
        </button>
        {saveMessage && <p className="text-sm text-success-foreground">{saveMessage}</p>}
        {saveError && <p className="text-sm text-error-foreground">{saveError}</p>}
      </div>
    </form>
  );
}
