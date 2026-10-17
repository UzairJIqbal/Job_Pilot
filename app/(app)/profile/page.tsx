import { PageHeader } from "@/components/layout/PageHeader";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getProfile } from "@/actions/profile";
import { getApplicationProfile } from "@/actions/application-profile";
import { ApplicationProfileForm } from "@/components/profile/ApplicationProfileForm";

export default async function ProfilePage() {
  let userId: string | undefined;
  let email: string | undefined;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    userId = data?.user?.id;
    email = data?.user?.email;
  } catch {
    // Not authenticated — proxy.ts redirects before we get here
  }

  const [{ data: profile, error: profileError }, { data: applicationProfile }] = await Promise.all([
    getProfile(userId),
    getApplicationProfile(userId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your resume and preferences drive every match score and generated document."
      />
      {profileError && (
        <div className="rounded-lg border border-error-light bg-error-lightest px-4 py-3 text-sm text-error-foreground">
          {profileError}
        </div>
      )}
      <ProfilePageClient profile={profile} authEmail={email} />
      <ApplicationProfileForm initial={applicationProfile} />
    </div>
  );
}
