/**
 * Auth Module - Register & Login Flow Tests
 *
 * Tests the core authentication helpers in server/auth.ts:
 *   - registerUser: email validation, password strength, duplicate detection, email-verification flag
 *   - loginUser: credential verification, blocked-account guard, unverified-email guard, token generation
 *   - generateToken / verifyToken: JWT round-trip
 *   - generateEmailVerificationToken: token format
 *   - isValidEmail / isValidPassword: input validation helpers
 *
 * Strategy: unit-test pure helpers without a DB; DB-dependent paths are tested
 * with vi.mock so no live database is required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidEmail,
  isValidPassword,
  generateEmailVerificationToken,
  generateToken,
  verifyToken,
  registerUser,
  loginUser,
} from "./auth";
import type { User } from "../drizzle/schema_new";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal User object that satisfies the type expected by generateToken */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 42,
    email: "test@example.com",
    name: "Test User",
    passwordHash: "$2b$10$hashedpassword",
    loginMethod: "password",
    role: "user",
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    lastSignedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    googleId: null,
    appleId: null,
    avatarUrl: null,
    phone: null,
    isBlocked: false,
    blockReason: null,
    ...overrides,
  } as unknown as User;
}

// ---------------------------------------------------------------------------
// Pure helper tests (no DB, no mocks needed)
// ---------------------------------------------------------------------------

describe("isValidEmail", () => {
  it("accepts a well-formed email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user+tag@sub.domain.io")).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts a strong password", () => {
    const result = isValidPassword("Secure1Password");
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = isValidPassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/8/);
  });

  it("rejects passwords without uppercase letters", () => {
    const result = isValidPassword("alllowercase1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/大寫/);
  });

  it("rejects passwords without lowercase letters", () => {
    const result = isValidPassword("ALLUPPERCASE1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/小寫/);
  });

  it("rejects passwords without digits", () => {
    const result = isValidPassword("NoDigitsHere");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/數字/);
  });
});

describe("generateEmailVerificationToken", () => {
  it("returns a 96-character hex string", () => {
    const token = generateEmailVerificationToken();
    expect(typeof token).toBe("string");
    // 48 random bytes → 96 hex chars
    expect(token).toHaveLength(96);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens on each call", () => {
    const t1 = generateEmailVerificationToken();
    const t2 = generateEmailVerificationToken();
    expect(t1).not.toBe(t2);
  });
});

describe("generateToken / verifyToken", () => {
  it("round-trips a user through JWT encode/decode", () => {
    const user = makeUser();
    const token = generateToken(user);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(user.id);
    expect(decoded!.email).toBe(user.email);
    expect(decoded!.role).toBe(user.role);
  });

  it("returns null for a tampered token", () => {
    const token = generateToken(makeUser());
    const tampered = token.slice(0, -4) + "xxxx";
    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyToken("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// registerUser – DB-dependent paths mocked via vi.mock
// ---------------------------------------------------------------------------

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./emailService", () => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import * as dbModule from "./db";

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when DB is unavailable", async () => {
    vi.mocked(dbModule.getDb).mockResolvedValue(null as any);
    const result = await registerUser("user@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/數據庫/);
  });

  it("returns error for invalid email format", async () => {
    // DB mock not needed – validation happens before DB call
    vi.mocked(dbModule.getDb).mockResolvedValue({} as any);
    const result = await registerUser("bad-email", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it("returns error for weak password (no uppercase)", async () => {
    vi.mocked(dbModule.getDb).mockResolvedValue({} as any);
    const result = await registerUser("user@example.com", "weakpassword1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/大寫/);
  });

  it("returns error when email is already registered", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeUser({ email: "user@example.com" })]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await registerUser("user@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/已被註冊/);
  });

  it("returns success with requiresEmailVerification=true on valid new registration", async () => {
    const newUser = makeUser({ id: 99, emailVerified: false });
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      // First call: check existing user → empty; second call: fetch created user → [newUser]
      limit: vi.fn()
        .mockResolvedValueOnce([])        // no existing user
        .mockResolvedValueOnce([newUser]), // created user fetch
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([{ insertId: 99 }]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await registerUser("newuser@example.com", "Password1");
    expect(result.success).toBe(true);
    expect(result.requiresEmailVerification).toBe(true);
    // No session token should be issued before email verification
    expect(result.token).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// loginUser – DB-dependent paths mocked
// ---------------------------------------------------------------------------

describe("loginUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when DB is unavailable", async () => {
    vi.mocked(dbModule.getDb).mockResolvedValue(null as any);
    const result = await loginUser("user@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/數據庫/);
  });

  it("returns generic error when user is not found", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no user
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("ghost@example.com", "Password1");
    expect(result.success).toBe(false);
    // Must NOT reveal whether the email exists (security)
    expect(result.error).toMatch(/email 或密碼錯誤/);
  });

  it("returns error when account uses a different login method", async () => {
    const googleUser = makeUser({ loginMethod: "google", passwordHash: null });
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([googleUser]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("google@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/其他方式/);
  });

  it("returns error for wrong password", async () => {
    // Use a real bcrypt hash for "CorrectPass1" to test verifyPassword path
    const { hashPassword } = await import("./auth");
    const hash = await hashPassword("CorrectPass1");
    const user = makeUser({ passwordHash: hash, emailVerified: true });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([user]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("user@example.com", "WrongPass1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email 或密碼錯誤/);
  });

  it("returns EMAIL_NOT_VERIFIED error for unverified account", async () => {
    const { hashPassword } = await import("./auth");
    const hash = await hashPassword("Password1");
    const user = makeUser({ passwordHash: hash, emailVerified: false });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([user]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("user@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("EMAIL_NOT_VERIFIED");
    expect(result.requiresEmailVerification).toBe(true);
  });

  it("returns error for blocked account", async () => {
    const { hashPassword } = await import("./auth");
    const hash = await hashPassword("Password1");
    const user = makeUser({ passwordHash: hash, emailVerified: true, isBlocked: true, blockReason: "違規行為" });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([user]),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("user@example.com", "Password1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/封鎖/);
    expect(result.error).toMatch(/違規行為/);
  });

  it("returns success with JWT token for valid credentials", async () => {
    const { hashPassword } = await import("./auth");
    const hash = await hashPassword("Password1");
    const user = makeUser({ passwordHash: hash, emailVerified: true });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([user]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as any);

    const result = await loginUser("user@example.com", "Password1");
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    // Token must be a valid JWT
    const decoded = verifyToken(result.token!);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(user.id);
  });
});
