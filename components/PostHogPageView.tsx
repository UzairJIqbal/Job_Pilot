"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { initPostHog } from "@/lib/posthog-client";

export function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (pathname) {
      posthog.capture("$pageview", { $current_url: window.location.href });
    }
  }, [pathname]);

  return null;
}
