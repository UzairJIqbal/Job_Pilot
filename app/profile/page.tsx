import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getProfile } from "@/actions/profile";

export default async function ProfilePage() {
  let userId: string | undefined;
  let email: string | undefined;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    userId = data?.user?.id;
    email = data?.user?.email;
  } catch {
    // Not authenticated — identity not set
  }

  const { data: profile, error: profileError } = await getProfile(userId);

  return (
    <div className="flex min-h-screen flex-col">
      {userId && <PostHogIdentify userId={userId} email={email} />}
      <Navbar />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-282 space-y-6">
          <h1 className="text-xl font-semibold text-text-primary">
            Your Profile
          </h1>
          {profileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {profileError}
            </div>
          )}
          <ProfilePageClient profile={profile} authEmail={email} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
