import Link from "next/link";
import type { ReactElement } from "react";

export function BottomCta(): ReactElement {
  return (
    <section className="landing-gradient border-x border-b border-border">
      <div className="mx-auto flex min-h-[330px] w-full max-w-[1128px] flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="max-w-[700px] text-[42px] font-bold leading-[1.08] text-text-slate md:text-[48px]">
          Your next job search can feel a lot less overwhelming
        </h2>
        <p className="mt-6 text-sm font-medium leading-6 text-text-secondary">
          Set up your profile, upload your resume, and start finding matches in minutes.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-10 min-w-36 items-center justify-center rounded-md bg-overlay px-5 text-sm font-medium leading-5 text-accent-foreground transition-colors hover:bg-overlay-dark"
          >
            Get Started &gt;
          </Link>
          <Link
            href="/find-jobs"
            className="inline-flex h-10 min-w-44 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-secondary"
          >
            Find Your First Match
          </Link>
        </div>
      </div>
    </section>
  );
}
