import { NextRequest, NextResponse } from "next/server";
import { exchangeWhoopCode } from "@/lib/whoop";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("whoop_oauth_state")?.value;

  if (!state || state !== savedState) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  cookieStore.delete("whoop_oauth_state");

  const tokens = await exchangeWhoopCode(code);

  cookieStore.set("whoop_access_token", tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 3600,
    path: "/",
  });
  cookieStore.set("whoop_refresh_token", tokens.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return NextResponse.redirect(new URL("/", request.url));
}
