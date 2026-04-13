import { NextResponse } from "next/server";
import { fetchCycles } from "@/lib/whoop";
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

  const cycles = await fetchCycles(
    accessToken,
    fiveDaysAgo.toISOString().split("T")[0],
    now.toISOString().split("T")[0]
  );

  return NextResponse.json({
    count: cycles.length,
    firstRecord: cycles[0] ?? null,
    scoreKeys: cycles[0] ? Object.keys(cycles[0].score ?? {}) : [],
    topLevelKeys: cycles[0] ? Object.keys(cycles[0]) : [],
  });
}
