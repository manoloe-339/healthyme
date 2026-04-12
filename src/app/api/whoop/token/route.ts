import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("whoop_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token. Re-auth with WHOOP first." });
  }

  return NextResponse.json({
    message: "Copy this token and set as WHOOP_REFRESH_TOKEN env var in Vercel",
    refreshToken,
  });
}
