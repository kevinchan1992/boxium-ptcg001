import { getDb } from './db';
import { scheduledTasks, BatchTaskProgress } from '../drizzle/schema_new';
import { eq, and, or, desc, lt, sql } from 'drizzle-orm';

/**
 * Batch Task Manager - Persistent task tracking using database
 * Replaces in-memory progress tracking to support server restarts and cross-page navigation
 */

/**
 * Create a new batch task
 */
export async function createBatchTask(
  taskType: 'batch_snkrdunk_update',
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
  taskType: 'batch_snkrdunk_update'
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
 * Cancel task (mark as completed to stop execution)
 */
export async function cancelTask(taskId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }

  await db
    .update(scheduledTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, taskId));

  console.log(`[BatchTaskManager] Task ${taskId} cancelled`);
}

/**
 * Check if task is cancelled/completed
 */
export async function isTaskCancelled(taskId: number): Promise<boolean> {
  const task = await getBatchTaskProgress(taskId);
  return task?.status === 'completed';
}

/**
 * Check if there's a running task of the same type
 */
export async function hasRunningTask(taskType: 'batch_snkrdunk_update'): Promise<boolean> {
  const task = await getLatestRunningTask(taskType);
  return task !== null;
}

/**
 * Get task history with pagination
 */
export async function getTaskHistory(options: {
  page?: number;
  pageSize?: number;
  taskType?: string;
  status?: string;
} = {}): Promise<{
  tasks: Array<{
    id: number;
    taskType: string;
    status: string;
    totalItems: number;
    processedItems: number;
    successCount: number;
    failureCount: number;
    progress: number;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date | null;
    durationMs: number | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const db = await getDb();
  if (!db) {
    return { tasks: [], total: 0, page: 1, pageSize: 20 };
  }

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions: any[] = [];
  if (options.taskType) {
    conditions.push(eq(scheduledTasks.taskType, options.taskType));
  }
  if (options.status) {
    conditions.push(eq(scheduledTasks.status, options.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(scheduledTasks)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  // Get paginated tasks
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(whereClause)
    .orderBy(desc(scheduledTasks.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    tasks: tasks.map(task => {
      // Calculate duration
      let durationMs: number | null = null;
      if (task.startedAt && task.completedAt) {
        durationMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      } else if (task.startedAt && task.status === 'running') {
        durationMs = Date.now() - new Date(task.startedAt).getTime();
      }

      return {
        id: task.id,
        taskType: task.taskType,
        status: task.status,
        totalItems: task.totalItems || 0,
        processedItems: task.processedItems || 0,
        successCount: task.successCount || 0,
        failureCount: task.failureCount || 0,
        progress: task.progress || 0,
        errorMessage: task.errorMessage || null,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        durationMs,
      };
    }),
    total,
    page,
    pageSize,
  };
}

/**
 * Clean old task records, keeping only the most recent N records
 */
export async function cleanOldTasks(keepCount: number = 50): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  // Get the ID threshold: keep the most recent keepCount records
  const recentTasks = await db
    .select({ id: scheduledTasks.id })
    .from(scheduledTasks)
    .orderBy(desc(scheduledTasks.createdAt))
    .limit(keepCount);

  if (recentTasks.length < keepCount) {
    // Not enough records to clean
    return 0;
  }

  const oldestKeptId = recentTasks[recentTasks.length - 1].id;

  // Delete records older than the threshold (but not running/paused tasks)
  const result = await db
    .delete(scheduledTasks)
    .where(
      and(
        lt(scheduledTasks.id, oldestKeptId),
        // Don't delete running or paused tasks
        sql`${scheduledTasks.status} NOT IN ('running', 'paused')`
      )
    );

  const deletedCount = Number((result as any)[0]?.affectedRows || 0);
  console.log(`[BatchTaskManager] Cleaned ${deletedCount} old task records (kept ${keepCount} most recent)`);
  return deletedCount;
}

/**
 * Recover stalled tasks on server startup.
 * Detects tasks with status='running' but no progress update for >30 minutes,
 * and marks them as 'failed' with an appropriate error message.
 * 
 * This should be called once during server startup to clean up orphaned tasks
 * from previous server instances that died unexpectedly.
 */
export async function recoverStalledTasks(stalledThresholdMinutes: number = 30): Promise<{
  recoveredCount: number;
  recoveredTaskIds: number[];
}> {
  const db = await getDb();
  if (!db) {
    return { recoveredCount: 0, recoveredTaskIds: [] };
  }

  const thresholdDate = new Date(Date.now() - stalledThresholdMinutes * 60 * 1000);

  // Find all running/paused tasks that haven't been updated recently
  const stalledTasks = await db
    .select({
      id: scheduledTasks.id,
      taskType: scheduledTasks.taskType,
      status: scheduledTasks.status,
      processedItems: scheduledTasks.processedItems,
      totalItems: scheduledTasks.totalItems,
      updatedAt: scheduledTasks.updatedAt,
    })
    .from(scheduledTasks)
    .where(
      and(
        or(
          eq(scheduledTasks.status, 'running'),
          eq(scheduledTasks.status, 'paused')
        ),
        lt(scheduledTasks.updatedAt, thresholdDate)
      )
    );

  if (stalledTasks.length === 0) {
    console.log('[BatchTaskManager] No stalled tasks found on startup');
    return { recoveredCount: 0, recoveredTaskIds: [] };
  }

  const recoveredTaskIds: number[] = [];

  for (const task of stalledTasks) {
    const errorMsg = `Auto-recovered on server startup: task was ${task.status} but had no progress update since ${task.updatedAt?.toISOString() || 'unknown'}. Processed ${task.processedItems || 0}/${task.totalItems || 0} items before stalling.`;
    
    await db
      .update(scheduledTasks)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: errorMsg,
      })
      .where(eq(scheduledTasks.id, task.id));

    recoveredTaskIds.push(task.id);
    console.log(`[BatchTaskManager] Recovered stalled task ${task.id} (${task.taskType}): ${task.processedItems || 0}/${task.totalItems || 0} items processed`);
  }

  console.log(`[BatchTaskManager] Recovered ${recoveredTaskIds.length} stalled task(s) on startup: [${recoveredTaskIds.join(', ')}]`);
  return { recoveredCount: recoveredTaskIds.length, recoveredTaskIds };
}

/**
 * Check for stalled tasks (health check).
 * Returns tasks that are marked as 'running' but haven't been updated recently.
 * Unlike recoverStalledTasks, this does NOT modify the tasks - it only reports them.
 */
export async function checkStalledTasks(stalledThresholdMinutes: number = 30): Promise<Array<{
  id: number;
  taskType: string;
  status: string;
  processedItems: number;
  totalItems: number;
  lastUpdated: Date | null;
  stalledMinutes: number;
}>> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const thresholdDate = new Date(Date.now() - stalledThresholdMinutes * 60 * 1000);

  const stalledTasks = await db
    .select({
      id: scheduledTasks.id,
      taskType: scheduledTasks.taskType,
      status: scheduledTasks.status,
      processedItems: scheduledTasks.processedItems,
      totalItems: scheduledTasks.totalItems,
      updatedAt: scheduledTasks.updatedAt,
    })
    .from(scheduledTasks)
    .where(
      and(
        or(
          eq(scheduledTasks.status, 'running'),
          eq(scheduledTasks.status, 'paused')
        ),
        lt(scheduledTasks.updatedAt, thresholdDate)
      )
    );

  return stalledTasks.map(task => ({
    id: task.id,
    taskType: task.taskType,
    status: task.status,
    processedItems: task.processedItems || 0,
    totalItems: task.totalItems || 0,
    lastUpdated: task.updatedAt,
    stalledMinutes: task.updatedAt 
      ? Math.round((Date.now() - new Date(task.updatedAt).getTime()) / 60000)
      : -1,
  }));
}

export async function getTaskStats(): Promise<{
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  last7DaysStats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgDurationMs: number;
    totalItemsProcessed: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      last7DaysStats: { totalRuns: 0, successfulRuns: 0, failedRuns: 0, avgDurationMs: 0, totalItemsProcessed: 0 },
    };
  }

  // Overall counts - query all tasks and count in JS to avoid drizzle groupBy type issues
  const allTasks = await db
    .select({ status: scheduledTasks.status })
    .from(scheduledTasks);

  const counts: Record<string, number> = {};
  for (const row of allTasks) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }

  // Last 7 days stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        sql`${scheduledTasks.createdAt} >= ${sevenDaysAgo}`,
        eq(scheduledTasks.taskType, 'batch_snkrdunk_update')
      )
    );

  let totalRuns = recentTasks.length;
  let successfulRuns = 0;
  let failedRuns = 0;
  let totalDurationMs = 0;
  let durationCount = 0;
  let totalItemsProcessed = 0;

  for (const task of recentTasks) {
    if (task.status === 'completed') successfulRuns++;
    if (task.status === 'failed') failedRuns++;
    totalItemsProcessed += task.processedItems || 0;

    if (task.startedAt && task.completedAt) {
      totalDurationMs += new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      durationCount++;
    }
  }

  return {
    totalTasks: Object.values(counts).reduce((a, b) => a + b, 0),
    runningTasks: counts['running'] || 0,
    completedTasks: counts['completed'] || 0,
    failedTasks: counts['failed'] || 0,
    last7DaysStats: {
      totalRuns,
      successfulRuns,
      failedRuns,
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      totalItemsProcessed,
    },
  };
}
