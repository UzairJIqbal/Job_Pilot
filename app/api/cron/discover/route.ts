import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/admin-client";
import { discoverFromBoards } from "@/agent/boards";

export const maxDuration = 800;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Daily board scan for every user who turned on auto-discover. Called by an
 * InsForge schedule with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = getAdminClient();
  const { data: users, error } = await client.database
    .from("profiles")
    .select("id")
    .eq("auto_discover", true);

  if (error) {
    console.error("[cron/discover] failed to load users:", error);
    return NextResponse.json({ success: false, error: "Failed to load users" }, { status: 500 });
  }

  const results: { userId: string; saved: number; error?: string }[] = [];
  // Sequential: boards are cached after the first user, and Gemini is rate limited.
  for (const { id } of users ?? []) {
    const result = await discoverFromBoards({ client, userId: id });
    results.push(
      result.success ? { userId: id, saved: result.saved } : { userId: id, saved: 0, error: result.error },
    );
  }

  return NextResponse.json({ success: true, data: { users: results.length, results } });
}
