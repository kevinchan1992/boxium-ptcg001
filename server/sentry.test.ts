/**
 * Sentry Integration Tests
 * 
 * Verify that Sentry error monitoring is properly configured
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Sentry Integration", () => {
  describe("Backend Configuration", () => {
    it("should have Sentry SDK installed", () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
      );
      expect(packageJson.dependencies).toHaveProperty("@sentry/node");
      expect(packageJson.dependencies).toHaveProperty("@sentry/react");
    });

    it("should have sentry.ts configuration file", () => {
      const sentryPath = path.join(__dirname, "_core/sentry.ts");
      expect(fs.existsSync(sentryPath)).toBe(true);
    });

    it("should import Sentry in server entry point", () => {
      const indexPath = path.join(__dirname, "_core/index.ts");
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      expect(indexContent).toContain('import { Sentry } from "./sentry"');
    });

    it("should have Sentry error handler in tRPC middleware", () => {
      const indexPath = path.join(__dirname, "_core/index.ts");
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      expect(indexContent).toContain("onError:");
      expect(indexContent).toContain("Sentry.captureException");
    });
  });

  describe("Frontend Configuration", () => {
    it("should import Sentry in main.tsx", () => {
      const mainPath = path.join(__dirname, "../client/src/main.tsx");
      const mainContent = fs.readFileSync(mainPath, "utf-8");
      expect(mainContent).toContain('import * as Sentry from "@sentry/react"');
    });

    it("should initialize Sentry with proper config", () => {
      const mainPath = path.join(__dirname, "../client/src/main.tsx");
      const mainContent = fs.readFileSync(mainPath, "utf-8");
      expect(mainContent).toContain("Sentry.init");
      expect(mainContent).toContain("VITE_SENTRY_DSN_FRONTEND");
      expect(mainContent).toContain("browserTracingIntegration");
      expect(mainContent).toContain("replayIntegration");
    });

    it("should capture API query errors", () => {
      const mainPath = path.join(__dirname, "../client/src/main.tsx");
      const mainContent = fs.readFileSync(mainPath, "utf-8");
      expect(mainContent).toContain("api_query_error");
      expect(mainContent).toContain("Sentry.captureException(error");
    });

    it("should capture API mutation errors", () => {
      const mainPath = path.join(__dirname, "../client/src/main.tsx");
      const mainContent = fs.readFileSync(mainPath, "utf-8");
      expect(mainContent).toContain("api_mutation_error");
    });
  });

  describe("Configuration Structure", () => {
    it("should have proper Sentry init structure in backend", () => {
      const sentryPath = path.join(__dirname, "_core/sentry.ts");
      const sentryContent = fs.readFileSync(sentryPath, "utf-8");
      
      // Check for essential configuration
      expect(sentryContent).toContain("Sentry.init");
      expect(sentryContent).toContain("SENTRY_DSN_BACKEND");
      expect(sentryContent).toContain("tracesSampleRate");
      expect(sentryContent).toContain("profilesSampleRate");
    });

    it("should handle missing DSN gracefully", () => {
      const sentryPath = path.join(__dirname, "_core/sentry.ts");
      const sentryContent = fs.readFileSync(sentryPath, "utf-8");
      
      // Should check for DSN before initializing
      expect(sentryContent).toContain("if (sentryDsn)");
      expect(sentryContent).toContain("DSN not configured");
    });
  });

  describe("Error Context", () => {
    it("should include tRPC context in backend errors", () => {
      const indexPath = path.join(__dirname, "_core/index.ts");
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      
      expect(indexContent).toContain("contexts:");
      expect(indexContent).toContain("trpc:");
      expect(indexContent).toContain("path,");
      expect(indexContent).toContain("input:");
    });

    it("should include query context in frontend errors", () => {
      const mainPath = path.join(__dirname, "../client/src/main.tsx");
      const mainContent = fs.readFileSync(mainPath, "utf-8");
      
      expect(mainContent).toContain("contexts:");
      expect(mainContent).toContain("query:");
      expect(mainContent).toContain("queryKey:");
    });
  });
});
