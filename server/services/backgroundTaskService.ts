import { backgroundTasks, type BackgroundTask } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { scrapeSnkrdunkListings } from "./snkrdunkPlaywright";
import { clearSnkrdunkCacheByCardId } from "../db";

/**
 * Background Task Service
 * Manages long-running background tasks with progress tracking
 */

export type TaskType = "refresh_all_cards_cache";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Create a new background task
 */
export async function createTask(
  taskType: TaskType,
  totalItems: number
): Promise<BackgroundTask> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [task] = await db.insert(backgroundTasks).values({
    taskType,
    totalItems,
    status: "pending",
    processedItems: 0,
    successCount: 0,
    failureCount: 0,
  }).$returningId();

  const [createdTask] = await db
    .select()
    .from(backgroundTasks)
    .where(eq(backgroundTasks.id, task.id));

  return createdTask;
}

/**
 * Update task progress
 */
export async function updateTaskProgress(
  taskId: number,
  updates: {
    status?: TaskStatus;
    processedItems?: number;
    successCount?: number;
    failureCount?: number;
    currentItem?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db
    .update(backgroundTasks)
    .set(updates)
    .where(eq(backgroundTasks.id, taskId));
}

/**
 * Get task by ID
 */
export async function getTask(taskId: number): Promise<BackgroundTask | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [task] = await db
    .select()
    .from(backgroundTasks)
    .where(eq(backgroundTasks.id, taskId));
  return task;
}

/**
 * Get all tasks (ordered by creation time, newest first)
 */
export async function listTasks(limit = 10): Promise<BackgroundTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const tasks = await db
    .select()
    .from(backgroundTasks)
    .orderBy(backgroundTasks.createdAt)
    .limit(limit);
  return tasks;
}

/**
 * Cancel a running task
 */
export async function cancelTask(taskId: number): Promise<void> {
  await updateTaskProgress(taskId, {
    status: "cancelled",
    completedAt: new Date(),
  });
}

/**
 * Execute refresh all cards cache task
 */
export async function executeRefreshAllCardsCache(
  taskId: number,
  cards: Array<{ cardId: number; snkrdunkId: string; name: string }>
): Promise<void> {
  console.log(`[BackgroundTaskService] Starting task ${taskId} for ${cards.length} cards`);

  // Mark task as running
  await updateTaskProgress(taskId, {
    status: "running",
    startedAt: new Date(),
  });

  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  // Process cards in batches of 10
  const batchSize = 10;
  for (let i = 0; i < cards.length; i += batchSize) {
    // Check if task was cancelled
    const task = await getTask(taskId);
    if (task?.status === "cancelled") {
      console.log(`[BackgroundTaskService] Task ${taskId} was cancelled`);
      return;
    }

    const batch = cards.slice(i, i + batchSize);
    console.log(
      `[BackgroundTaskService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)}`
    );

    for (const card of batch) {
      try {
        // Update current item
        await updateTaskProgress(taskId, {
          currentItem: JSON.stringify({
            cardId: card.cardId,
            name: card.name,
            snkrdunkId: card.snkrdunkId,
          }),
        });

        console.log(`[BackgroundTaskService] Processing card ${card.cardId} (${card.name})`);

        // Clear existing cache
        await clearSnkrdunkCacheByCardId(card.cardId);

        // Scrape new data
        const listings = await scrapeSnkrdunkListings(card.snkrdunkId);

        console.log(
          `[BackgroundTaskService] Card ${card.cardId} refreshed: ${listings.length} listings`
        );

        successCount++;
      } catch (error: any) {
        console.error(
          `[BackgroundTaskService] Error processing card ${card.cardId}:`,
          error.message
        );
        failureCount++;
        errors.push(`Card ${card.cardId}: ${error.message}`);
      }

      processedCount++;

      // Update progress
      await updateTaskProgress(taskId, {
        processedItems: processedCount,
        successCount,
        failureCount,
      });
    }
  }

  // Mark task as completed
  await updateTaskProgress(taskId, {
    status: failureCount === 0 ? "completed" : "failed",
    completedAt: new Date(),
    errorMessage: errors.length > 0 ? errors.slice(0, 10).join("\n") : undefined,
  });

  console.log(
    `[BackgroundTaskService] Task ${taskId} completed: ${successCount} success, ${failureCount} failures`
  );
}
