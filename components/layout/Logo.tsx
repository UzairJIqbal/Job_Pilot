import type { ReactElement } from "react";

type LogoMarkProps = {
  /** Unique gradient id — needed when several logos render on one page. */
  gradientId: string;
  size?: number;
};

export function LogoMark({ gradientId, size = 36 }: LogoMarkProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-logo-gradient-end)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill={`url(#${gradientId})`} />
      <path d="M10 24L18 10L26 24H10Z" fill="white" fillOpacity="0.95" />
      <path d="M18 14L22 22H14L18 14Z" fill="white" fillOpacity="0.5" />
    </svg>
  );
}
