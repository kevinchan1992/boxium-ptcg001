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

  it("calculateTrendingCards should be listed in INTERNAL_PROCEDURES whitelist", async () => {
    const fs = await import("fs");
    const securityCode = fs.readFileSync("server/middleware/security.ts", "utf-8");
    expect(securityCode).toContain('"admin.calculateTrendingCards"');
  });

  it("/api/scheduled/calculateTrending route should be registered in index.ts", async () => {
    const fs = await import("fs");
    const indexCode = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(indexCode).toContain('"/api/scheduled/calculateTrending"');
    expect(indexCode).toContain("calculateAndCacheTrendingCards");
  });

  it("/api/scheduled/keepalive route should be registered in index.ts", async () => {
    const fs = await import("fs");
    const indexCode = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(indexCode).toContain('"/api/scheduled/keepalive"');
  });

  it("heartbeat.ts SDK should export createHeartbeatJob", async () => {
    const heartbeat = await import("./_core/heartbeat");
    expect(typeof heartbeat.createHeartbeatJob).toBe("function");
    expect(typeof heartbeat.listHeartbeatJobs).toBe("function");
    expect(typeof heartbeat.updateHeartbeatJob).toBe("function");
    expect(typeof heartbeat.deleteHeartbeatJob).toBe("function");
  });
});
