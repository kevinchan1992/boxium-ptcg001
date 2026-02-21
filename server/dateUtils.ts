/**
 * Convert Date to ISO string for PostgreSQL timestamp
 * PostgreSQL expects ISO 8601 format strings for timestamp fields
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
