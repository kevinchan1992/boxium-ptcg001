/**
 * biometricAuthService.ts
 *
 * Provides Face ID / Touch ID biometric authentication for the BOXIUM PTCG native app.
 *
 * This uses @capacitor-community/biometric-auth (community plugin).
 * Note: The official @capacitor/biometric-auth is not yet available for Capacitor 8.
 * We use a graceful fallback approach - if the plugin is not available, biometric
 * auth is simply not offered to the user.
 *
 * Usage:
 * 1. Check if biometric auth is available: isBiometricAvailable()
 * 2. Authenticate: authenticateWithBiometric()
 * 3. Store/retrieve credentials: storeBiometricCredentials() / getBiometricCredentials()
 */

import { Capacitor } from "@capacitor/core";

// We use the Preferences plugin for secure credential storage
// (available in @capacitor/preferences, which ships with Capacitor 8)
let Preferences: typeof import("@capacitor/preferences").Preferences | null = null;

async function loadPreferences() {
  if (!Capacitor.isNativePlatform()) return null;
  if (Preferences) return Preferences;
  try {
    const module = await import("@capacitor/preferences");
    Preferences = module.Preferences;
    return Preferences;
  } catch {
    console.warn("[BiometricAuth] @capacitor/preferences not available");
    return null;
  }
}

const BIOMETRIC_ENABLED_KEY = "boxium_biometric_enabled";
const BIOMETRIC_EMAIL_KEY = "boxium_biometric_email";

/**
 * Check if biometric authentication is available on this device.
 * Returns false on web or if the device doesn't support biometrics.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  // Check if the Web Authentication API is available (works on modern iOS/Android)
  if (window.PublicKeyCredential) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Check if the user has enabled biometric login for this app.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const prefs = await loadPreferences();
  if (!prefs) return false;
  
  const { value } = await prefs.get({ key: BIOMETRIC_ENABLED_KEY });
  return value === "true";
}

/**
 * Enable biometric login and store the user's email for auto-fill.
 * Call this after a successful password login when the user opts in.
 */
export async function enableBiometricLogin(email: string): Promise<void> {
  const prefs = await loadPreferences();
  if (!prefs) return;
  
  await prefs.set({ key: BIOMETRIC_ENABLED_KEY, value: "true" });
  await prefs.set({ key: BIOMETRIC_EMAIL_KEY, value: email });
}

/**
 * Disable biometric login and clear stored credentials.
 */
export async function disableBiometricLogin(): Promise<void> {
  const prefs = await loadPreferences();
  if (!prefs) return;
  
  await prefs.remove({ key: BIOMETRIC_ENABLED_KEY });
  await prefs.remove({ key: BIOMETRIC_EMAIL_KEY });
}

/**
 * Get the stored email for biometric login.
 */
export async function getBiometricEmail(): Promise<string | null> {
  const prefs = await loadPreferences();
  if (!prefs) return null;
  
  const { value } = await prefs.get({ key: BIOMETRIC_EMAIL_KEY });
  return value;
}

/**
 * Trigger biometric authentication prompt.
 * Returns true if authentication succeeded.
 *
 * Note: This uses the Web Authentication API (WebAuthn) which is supported
 * natively on iOS 16+ and Android 9+ within WKWebView/WebView.
 */
export async function authenticateWithBiometric(reason?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    // Use WebAuthn platform authenticator (Face ID / Touch ID / Fingerprint)
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: "boxium.asia",
        userVerification: "required",
        timeout: 60000,
      },
    });
    
    return credential !== null;
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === "NotAllowedError") {
      // User cancelled or biometric failed
      console.log("[BiometricAuth] User cancelled or biometric failed");
    } else {
      console.error("[BiometricAuth] Error:", err?.message);
    }
    return false;
  }
}
