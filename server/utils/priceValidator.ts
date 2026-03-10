/**
 * SNKRDUNK Price History Validation Utilities
 * 
 * Centralised validation logic for all scraping paths:
 * - persistentSnkrdunkBatchUpdate.ts (batch update)
 * - routers.ts addSnkrdunkDataSource / refreshDataSource (manual add / refresh)
 * - scheduler.ts (legacy path, kept for reference)
 * - fixOrphanDataSources.ts (orphan fix)
 * 
 * Rules applied to every incoming price record BEFORE it is written to the DB:
 * 1. Grade normalisation  – "PSA 10" → "PSA10", "PSA 9" → "PSA9", etc.
 * 2. Grade allowlist       – only known grades are accepted; unknown values are
 *                            stored as-is but flagged in logs.
 * 3. Minimum JPY threshold – PSA10 records below 5,000 JPY are almost certainly
 *                            mis-classified and are dropped.
 * 4. General minimum       – any record below 500 JPY is dropped regardless of grade.
 * 5. IQR outlier filter    – when a batch of records is available for the same
 *                            grade, values outside [Q1 - 3×IQR, Q3 + 3×IQR] are
 *                            dropped (very conservative: only extreme outliers).
 */

export interface RawPriceEntry {
  price: number;      // JPY price
  jpyPrice?: number;  // Same as price (explicit field)
  soldAt: Date;
  grade?: string;
  quantity?: string;
}

// ---------------------------------------------------------------------------
// 1. Grade normalisation map
// ---------------------------------------------------------------------------
const GRADE_NORMALISE: Record<string, string> = {
  "PSA 10":    "PSA10",
  "PSA 9":     "PSA9",
  "PSA 8":     "PSA8",
  "PSA 7":     "PSA7",
  "PSA 6":     "PSA6",
  "PSA 5":     "PSA5",
  "PSA 4":     "PSA4",
  "PSA 3":     "PSA3",
  "PSA 2":     "PSA2",
  "PSA 1":     "PSA1",
  "BGS 10":    "BGS10",
  "BGS 9.5":   "BGS9.5",
  "BGS 9":     "BGS9",
  "BGS 10 BL": "BGS10 BL",
  "PSA8以下":  "PSA8以下",
  // Already-normalised values pass through unchanged
};

// Known valid grades (after normalisation)
const KNOWN_GRADES = new Set([
  "PSA10", "PSA9", "PSA8", "PSA7", "PSA6", "PSA5",
  "PSA4", "PSA3", "PSA2", "PSA1",
  "PSA8以下",
  "BGS10", "BGS10 BL", "BGS9.5", "BGS9",
  "A", "B", "C", "D",
  "中古",
]);

// Minimum JPY thresholds per grade
// PSA10: real market data shows PSA10 Pokemon cards almost never sell below ¥10,000.
// The bug that triggered this fix: a non-PSA10 card (JPY 21,000) was mis-classified
// as PSA10 because the old threshold of ¥5,000 was too permissive.
const MIN_JPY_BY_GRADE: Record<string, number> = {
  PSA10:    10000,  // PSA10 cards should never sell for < ¥10,000
  PSA9:     3000,
  PSA8:     1000,
  "PSA8以下": 500,
  BGS10:    10000,
  "BGS10 BL": 10000,
  BGS9:     3000,
  // For ungraded (A/B/C/D/中古) we use the global minimum
};

const GLOBAL_MIN_JPY = 500; // Absolute floor for any grade

