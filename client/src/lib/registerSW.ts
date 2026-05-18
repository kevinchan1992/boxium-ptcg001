/**
 * Service Worker 註冊工具
 * - 只在 production 環境或明確啟用時註冊
 * - 提供更新通知回調
 */

export function registerServiceWorker(options?: {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
}) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Register on load to avoid blocking initial render
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New content available
              options?.onUpdate?.(registration);
            } else {
              // Content cached for first time
              options?.onSuccess?.(registration);
            }
          }
        });
      });

      // Check for updates every 60 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);

    } catch (err) {
      console.warn("[SW] Registration failed:", err);
    }
  });
}

export function unregisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch(() => {});
}
