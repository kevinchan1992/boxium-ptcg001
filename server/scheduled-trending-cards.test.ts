import { describe, it, expect } from "vitest";

describe("Scheduled Trending Cards Endpoint", () => {
  it("CRON_SECRET environment variable should be set", () => {
    const cronSecret = process.env.CRON_SECRET;
    expect(cronSecret).toBeDefined();
    expect(cronSecret).not.toBe("");
    expect(cronSecret!.length).toBeGreaterThanOrEqual(32);
  });

  it("CRON_SECRET should be a valid hex string", () => {
    const cronSecret = process.env.CRON_SECRET!;
    expect(/^[0-9a-f]+$/i.test(cronSecret)).toBe(true);
  });
});
