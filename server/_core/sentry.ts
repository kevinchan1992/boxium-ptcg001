/**
 * Sentry Error Monitoring Configuration (Backend)
 *
 * Centralized error tracking for production environment.
 * Uses a no-op stub in development to avoid loading @opentelemetry/instrumentation,
 * which has a broken inode in the dev sandbox (ERR_MODULE_NOT_FOUND on 0.211.0).
 */

const environment = process.env.NODE_ENV || "development";
const sentryDsn = process.env.SENTRY_DSN_BACKEND;

// Minimal no-op stub that satisfies all Sentry call sites
const noopSentry = {
  init: () => {},
  captureException: (_err: unknown) => "",
  captureMessage: (_msg: string) => "",
  withScope: (cb: (scope: any) => void) => cb({ setExtra: () => {}, setTag: () => {}, setUser: () => {} }),
  setUser: () => {},
  setTag: () => {},
  setExtra: () => {},
  addBreadcrumb: () => {},
  startTransaction: () => ({ finish: () => {} }),
  getCurrentHub: () => ({ getScope: () => null }),
} as any;

let Sentry: typeof import("@sentry/node") = noopSentry;

// Use a self-executing async function to avoid top-level await (tsconfig target compatibility)
(async () => {
  if (environment === "production" && sentryDsn) {
    try {
      // Dynamic import so the module is only resolved at runtime in production
      const SentryModule = await import("@sentry/node");
      Sentry = SentryModule;
      Sentry.init({
        dsn: sentryDsn,
        environment,
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.1,
      });
      console.log(`[Sentry] Initialized for ${environment} environment`);
    } catch (err: any) {
      console.warn("[Sentry] Failed to initialize, using no-op stub:", err.message);
      Sentry = noopSentry;
    }
  } else if (environment === "production") {
    console.log("[Sentry] DSN not configured, error monitoring disabled");
  } else {
    console.log("[Sentry] Skipped in non-production environment");
  }
})();

export { Sentry };
