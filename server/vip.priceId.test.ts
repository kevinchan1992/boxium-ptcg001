/**
 * Validates that Stripe VIP Price ID environment variables are configured.
 * These are required for the VIP subscription checkout to work in production.
 */
import { describe, it, expect } from "vitest";

describe("Stripe VIP Price ID configuration", () => {
  it("should have STRIPE_VIP_MONTHLY_PRICE_ID set", () => {
    const priceId = process.env.STRIPE_VIP_MONTHLY_PRICE_ID;
    expect(priceId).toBeTruthy();
    expect(priceId).toMatch(/^price_/);
  });

  it("should have STRIPE_VIP_YEARLY_PRICE_ID set", () => {
    const priceId = process.env.STRIPE_VIP_YEARLY_PRICE_ID;
    expect(priceId).toBeTruthy();
    expect(priceId).toMatch(/^price_/);
  });

  it("should have STRIPE_SECRET_KEY set", () => {
    const key = process.env.STRIPE_SECRET_KEY;
    expect(key).toBeTruthy();
    // Should be either test or live key
    expect(key).toMatch(/^sk_(test|live)_/);
  });
});
