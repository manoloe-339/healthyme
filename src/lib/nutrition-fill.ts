interface NutritionRow {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  totalFat: number | null;
  fiber: number | null;
  sugar: number | null;
}

interface FilledNutrition {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  totalFat: number | null;
  fiber: number | null;
  sugar: number | null;
  estimated: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Remove top outlier if we have enough data points
  // An outlier is > 2x the next highest value (catches refeed days)
  if (sorted.length >= 4) {
    const top = sorted[sorted.length - 1];
    const secondTop = sorted[sorted.length - 2];
    if (top > secondTop * 1.8) {
      sorted.pop();
    }
  }
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Fill nutrition gaps for dates that have recovery/weight data but no nutrition.
 * Uses median of logged days (excluding outliers like refeed days).
 */
export function fillNutritionGaps(
  nutrition: NutritionRow[],
  allDates: string[]
): FilledNutrition[] {
  const nutritionByDate = new Map(nutrition.map((n) => [n.date, n]));

  // Get logged values for median calculation
  const loggedCalories = nutrition.filter((n) => n.calories !== null).map((n) => n.calories!);
  const loggedProtein = nutrition.filter((n) => n.protein !== null).map((n) => n.protein!);
  const loggedCarbs = nutrition.filter((n) => n.carbs !== null).map((n) => n.carbs!);
  const loggedFat = nutrition.filter((n) => n.totalFat !== null).map((n) => n.totalFat!);
  const loggedFiber = nutrition.filter((n) => n.fiber !== null).map((n) => n.fiber!);
  const loggedSugar = nutrition.filter((n) => n.sugar !== null).map((n) => n.sugar!);

  const medianCalories = median(loggedCalories);
  const medianProtein = median(loggedProtein);
  const medianCarbs = median(loggedCarbs);
  const medianFat = median(loggedFat);
  const medianFiber = median(loggedFiber);
  const medianSugar = median(loggedSugar);

  // No logged data at all — can't estimate
  if (loggedCalories.length === 0) {
    return allDates.map((d) => {
      const existing = nutritionByDate.get(d);
      return {
        date: d,
        calories: existing?.calories ?? null,
        protein: existing?.protein ?? null,
        carbs: existing?.carbs ?? null,
        totalFat: existing?.totalFat ?? null,
        fiber: existing?.fiber ?? null,
        sugar: existing?.sugar ?? null,
        estimated: false,
      };
    });
  }

  return allDates.map((d) => {
    const existing = nutritionByDate.get(d);
    if (existing && existing.calories !== null) {
      return {
        date: d,
        calories: existing.calories,
        protein: existing.protein,
        carbs: existing.carbs,
        totalFat: existing.totalFat,
        fiber: existing.fiber,
        sugar: existing.sugar,
        estimated: false,
      };
    }
    return {
      date: d,
      calories: medianCalories,
      protein: medianProtein,
      carbs: medianCarbs,
      totalFat: medianFat,
      fiber: medianFiber,
      sugar: medianSugar,
      estimated: true,
    };
  });
}
