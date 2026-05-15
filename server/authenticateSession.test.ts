/**
 * Tests for authenticateSession.ts
 * Verifies that:
 *  1. v2 JWT fast path reconstructs User without a DB query
 *  2. In-memory cache returns the same user on subsequent calls
 *  3. invalidateSessionCache forces a DB lookup on next call
 *  4. Blocked users are rejected even with a valid v2 JWT
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = "test-secret";
process.env.JWT_SECRET = JWT_SECRET;

// ── Mock the DB so we can detect if it's called ──────────────────────────────
const mockSelect = vi.fn();
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelect,
        }),
      }),
    }),
  }),
}));

// jose uses the same JWT_SECRET env var; we need to sign tokens with the same secret.
// authenticateSession uses jose's jwtVerify, so we sign with jsonwebtoken (HS256 compatible).
function signV2(payload: object, expiresIn = "7d") {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn });
}

function makeRequest(token: string | undefined) {
  return { cookies: token ? { session: token } : {} } as any;
}

// Re-import after mocks are set up
let authenticateSession: typeof import("./_core/authenticateSession").authenticateSession;
let invalidateSessionCache: typeof import("./_core/authenticateSession").invalidateSessionCache;
let clearSessionCache: typeof import("./_core/authenticateSession").clearSessionCache;

beforeEach(async () => {
  vi.resetModules();
  mockSelect.mockReset();
  const mod = await import("./_core/authenticateSession");
  authenticateSession = mod.authenticateSession;
  invalidateSessionCache = mod.invalidateSessionCache;
  clearSessionCache = mod.clearSessionCache;
  clearSessionCache();
});

describe("authenticateSession", () => {
  it("returns null when no session cookie is present", async () => {
    const result = await authenticateSession(makeRequest(undefined));
    expect(result).toBeNull();
  });

  it("v2 JWT: reconstructs user without hitting the DB", async () => {
    const token = signV2({
      v: 2,
      id: 42,
      email: "test@example.com",
      role: "user",
      name: "Alice",
      phone: null,
      emailVerified: true,
      isBlocked: false,
      loginMethod: "password",
      googleId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSignedIn: Date.now(),
    });

    const user = await authenticateSession(makeRequest(token));
    expect(user).not.toBeNull();
    expect(user?.id).toBe(42);
    expect(user?.email).toBe("test@example.com");
    expect(user?.name).toBe("Alice");
    // DB should NOT have been called
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("v2 JWT: rejects blocked users immediately", async () => {
    const token = signV2({
      v: 2,
      id: 99,
      email: "blocked@example.com",
      role: "user",
      isBlocked: true,
      emailVerified: true,
      loginMethod: "password",
    });

    const result = await authenticateSession(makeRequest(token));
    expect(result).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("v2 JWT: second call uses in-memory cache (DB still not called)", async () => {
    const token = signV2({
      v: 2,
      id: 7,
      email: "cached@example.com",
      role: "admin",
      isBlocked: false,
      emailVerified: true,
      loginMethod: "google",
    });

    const first = await authenticateSession(makeRequest(token));
    const second = await authenticateSession(makeRequest(token));
    expect(first?.id).toBe(7);
    expect(second?.id).toBe(7);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("invalidateSessionCache forces DB lookup on next call (v1 JWT fallback)", async () => {
    // Simulate a v1 token (no v:2 flag)
    const v1Token = jwt.sign({ id: 5, email: "v1@example.com", role: "user" }, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "7d",
    });

    const mockUser = {
      id: 5,
      email: "v1@example.com",
      role: "user",
      isBlocked: false,
      name: "V1 User",
      phone: null,
      emailVerified: true,
      loginMethod: "password",
      googleId: null,
      passwordHash: null,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      blockReason: null,
    };

    mockSelect.mockResolvedValueOnce([mockUser]);

    const first = await authenticateSession(makeRequest(v1Token));
    expect(first?.id).toBe(5);
    expect(mockSelect).toHaveBeenCalledTimes(1);

    // Second call should use cache — no additional DB call
    const second = await authenticateSession(makeRequest(v1Token));
    expect(second?.id).toBe(5);
    expect(mockSelect).toHaveBeenCalledTimes(1); // still 1

    // After invalidation, DB should be called again
    invalidateSessionCache(5);
    mockSelect.mockResolvedValueOnce([mockUser]);
    const third = await authenticateSession(makeRequest(v1Token));
    expect(third?.id).toBe(5);
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});
