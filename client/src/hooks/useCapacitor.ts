import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * useCapacitor - Detect if running inside a Capacitor native app
 *
 * Returns:
 * - isNative: true when running in iOS/Android Capacitor app
 * - platform: 'ios' | 'android' | 'web'
 * - isIOS: shorthand for platform === 'ios'
 * - isAndroid: shorthand for platform === 'android'
 */
export function useCapacitor() {
  const [platform] = useState<string>(() => Capacitor.getPlatform());
  const [isNative] = useState<boolean>(() => Capacitor.isNativePlatform());

  return {
    isNative,
    platform,
    isIOS: platform === "ios",
    isAndroid: platform === "android",
    isWeb: platform === "web",
  };
}

/**
 * useCapacitorReady - Wait for Capacitor plugins to be ready
 * Use this before calling any Capacitor plugin APIs
 */
export function useCapacitorReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Capacitor plugins are ready once the DOM is loaded
    if (document.readyState === "complete") {
      setReady(true);
    } else {
      const handler = () => setReady(true);
      window.addEventListener("DOMContentLoaded", handler);
      return () => window.removeEventListener("DOMContentLoaded", handler);
    }
  }, []);

  return ready;
}

/**
 * Utility: check if running in native app (non-hook version)
 * Use this in non-React code (e.g., service files)
 */
export const isNativeApp = () => Capacitor.isNativePlatform();
export const getNativePlatform = () => Capacitor.getPlatform();
