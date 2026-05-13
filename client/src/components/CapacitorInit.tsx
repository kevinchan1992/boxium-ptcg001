/**
 * CapacitorInit.tsx
 *
 * Initializes Capacitor native features when running inside the mobile app.
 * This component should be rendered once near the top of the component tree.
 *
 * Responsibilities:
 * 1. Add `.capacitor-native` class to <body> for CSS targeting
 * 2. Initialize push notifications
 * 3. Configure StatusBar
 * 4. Configure Keyboard behavior
 * 5. Send push token to backend for storage
 */

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { trpc } from "@/lib/trpc";
import {
  initPushNotifications,
  removePushNotificationListeners,
} from "@/services/pushNotificationService";
import { toast } from "sonner";

export function CapacitorInit() {
  const { data: user } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 1. Add native class to body for CSS targeting
    document.body.classList.add("capacitor-native");

    // 2. Configure StatusBar (dark theme to match app)
    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });
      } catch {
        // StatusBar plugin not available or error - ignore silently
      }
    })();

    // 3. Configure Keyboard
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        // Keyboard will resize the body, not the webview
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {
        // Keyboard plugin not available - ignore silently
      }
    })();

    // 4. Initialize Push Notifications (only when user is logged in)
    if (user) {
      initPushNotifications(
        async (token) => {
          // Send token to backend for storage
          // The backend will use this to send targeted push notifications
          try {
            const response = await fetch("/api/push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                token: token.value,
                platform: token.platform,
              }),
            });
            if (!response.ok) {
              console.warn("[CapacitorInit] Failed to register push token");
            }
          } catch {
            console.warn("[CapacitorInit] Push token registration failed");
          }
        },
        (notification) => {
          // Show foreground notification as toast
          if (notification.title) {
            toast(notification.title, {
              description: notification.body,
              duration: 5000,
            });
          }
        }
      );
    }

    return () => {
      document.body.classList.remove("capacitor-native");
      removePushNotificationListeners();
    };
  }, [user]);

  // This component renders nothing - it's purely for side effects
  return null;
}
