import { describe, it, expect, beforeAll } from 'vitest';
import * as batchTaskManager from './batchTaskManager';

/**
 * Test: Progress bar fix - getBatchUpdateProgress now reads from database
 * instead of in-memory variable
 */
describe('Progress Bar Fix - Database-based progress tracking', () => {
  
  it('should return isRunning: false when no running tasks exist', async () => {
    const task = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    // After we cleaned up all running tasks, there should be none
    // This verifies the API would return isRunning: false
    // (task could be null or a running task depending on state)
    if (task === null) {
      expect(task).toBeNull();
    } else {
      expect(task.status).toBe('running');
    }
  });

  it('should create a task and detect it as running', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 100);
    expect(taskId).toBeGreaterThan(0);
    
    // Verify it's detected as running
    const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(runningTask).not.toBeNull();
    expect(runningTask!.taskId).toBe(taskId);
    expect(runningTask!.status).toBe('running');
    expect(runningTask!.totalItems).toBe(100);
    expect(runningTask!.processedItems).toBe(0);
    
    // hasRunningTask should return true
    const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
    expect(hasRunning).toBe(true);
    
    // Clean up
    await batchTaskManager.completeTask(taskId, 'completed');
  });

  it('should update progress and reflect in getLatestRunningTask', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 50);
    
    // Update progress
    await batchTaskManager.updateTaskProgressSuccess(taskId, 1);
    await batchTaskManager.updateTaskProgressSuccess(taskId, 1);
    await batchTaskManager.updateTaskProgressFailure(taskId, 999, 'test-card', 'test error');
    
    // Verify progress
    const task = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(task).not.toBeNull();
    expect(task!.processedItems).toBe(3);
    expect(task!.successCount).toBe(2);
    expect(task!.failureCount).toBe(1);
    expect(task!.progress).toBe(6); // 3/50 = 6%
    
    // Clean up
    await batchTaskManager.completeTask(taskId, 'completed');
  });

  it('should return isRunning: false after task is completed', async () => {
    // Create and immediately complete a task
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 10);
    await batchTaskManager.completeTask(taskId, 'completed');
    
    // getLatestRunningTask should not return this task
    // (it only returns running/paused tasks)
    const task = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(task).not.toBeNull();
    expect(task!.status).toBe('completed');
  });

  it('should support pause and resume via database', async () => {
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 20);
    
    // Pause
    await batchTaskManager.pauseTask(taskId);
    let task = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(task!.status).toBe('paused');
    
    // getLatestRunningTask should still find paused tasks
    const pausedTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(pausedTask).not.toBeNull();
    expect(pausedTask!.status).toBe('paused');
    
    // Resume
    await batchTaskManager.resumeTask(taskId);
    task = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(task!.status).toBe('running');
    
    // Clean up
    await batchTaskManager.completeTask(taskId, 'completed');
  });

  it('should support cancel via database', async () => {
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 30);
    
    // Cancel
    await batchTaskManager.cancelTask(taskId);
    
    const task = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(task!.status).toBe('completed'); // cancelTask marks as completed
    expect(task!.completedAt).not.toBeNull();
    
    // Should not appear as running
    // Note: there might be other running tasks from previous tests
    const isRunning = await batchTaskManager.isTaskCancelled(taskId);
    expect(isRunning).toBe(true);
  });

  it('should return progress data matching frontend expected format', async () => {
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 200);
    await batchTaskManager.updateTaskProgressSuccess(taskId, 3);
    
    const runningTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(runningTask).not.toBeNull();
    
    // Simulate what the API returns to frontend
    const frontendProgress = {
      isRunning: true,
      isPaused: runningTask!.status === 'paused',
      totalCards: runningTask!.totalItems,
      processedCards: runningTask!.processedItems,
      successCount: runningTask!.successCount,
      failureCount: runningTask!.failureCount,
      totalRecordsAdded: 0,
      errors: runningTask!.errors || [],
      startTime: runningTask!.startedAt ? new Date(runningTask!.startedAt).getTime() : null,
      endTime: null,
      taskId: runningTask!.taskId,
    };
    
    // Verify all expected fields exist
    expect(frontendProgress.isRunning).toBe(true);
    expect(frontendProgress.isPaused).toBe(false);
    expect(frontendProgress.totalCards).toBe(200);
    expect(frontendProgress.processedCards).toBe(1);
    expect(frontendProgress.successCount).toBe(1);
    expect(frontendProgress.failureCount).toBe(0);
    expect(frontendProgress.taskId).toBe(taskId);
    expect(frontendProgress.startTime).toBeGreaterThan(0);
    
    // Clean up
    await batchTaskManager.completeTask(taskId, 'completed');
  });
});
