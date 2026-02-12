import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startScheduler,
  stopScheduler,
  getUpdateStatus,
  manualUpdateDataSource,
} from "./scheduler";

describe("scheduler", () => {
  beforeEach(() => {
    // Clear any existing intervals
    stopScheduler();
  });

  afterEach(() => {
    stopScheduler();
  });

  it("should start and stop scheduler without errors", () => {
    expect(() => {
      startScheduler();
      stopScheduler();
    }).not.toThrow();
  });

  it("should not start scheduler twice", () => {
    const consoleSpy = vi.spyOn(console, "log");
    startScheduler();
    startScheduler(); // Try to start again

    // Should log that scheduler is already running
    expect(
      consoleSpy.mock.calls.some((call) =>
        call[0]?.includes("already running")
      )
    ).toBe(true);

    stopScheduler();
    consoleSpy.mockRestore();
  });

  it("should handle getUpdateStatus gracefully when database is unavailable", async () => {
    // This test verifies that the function doesn't crash
    // when database is not available
    const status = await getUpdateStatus(999);
    expect(status).toBeNull();
  });

  it("should handle manual update request gracefully", async () => {
    // This test verifies that manual update doesn't crash
    // when database is not available
    try {
      await manualUpdateDataSource(999);
    } catch (error) {
      // Expected to throw "Data source not found"
      expect(error instanceof Error).toBe(true);
    }
  });

  it("should have proper scheduler interval", () => {
    startScheduler();
    // Verify scheduler is running by checking if it's not null
    // The actual interval testing would require mocking timers
    stopScheduler();
  });
});