// ---------------------------------------------------------------------------
// Helper: check if a JPY price is above the minimum for a given grade
// (exported for testing)
// ---------------------------------------------------------------------------
export function isAboveMinimumPrice(
  jpyPrice: number,
  grade: string | undefined,
  productType: "single_card" | "sealed_product" = "single_card",
): boolean {
  if (productType === "sealed_product") return jpyPrice > 0;
  if (jpyPrice < GLOBAL_MIN_JPY) return false;
  if (grade && MIN_JPY_BY_GRADE[grade]) {
    return jpyPrice >= MIN_JPY_BY_GRADE[grade];
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. Normalise a single grade string
// ---------------------------------------------------------------------------
export function normaliseGrade(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  // Direct lookup first
  if (GRADE_NORMALISE[trimmed]) return GRADE_NORMALISE[trimmed];
  // Already a known normalised value
  if (KNOWN_GRADES.has(trimmed)) return trimmed;
  // Unknown grade: log and return as-is (don't silently drop)
  console.warn(`[PriceValidator] Unknown grade value: "${trimmed}" – storing as-is`);
  return trimmed;
}

// ---------------------------------------------------------------------------
// 3. Validate a single price entry (returns true if it should be kept)
// ---------------------------------------------------------------------------
export function isValidPriceEntry(
  entry: RawPriceEntry,
  normalisedGrade: string | undefined,
): boolean {
  const jpyPrice = entry.jpyPrice ?? entry.price;

  // Global floor
  if (jpyPrice < GLOBAL_MIN_JPY) {
    console.warn(
      `[PriceValidator] Dropping record: JPY ${jpyPrice} is below global minimum ${GLOBAL_MIN_JPY}` +
      ` (grade: ${normalisedGrade ?? "none"}, soldAt: ${entry.soldAt.toISOString()})`
    );
    return false;
  }

  // Grade-specific floor
  if (normalisedGrade && MIN_JPY_BY_GRADE[normalisedGrade]) {
    const minJpy = MIN_JPY_BY_GRADE[normalisedGrade];
    if (jpyPrice < minJpy) {
      console.warn(
        `[PriceValidator] Dropping ${normalisedGrade} record: JPY ${jpyPrice} < min ${minJpy}` +
        ` (soldAt: ${entry.soldAt.toISOString()})`
      );
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// 4. IQR-based outlier filter for a batch of entries of the SAME grade
//    Uses a very conservative multiplier (3×) to only drop extreme outliers.
// ---------------------------------------------------------------------------
export function filterOutliersByIQR<T extends RawPriceEntry>(
  entries: T[],
  grade: string | undefined,
): T[] {
  if (entries.length < 5) return entries; // Not enough data for IQR

  const prices = entries.map(e => e.jpyPrice ?? e.price).sort((a, b) => a - b);
  const q1 = percentile(prices, 25);
  const q3 = percentile(prices, 75);
  const iqr = q3 - q1;
  const multiplier = 3; // Conservative: only drop extreme outliers
  const lower = q1 - multiplier * iqr;
  const upper = q3 + multiplier * iqr;

  const filtered: T[] = entries.filter(e => {
    const p = e.jpyPrice ?? e.price;
    if (p < lower || p > upper) {
      console.warn(
        `[PriceValidator] IQR outlier dropped: JPY ${p} outside [${Math.round(lower)}, ${Math.round(upper)}]` +
        ` (grade: ${grade ?? "none"}, Q1=${Math.round(q1)}, Q3=${Math.round(q3)}, IQR=${Math.round(iqr)})`
      );
      return false;
    }
    return true;
  });

  if (filtered.length < entries.length) {
    console.log(
      `[PriceValidator] IQR filter: kept ${filtered.length}/${entries.length} records for grade ${grade ?? "none"}`
    );
  }

  return filtered;
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ---------------------------------------------------------------------------
// 5. Master validation function: normalise + validate + IQR filter
//    Call this on the full list of price entries returned by the scraper
//    BEFORE writing to the database.
// ---------------------------------------------------------------------------
export interface ValidatedPriceEntry extends RawPriceEntry {
  normalisedGrade: string | undefined;
}

export function validateAndFilterPriceHistory(
  entries: RawPriceEntry[],
  productType: "single_card" | "sealed_product" = "single_card",
): ValidatedPriceEntry[] {
  if (!entries || entries.length === 0) return [];

  // Step 1: Normalise grades and apply per-entry validation
  const normalised: ValidatedPriceEntry[] = [];
  for (const entry of entries) {
    const normalisedGrade = productType === "single_card"
      ? normaliseGrade(entry.grade)
      : undefined; // Sealed products don't use grade

    if (!isValidPriceEntry(entry, normalisedGrade)) continue;

    normalised.push({ ...entry, normalisedGrade });
  }

  if (productType !== "single_card") return normalised;

  // Step 2: Group by grade and apply IQR filter per group
  const byGrade = new Map<string, ValidatedPriceEntry[]>();
  for (const entry of normalised) {
    const key = entry.normalisedGrade ?? "__none__";
    if (!byGrade.has(key)) byGrade.set(key, []);
    byGrade.get(key)!.push(entry);
  }

  const result: ValidatedPriceEntry[] = [];
  byGrade.forEach((gradeEntries, gradeKey) => {
    const filtered = filterOutliersByIQR(gradeEntries, gradeKey === "__none__" ? undefined : gradeKey);
    result.push(...filtered);
  });

  return result;
}
