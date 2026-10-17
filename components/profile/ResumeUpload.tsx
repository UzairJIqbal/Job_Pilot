"use client";

import { useCallback, useState, useRef } from "react";
import { uploadResume } from "@/actions/profile";
import { MAX_RESUME_BYTES, MAX_RESUME_LABEL, NOT_A_PDF, looksLikePdf } from "@/lib/resume-file";

import type { ProfileFormData } from "@/lib/mock-profile";

interface ResumeUploadProps {
  resumeUrl: string | null;
  onUploadComplete: (url: string) => void;
  onExtractComplete?: (data: Partial<ProfileFormData>) => void;
  onGenerateComplete?: (url: string) => void;
}

export function ResumeUpload({ resumeUrl, onUploadComplete, onExtractComplete, onGenerateComplete }: ResumeUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted.");
        return;
      }
      if (file.size > MAX_RESUME_BYTES) {
        setError(`File must be under ${MAX_RESUME_LABEL}.`);
        return;
      }
      if (!looksLikePdf(new Uint8Array(await file.slice(0, 1024).arrayBuffer()))) {
        setError(NOT_A_PDF);
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadResume(file);
        if (result.error) {
          setError(result.error);
        } else if (result.url) {
          onUploadComplete(result.url);
        }
      } catch {
        // A rejected request body never reaches the action, so it can't return an error.
        setError("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleExtract = useCallback(async () => {
    setExtractError(null);
    setIsExtracting(true);

    try {
      const res = await fetch("/api/resume/extract", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setExtractError(body.error ?? "Extraction failed. Please try again.");
        return;
      }

      if (body.data && onExtractComplete) {
        onExtractComplete(body.data);
      }
    } catch {
      setExtractError("Network error. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  }, [onExtractComplete]);

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/resume/generate", { method: "POST" });

      if (!res.ok) {
        const body = await res.json();
        setGenerateError(body.error ?? "Generation failed. Please try again.");
        return;
      }

      // Response is the PDF buffer directly
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // Update profile state with the storage URL from header
      const resumeUrl = res.headers.get("X-Resume-Url");
      if (resumeUrl && onGenerateComplete) {
        onGenerateComplete(resumeUrl);
      }
    } catch {
      setGenerateError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateComplete]);

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-5">
      <h3 className="mb-4 text-sm font-medium text-text-primary">
        Resume
      </h3>

      {resumeUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-success-light bg-success-lightest px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-success-foreground">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <a
            href="/api/resume/view"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm font-medium text-success-foreground underline hover:opacity-80"
          >
            Resume uploaded
          </a>
          <button
            type="button"
            onClick={handleClick}
            className="text-xs font-medium text-success-foreground underline hover:opacity-80"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
            isDragging
              ? "border-accent bg-accent-muted"
              : "border-border bg-surface-secondary hover:border-border-muted"
          }`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">
            {isDragging ? "Drop your resume here" : "Drag & drop your resume here"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            or click to browse files
          </p>
          <p className="mt-2 text-xs text-text-muted">
            PDF only, up to {MAX_RESUME_LABEL}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading && (
        <p className="mt-3 text-sm text-text-secondary">Uploading resume...</p>
      )}
      {isExtracting && (
        <p className="mt-3 text-sm text-text-secondary">Extracting profile data from resume...</p>
      )}
      {isGenerating && (
        <p className="mt-3 text-sm text-text-secondary">Generating resume PDF...</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-error-foreground">{error}</p>
      )}
      {extractError && (
        <p className="mt-3 text-sm text-error-foreground">{extractError}</p>
      )}
      {generateError && (
        <p className="mt-3 text-sm text-error-foreground">{generateError}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!resumeUrl && (
          <button
            type="button"
            onClick={handleClick}
            disabled={isUploading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Select Resume
          </button>
        )}
        <button
          type="button"
          disabled={!resumeUrl || isGenerating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <polyline points="9 15 12 12 15 15" />
          </svg>
          {isGenerating ? "Generating..." : "Generate Resume from Profile"}
        </button>
        <button
          type="button"
          disabled={!resumeUrl || isExtracting}
          onClick={handleExtract}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          {isExtracting ? "Extracting..." : "Extract from Resume"}
        </button>
      </div>
    </div>
  );
}
