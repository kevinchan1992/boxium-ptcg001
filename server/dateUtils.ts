/**
 * Date/Time Utilities - Hong Kong Timezone (Asia/Hong_Kong, UTC+8)
 * 
 * This module provides timezone-aware date utilities.
 * The system is configured to use Hong Kong timezone throughout:
 * 1. Node.js process: TZ=Asia/Hong_Kong (set in server/_core/index.ts)
 * 2. MySQL session: timezone=+08:00 (set in server/db.ts)
 * 3. Frontend display: Intl with Asia/Hong_Kong (set in client components)
 */

export const HK_TIMEZONE = 'Asia/Hong_Kong';
export const HK_OFFSET = '+08:00';

/**
 * Get current date in Hong Kong timezone.
 * With TZ=Asia/Hong_Kong set at process level, new Date() already returns HK time.
 */
export function nowHK(): Date {
  return new Date();
}

/**
 * Convert Date to ISO string
 */
export function toTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Get current timestamp as ISO string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Create a Date object from days ago
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Convert days ago to timestamp string
 */
export function daysAgoTimestamp(days: number): string {
  return toTimestamp(daysAgo(days));
}

/**
 * Format a date for display in Hong Kong timezone.
 * Example: "2026-02-27 16:30:00"
 */
export function formatHKDate(date: Date | string | number, options?: {
  includeTime?: boolean;
  includeSeconds?: boolean;
}): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const { includeTime = true, includeSeconds = false } = options || {};
  
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? {
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    } : {}),
  });
  
  return formatter.format(d);
}

/**
 * Get hours ago as a Date object
 */
export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
