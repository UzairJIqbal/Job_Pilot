import { PageHeader } from "@/components/layout/PageHeader";
import { ApplicationsBoard } from "@/components/applications/ApplicationsBoard";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPipelineJobs } from "@/lib/pipeline";

export default async function ApplicationsPage() {
  let userId: string | undefined;

  try {
    const insforge = await createInsforgeServer();
    const { data } = await insforge.auth.getCurrentUser();
    userId = data?.user?.id;
  } catch {
    // Not authenticated — proxy.ts redirects before we get here
  }

  const jobs = userId ? await getPipelineJobs(userId) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Every role you've kept, stage by stage. Move a card when something changes."
      />
      <ApplicationsBoard initialJobs={jobs} />
    </div>
  );
}
