// All pace calculations use this baseline ONLY
export const BASELINE = {
  startDate: "2026-02-11",
  startWeight: 232,
  goalWeight: 160,
  goalDate: "2026-10-31",
};

export const MILESTONES: { date: string; weight: number; label: string }[] = [
  { date: "2026-05-01", weight: 209, label: "May 1" },
  { date: "2026-06-01", weight: 200, label: "Jun 1" },
  { date: "2026-07-01", weight: 191, label: "Jul 1" },
  { date: "2026-08-01", weight: 182, label: "Aug 1" },
  { date: "2026-09-01", weight: 173, label: "Sep 1" },
  { date: "2026-10-01", weight: 164, label: "Oct 1" },
  { date: "2026-10-31", weight: 160, label: "Oct 31" },
];

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000
  );
}

export function getNextMilestone(currentWeight: number) {
  return MILESTONES.find((m) => currentWeight > m.weight) ?? MILESTONES[MILESTONES.length - 1];
}

export function getPaceStatus(currentWeight: number, today: string) {
  const totalToLose = BASELINE.startWeight - BASELINE.goalWeight; // 72
  const lost = BASELINE.startWeight - currentWeight;
  const pctComplete = (lost / totalToLose) * 100;

  const totalDays = daysBetween(BASELINE.startDate, BASELINE.goalDate);
  const daysElapsed = daysBetween(BASELINE.startDate, today);
  const daysRemaining = totalDays - daysElapsed;

  const requiredPacePerWeek = ((currentWeight - BASELINE.goalWeight) / daysRemaining) * 7;

  // Use milestone targets for expected weight (not linear)
  // Find the two milestones that bracket today
  const allPoints = [
    { date: BASELINE.startDate, weight: BASELINE.startWeight },
    ...MILESTONES.map((m) => ({ date: m.date, weight: m.weight })),
  ];
  let expectedWeight = BASELINE.startWeight;
  for (let i = 0; i < allPoints.length - 1; i++) {
    if (today >= allPoints[i].date && today <= allPoints[i + 1].date) {
      const segDays = daysBetween(allPoints[i].date, allPoints[i + 1].date);
      const segElapsed = daysBetween(allPoints[i].date, today);
      const segPct = segDays > 0 ? segElapsed / segDays : 0;
      expectedWeight = allPoints[i].weight - (allPoints[i].weight - allPoints[i + 1].weight) * segPct;
      break;
    }
  }

  const nextMilestone = getNextMilestone(currentWeight);
  const daysToMilestone = daysBetween(today, nextMilestone.date);
  const lbsToMilestone = currentWeight - nextMilestone.weight;

  // Pace status: compare actual vs milestone-based expected
  const diff = currentWeight - expectedWeight; // negative = ahead, positive = behind
  let status: "green" | "yellow" | "red";
  // Green if within 1.5 weeks of required loss (accounts for water fluctuation)
  const weeklyPace = requiredPacePerWeek;
  if (diff <= weeklyPace * 1.5) {
    status = "green"; // less than 1.5 weeks behind = on track
  } else if (diff <= weeklyPace * 3) {
    status = "yellow"; // 1.5-3 weeks behind = close
  } else {
    status = "red"; // more than 2 weeks behind
  }

  return {
    status,
    currentWeight,
    expectedWeight,
    pctComplete,
    lost,
    totalToLose,
    daysElapsed,
    daysRemaining,
    requiredPacePerWeek,
    nextMilestone,
    daysToMilestone,
    lbsToMilestone,
  };
}

export function getWeightTrends(
  weights: { date: string; weightLbs: number }[],
  today: string
) {
  if (weights.length === 0) return null;

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].weightLbs;

  function lostSince(daysAgo: number): { value: number; actualDays: number; startWeight: number; endWeight: number; startDate: string } | null {
    const cutoff = new Date(today + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - daysAgo);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const entry = sorted.find((w) => w.date >= cutoffStr);
    if (!entry || entry.date === sorted[sorted.length - 1].date) {
      const oldest = sorted[0];
      const actualDays = daysBetween(oldest.date, today);
      if (actualDays < daysAgo * 0.7) return null;
      return { value: oldest.weightLbs - latest, actualDays, startWeight: oldest.weightLbs, endWeight: latest, startDate: oldest.date };
    }
    const actualDays = daysBetween(entry.date, today);
    if (actualDays < 1) return null;
    return { value: entry.weightLbs - latest, actualDays, startWeight: entry.weightLbs, endWeight: latest, startDate: entry.date };
  }

  const sinceBaseline = BASELINE.startWeight - latest;

  function paceStatus(result: { value: number; actualDays: number } | null, targetDays: number): "green" | "yellow" | "red" {
    if (result === null) return "yellow";
    // Scale required pace to actual days covered
    const totalDays = daysBetween(BASELINE.startDate, BASELINE.goalDate);
    const requiredPerDay = (BASELINE.startWeight - BASELINE.goalWeight) / totalDays;
    const required = requiredPerDay * result.actualDays;
    if (result.value >= required * 0.9) return "green";
    if (result.value >= required * 0.7) return "yellow";
    return "red";
  }

  const lost7 = lostSince(7);
  const lost30 = lostSince(30);
  const lost90 = lostSince(90);

  return {
    lost7: { value: lost7?.value ?? null, status: paceStatus(lost7, 7), startWeight: lost7?.startWeight, endWeight: lost7?.endWeight, actualDays: lost7?.actualDays, startDate: lost7?.startDate },
    lost30: { value: lost30?.value ?? null, status: paceStatus(lost30, 30), startWeight: lost30?.startWeight, endWeight: lost30?.endWeight, actualDays: lost30?.actualDays, startDate: lost30?.startDate },
    lost90: { value: lost90?.value ?? null, status: paceStatus(lost90, 90), startWeight: lost90?.startWeight, endWeight: lost90?.endWeight, actualDays: lost90?.actualDays, startDate: lost90?.startDate },
    sinceBaseline: { value: sinceBaseline, status: sinceBaseline > 0 ? "green" as const : "red" as const, startWeight: BASELINE.startWeight, endWeight: latest },
  };
}
