import { MATCH_THRESHOLD } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-accent",
  "bg-info",
  "bg-success",
  "bg-warning",
  "bg-error",
  "bg-info-dark",
  "bg-success-dark",
  "bg-accent-dark",
];

export function companyColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CompanyAvatar({ company, size = "md" }: { company: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold text-white ${dims} ${companyColor(company)}`}
    >
      {company.charAt(0).toUpperCase()}
    </div>
  );
}

export function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= MATCH_THRESHOLD
      ? "bg-success-lightest text-success-foreground"
      : score >= MATCH_THRESHOLD - 10
        ? "bg-info-lightest text-info-foreground"
        : "bg-warning-lightest text-warning-foreground";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {score}%
    </span>
  );
}
