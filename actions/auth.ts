"use server";

import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";

export async function signOut(): Promise<{ error?: string }> {
  try {
    const cookieStore = await cookies();
    const auth = createAuthActions({ cookies: cookieStore });
    await auth.signOut();
    return {};
  } catch (error) {
    console.error("[actions/auth] signOut exception:", error);
    return { error: "Failed to sign out." };
  }
}
