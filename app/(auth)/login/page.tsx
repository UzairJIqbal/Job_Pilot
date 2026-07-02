"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";

type Provider = "google" | "github";

const benefits: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: "⚡",
    title: "AI-Powered Matching",
    description: "Get matched to jobs scored against your actual skills and experience.",
  },
  {
    icon: "🔍",
    title: "Company Research",
    description: "AI digs into every company so you walk in informed.",
  },
  {
    icon: "📄",
    title: "Smart Resumes",
    description: "Tailored resumes generated from your profile in seconds.",
  },
];

const providerStyles: Record<Provider, string> = {
  google: "border-border bg-surface hover:bg-surface-secondary",
  github: "border-border bg-surface hover:bg-surface-secondary",
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const providerIcons: Record<Provider, React.FC> = {
  google: GoogleIcon,
  github: GitHubIcon,
};

const providerLabels: Record<Provider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  function handleProviderClick(provider: Provider) {
    posthog.capture("oauth_provider_selected", { provider });
  }

  return (
    <>
      {/* Left panel — branding, hidden on mobile */}
      <div className="hidden w-[480px] flex-col justify-between bg-accent p-12 lg:flex">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
            Job Hunting, Reimagined
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Find your next role
            <br />
            with an AI co-pilot
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            JobPilot finds, scores, and researches jobs for you — so you spend
            less time searching and more time landing offers.
          </p>
        </div>

        <ul className="flex flex-col gap-5">
          {benefits.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-base">
                {item.icon}
              </span>
              <div>
                <span className="block text-sm font-medium text-white">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/70">
                  {item.description}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — sign-in form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-xl font-semibold text-text-primary">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              Sign in to continue to JobPilot
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {(["google", "github"] as Provider[]).map((provider) => {
              const Icon = providerIcons[provider];
              return (
                <a
                  key={provider}
                  href={`/api/auth/oauth/${provider}`}
                  onClick={() => handleProviderClick(provider)}
                  className={`flex h-11 items-center justify-center gap-3 rounded-lg border px-4 text-sm font-medium text-text-primary transition-colors ${providerStyles[provider]}`}
                >
                  <Icon />
                  {providerLabels[provider]}
                </a>
              );
            })}
          </div>

          {error && (
            <p className="mt-4 text-center text-sm text-error">
              {error === "invalid_provider"
                ? "Invalid sign-in method. Please try again."
                : "Something went wrong. Please try again."}
            </p>
          )}

          <p className="mt-10 text-center text-xs text-text-muted">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline transition-colors hover:text-text-secondary">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline transition-colors hover:text-text-secondary">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
