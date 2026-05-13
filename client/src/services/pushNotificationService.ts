/**
 * pushNotificationService.ts
 *
 * Handles Capacitor Push Notifications for the BOXIUM PTCG native app.
 *
 * Flow:
 * 1. Request permission from the user
 * 2. Register for push notifications (get FCM/APNS token)
 * 3. Send token to backend for storage
 * 4. Listen for incoming notifications
 *
 * This service should only be initialized when running in a native app.
 * Use isNativeApp() from useCapacitor.ts to check before calling init().
 */

import { Capacitor } from "@capacitor/core";

// Lazy-load Capacitor plugins to avoid errors on web
let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications | null = null;

async function loadPushNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  if (PushNotifications) return PushNotifications;
  try {
    const module = await import("@capacitor/push-notifications");
    PushNotifications = module.PushNotifications;
    return PushNotifications;
  } catch {
    console.warn("[PushNotifications] Plugin not available");
    return null;
  }
}

export interface PushNotificationToken {
  value: string;
  platform: "ios" | "android";
}

/**
 * Initialize push notifications.
 * Call this once after app startup (e.g., in App.tsx useEffect).
 *
 * @param onTokenReceived - Callback with the device token for backend registration
 * @param onNotificationReceived - Callback when a notification is received in foreground
 */
export async function initPushNotifications(
  onTokenReceived?: (token: PushNotificationToken) => void,
  onNotificationReceived?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
): Promise<void> {
  const plugin = await loadPushNotifications();
  if (!plugin) return;

  const platform = Capacitor.getPlatform() as "ios" | "android";

  // 1. Check / request permission
  const permResult = await plugin.checkPermissions();
  
  if (permResult.receive === "prompt") {
    const requestResult = await plugin.requestPermissions();
    if (requestResult.receive !== "granted") {
      console.log("[PushNotifications] Permission denied by user");
      return;
    }
  } else if (permResult.receive === "denied") {
    console.log("[PushNotifications] Permission previously denied");
    return;
  }

  // 2. Register for push notifications
  await plugin.register();

  // 3. Listen for registration token
  plugin.addListener("registration", (token) => {
    console.log("[PushNotifications] Token received:", token.value.substring(0, 20) + "...");
    onTokenReceived?.({ value: token.value, platform });
  });

  // 4. Handle registration errors
  plugin.addListener("registrationError", (error) => {
    console.error("[PushNotifications] Registration error:", error);
  });

  // 5. Handle foreground notifications
  plugin.addListener("pushNotificationReceived", (notification) => {
    console.log("[PushNotifications] Received in foreground:", notification.title);
    onNotificationReceived?.({
      title: notification.title,
      body: notification.body,
      data: notification.data as Record<string, unknown>,
    });
  });

  // 6. Handle notification tap (app opened from notification)
  plugin.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[PushNotifications] Action performed:", action.actionId);
    const data = action.notification.data as Record<string, unknown>;
    
    // Handle deep linking based on notification data
    if (data?.type === "price_alert" && data?.cardId) {
      window.location.href = `/pricing/${data.cardId}`;
    } else if (data?.type === "order_update" && data?.orderNo) {
      window.location.href = `/orders/${data.orderNo}`;
    } else if (data?.type === "marketplace" && data?.listingId) {
      window.location.href = `/marketplace/${data.listingId}`;
    }
  });

  console.log("[PushNotifications] Initialized successfully on", platform);
}

/**
 * Remove all push notification listeners.
 * Call this on app cleanup.
 */
export async function removePushNotificationListeners(): Promise<void> {
  const plugin = await loadPushNotifications();
  if (!plugin) return;
  await plugin.removeAllListeners();
}
