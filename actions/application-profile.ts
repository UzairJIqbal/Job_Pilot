"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import {
  applicationProfileToRow,
  rowToApplicationProfile,
  type ApplicationProfileFormData,
  type ApplicationProfileRow,
} from "@/lib/application-profile";

export async function getApplicationProfile(userId?: string): Promise<{
  data: ApplicationProfileFormData | null;
  error?: string;
}> {
  try {
    const insforge = await createInsforgeServer();
    if (!userId) {
      const { data: authData } = await insforge.auth.getCurrentUser();
      userId = authData?.user?.id;
    }
    if (!userId) return { data: null, error: "Not authenticated" };

    const { data: row, error } = await insforge.database
      .from("application_profiles")
      .select()
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[actions/application-profile] get:", error);
      return { data: null, error: "Failed to load application answers" };
    }
    return { data: row ? rowToApplicationProfile(row as ApplicationProfileRow) : null };
  } catch (error) {
    // Let Next's dynamic-rendering signal through instead of logging it.
    unstable_rethrow(error);
    console.error("[actions/application-profile] get exception:", error);
    return { data: null, error: "Failed to load application answers" };
  }
}

export async function saveApplicationProfile(data: ApplicationProfileFormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData } = await insforge.auth.getCurrentUser();
    const userId = authData?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    if (data.earliestStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.earliestStartDate)) {
      return { success: false, error: "Earliest start date must be a date" };
    }

    const { error } = await insforge.database
      .from("application_profiles")
      .upsert(applicationProfileToRow(data, userId), { onConflict: "user_id" });

    if (error) {
      console.error("[actions/application-profile] save:", JSON.stringify(error));
      return { success: false, error: "Failed to save application answers" };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/application-profile] save exception:", error);
    return { success: false, error: "Failed to save application answers" };
  }
}
