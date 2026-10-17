import { Sidebar } from "@/components/layout/Sidebar";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { createInsforgeServer } from "@/lib/insforge-server";

/**
 * Shared shell for every signed-in page: sidebar rail on desktop, top bar +
 * drawer on mobile, and one consistent content container. Pages render only
 * their content — no Navbar/Footer/<main> of their own.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user: { id: string; email?: string } | null = null;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user) user = { id: data.user.id, email: data.user.email };
  } catch {
    // proxy.ts already guards these routes; render the shell regardless.
  }

  return (
    <div className="min-h-screen">
      {user && <PostHogIdentify userId={user.id} email={user.email} />}
      <Sidebar email={user?.email} />
      <div className="lg:pl-sidebar">
        <main className="mx-auto w-full max-w-content px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
