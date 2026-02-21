import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock context for testing
const createMockContext = (userId?: number): Context => ({
  user: userId
    ? {
        id: userId,
        openId: `test-openid-${userId}`,
        email: `test${userId}@example.com`,
        name: `Test User ${userId}`,
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "oauth",
      }
    : null,
  req: {} as any,
  res: {
    setHeader: () => {},
  } as any,
});

describe("Notifications API", () => {
  const caller = appRouter.createCaller(createMockContext(1));

  describe("createTest", () => {
    it("should create a test notification", async () => {
      const notification = await caller.notifications.createTest({
        type: "system",
        title: "Test Notification",
        content: "This is a test notification",
        priority: "medium",
      });

      expect(notification).toBeDefined();
      expect(notification.title).toBe("Test Notification");
      expect(notification.content).toBe("This is a test notification");
      expect(notification.type).toBe("system");
      expect(notification.priority).toBe("medium");
      expect(notification.isRead).toBe(false);
    });

    it("should create a price alert notification with metadata", async () => {
      const notification = await caller.notifications.createTest({
        type: "price_alert",
        title: "Price Alert: Pikachu VMAX",
        content: "Price dropped to HKD 500",
        priority: "high",
        relatedCardId: 1,
        relatedUrl: "/card/1",
        metadata: JSON.stringify({ oldPrice: 600, newPrice: 500 }),
      });

      expect(notification).toBeDefined();
      expect(notification.type).toBe("price_alert");
      expect(notification.priority).toBe("high");
      expect(notification.relatedCardId).toBe(1);
      expect(notification.relatedUrl).toBe("/card/1");
      expect(notification.metadata).toBe(JSON.stringify({ oldPrice: 600, newPrice: 500 }));
    });
  });

  describe("list", () => {
    it("should list user notifications", async () => {
      // Create a test notification first
      await caller.notifications.createTest({
        type: "system",
        title: "Test List Notification",
        content: "Testing list functionality",
      });

      const notifications = await caller.notifications.list({
        limit: 10,
        offset: 0,
        unreadOnly: false,
      });

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it("should filter unread notifications", async () => {
      const notifications = await caller.notifications.list({
        limit: 10,
        offset: 0,
        unreadOnly: true,
      });

      expect(Array.isArray(notifications)).toBe(true);
      // All returned notifications should be unread
      notifications.forEach((notification) => {
        expect(notification.isRead).toBe(false);
      });
    });
  });

  describe("unreadCount", () => {
    it("should return unread notification count", async () => {
      const count = await caller.notifications.unreadCount();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("markAsRead", () => {
    it("should mark a notification as read", async () => {
      // Create a test notification
      const notification = await caller.notifications.createTest({
        type: "system",
        title: "Test Mark As Read",
        content: "Testing mark as read functionality",
      });

      // Mark it as read
      const result = await caller.notifications.markAsRead({
        notificationId: notification.id,
      });

      expect(result.success).toBe(true);

      // Verify it's marked as read
      const updated = await caller.notifications.getById({
        notificationId: notification.id,
      });

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      // Create multiple test notifications
      await caller.notifications.createTest({
        type: "system",
        title: "Test 1",
        content: "Test content 1",
      });

      await caller.notifications.createTest({
        type: "system",
        title: "Test 2",
        content: "Test content 2",
      });

      // Mark all as read
      const result = await caller.notifications.markAllAsRead();

      expect(result.count).toBeGreaterThanOrEqual(0);

      // Verify unread count is 0
      const unreadCount = await caller.notifications.unreadCount();
      expect(unreadCount).toBe(0);
    });
  });

  describe("delete", () => {
    it("should delete a notification", async () => {
      // Create a test notification
      const notification = await caller.notifications.createTest({
        type: "system",
        title: "Test Delete",
        content: "Testing delete functionality",
      });

      // Delete it
      const result = await caller.notifications.delete({
        notificationId: notification.id,
      });

      expect(result.success).toBe(true);

      // Verify it's deleted (should throw error)
      await expect(
        caller.notifications.getById({
          notificationId: notification.id,
        })
      ).rejects.toThrow("Notification not found");
    });
  });

  describe("deleteAllRead", () => {
    it("should delete all read notifications", async () => {
      // Create and mark a notification as read
      const notification = await caller.notifications.createTest({
        type: "system",
        title: "Test Delete All Read",
        content: "Testing delete all read functionality",
      });

      await caller.notifications.markAsRead({
        notificationId: notification.id,
      });

      // Delete all read notifications
      const result = await caller.notifications.deleteAllRead();

      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getById", () => {
    it("should get a notification by ID", async () => {
      // Create a test notification
      const created = await caller.notifications.createTest({
        type: "system",
        title: "Test Get By ID",
        content: "Testing get by ID functionality",
      });

      // Get it by ID
      const notification = await caller.notifications.getById({
        notificationId: created.id,
      });

      expect(notification).toBeDefined();
      expect(notification.id).toBe(created.id);
      expect(notification.title).toBe("Test Get By ID");
    });

    it("should throw error for non-existent notification", async () => {
      await expect(
        caller.notifications.getById({
          notificationId: 999999,
        })
      ).rejects.toThrow("Notification not found");
    });
  });
});
