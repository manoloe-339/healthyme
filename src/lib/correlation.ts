interface DataPoint {
  date: string;
  weightKg: number | null;
  recoveryScore: number | null;
  sleepPerformance: number | null;
  strain: number | null;
}

export interface CorrelationResult {
  weightVsSleep: number | null;
  weightVsRecovery: number | null;
  weightVsStrain: number | null;
  windowDays: number;
  consecutiveLowSleep: number;
  sleepWarning: boolean;
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length < 3 || x.length !== y.length) return null;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (den === 0) return null;
  return num / den;
}

export function computeCorrelations(data: DataPoint[]): CorrelationResult {
  const sorted = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const withWeight = sorted.filter((d) => d.weightKg !== null);
  const weights = withWeight.map((d) => d.weightKg!);

  const sleepScores = withWeight
    .map((d) => d.sleepPerformance)
    .filter((s): s is number => s !== null);
  const recoveryScores = withWeight
    .map((d) => d.recoveryScore)
    .filter((r): r is number => r !== null);
  const strainScores = withWeight
    .map((d) => d.strain)
    .filter((s): s is number => s !== null);

  // Count consecutive low sleep days (< 70%) from most recent
  let consecutiveLowSleep = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (
      sorted[i].sleepPerformance !== null &&
      sorted[i].sleepPerformance! < 70
    ) {
      consecutiveLowSleep++;
    } else {
      break;
    }
  }

  return {
    weightVsSleep: pearsonCorrelation(
      weights.slice(0, sleepScores.length),
      sleepScores
    ),
    weightVsRecovery: pearsonCorrelation(
      weights.slice(0, recoveryScores.length),
      recoveryScores
    ),
    weightVsStrain: pearsonCorrelation(
      weights.slice(0, strainScores.length),
      strainScores
    ),
    windowDays: sorted.length,
    consecutiveLowSleep,
    sleepWarning: consecutiveLowSleep >= 2,
  };
}
