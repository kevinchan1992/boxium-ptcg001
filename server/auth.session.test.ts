import { describe, it, expect, beforeAll } from "vitest";
import { loginUser, registerUser } from "./auth";
import { getUserByEmail } from "./db";

describe("Session Authentication Flow", () => {
  const testEmail = "test-session@example.com";
  const testPassword = "TestPassword123";

  beforeAll(async () => {
    // Clean up test user if exists
    try {
      const existingUser = await getUserByEmail(testEmail);
      if (existingUser) {
        // User exists, we can use it for testing
        console.log("[Test] Using existing test user");
      }
    } catch (error) {
      // User doesn't exist, create it
      console.log("[Test] Creating test user");
      await registerUser(testEmail, testPassword, "Test User");
    }
  });

  it("should login successfully and return a token", async () => {
    const result = await loginUser(testEmail, testPassword);
    
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(testEmail);
    
    console.log("[Test] Login successful");
    console.log("[Test] Token:", result.token?.substring(0, 20) + "...");
    console.log("[Test] User ID:", result.user?.id);
    console.log("[Test] User Email:", result.user?.email);
  });

  it("should fail with incorrect password", async () => {
    const result = await loginUser(testEmail, "WrongPassword123");
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    console.log("[Test] Failed login error:", result.error);
  });

  it("should fail with non-existent email", async () => {
    const result = await loginUser("nonexistent@example.com", testPassword);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    console.log("[Test] Non-existent user error:", result.error);
  });
});
