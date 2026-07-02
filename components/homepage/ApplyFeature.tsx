import Image from "next/image";
import type { ReactElement } from "react";

const applyBenefits: Array<{ title: string; description: string; active?: boolean }> = [
  {
    title: "Understand your match score",
    description:
      "See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what's missing.",
  },
  {
    title: "AI-Powered Job Matching",
    description:
      "Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter.",
    active: true,
  },
  {
    title: "Focus on the right roles",
    description:
      "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying.",
  },
];

export function ApplyFeature(): ReactElement {
  return (
    <section className="border-x border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1128px] grid-cols-1 md:grid-cols-2">
        <div className="flex items-center justify-center border-b border-border bg-surface-muted px-8 py-20 md:border-b-0 md:border-r">
          <Image
            src="/images/agnet-log.png"
            alt="JobPilot agent log"
            width={536}
            height={414}
            className="w-full max-w-[430px] rounded-xl"
          />
        </div>

        <div>
          <div className="flex min-h-[196px] items-end px-10 pb-10 pt-16 md:px-14">
            <h2 className="max-w-[390px] text-[38px] font-bold leading-[1.08] text-text-slate">
              Apply With More Confidence, Every Time
            </h2>
          </div>
          <div className="border-t border-border">
            {applyBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className={`border-b border-border px-10 py-8 last:border-b-0 md:px-14 ${
                  benefit.active ? "border-l-2 border-l-success" : "border-l-2 border-l-transparent"
                }`}
              >
                <h3 className="text-base font-semibold leading-6 text-text-darker">
                  {benefit.title}
                </h3>
                <p className="mt-3 max-w-[430px] text-sm font-medium leading-6 text-text-secondary">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
