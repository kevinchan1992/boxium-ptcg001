import { describe, it, expect } from "vitest";

// ─── Tests for Tab Batch Count + Payment Countdown ───────────────────────────

describe("Profile Tab Batch Count - All Tabs", () => {
  // Simulate the countByBatch logic from Profile.tsx
  function countByBatch(orders: Array<{ batchRef?: string | null }>) {
    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of orders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }
    return count;
  }

  it("counts standalone orders individually", () => {
    const orders = [
      { batchRef: null },
      { batchRef: null },
      { batchRef: null },
    ];
    expect(countByBatch(orders)).toBe(3);
  });

  it("counts batch orders as one unit", () => {
    const orders = [
      { batchRef: "BATCH-001" },
      { batchRef: "BATCH-001" },
    ];
    expect(countByBatch(orders)).toBe(1);
  });

  it("counts mixed batch and standalone correctly", () => {
    const orders = [
      { batchRef: "BATCH-001" },
      { batchRef: "BATCH-001" },
      { batchRef: null },
      { batchRef: "BATCH-002" },
      { batchRef: "BATCH-002" },
      { batchRef: "BATCH-002" },
    ];
    // BATCH-001 = 1, standalone = 1, BATCH-002 = 1 → total 3
    expect(countByBatch(orders)).toBe(3);
  });

  it("counts empty array as 0", () => {
    expect(countByBatch([])).toBe(0);
  });

  it("counts all-batch orders correctly", () => {
    const orders = [
      { batchRef: "BATCH-A" },
      { batchRef: "BATCH-A" },
      { batchRef: "BATCH-B" },
    ];
    expect(countByBatch(orders)).toBe(2);
  });

  it("active tab uses batch count (not individual order count)", () => {
    const STATUS_GROUPS = {
      active: ["payment_submitted", "payment_confirmed", "processing", "shipped"],
    };
    const allOrders = [
      { batchRef: "BATCH-001", orderStatus: "processing" },
      { batchRef: "BATCH-001", orderStatus: "processing" },
      { batchRef: null, orderStatus: "shipped" },
    ];
    const activeOrders = allOrders.filter(o => STATUS_GROUPS.active.includes(o.orderStatus));
    expect(countByBatch(activeOrders)).toBe(2); // 1 batch + 1 standalone
    expect(activeOrders.length).toBe(3); // raw count would be 3 (wrong)
  });

  it("done tab uses batch count (not individual order count)", () => {
    const STATUS_GROUPS = {
      done: ["completed", "cancelled"],
    };
    const allOrders = [
      { batchRef: "BATCH-X", orderStatus: "completed" },
      { batchRef: "BATCH-X", orderStatus: "completed" },
      { batchRef: "BATCH-X", orderStatus: "completed" },
      { batchRef: null, orderStatus: "cancelled" },
    ];
    const doneOrders = allOrders.filter(o => STATUS_GROUPS.done.includes(o.orderStatus));
    expect(countByBatch(doneOrders)).toBe(2); // 1 batch + 1 standalone
    expect(doneOrders.length).toBe(4); // raw count would be 4 (wrong)
  });
});

describe("Payment Countdown Logic", () => {
  // Simulate the useBatchPaymentCountdown calculation logic
  function calcCountdown(createdAt: Date | string, timeoutMinutes: number) {
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    const diff = deadline - Date.now();
    if (diff <= 0) return { minutes: 0, seconds: 0, expired: true };
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { minutes, seconds, expired: false };
  }

  it("returns expired=true for past deadline", () => {
    const past = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago
    const result = calcCountdown(past, 30);
    expect(result.expired).toBe(true);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it("returns correct time for future deadline", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    const result = calcCountdown(recent, 30); // 30 min timeout → 25 min left
    expect(result.expired).toBe(false);
    expect(result.minutes).toBeGreaterThanOrEqual(24);
    expect(result.minutes).toBeLessThanOrEqual(25);
  });

  it("uses custom timeout minutes correctly", () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const result = calcCountdown(recent, 60); // 60 min timeout → ~50 min left
    expect(result.expired).toBe(false);
    expect(result.minutes).toBeGreaterThanOrEqual(49);
    expect(result.minutes).toBeLessThanOrEqual(50);
  });

  it("returns expired=false for just-created order", () => {
    const justNow = new Date(Date.now() - 1000); // 1 second ago
    const result = calcCountdown(justNow, 30);
    expect(result.expired).toBe(false);
    expect(result.minutes).toBe(29);
  });

  it("handles string date input", () => {
    const past = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const result = calcCountdown(past, 30);
    expect(result.expired).toBe(true);
  });
});
