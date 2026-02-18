/**
 * Currency conversion utilities
 * Converts various currencies to HKD for unified display
 */

// Exchange rates (as of 2026-02-18)
// These rates should be updated periodically or fetched from an API
const EXCHANGE_RATES: Record<string, number> = {
  HKD: 1.0, // Hong Kong Dollar (base currency)
  SGD: 5.8, // Singapore Dollar to HKD (1 SGD ≈ 5.8 HKD)
  USD: 7.8, // US Dollar to HKD (1 USD ≈ 7.8 HKD)
  CNY: 1.1, // Chinese Yuan to HKD (1 CNY ≈ 1.1 HKD)
  JPY: 0.052, // Japanese Yen to HKD (1 JPY ≈ 0.052 HKD)
};

/**
 * Convert a price from one currency to HKD
 * @param amount - The amount to convert
 * @param fromCurrency - The source currency code (e.g., 'SGD', 'USD')
 * @returns The converted amount in HKD
 */
export function convertToHKD(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency.toUpperCase()];
  
  if (!rate) {
    console.warn(`[Currency] Unknown currency: ${fromCurrency}, defaulting to 1:1 conversion`);
    return amount;
  }
  
  return amount * rate;
}

/**
 * Format a price in HKD with proper formatting
 * @param amount - The amount in HKD
 * @returns Formatted string (e.g., "HKD 2,345.67")
 */
export function formatHKD(amount: number): string {
  return `HKD ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Get the exchange rate for a currency to HKD
 * @param currency - The currency code
 * @returns The exchange rate, or 1.0 if unknown
 */
export function getExchangeRate(currency: string): number {
  return EXCHANGE_RATES[currency.toUpperCase()] || 1.0;
}
