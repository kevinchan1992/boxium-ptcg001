import { useState, useEffect } from "react";

/**
 * Debounce a value by a given delay (ms).
 * The returned value only updates after the input has been stable for `delay` ms.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
