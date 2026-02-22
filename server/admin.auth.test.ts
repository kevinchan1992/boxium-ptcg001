import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: {} as any,
    res: {} as any,
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

describe("Admin API Authentication", () => {
  const caller = appRouter.createCaller;

  it("should allow guest to call auth.me", async () => {
    const guestCaller = caller(createGuestContext());
    const result = await guestCaller.auth.me();
    expect(result).toBeNull();
  });

  it("should return user info for authenticated user", async () => {
    const userCaller = caller(createUserContext());
    const result = await userCaller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("user");
  });

  it("should return admin info for admin user", async () => {
    const adminCaller = caller(createAdminContext());
    const result = await adminCaller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });

  it("should reject guest from calling admin.deleteDataSource", async () => {
    const guestCaller = caller(createGuestContext());
    
    await expect(
      guestCaller.admin.deleteDataSource({ dataSourceId: 1 })
    ).rejects.toThrow("You do not have required permission");
  });

  it("should reject regular user from calling admin.deleteDataSource", async () => {
    const userCaller = caller(createUserContext());
    
    await expect(
      userCaller.admin.deleteDataSource({ dataSourceId: 1 })
    ).rejects.toThrow("You do not have required permission");
  });

  it("should allow admin to call admin.getDashboardStats", async () => {
    const adminCaller = caller(createAdminContext());
    
    // This should not throw
    const result = await adminCaller.admin.getDashboardStats();
    expect(result).toBeDefined();
  });

  it("should reject guest from calling admin.batchUpdateEbayPrices", async () => {
    const guestCaller = caller(createGuestContext());
    
    await expect(
      guestCaller.admin.batchUpdateEbayPrices()
    ).rejects.toThrow("You do not have required permission");
  });

  it("should reject regular user from calling admin.batchUpdateSnkrdunkPrices", async () => {
    const userCaller = caller(createUserContext());
    
    await expect(
      userCaller.admin.batchUpdateSnkrdunkPrices()
    ).rejects.toThrow("You do not have required permission");
  });

  it("should reject guest from calling blog.createPost", async () => {
    const guestCaller = caller(createGuestContext());
    
    await expect(
      guestCaller.blog.createPost({
        title: "Test Post",
        content: "Test Content",
        excerpt: "Test Excerpt",
        slug: "test-post",
        category: "general",
      })
    ).rejects.toThrow("You do not have required permission");
  });

  it("should reject regular user from calling blog.deletePost", async () => {
    const userCaller = caller(createUserContext());
    
    await expect(
      userCaller.blog.deletePost({ id: 1 })
    ).rejects.toThrow("You do not have required permission");
  });
});
