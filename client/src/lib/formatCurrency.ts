/**
 * Format currency with thousand separators and two decimal places
 * @param amount - The amount to format (number or string)
 * @param currency - The currency code (default: "HKD")
 * @returns Formatted currency string (e.g., "HKD 216,010.50")
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = "HKD"): string {
  if (amount === null || amount === undefined || amount === "") {
    return `${currency} 0.00`;
  }

  // Convert to number if it's a string
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  // Check if it's a valid number
  if (isNaN(numAmount)) {
    return `${currency} 0.00`;
  }

  // Format with thousand separators and two decimal places
  const formatted = numAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currency} ${formatted}`;
}

/**
 * Format price change percentage
 * @param change - The percentage change (number or string)
 * @returns Formatted percentage string with sign (e.g., "+13.7%" or "-5.2%")
 */
export function formatPriceChange(change: number | string | null | undefined): string {
  if (change === null || change === undefined || change === "") {
    return "0.0%";
  }

  const numChange = typeof change === "string" ? parseFloat(change) : change;

  if (isNaN(numChange)) {
    return "0.0%";
  }

  const sign = numChange >= 0 ? "+" : "";
  return `${sign}${numChange.toFixed(1)}%`;
}
