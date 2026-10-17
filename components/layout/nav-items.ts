import { Home, Search, KanbanSquare, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const APP_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", description: "What needs you today", icon: Home },
  { href: "/find-jobs", label: "Find jobs", description: "Search and score new roles", icon: Search },
  { href: "/applications", label: "Applications", description: "Your pipeline, stage by stage", icon: KanbanSquare },
  { href: "/profile", label: "Profile", description: "Resume and preferences", icon: UserRound },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
