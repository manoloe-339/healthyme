import { NextResponse } from "next/server";
import { fetchSleep } from "@/lib/whoop";
import { getWhoopAccessToken } from "@/lib/whoop-tokens";

export async function GET() {
  let accessToken: string;
  try {
    accessToken = await getWhoopAccessToken();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auth failed" }, { status: 401 });
  }

  const now = new Date();
  const fiveDaysAgo = new Date(now);
  fiveDaysAgo.setDate(now.getDate() - 5);

  const sleeps = await fetchSleep(
    accessToken,
    fiveDaysAgo.toISOString().split("T")[0],
    now.toISOString().split("T")[0]
  );

  return NextResponse.json({
    count: sleeps.length,
    firstRecord: sleeps[0] ?? null,
    scoreKeys: sleeps[0] ? Object.keys(sleeps[0].score ?? {}) : [],
    topLevelKeys: sleeps[0] ? Object.keys(sleeps[0]) : [],
  });
}
