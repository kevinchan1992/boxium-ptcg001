/**
 * 日期格式化工具函數
 * 統一整個平台的日期顯示格式
 * 
 * 所有時間顯示強制使用香港時區 (Asia/Hong_Kong, UTC+8)
 * 無論用戶瀏覽器的本地時區為何，都顯示香港時間
 */

const HK_TIMEZONE = 'Asia/Hong_Kong';

/**
 * 格式化日期為「YYYY/MM/DD 上午/下午 HH:MM」格式
 * 例如：2024/11/20 下午 01:00
 * 強制使用香港時區
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  // Use Intl to get Hong Kong timezone parts
  const parts = getHKDateParts(d);
  
  const period = parts.hours < 12 ? "上午" : "下午";
  const displayHours = String(parts.hours % 12 || 12).padStart(2, "0");

  return `${parts.year}/${parts.month}/${parts.day} ${period} ${displayHours}:${parts.minutes}`;
}

/**
 * 格式化日期為「YYYY/MM/DD」格式
 * 例如：2024/11/20
 * 強制使用香港時區
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const parts = getHKDateParts(d);
  return `${parts.year}/${parts.month}/${parts.day}`;
}

/**
 * 格式化日期為「YYYY/MM/DD 下午 HH:MM」格式（24小時制顯示）
 * 例如：2026/02/20 下午 21:40
 * 強制使用香港時區
 */
export function formatShortDateTime(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const parts = getHKDateParts(d);
  
  const period = parts.hours < 12 ? "上午" : "下午";
  const displayHours = String(parts.hours).padStart(2, "0");

  return `${parts.year}/${parts.month}/${parts.day} ${period} ${displayHours}:${parts.minutes}`;
}

/**
 * 格式化日期為香港時區的本地化字串
 * 用於替換所有 .toLocaleString() 調用
 * 
 * @param date - 日期
 * @param options - 額外的 Intl.DateTimeFormat 選項
 */
export function formatHKLocale(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleString('zh-TW', {
    timeZone: HK_TIMEZONE,
    ...options,
  });
}

/**
 * 格式化日期為香港時區的日期字串（不含時間）
 */
export function formatHKDate(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('zh-TW', {
    timeZone: HK_TIMEZONE,
  });
}

// ===== Internal helpers =====

/**
 * Extract date parts in Hong Kong timezone using Intl.DateTimeFormat
 */
function getHKDateParts(d: Date): {
  year: string;
  month: string;
  day: string;
  hours: number;
  minutes: string;
  seconds: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: HK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: parseInt(get('hour'), 10),
    minutes: get('minute'),
    seconds: get('second'),
  };
}
