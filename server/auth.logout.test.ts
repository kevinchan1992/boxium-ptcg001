import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      setHeader: (name: string, value: string | string[]) => {
        // Mock setHeader for cookie clearing
        if (name === "Set-Cookie") {
          // Store the cookie headers for verification
          const cookies = Array.isArray(value) ? value : [value];
          cookies.forEach(cookie => {
            if (cookie.includes("session=")) {
              clearedCookies.push({ name: "session", options: {} });
            }
          });
        }
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // Should have 2 session cookie clearing attempts (Max-Age=0 and Expires strategies)
    expect(clearedCookies).toHaveLength(2);
    
    // Check that session cookies are cleared
    const cookieNames = clearedCookies.map(c => c.name);
    expect(cookieNames).toContain("session");
    expect(cookieNames.filter(n => n === "session")).toHaveLength(2);
  });
});
