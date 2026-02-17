import { describe, it, expect } from 'vitest';
import * as batchTaskManager from './batchTaskManager';

describe('Persistent Batch Update System', () => {
  it('should create a batch task and track progress', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_ebay_update', 10);
    expect(taskId).toBeGreaterThan(0);

    // Get task progress
    const progress = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(progress).toBeDefined();
    expect(progress?.taskId).toBe(taskId);
    expect(progress?.taskType).toBe('batch_ebay_update');
    expect(progress?.status).toBe('running');
    expect(progress?.totalItems).toBe(10);
    expect(progress?.processedItems).toBe(0);
    expect(progress?.successCount).toBe(0);
    expect(progress?.failureCount).toBe(0);
    expect(progress?.progress).toBe(0);
  });

  it('should update task progress correctly', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 5);

    // Simulate processing items
    await batchTaskManager.updateTaskProgressSuccess(taskId, 3);
    await batchTaskManager.updateTaskProgressSuccess(taskId, 2);
    await batchTaskManager.updateTaskProgressFailure(taskId, 123, 'Test Card', 'Test error');

    // Check progress
    const progress = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(progress?.processedItems).toBe(3);
    expect(progress?.successCount).toBe(2);
    expect(progress?.failureCount).toBe(1);
    expect(progress?.progress).toBe(60); // 3/5 = 60%
    expect(progress?.errors).toHaveLength(1);
    expect(progress?.errors[0].cardName).toBe('Test Card');
  });

  it('should pause and resume tasks', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_ebay_update', 10);

    // Pause task
    await batchTaskManager.pauseTask(taskId);
    let isPaused = await batchTaskManager.isTaskPaused(taskId);
    expect(isPaused).toBe(true);

    // Resume task
    await batchTaskManager.resumeTask(taskId);
    isPaused = await batchTaskManager.isTaskPaused(taskId);
    expect(isPaused).toBe(false);
  });

  it('should complete tasks', async () => {
    // Create a test task
    const taskId = await batchTaskManager.createBatchTask('batch_ebay_update', 10);

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');

    // Check status
    const progress = await batchTaskManager.getBatchTaskProgress(taskId);
    expect(progress?.status).toBe('completed');
    expect(progress?.progress).toBe(100);
    expect(progress?.completedAt).toBeDefined();
  });

  it('should detect running tasks', async () => {
    // Check if there's a running task
    const hasRunning1 = await batchTaskManager.hasRunningTask('batch_ebay_update');
    
    // Create a new task
    const taskId = await batchTaskManager.createBatchTask('batch_ebay_update', 10);
    
    // Should detect the running task
    const hasRunning2 = await batchTaskManager.hasRunningTask('batch_ebay_update');
    expect(hasRunning2).toBe(true);

    // Complete the task
    await batchTaskManager.completeTask(taskId, 'completed');

    // Should not detect running task after completion
    const hasRunning3 = await batchTaskManager.hasRunningTask('batch_ebay_update');
    expect(hasRunning3).toBe(false);
  });

  it('should get latest running task', async () => {
    // Create multiple tasks
    const taskId1 = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 10);
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit
    const taskId2 = await batchTaskManager.createBatchTask('batch_snkrdunk_update', 20);

    // Get latest running task
    const latestTask = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(latestTask).toBeDefined();
    expect(latestTask?.taskId).toBe(taskId1); // Should return the first created task (oldest)

    // Complete first task
    await batchTaskManager.completeTask(taskId1, 'completed');

    // Now should get the second task
    const latestTask2 = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    expect(latestTask2?.taskId).toBe(taskId2);
  });
});
