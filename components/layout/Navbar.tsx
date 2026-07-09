import Link from "next/link";
import type { ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { SignOutButton } from "./SignOutButton";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function LogoIcon(): ReactElement {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="#4361EE" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logo-gradient)" />
      <path
        d="M10 24L18 10L26 24H10Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M18 14L22 22H14L18 14Z"
        fill="white"
        fillOpacity="0.5"
      />
    </svg>
  );
}

const navItems: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/profile", label: "Profile" },
];

export async function Navbar(): Promise<ReactElement> {
  let user: { id: string; email?: string } | null = null;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    if (data.user) {
      user = { id: data.user.id, email: data.user.email };
    }
  } catch {
    // Not authenticated — show login CTA
  }

  return (
    <header className="border-b border-border bg-surface">
      {user && <PostHogIdentify userId={user.id} email={user.email} />}
      <div className="mx-auto flex h-16 w-full max-w-282 items-center justify-between px-5">
        <Link href="/" aria-label="JobPilot home" className="inline-flex items-center gap-2">
          <LogoIcon />
          <span className="text-sm font-semibold leading-5 text-text-slate">JobPilot</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium leading-5 text-text-primary transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-md bg-overlay px-5 text-sm font-medium leading-5 text-white transition-colors hover:bg-overlay-dark"
            >
              Start for free
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
