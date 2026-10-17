import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/auth-helpers";
import { discoverFromBoards } from "@/agent/boards";

// Fetching ~250 boards and scoring a few jobs takes a minute or two.
export const maxDuration = 300;

export async function POST() {
  try {
    const auth = await getAuthenticatedClient();
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const result = await discoverFromBoards({ client: auth.client, userId: auth.userId });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[agent/boards] POST exception:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
