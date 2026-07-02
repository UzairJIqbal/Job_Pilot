"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { initPostHog } from "@/lib/posthog-client";

interface Props {
  userId: string;
  email?: string;
}

export function PostHogIdentify({ userId, email }: Props) {
  useEffect(() => {
    initPostHog();
    posthog.identify(userId, { email });
  }, [userId, email]);

  return null;
}
