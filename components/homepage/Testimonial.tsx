import Image from "next/image";
import type { ReactElement } from "react";

export function Testimonial(): ReactElement {
  return (
    <section className="border-x border-b border-border bg-surface">
      <div className="mx-auto flex min-h-[360px] w-full max-w-[1128px] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase leading-4 text-accent">Success Stories</p>
        <blockquote className="mt-6 max-w-[760px] text-[26px] font-semibold leading-[1.35] text-text-darker">
          &ldquo;I used to spend my evenings copy-pasting resumes. Now I open my dashboard
          to see interviews waiting. It feels like cheating. Had 3 offers on the table
          simultaneously.&rdquo;
        </blockquote>
        <div className="mt-8 flex items-center gap-3">
          <Image
            src="/images/user-icon.png"
            alt="Tom Wilson"
            width={40}
            height={40}
            className="rounded-md"
          />
          <div className="text-left">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-5 text-text-primary">
              Tom Wilson
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Verified"
              >
                <circle cx="8" cy="8" r="8" fill="var(--color-success)" />
                <path
                  d="M5 8L7 10L11 6"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </p>
            <p className="text-xs font-medium leading-4 text-text-secondary">Junior Developer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
