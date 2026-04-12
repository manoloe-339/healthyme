import { NextResponse } from "next/server";
import { getWhoopAuthUrl } from "@/lib/whoop";

export async function GET() {
  const url = getWhoopAuthUrl();
  return NextResponse.redirect(url);
}
