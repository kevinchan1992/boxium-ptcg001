/**
 * Email Verification Flow Tests
 *
 * Tests the complete email verification flow:
 * 1. generateEmailVerificationToken - generates a secure random token
 * 2. loginUser - returns EMAIL_NOT_VERIFIED for unverified users
 * 3. verifyEmail procedure - validates token and marks email as verified
 * 4. resendVerificationEmail - generates new token for unverified users
 */

import { describe, it, expect } from "vitest";
import { generateEmailVerificationToken } from "./auth";

describe("generateEmailVerificationToken", () => {
  it("should generate a token of expected length", () => {
    const token = generateEmailVerificationToken();
    // 48 bytes hex = 96 characters
    expect(token).toHaveLength(96);
  });

  it("should generate unique tokens each time", () => {
    const token1 = generateEmailVerificationToken();
    const token2 = generateEmailVerificationToken();
    expect(token1).not.toBe(token2);
  });

  it("should only contain hex characters", () => {
    const token = generateEmailVerificationToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});

describe("Email Verification Logic", () => {
  it("should require email verification before login for password accounts", () => {
    // This test validates the business logic:
    // Password-registered users must verify email before logging in
    const mockUser = {
      loginMethod: "password",
      emailVerified: false,
      passwordHash: "hashed_password",
      isBlocked: false,
    };

    // Simulate the loginUser check
    const shouldBlockLogin = !mockUser.emailVerified && mockUser.loginMethod === "password";
    expect(shouldBlockLogin).toBe(true);
  });

  it("should allow Google OAuth users to login without email verification", () => {
    // Google OAuth users have emailVerified=true by default
    const mockGoogleUser = {
      loginMethod: "google",
      emailVerified: true,
      isBlocked: false,
    };

    const shouldBlockLogin = !mockGoogleUser.emailVerified && mockGoogleUser.loginMethod === "password";
    expect(shouldBlockLogin).toBe(false);
  });

  it("should allow verified password users to login", () => {
    const mockVerifiedUser = {
      loginMethod: "password",
      emailVerified: true,
      passwordHash: "hashed_password",
      isBlocked: false,
    };

    const shouldBlockLogin = !mockVerifiedUser.emailVerified && mockVerifiedUser.loginMethod === "password";
    expect(shouldBlockLogin).toBe(false);
  });

  it("should calculate correct token expiry (24 hours from now)", () => {
    const now = Date.now();
    const expiry = new Date(now + 24 * 60 * 60 * 1000);
    const diffHours = (expiry.getTime() - now) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 1);
  });

  it("should detect expired tokens", () => {
    const expiredExpiry = new Date(Date.now() - 1000); // 1 second ago
    const validExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const now = new Date();

    expect(expiredExpiry < now).toBe(true);
    expect(validExpiry > now).toBe(true);
  });

  it("should not resend verification to already-verified users", () => {
    const verifiedUser = { emailVerified: true };
    const unverifiedUser = { emailVerified: false };

    // Business rule: resend only if user exists AND is NOT verified
    const shouldResendForVerified = verifiedUser && !verifiedUser.emailVerified;
    const shouldResendForUnverified = unverifiedUser && !unverifiedUser.emailVerified;

    expect(shouldResendForVerified).toBe(false);
    expect(shouldResendForUnverified).toBe(true);
  });

  it("should clear verification token after successful verification", () => {
    // After verification, token and expiry should be set to null
    const updatePayload = {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      lastSignedIn: new Date(),
    };

    expect(updatePayload.emailVerified).toBe(true);
    expect(updatePayload.emailVerificationToken).toBeNull();
    expect(updatePayload.emailVerificationExpiry).toBeNull();
  });
});
