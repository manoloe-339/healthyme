import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Extract just the metric names and their units/data counts
  const metrics = body.data?.metrics ?? body.metrics ?? [];
  const summary = metrics.map((m: { name: string; units: string; data?: unknown[] }) => ({
    name: m.name,
    units: m.units,
    dataPoints: m.data?.length ?? 0,
  }));

  return NextResponse.json({ metricCount: metrics.length, metrics: summary });
}
