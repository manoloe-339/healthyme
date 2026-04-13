import { NextRequest } from "next/server";
import { POST as healthPost } from "../health/route";

// Redirect to /api/webhook/health for backwards compatibility
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  return healthPost(request);
}
