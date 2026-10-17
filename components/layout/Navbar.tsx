import Link from "next/link";
import type { ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { SignOutButton } from "./SignOutButton";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoMark } from "./Logo";

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
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-5">
        <Link href="/" aria-label="JobPilot home" className="inline-flex items-center gap-2">
          <LogoMark gradientId="nav-logo-gradient" />
          <span className="text-sm font-semibold leading-5 text-text-primary">JobPilot</span>
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
