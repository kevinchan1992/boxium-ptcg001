import { getDb } from './db';
import { scheduledTasks, BatchTaskProgress } from '../drizzle/schema';
import { eq, and, or } from 'drizzle-orm';

/**
 * Batch Task Manager - Persistent task tracking using database
 * Replaces in-memory progress tracking to support server restarts and cross-page navigation
 */

/**
 * Create a new batch task
 */
export async function createBatchTask(
  taskType: 'batch_ebay_update' | 'batch_snkrdunk_update',
  totalItems: number
): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const result = await db.insert(scheduledTasks).values({
    taskType,
    status: 'running',
    totalItems,
    processedItems: 0,
    successCount: 0,
    failureCount: 0,
    progress: 0,
    startedAt: new Date(),
    metadata: JSON.stringify({ errors: [] }),
  });

  const taskId = Number(result[0].insertId);
  console.log(`[BatchTaskManager] Created task ${taskId} (${taskType}) with ${totalItems} items`);
  return taskId;
}

/**
 * Get batch task progress
 */
export async function getBatchTaskProgress(taskId: number): Promise<BatchTaskProgress | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.id, taskId))
    .limit(1);

  if (tasks.length === 0) {
    return null;
  }

  const task = tasks[0];
  const metadata = task.metadata ? JSON.parse(task.metadata) : { errors: [] };

  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status as any,
    totalItems: task.totalItems || 0,
    processedItems: task.processedItems || 0,
    successCount: task.successCount || 0,
    failureCount: task.failureCount || 0,
    progress: task.progress || 0,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errors: metadata.errors || [],
  };
}

/**
 * Get the latest running task by type
 */
export async function getLatestRunningTask(
  taskType: 'batch_ebay_update' | 'batch_snkrdunk_update'
): Promise<BatchTaskProgress | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.taskType, taskType),
        or(
          eq(scheduledTasks.status, 'running'),
          eq(scheduledTasks.status, 'paused')
        )
      )
    )
    .orderBy(scheduledTasks.createdAt)
    .limit(1);

  if (tasks.length === 0) {
    return null;
  }

  const task = tasks[0];
  const metadata = task.metadata ? JSON.parse(task.metadata) : { errors: [] };

  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status as any,
    totalItems: task.totalItems || 0,
    processedItems: task.processedItems || 0,
    successCount: task.successCount || 0,
    failureCount: task.failureCount || 0,
    progress: task.progress || 0,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errors: metadata.errors || [],
  };
}

/**
 * Update task progress (success)
 */
export async function updateTaskProgressSuccess(taskId: number, recordsAdded: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  const task = await getBatchTaskProgress(taskId);
  if (!task) {
    return;
  }

  const processedItems = task.processedItems + 1;
  const successCount = task.successCount + 1;
  const progress = Math.round((processedItems / task.totalItems) * 100);

  await db
    .update(scheduledTasks)
    .set({
      processedItems,
      successCount,
      progress,
    })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} progress: ${processedItems}/${task.totalItems} (${progress}%)`);
}

/**
 * Update task progress (failure)
 */
export async function updateTaskProgressFailure(
  taskId: number,
  cardId: number,
  cardName: string,
  error: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  const task = await getBatchTaskProgress(taskId);
  if (!task) {
    return;
  }

  const processedItems = task.processedItems + 1;
  const failureCount = task.failureCount + 1;
  const progress = Math.round((processedItems / task.totalItems) * 100);

  // Add error to metadata
  const errors = task.errors || [];
  errors.push({ cardId, cardName, error });
  
  // Keep only last 100 errors to avoid metadata bloat
  const recentErrors = errors.slice(-100);

  await db
    .update(scheduledTasks)
    .set({
      processedItems,
      failureCount,
      progress,
      metadata: JSON.stringify({ errors: recentErrors }),
    })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} failure: ${cardName} - ${error}`);
}

/**
 * Pause task
 */
export async function pauseTask(taskId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db
    .update(scheduledTasks)
    .set({ status: 'paused' })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} paused`);
}

/**
 * Resume task
 */
export async function resumeTask(taskId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db
    .update(scheduledTasks)
    .set({ status: 'running' })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} resumed`);
}

/**
 * Check if task is paused
 */
export async function isTaskPaused(taskId: number): Promise<boolean> {
  const task = await getBatchTaskProgress(taskId);
  return task?.status === 'paused';
}

/**
 * Complete task
 */
export async function completeTask(taskId: number, status: 'completed' | 'failed' = 'completed'): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db
    .update(scheduledTasks)
    .set({
      status,
      completedAt: new Date(),
      progress: 100,
    })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} ${status}`);
}

/**
 * Check if there's a running task of the same type
 */
export async function hasRunningTask(taskType: 'batch_ebay_update' | 'batch_snkrdunk_update'): Promise<boolean> {
  const task = await getLatestRunningTask(taskType);
  return task !== null;
}
