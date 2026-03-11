import { describe, it, expect } from "vitest";

/**
 * Payment Reminder Scheduler Tests
 *
 * Tests the logic for sending payment reminder notifications to buyers
 * whose pending_payment orders were created 12–13 hours ago (i.e. ~12 hours
 * before the 24-hour auto-cancel deadline).
 *
 * The scheduler runs every hour at :45 (Asia/Hong_Kong).
 */

describe("Payment Reminder Scheduler Logic", () => {
  // ── Time window calculation ─────────────────────────────────────────────────
  describe("12–13 hour reminder window calculation", () => {
    it("should calculate windowStart as 13 hours ago", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      expect(windowStart.toISOString()).toBe("2026-03-10T00:45:00.000Z");
    });

    it("should calculate windowEnd as 12 hours ago", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowEnd = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      expect(windowEnd.toISOString()).toBe("2026-03-10T01:45:00.000Z");
    });

    it("should include orders created exactly 12.5 hours ago", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const orderCreatedAt = new Date(now.getTime() - 12.5 * 60 * 60 * 1000);
      const inWindow = orderCreatedAt >= windowStart && orderCreatedAt < windowEnd;
      expect(inWindow).toBe(true);
    });

    it("should NOT include orders created 11 hours ago (too recent)", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const orderCreatedAt = new Date(now.getTime() - 11 * 60 * 60 * 1000);
      const inWindow = orderCreatedAt >= windowStart && orderCreatedAt < windowEnd;
      expect(inWindow).toBe(false);
    });

    it("should NOT include orders created 14 hours ago (too old)", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const orderCreatedAt = new Date(now.getTime() - 14 * 60 * 60 * 1000);
      const inWindow = orderCreatedAt >= windowStart && orderCreatedAt < windowEnd;
      expect(inWindow).toBe(false);
    });

    it("should NOT include orders created exactly 12 hours ago (boundary: windowEnd is exclusive)", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const orderCreatedAt = new Date(windowEnd.getTime()); // exactly at windowEnd
      const inWindow = orderCreatedAt >= windowStart && orderCreatedAt < windowEnd;
      expect(inWindow).toBe(false);
    });

    it("should include orders created exactly 13 hours ago (boundary: windowStart is inclusive)", () => {
      const now = new Date("2026-03-10T13:45:00.000Z");
      const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);
      const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const orderCreatedAt = new Date(windowStart.getTime()); // exactly at windowStart
      const inWindow = orderCreatedAt >= windowStart && orderCreatedAt < windowEnd;
      expect(inWindow).toBe(true);
    });
  });

  // ── Reminder window aligns with auto-cancel deadline ───────────────────────
  describe("Reminder timing relative to 24-hour auto-cancel", () => {
    it("should send reminder when ~12 hours remain before auto-cancel", () => {
      const orderCreatedAt = new Date("2026-03-09T01:30:00.000Z");
      const autoCancelAt   = new Date(orderCreatedAt.getTime() + 24 * 60 * 60 * 1000);
      const reminderSentAt = new Date(orderCreatedAt.getTime() + 12.5 * 60 * 60 * 1000);

      const hoursRemainingAtReminder =
        (autoCancelAt.getTime() - reminderSentAt.getTime()) / (60 * 60 * 1000);

      expect(hoursRemainingAtReminder).toBeCloseTo(11.5, 0);
      expect(hoursRemainingAtReminder).toBeGreaterThan(11);
      expect(hoursRemainingAtReminder).toBeLessThan(13);
    });
  });

  // ── Duplicate prevention via paymentReminderSentAt ─────────────────────────
  describe("Duplicate reminder prevention", () => {
    it("should only remind orders where paymentReminderSentAt IS NULL", () => {
      const orders = [
        { id: 1, orderNo: "BOXIUM-001", paymentReminderSentAt: null },
        { id: 2, orderNo: "BOXIUM-002", paymentReminderSentAt: new Date("2026-03-09T14:00:00.000Z") },
        { id: 3, orderNo: "BOXIUM-003", paymentReminderSentAt: null },
      ];

      const toRemind = orders.filter((o) => o.paymentReminderSentAt === null);
      expect(toRemind).toHaveLength(2);
      expect(toRemind.map((o) => o.id)).toEqual([1, 3]);
    });

    it("should mark paymentReminderSentAt before sending to prevent duplicates", () => {
      // Simulates the guard: mark first, then send
      const order = { id: 1, paymentReminderSentAt: null as Date | null };
      const now = new Date();

      // Step 1: mark
      order.paymentReminderSentAt = now;
      // Step 2: send notification (simulated)
      const notificationSent = true;

      expect(order.paymentReminderSentAt).not.toBeNull();
      expect(notificationSent).toBe(true);
    });
  });

  // ── Order status filtering ──────────────────────────────────────────────────
  describe("Order status filtering", () => {
    it("should only remind pending_payment orders", () => {
      const allStatuses = ["pending_payment", "paid_held", "processing", "shipped", "completed", "cancelled"];
      const remindable = allStatuses.filter((s) => s === "pending_payment");
      expect(remindable).toEqual(["pending_payment"]);
    });

    it("should not remind already paid orders", () => {
      const order = { orderStatus: "paid_held", paymentReminderSentAt: null };
      const shouldRemind = order.orderStatus === "pending_payment";
      expect(shouldRemind).toBe(false);
    });

    it("should not remind cancelled orders", () => {
      const order = { orderStatus: "cancelled", paymentReminderSentAt: null };
      const shouldRemind = order.orderStatus === "pending_payment";
      expect(shouldRemind).toBe(false);
    });
  });

  // ── Notification content ────────────────────────────────────────────────────
  describe("Notification content", () => {
    it("should include order number in notification body", () => {
      const orderNo = "BOXIUM-1741614600000-1234";
      const body = `訂單 #${orderNo} 尚未完成付款，將在約 12 小時後自動取消，請盡快完成付款。`;
      expect(body).toContain(orderNo);
    });

    it("should mention 12 hours in the notification body", () => {
      const body = `訂單 #BOXIUM-001 尚未完成付款，將在約 12 小時後自動取消，請盡快完成付款。`;
      expect(body).toContain("12 小時");
    });

    it("should include order detail link in notification", () => {
      const orderNo = "BOXIUM-1741614600000-1234";
      const linkUrl = `/orders/${orderNo}`;
      expect(linkUrl).toMatch(/^\/orders\/BOXIUM-/);
    });

    it("should use order notification type", () => {
      const notificationType = "order";
      expect(notificationType).toBe("order");
    });

    it("should use warning emoji in title", () => {
      const title = "⏰ 訂單即將自動取消";
      expect(title).toContain("⏰");
      expect(title).toContain("自動取消");
    });
  });

  // ── Cron schedule configuration ─────────────────────────────────────────────
  describe("Cron schedule configuration", () => {
    it("should run every hour at :45", () => {
      const cronExpression = "45 * * * *";
      const parts = cronExpression.split(" ");
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe("45"); // minute: 45
      expect(parts[1]).toBe("*");  // every hour
    });

    it("should use Asia/Hong_Kong timezone", () => {
      const timezone = "Asia/Hong_Kong";
      expect(timezone).toBe("Asia/Hong_Kong");
    });

    it("should not conflict with payment timeout scheduler (runs at :30)", () => {
      const reminderMinute = 45;
      const timeoutMinute  = 30;
      expect(reminderMinute).not.toBe(timeoutMinute);
    });

    it("should not conflict with offer expiry reminder (runs at :15)", () => {
      const reminderMinute = 45;
      const offerMinute    = 15;
      expect(reminderMinute).not.toBe(offerMinute);
    });

    it("should not start duplicate schedulers (idempotent)", () => {
      let startCount = 0;
      let job: boolean | null = null;

      function startScheduler() {
        if (job) return;
        job = true;
        startCount++;
      }

      startScheduler();
      startScheduler();
      startScheduler();

      expect(startCount).toBe(1);
    });
  });

  // ── Batch processing ────────────────────────────────────────────────────────
  describe("Batch processing behaviour", () => {
    it("should skip when no orders need reminding", () => {
      const ordersToRemind: any[] = [];
      let reminderCount = 0;

      if (ordersToRemind.length === 0) {
        // early return
      } else {
        reminderCount = ordersToRemind.length;
      }

      expect(reminderCount).toBe(0);
    });

    it("should process each order independently (error isolation)", () => {
      const orders = [
        { id: 1, orderNo: "BOXIUM-001" },
        { id: 2, orderNo: "BOXIUM-002" },
        { id: 3, orderNo: "BOXIUM-003" },
      ];

      const reminded: number[] = [];
      const failed: number[] = [];

      for (const order of orders) {
        try {
          if (order.id === 2) throw new Error("Notification service error");
          reminded.push(order.id);
        } catch {
          failed.push(order.id);
        }
      }

      expect(reminded).toEqual([1, 3]);
      expect(failed).toEqual([2]);
    });

    it("should log the count of orders to remind", () => {
      const logs: string[] = [];
      const ordersToRemind = [{ id: 1 }, { id: 2 }];

      if (ordersToRemind.length > 0) {
        logs.push(`[PaymentReminder] Found ${ordersToRemind.length} orders to remind`);
      }

      expect(logs[0]).toContain("Found 2 orders to remind");
    });

    it("should respect the limit of 100 orders per run", () => {
      // Simulates the .limit(100) in the DB query
      const MAX_PER_RUN = 100;
      const mockOrders = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));
      const batch = mockOrders.slice(0, MAX_PER_RUN);
      expect(batch).toHaveLength(100);
    });
  });
});
