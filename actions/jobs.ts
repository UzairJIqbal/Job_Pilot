"use server";

import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import { JOB_STATUSES, type JobStatus } from "@/lib/job-status";

export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<{ success: boolean; error?: string }> {
  if (!JOB_STATUSES.includes(status)) return { success: false, error: "Unknown status" };
  try {
    const insforge = await createInsforgeServer();
    const { data: authData } = await insforge.auth.getCurrentUser();
    const userId = authData?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    const { error } = await insforge.database
      .from("jobs")
      .update({ status })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (error) {
      console.error("[actions/jobs] updateJobStatus:", error);
      return { success: false, error: "Failed to update job status" };
    }

    revalidatePath("/dashboard");
    revalidatePath("/applications");
    revalidatePath("/find-jobs");
    revalidatePath(`/find-jobs/${jobId}`);
    return { success: true };
  } catch (error) {
    console.error("[actions/jobs] updateJobStatus exception:", error);
    return { success: false, error: "Failed to update job status" };
  }
}
