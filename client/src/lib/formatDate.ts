/**
 * 日期格式化工具函數
 * 統一整個平台的日期顯示格式
 */

/**
 * 格式化日期為「YYYY/MM/DD 上午/下午 HH:MM」格式
 * 例如：2024/11/20 下午 01:00
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  const period = hours < 12 ? "上午" : "下午";
  const displayHours = String(hours % 12 || 12).padStart(2, "0");

  return `${year}/${month}/${day} ${period} ${displayHours}:${minutes}`;
}

/**
 * 格式化日期為「YYYY/MM/DD」格式
 * 例如：2024/11/20
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

/**
 * 格式化日期為「MM/DD 上午/下午 HH:MM」格式（簡短版）
 * 例如：11/20 下午 01:00
 */
export function formatShortDateTime(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  const period = hours < 12 ? "上午" : "下午";
  const displayHours = String(hours % 12 || 12).padStart(2, "0");

  return `${month}/${day} ${period} ${displayHours}:${minutes}`;
}
