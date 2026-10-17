import { PageHeader } from "@/components/layout/PageHeader";
import { QueueClient } from "@/components/queue/QueueClient";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getQueue } from "@/lib/queue";

export default async function QueuePage() {
  const insforge = await createInsforgeServer();
  let userId: string | undefined;
  try {
    const { data } = await insforge.auth.getCurrentUser();
    userId = data?.user?.id;
  } catch {
    // Not authenticated — proxy.ts redirects before we get here
  }

  const { items, candidates } = userId
    ? await getQueue(insforge, userId)
    : { items: [], candidates: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queue"
        description="Drafted applications waiting on you. Nothing is sent until you approve it."
      />
      <QueueClient items={items} candidates={candidates} />
    </div>
  );
}
