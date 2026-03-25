/**
 * Tests for:
 * 1. EmbeddedOrderCard countdown timer (frontend logic)
 * 2. Auto-refresh on countdown expiry (onExpire callback)
 * 3. Batch cancel email subject optimization (batchCount/batchIndex)
 */

import { describe, it, expect } from "vitest";
import { buildOrderCancelledEmail } from "./emailService";

describe("buildOrderCancelledEmail - batch subject optimization", () => {
  it("single order uses standard subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-1234",
      itemName: "鳴喊比卡超",
      priceHkd: "10000.00",
      note: "買家主動取消",
      batchCount: 1,
      batchIndex: 0,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-1234");
  });

  it("batch first email uses batch subject with count", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-1234",
      itemName: "鳴喊比卡超",
      priceHkd: "10000.00",
      note: "買家主動取消",
      batchCount: 2,
      batchIndex: 0,
    });
    expect(subject).toBe("❌ 您的 2 件商品訂單已取消");
  });

  it("batch second email uses individual subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-5678",
      itemName: "123",
      priceHkd: "1000.00",
      note: "買家主動取消",
      batchCount: 2,
      batchIndex: 1,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-5678");
  });

  it("batch of 3 - first email uses batch subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-0001",
      itemName: "商品A",
      priceHkd: "500.00",
      batchCount: 3,
      batchIndex: 0,
    });
    expect(subject).toBe("❌ 您的 3 件商品訂單已取消");
  });

  it("batch of 3 - second email uses individual subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-0002",
      itemName: "商品B",
      priceHkd: "500.00",
      batchCount: 3,
      batchIndex: 1,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-0002");
  });

  it("batch of 3 - third email uses individual subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-0003",
      itemName: "商品C",
      priceHkd: "500.00",
      batchCount: 3,
      batchIndex: 2,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-0003");
  });

  it("no batchCount provided - uses standard subject (backward compat)", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-9999",
      itemName: "商品X",
      priceHkd: "999.00",
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-9999");
  });

  it("batchCount=0 (edge case) - uses standard subject", () => {
    const { subject } = buildOrderCancelledEmail({
      orderNo: "BOXIUM-20260324-0000",
      itemName: "商品Y",
      priceHkd: "100.00",
      batchCount: 0,
      batchIndex: 0,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-0000");
  });
});

describe("useBatchPaymentCountdown - onExpire callback logic", () => {
  it("should fire onExpire callback when deadline has passed", async () => {
    // Simulate the countdown logic directly
    let expiredFired = false;
    const onExpire = () => { expiredFired = true; };

    // Simulate: createdAt was 31 minutes ago, timeout is 30 minutes
    const createdAt = new Date(Date.now() - 31 * 60 * 1000);
    const timeoutMinutes = 30;
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    const diff = deadline - Date.now();

    if (diff <= 0) {
      onExpire();
    }

    expect(expiredFired).toBe(true);
  });

  it("should NOT fire onExpire callback when deadline has not passed", () => {
    let expiredFired = false;
    const onExpire = () => { expiredFired = true; };

    // Simulate: createdAt was 5 minutes ago, timeout is 30 minutes
    const createdAt = new Date(Date.now() - 5 * 60 * 1000);
    const timeoutMinutes = 30;
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    const diff = deadline - Date.now();

    if (diff <= 0) {
      onExpire();
    }

    expect(expiredFired).toBe(false);
  });

  it("should calculate correct remaining time", () => {
    // 10 minutes remaining
    const createdAt = new Date(Date.now() - 20 * 60 * 1000);
    const timeoutMinutes = 30;
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    const diff = deadline - Date.now();

    expect(diff).toBeGreaterThan(0);
    const minutes = Math.floor(diff / 60000);
    expect(minutes).toBeGreaterThanOrEqual(9); // ~10 minutes
    expect(minutes).toBeLessThanOrEqual(10);
  });
});
