<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the JobPilot Next.js App Router application. PostHog is initialized via `instrumentation-client.ts` (the correct pattern for Next.js 15.3+) with a reverse proxy configured in `next.config.ts` to route requests through `/ingest`. A server-side PostHog client (`lib/posthog-server.ts`) is used to capture events from API routes. Users are identified client-side via a `PostHogIdentify` component rendered on the dashboard page.

| Event Name | Description | File |
|---|---|---|
| `oauth_provider_selected` | User clicks a social login button (Google or GitHub) on the login page. | `app/(auth)/login/page.tsx` |
| `oauth_initiated` | Server successfully redirects the user to an OAuth provider to begin authentication. | `app/api/auth/oauth/[provider]/route.ts` |
| `oauth_completed` | Server exchanges the OAuth code and the user is authenticated successfully. | `app/api/auth/callback/route.ts` |
| `oauth_failed` | OAuth code exchange fails and the user is redirected back to login with an error. | `app/api/auth/callback/route.ts` |
| `user_signed_out` | User clicks the sign-out button and is successfully logged out. | `components/layout/SignOutButton.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/494489/dashboard/1788956)
- [OAuth Login Funnel (wizard)](https://us.posthog.com/project/494489/insights/Scura0a8)
- [Daily Login Attempts (wizard)](https://us.posthog.com/project/494489/insights/iYA6TGKt)
- [Login Provider Breakdown (wizard)](https://us.posthog.com/project/494489/insights/FLXKuCiw)
- [User Sign-outs (wizard)](https://us.posthog.com/project/494489/insights/6xQr5dYr)
- [Auth Failures (wizard)](https://us.posthog.com/project/494489/insights/Havp6LlK)

## Verify before merging

- [ ] Run a full production build (`bun run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentify` component fires on every dashboard load, which covers returning sessions, but verify this works correctly once the app is running in a browser.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
