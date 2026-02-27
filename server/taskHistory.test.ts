import { describe, it, expect, beforeAll } from "vitest";
import mysql from "mysql2/promise";

let conn: mysql.Connection;

beforeAll(async () => {
  conn = await mysql.createConnection(process.env.DATABASE_URL!);
});

describe("Task History API - Backend Functions", () => {
  it("should have getTaskHistory function that returns paginated results", async () => {
    const { getTaskHistory } = await import("./batchTaskManager");
    const result = await getTaskHistory({ page: 1, pageSize: 5 });
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("tasks");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("pageSize");
    // totalPages is calculated on frontend from total/pageSize
    expect(Array.isArray(result.tasks)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
  });

  it("should have getTaskStats function that returns statistics", async () => {
    const { getTaskStats } = await import("./batchTaskManager");
    const result = await getTaskStats();
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalTasks");
    expect(result).toHaveProperty("runningTasks");
    expect(result).toHaveProperty("completedTasks");
    expect(result).toHaveProperty("failedTasks");
    expect(result).toHaveProperty("last7DaysStats");
    expect(result.last7DaysStats).toHaveProperty("totalRuns");
    expect(result.last7DaysStats).toHaveProperty("successfulRuns");
    expect(result.last7DaysStats).toHaveProperty("failedRuns");
    expect(result.last7DaysStats).toHaveProperty("avgDurationMs");
    expect(result.last7DaysStats).toHaveProperty("totalItemsProcessed");
    expect(typeof result.totalTasks).toBe("number");
  });

  it("should filter tasks by status", async () => {
    const { getTaskHistory } = await import("./batchTaskManager");
    const result = await getTaskHistory({ page: 1, pageSize: 10, status: "running" });
    
    expect(result).toBeDefined();
    for (const task of result.tasks) {
      expect(task.status).toBe("running");
    }
  });

  it("should filter tasks by taskType", async () => {
    const { getTaskHistory } = await import("./batchTaskManager");
    const result = await getTaskHistory({ page: 1, pageSize: 10, taskType: "batch_snkrdunk_update" });
    
    expect(result).toBeDefined();
    for (const task of result.tasks) {
      expect(task.taskType).toBe("batch_snkrdunk_update");
    }
  });

  it("should return task history with correct fields", async () => {
    const { getTaskHistory } = await import("./batchTaskManager");
    const result = await getTaskHistory({ page: 1, pageSize: 1 });
    
    if (result.tasks.length > 0) {
      const task = result.tasks[0];
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("taskType");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("totalItems");
      expect(task).toHaveProperty("processedItems");
      expect(task).toHaveProperty("successCount");
      expect(task).toHaveProperty("failureCount");
      expect(task).toHaveProperty("progress");
      expect(task).toHaveProperty("durationMs");
      expect(typeof task.progress).toBe("number");
      expect(task.progress).toBeGreaterThanOrEqual(0);
      expect(task.progress).toBeLessThanOrEqual(100);
    }
  });

  it("should verify running task 330002 exists", async () => {
    const [rows] = await conn.execute(
      "SELECT * FROM scheduledTasks WHERE id = 330002"
    ) as any[];
    
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("running");
    expect(rows[0].taskType).toBe("batch_snkrdunk_update");
  });

  it("should have cleanOldTasks function", async () => {
    const { cleanOldTasks } = await import("./batchTaskManager");
    expect(typeof cleanOldTasks).toBe("function");
  });
});
