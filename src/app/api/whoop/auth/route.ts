import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWhoopAuthUrl } from "@/lib/whoop";

export async function GET() {
  const { url, state } = getWhoopAuthUrl();
  const cookieStore = await cookies();
  cookieStore.set("whoop_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(url);
}
