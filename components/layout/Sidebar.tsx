"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Command } from "lucide-react";
import { LogoMark } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { APP_NAV, isActivePath } from "./nav-items";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CommandPalette } from "./CommandPalette";

type SidebarProps = {
  email?: string;
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-0.5">
      {APP_NAV.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-light text-accent"
                : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  email,
  onNavigate,
  onOpenPalette,
}: SidebarProps & { onNavigate?: () => void; onOpenPalette: () => void }) {
  const initial = email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <LogoMark gradientId="sidebar-logo-gradient" size={28} />
        <span className="text-sm font-semibold text-text-primary">JobPilot</span>
      </Link>

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
      >
        <span>Jump to…</span>
        <kbd className="inline-flex items-center gap-0.5 rounded-sm border border-border px-1.5 text-[11px] font-medium">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent">
            {initial}
          </div>
          <p className="min-w-0 flex-1 truncate text-xs text-text-secondary" title={email}>
            {email ?? "Signed in"}
          </p>
          <ThemeToggle />
        </div>
        <SignOutButton className="w-full" />
      </div>
    </div>
  );
}

export function Sidebar({ email }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setMobileOpen(false);
    setPaletteOpen(true);
  };

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-border bg-surface-secondary lg:block">
        <SidebarBody email={email} onOpenPalette={openPalette} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark gradientId="mobile-logo-gradient" size={28} />
          <span className="text-sm font-semibold text-text-primary">JobPilot</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-overlay/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface-secondary shadow-pop">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody
              email={email}
              onNavigate={() => setMobileOpen(false)}
              onOpenPalette={openPalette}
            />
          </div>
        </div>
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
