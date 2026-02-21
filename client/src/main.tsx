import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

import "./index.css";
import "./mobile-touch-optimization.css";
import "./i18n";

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
