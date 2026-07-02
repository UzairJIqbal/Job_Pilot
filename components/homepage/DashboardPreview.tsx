import Image from "next/image";
import type { ReactElement } from "react";

export function DashboardPreview(): ReactElement {
  return (
    <section className="border-x border-b border-border bg-surface-secondary">
      <div className="mx-auto flex w-full max-w-[1128px] justify-center px-8 py-12 md:px-16">
        <Image
          src="/images/dashboard-demo.png"
          alt="JobPilot dashboard preview"
          width={1197}
          height={604}
          priority
          className="image-soft-shadow w-full max-w-[940px] rounded-xl"
        />
      </div>
    </section>
  );
}
