import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import * as Sentry from "@sentry/react";

import "./index.css";

// Suppress ResizeObserver loop warning - this is a known benign browser behavior
// triggered by recharts and other responsive chart libraries during rapid resize events.
// It does not affect functionality and is safe to ignore.
const _origError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (typeof message === "string" && message.includes("ResizeObserver loop")) {
    return true; // suppress
  }
  if (_origError) return _origError(message, source, lineno, colno, error);
  return false;
};
window.addEventListener("error", (e) => {
  if (e.message && e.message.includes("ResizeObserver loop")) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);
import "./mobile-touch-optimization.css";
import "./i18n";

// Initialize Sentry for frontend error monitoring
const sentryDsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const queryClient = new QueryClient();

// Error logging for debugging
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error as any;
    // Filter out expected authentication errors (e.g., when loading protected routes)
    if (error?.message?.includes("Please login") || error?.data?.code === "UNAUTHORIZED") {
      return;
    }
    console.error("[API Query Error]", error);
    // Send to Sentry
    if (sentryDsn) {
      Sentry.captureException(error, {
        tags: { type: "api_query_error" },
        contexts: {
          query: {
            queryKey: event.query.queryKey,
            queryHash: event.query.queryHash,
          },
        },
      });
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error as any;
    // Filter out expected authentication errors
    if (error?.message?.includes("Please login") || error?.data?.code === "UNAUTHORIZED") {
      return;
    }
    console.error("[API Mutation Error]", error);
    // Send to Sentry
    if (sentryDsn) {
      Sentry.captureException(error, {
        tags: { type: "api_mutation_error" },
        contexts: {
          mutation: {
            mutationId: event.mutation.mutationId,
          },
        },
      });
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <GoogleAnalytics />
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
