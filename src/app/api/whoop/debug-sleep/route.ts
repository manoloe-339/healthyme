import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchSleep, refreshWhoopToken } from "@/lib/whoop";

export async function GET() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("whoop_access_token")?.value;
  const refreshToken = cookieStore.get("whoop_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    const tokens = await refreshWhoopToken(refreshToken);
    accessToken = tokens.access_token;
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
