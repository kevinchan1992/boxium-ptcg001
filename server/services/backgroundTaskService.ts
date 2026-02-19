import { backgroundTasks, type BackgroundTask } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, desc } from "drizzle-orm";
import { scrapeSnkrdunkListings } from "./snkrdunkPlaywright";
import { clearSnkrdunkCacheByCardId } from "../db";

/**
 * Background Task Service
 * Manages long-running background tasks with progress tracking
 */

export type TaskType = "refresh_all_cards_cache";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface FailedCard {
  cardId: number;
  name: string;
  error: string;
  retryCount: number;
}

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
    failedCards?: string;
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
    .orderBy(desc(backgroundTasks.createdAt))
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
 * Process a single card with retry logic
 */
async function processCardWithRetry(
  card: { cardId: number; snkrdunkId: string; name: string },
  maxRetries = 3
): Promise<{ success: boolean; error?: string; retryCount: number }> {
  let lastError: string = "";
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Clear existing cache
      await clearSnkrdunkCacheByCardId(card.cardId);
      
      // Scrape new data
      const listings = await scrapeSnkrdunkListings(card.snkrdunkId);
      
      console.log(
        `[BackgroundTaskService] Card ${card.cardId} refreshed: ${listings.length} listings (attempt ${attempt + 1})`
      );
      
      return { success: true, retryCount: attempt };
    } catch (error: any) {
      lastError = error.message;
      console.error(
        `[BackgroundTaskService] Error processing card ${card.cardId} (attempt ${attempt + 1}/${maxRetries}):`,
        error.message
      );
      
      // Wait before retry (exponential backoff: 2s, 4s, 8s)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
      }
    }
  }
  
  return { success: false, error: lastError, retryCount: maxRetries };
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
  const failedCards: FailedCard[] = [];

  // Process cards in batches of 20 (increased from 10)
  const batchSize = 20;
  for (let i = 0; i < cards.length; i += batchSize) {
    // Check if task was cancelled
    const task = await getTask(taskId);
    if (task?.status === "cancelled") {
      console.log(`[BackgroundTaskService] Task ${taskId} was cancelled`);
      return;
    }

    const batch = cards.slice(i, i + batchSize);
    console.log(
      `[BackgroundTaskService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)} (${batchSize} cards in parallel)`
    );

    // Process batch in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      batch.map(async (card) => {
        // Update current item
        await updateTaskProgress(taskId, {
          currentItem: JSON.stringify({
            cardId: card.cardId,
            name: card.name,
            snkrdunkId: card.snkrdunkId,
          }),
        });

        console.log(`[BackgroundTaskService] Processing card ${card.cardId} (${card.name})`);

        const result = await processCardWithRetry(card);
        
        return {
          card,
          ...result,
        };
      })
    );

    // Process results
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { card, success, error, retryCount } = result.value;
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
          failedCards.push({
            cardId: card.cardId,
            name: card.name,
            error: error || "Unknown error",
            retryCount,
          });
        }
      } else {
        // Promise rejected (shouldn't happen with our error handling, but just in case)
        failureCount++;
      }
      
      processedCount++;
    }

    // Update progress after each batch
    await updateTaskProgress(taskId, {
      processedItems: processedCount,
      successCount,
      failureCount,
    });
  }

  // Mark task as completed and save failed cards
  await updateTaskProgress(taskId, {
    status: failureCount === 0 ? "completed" : "failed",
    completedAt: new Date(),
    errorMessage: failedCards.length > 0 
      ? `${failedCards.length} cards failed after retries` 
      : undefined,
    failedCards: failedCards.length > 0 ? JSON.stringify(failedCards) : undefined,
  });

  console.log(
    `[BackgroundTaskService] Task ${taskId} completed: ${successCount} success, ${failureCount} failures`
  );
  
  if (failedCards.length > 0) {
    console.log(`[BackgroundTaskService] Failed cards:`, failedCards.slice(0, 10));
  }
}
