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

  // Expected weight for today (linear interpolation)
  const expectedWeight = BASELINE.startWeight - (totalToLose * (daysElapsed / totalDays));

  const nextMilestone = getNextMilestone(currentWeight);
  const daysToMilestone = daysBetween(today, nextMilestone.date);
  const lbsToMilestone = currentWeight - nextMilestone.weight;

  // Pace status: compare actual vs expected
  const diff = currentWeight - expectedWeight; // negative = ahead, positive = behind
  let status: "green" | "yellow" | "red";
  if (diff <= 0) {
    status = "green"; // ahead of pace
  } else if (diff <= totalToLose * 0.1) {
    status = "yellow"; // within 10%
  } else {
    status = "red"; // behind pace
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

  function lostSince(daysAgo: number): number | null {
    const cutoff = new Date(today + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - daysAgo);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const earliest = sorted.find((w) => w.date >= cutoffStr);
    if (!earliest) return null;
    return earliest.weightLbs - latest;
  }

  const sinceBaseline = BASELINE.startWeight - latest;

  // Required pace for each window
  const totalDays = daysBetween(BASELINE.startDate, BASELINE.goalDate);
  const requiredPerDay = (BASELINE.startWeight - BASELINE.goalWeight) / totalDays;

  function paceStatus(lost: number | null, days: number): "green" | "yellow" | "red" {
    if (lost === null) return "yellow";
    const required = requiredPerDay * days;
    if (lost >= required) return "green";
    if (lost >= required * 0.9) return "yellow";
    return "red";
  }

  const lost7 = lostSince(7);
  const lost30 = lostSince(30);
  const lost90 = lostSince(90);

  return {
    lost7: { value: lost7, status: paceStatus(lost7, 7) },
    lost30: { value: lost30, status: paceStatus(lost30, 30) },
    lost90: { value: lost90, status: paceStatus(lost90, 90) },
    sinceBaseline: { value: sinceBaseline, status: sinceBaseline > 0 ? "green" as const : "red" as const },
  };
}
