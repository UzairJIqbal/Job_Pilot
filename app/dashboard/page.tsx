import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { createInsforgeServer } from "@/lib/insforge-server";

export default async function DashboardPage() {
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

  return (
    <div className="flex min-h-screen flex-col">
      {userId && <PostHogIdentify userId={userId} email={email} />}
      <Navbar />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <h1 className="text-xl font-semibold text-text-primary">
            Dashboard
          </h1>
          <p className="text-sm text-text-secondary">
            Welcome back. Your job search overview will appear here.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
