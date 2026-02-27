/**
 * Shared Timezone Constants & Utilities
 * Used by both frontend and backend for consistent timezone handling.
 * 
 * System timezone: Asia/Hong_Kong (UTC+8)
 */

export const HK_TIMEZONE = 'Asia/Hong_Kong';
export const HK_OFFSET = '+08:00';

/**
 * Format a date/timestamp for display in Hong Kong timezone.
 * Works correctly regardless of the browser/server's local timezone.
 * 
 * @param date - Date object, ISO string, or Unix timestamp (ms)
 * @param options - Formatting options
 * @returns Formatted date string in Hong Kong timezone
 * 
 * @example
 * formatHKDateTime(new Date()) // "2026/02/27 16:30"
 * formatHKDateTime('2026-02-27T08:30:00Z') // "2026/02/27 16:30"
 * formatHKDateTime(date, { includeSeconds: true }) // "2026/02/27 16:30:00"
 * formatHKDateTime(date, { dateOnly: true }) // "2026/02/27"
 */
export function formatHKDateTime(
  date: Date | string | number | null | undefined,
  options?: {
    dateOnly?: boolean;
    includeSeconds?: boolean;
  }
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const { dateOnly = false, includeSeconds = false } = options || {};
  
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(!dateOnly ? {
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    } : {}),
  });
  
  return formatter.format(d);
}

/**
 * Get relative time description in Hong Kong timezone.
 * 
 * @example
 * getRelativeTimeHK(someDate) // "3 分鐘前" / "2 小時前" / "昨天"
 */
export function getRelativeTimeHK(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return '剛剛';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  if (diffHour < 24) return `${diffHour} 小時前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  
  return formatHKDateTime(d, { dateOnly: true });
}
