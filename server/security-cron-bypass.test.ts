/**
 * Tests for isInternalSystemRequest CRON_SECRET bypass
 * Ensures that Manus scheduled tasks calling /api/scheduled/* with valid
 * CRON_SECRET are correctly identified as internal requests and bypass
 * bot detection (which would otherwise block curl User-Agent).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isInternalSystemRequest } from "./middleware/security";
import type { Request } from "express";

function makeReq(overrides: Partial<{
  path: string;
  url: string;
  headers: Record<string, string>;
  method: string;
}>): Request {
  return {
    path: overrides.path ?? "/",
    url: overrides.url ?? overrides.path ?? "/",
    method: overrides.method ?? "POST",
    headers: overrides.headers ?? {},
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
}

describe("isInternalSystemRequest — CRON_SECRET bypass", () => {
  const FAKE_CRON_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    process.env.CRON_SECRET = FAKE_CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("should return true for /api/scheduled/trending-cards with valid CRON_SECRET", () => {
    const req = makeReq({
      path: "/api/scheduled/trending-cards",
      headers: {
        authorization: `Bearer ${FAKE_CRON_SECRET}`,
        // No User-Agent — simulates curl without -A flag
      },
    });
    expect(isInternalSystemRequest(req)).toBe(true);
  });

  it("should return true for any /api/scheduled/* path with valid CRON_SECRET", () => {
    const req = makeReq({
      path: "/api/scheduled/some-other-task",
      headers: {
        authorization: `Bearer ${FAKE_CRON_SECRET}`,
        "user-agent": "curl/8.5.0", // curl UA that would normally be blocked
      },
    });
    expect(isInternalSystemRequest(req)).toBe(true);
  });

  it("should return false for /api/scheduled/* with wrong CRON_SECRET", () => {
    const req = makeReq({
      path: "/api/scheduled/trending-cards",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });
    expect(isInternalSystemRequest(req)).toBe(false);
  });

  it("should return false for /api/scheduled/* with no Authorization header", () => {
    const req = makeReq({
      path: "/api/scheduled/trending-cards",
      headers: {},
    });
    expect(isInternalSystemRequest(req)).toBe(false);
  });

  it("should return false for /api/scheduled/* when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    const req = makeReq({
      path: "/api/scheduled/trending-cards",
      headers: {
        authorization: `Bearer ${FAKE_CRON_SECRET}`,
      },
    });
    expect(isInternalSystemRequest(req)).toBe(false);
  });

  it("should return false for non-scheduled paths even with CRON_SECRET", () => {
    const req = makeReq({
      path: "/api/trpc/cards.search",
      headers: {
        authorization: `Bearer ${FAKE_CRON_SECRET}`,
      },
    });
    expect(isInternalSystemRequest(req)).toBe(false);
  });

  it("should still return true for x-internal-token method", () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    const req = makeReq({
      path: "/api/trpc/admin.processBatch",
      headers: {
        "x-internal-token": "test-jwt-secret",
      },
    });
    expect(isInternalSystemRequest(req)).toBe(true);
    delete process.env.JWT_SECRET;
  });

  it("should still return true for known internal admin procedures", () => {
    const req = makeReq({
      path: "/api/trpc/admin.startBatchUpdateTask",
      url: "/api/trpc/admin.startBatchUpdateTask",
      headers: {},
    });
    expect(isInternalSystemRequest(req)).toBe(true);
  });

  it("should return true for Stripe webhook with stripe-signature header", () => {
    const req = makeReq({
      path: "/api/stripe/webhook",
      headers: {
        "stripe-signature": "t=123456,v1=abc123",
        // No User-Agent or browser headers
      },
    });
    expect(isInternalSystemRequest(req)).toBe(true);
  });

  it("should return false for /api/stripe/webhook without stripe-signature", () => {
    const req = makeReq({
      path: "/api/stripe/webhook",
      headers: {},
    });
    expect(isInternalSystemRequest(req)).toBe(false);
  });
});
