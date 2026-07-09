"use server";

import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ProfileFormData, ProfileRow } from "@/lib/mock-profile";
import { formDataToRow, rowToFormData } from "@/lib/mock-profile";

export async function getProfile(userId?: string): Promise<{
  data: ProfileFormData | null;
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
      .from("profiles")
      .select()
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[actions/profile] getProfile:", error);
      return { data: null, error: "Failed to load profile" };
    }

    if (!row) return { data: null };

    return { data: rowToFormData(row as ProfileRow) };
  } catch (error) {
    console.error("[actions/profile] getProfile exception:", error);
    return { data: null, error: "Failed to load profile" };
  }
}

export async function saveProfile(profileData: ProfileFormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData } = await insforge.auth.getCurrentUser();
    const userId = authData?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    const { data: existing } = await insforge.database
      .from("profiles")
      .select("is_complete")
      .eq("id", userId)
      .maybeSingle();

    const row = formDataToRow(profileData, userId);

    if (existing) {
      const { error } = await insforge.database
        .from("profiles")
        .update(row)
        .eq("id", userId)
        .select();

      if (error) {
        console.error("[actions/profile] saveProfile update error:", JSON.stringify(error));
        return { success: false, error: "Failed to save profile" };
      }
    } else {
      const { error } = await insforge.database
        .from("profiles")
        .insert(row)
        .select();

      if (error) {
        console.error("[actions/profile] saveProfile insert error:", JSON.stringify(error));
        return { success: false, error: "Failed to save profile" };
      }
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] saveProfile exception:", error);
    return { success: false, error: "Failed to save profile" };
  }
}

const MAX_RESUME_SIZE = 10 * 1024 * 1024;

export async function uploadResume(file: File): Promise<{
  url: string | null;
  error?: string;
}> {
  try {
    if (file.type !== "application/pdf") {
      return { url: null, error: "Only PDF files are accepted." };
    }
    if (file.size > MAX_RESUME_SIZE) {
      return { url: null, error: "File must be under 10MB." };
    }

    const insforge = await createInsforgeServer();
    const { data: authData } = await insforge.auth.getCurrentUser();
    const userId = authData?.user?.id;
    if (!userId) return { url: null, error: "Not authenticated" };

    const storagePath = `${userId}/resume.pdf`;
    const bucket = insforge.storage.from("resumes");

    const { error: deleteErr } = await bucket.remove(storagePath);
    if (deleteErr) {
      console.error("[actions/profile] uploadResume delete:", deleteErr);
    }

    const buffer = await file.arrayBuffer();
    const { data, error: uploadErr } = await bucket.upload(storagePath, new Blob([buffer], { type: "application/pdf" }));

    if (uploadErr || !data) {
      console.error("[actions/profile] uploadResume upload:", uploadErr);
      return { url: null, error: "Failed to upload resume. Please try again." };
    }

    const { error: updateErr } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: data.url, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) {
      console.error("[actions/profile] uploadResume update:", updateErr);
    }

    revalidatePath("/profile");
    return { url: data.url };
  } catch (error) {
    console.error("[actions/profile] uploadResume exception:", error);
    return { url: null, error: "Failed to upload resume. Please try again." };
  }
}
