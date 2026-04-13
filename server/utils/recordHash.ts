/**
 * recordHash.ts
 * Stable SHA-256 deduplication key for priceHistory records.
 *
 * Key design:
 *   hex(sha256("cardId|source|grade|soldAtDate|jpyPrice|sourcePosition"))
 *
 * All fields are normalised to their canonical string form before hashing
 * so the same logical transaction always produces the same hash regardless
 * of when it was scraped.
 *
 * Field normalisation rules:
 *   cardId        → decimal integer string, e.g. "12345"
 *   source        → lowercase string, e.g. "snkrdunk"
 *   grade         → trimmed uppercase string, or "__none__" if null/undefined
 *   soldAtDate    → "YYYY-MM-DD" (UTC date only – SNKRDUNK only provides date precision)
 *   jpyPrice      → decimal integer string, e.g. "15000"
 *   sourcePosition→ decimal integer string, e.g. "0"
 */

import { createHash } from "crypto";

export interface RecordHashInput {
  cardId: number;
  source: string;
  grade?: string | null;
  soldAt?: Date | null;
  jpyPrice?: number | null;
  sourcePosition?: number;
}

/**
 * Normalise a grade string to a canonical form.
 * Returns "__none__" when grade is absent.
 */
function normaliseGradeForHash(grade?: string | null): string {
  if (!grade) return "__none__";
  return grade.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Normalise a Date to a UTC "YYYY-MM-DD" string.
 * Returns "__nodate__" when soldAt is absent.
 */
function normaliseSoldAtForHash(soldAt?: Date | null): string {
  if (!soldAt) return "__nodate__";
  // Use UTC date components to avoid timezone drift
  const y = soldAt.getUTCFullYear();
  const m = String(soldAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(soldAt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compute the stable SHA-256 record hash for a priceHistory row.
 * Returns a 64-character hex string.
 */
export function computeRecordHash(input: RecordHashInput): string {
  const parts = [
    String(input.cardId),
    (input.source ?? "").toLowerCase(),
    normaliseGradeForHash(input.grade),
    normaliseSoldAtForHash(input.soldAt),
    String(input.jpyPrice != null ? Math.round(input.jpyPrice) : 0),
    String(input.sourcePosition ?? 0),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
