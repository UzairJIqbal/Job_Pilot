"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/actions/auth";
import posthog from "posthog-js";
import { initPostHog } from "@/lib/posthog-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const result = await signOut();
    if (!result.error) {
      initPostHog();
      posthog.reset();
      router.push("/login");
      router.refresh();
    } else {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-secondary disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
