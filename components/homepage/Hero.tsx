import Link from "next/link";
import type { ReactElement } from "react";

export function Hero(): ReactElement {
  return (
    <section className="landing-gradient border-x border-b border-border">
      <div className="mx-auto flex min-h-[330px] w-full max-w-[1128px] flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="max-w-[720px] text-[42px] font-bold leading-[1.08] text-text-slate md:text-[54px]">
          Job hunting is hard.
          <br />
          Your tools shouldn&apos;t be.
        </h1>
        <p className="mt-6 max-w-[540px] text-sm font-medium leading-6 text-text-secondary">
          Stop applying blind. JobPilot finds the jobs, researches the companies, and gives
          you everything you need to stand out.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
