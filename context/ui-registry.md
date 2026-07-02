# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Layout

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Navbar` | `components/layout/Navbar.tsx` | `h-16 max-w-[1128px] bg-surface border-b border-border`, logo text `text-sm font-semibold text-text-slate` with `gap-2`, nav links `text-sm font-medium text-text-primary`, CTA `bg-text-slate text-white rounded-md h-9`. Server component — checks auth state, shows SignOutButton + PostHogIdentify when authenticated |
| `Footer` | `components/layout/Footer.tsx` | `min-h-28 max-w-[1128px] bg-surface border-x border-t border-border`, logo text `text-sm font-semibold text-text-slate` with `gap-2`, links `text-xs font-medium text-text-secondary`, social icons `h-8 w-8 rounded-md text-text-secondary` |
| `SignOutButton` | `components/layout/SignOutButton.tsx` | Client component. `h-9 border border-border bg-surface rounded-md text-text-primary` secondary button style. Calls `signOut` server action, redirects to /login |

### Homepage Sections

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Hero` | `components/homepage/Hero.tsx` | `min-h-[540px] landing-gradient`, headline `text-[42px] md:text-[48px] font-bold text-text-slate`, CTA primary `bg-overlay text-accent-foreground`, CTA secondary `border border-border bg-surface text-text-primary` |
| `DashboardPreview` | `components/homepage/DashboardPreview.tsx` | `bg-surface-muted border-x border-b border-border`, image `max-w-[848px] image-soft-shadow rounded-2xl` |
| `SearchFeature` | `components/homepage/SearchFeature.tsx` | Two-column grid, left `bg-surface-muted border-r`, right `px-14`, heading `text-[38px] font-bold text-text-slate`, active benefit `border-l-2 border-l-success` |
| `ApplyFeature` | `components/homepage/ApplyFeature.tsx` | Two-column grid, left `bg-surface-muted border-r`, right `px-14`, heading `text-[38px] font-bold text-text-slate`, active benefit `border-l-2 border-l-success` |
| `Testimonial` | `components/homepage/Testimonial.tsx` | `min-h-[360px] bg-surface`, quote `text-[26px] font-semibold text-text-darker`, badge `text-xs font-semibold uppercase text-accent`, verified icon `fill-success` green checkmark next to name |
| `BottomCta` | `components/homepage/BottomCta.tsx` | `min-h-[330px] landing-gradient`, headline `text-[42px] md:text-[48px] font-bold text-text-slate`, buttons same as Hero |

### Auth Pages

| Component | Path | Key Classes |
|-----------|------|-------------|
| `Dashboard Page` | `app/dashboard/page.tsx` | Thin wrapper: Navbar → `main.flex-1.px-6.py-8` → Footer. Content `max-w-6xl mx-auto space-y-6`. Heading `text-xl font-semibold text-text-primary`, body `text-sm text-text-secondary`. |
| `Login Page` | `app/(auth)/login/page.tsx` | Two-panel layout. Left branding panel: `w-[480px] bg-accent p-12` (hidden below lg). Pill badge: `rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white`. Headline: `text-3xl font-semibold leading-tight text-white`. Subtext: `text-sm leading-relaxed text-white/80`. Benefit icon: `h-9 w-9 rounded-lg bg-white/15 text-base`. Benefit title: `text-sm font-medium text-white`. Benefit desc: `text-xs leading-relaxed text-white/70`. Right form panel: `flex-1 items-center justify-center px-6 py-12`, form `max-w-sm`. Heading: `text-xl font-semibold text-text-primary`. Subheading: `text-sm text-text-secondary`. OAuth buttons: `h-11 rounded-lg border border-border bg-surface hover:bg-surface-secondary text-sm font-medium text-text-primary gap-3`. Legal text: `text-xs text-text-muted` with `underline hover:text-text-secondary`. Error text: `text-sm text-error`. Suspense fallback: `h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent`. Client component — uses `useSearchParams` wrapped in `Suspense`. |

**Pattern notes:**
- OAuth buttons use `h-11` (larger than standard `h-9` buttons) for tap-friendly touch targets on auth flow
- Left branding panel uses `bg-accent` (the project's primary purple) — consistent brand color for auth screens
- White overlays on accent: `bg-white/20` for badges, `bg-white/15` for icons, `text-white/80` for subtext, `text-white/70` for descriptions
- Error and legal text sit below the buttons with `mt-4` and `mt-10` respectively
- Suspense fallback spinner uses `border-t-accent` accent color on a `border-border` track — reuse this pattern for all loading spinners
