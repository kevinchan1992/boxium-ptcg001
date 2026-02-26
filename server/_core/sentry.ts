/**
 * Sentry Error Monitoring Configuration (Backend)
 * 
 * Centralized error tracking for production environment
 */
import * as Sentry from "@sentry/node";

const sentryDsn = process.env.SENTRY_DSN_BACKEND;
const environment = process.env.NODE_ENV || "development";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Enable profiling
    profilesSampleRate: environment === "production" ? 0.1 : 1.0,
  });

  console.log(`[Sentry] Initialized for ${environment} environment`);
} else {
  console.log("[Sentry] DSN not configured, error monitoring disabled");
}

export { Sentry };
