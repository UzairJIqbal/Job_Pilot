import Image from "next/image";
import type { ReactElement } from "react";

const searchBenefits: Array<{ title: string; description: string; active?: boolean }> = [
  {
    title: "Find jobs that actually fit",
    description:
      "Search by title and location or paste a job link. Get matched roles you can quickly scan.",
    active: true,
  },
  {
    title: "Know the Company Before You Apply",
    description:
      "Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence.",
  },
  {
    title: "Keep track of every application",
    description:
      "Keep a clear view of every job you've found, tailored. Your activity and progress all stay in one simple place.",
  },
];

export function SearchFeature(): ReactElement {
  return (
    <section className="border-x border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1128px] grid-cols-1 md:grid-cols-2">
        <div className="border-b border-border md:border-b-0 md:border-r">
          <div className="flex min-h-[196px] items-end px-10 pb-10 pt-16 md:px-14">
            <h2 className="max-w-[360px] text-[38px] font-bold leading-[1.08] text-text-slate">
              Manage Your Job Search With Ease
            </h2>
          </div>
          <div className="border-t border-border">
            {searchBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className={`border-b border-border px-10 py-8 last:border-b-0 md:px-14 ${
                  benefit.active ? "border-l-2 border-l-success" : "border-l-2 border-l-transparent"
                }`}
              >
                <h3 className="text-base font-semibold leading-6 text-text-darker">
                  {benefit.title}
                </h3>
                <p className="mt-3 max-w-[420px] text-sm font-medium leading-6 text-text-secondary">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center bg-surface-muted px-8 py-16">
          <Image
            src="/images/jobs-lists.png"
            alt="JobPilot job matches list"
            width={591}
            height={445}
            className="w-full max-w-[455px] rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
