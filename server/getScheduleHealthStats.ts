/**
 * Get schedule execution health statistics for the last 7 days
 * 
 * This module provides functions to calculate health metrics for scheduled tasks,
 * including success rate, average execution time, and failure reason statistics.
 */

import * as db from './db';

export interface ScheduleHealthStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number; // Percentage (0-100)
  averageExecutionTime: number; // Milliseconds
  failureReasons: Array<{
    reason: string;
    count: number;
  }>;
}

/**
 * Get health statistics for a specific schedule type (last 7 days)
 */
export async function getScheduleHealthStats(
  scheduleType: 'snkrdunk_update' | 'trending_update'
): Promise<ScheduleHealthStats> {
  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Get all executions for this schedule type in the last 7 days
  const executions = await db.getScheduleExecutionHistory(scheduleType, 1000); // Get up to 1000 records
  
  // Filter to last 7 days
  const recentExecutions = executions.filter((exec: any) => {
    const executedAt = new Date(exec.executedAt);
    return executedAt >= sevenDaysAgo;
  });
  
  // Calculate statistics
  const totalExecutions = recentExecutions.length;
  const successCount = recentExecutions.filter((exec: any) => exec.status === 'completed').length;
  const failureCount = recentExecutions.filter((exec: any) => exec.status === 'failed').length;
  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
  
  // Calculate average execution time (only for completed executions)
  const completedExecutions = recentExecutions.filter((exec: any) => 
    exec.status === 'completed' && exec.duration !== null
  );
  const totalDuration = completedExecutions.reduce((sum: number, exec: any) => sum + (exec.duration || 0), 0);
  const averageExecutionTime = completedExecutions.length > 0 
    ? totalDuration / completedExecutions.length 
    : 0;
  
  // Count failure reasons
  const failureReasonMap = new Map<string, number>();
  recentExecutions
    .filter((exec: any) => exec.status === 'failed' && exec.errorMessage)
    .forEach((exec: any) => {
      const reason = exec.errorMessage || 'Unknown error';
      failureReasonMap.set(reason, (failureReasonMap.get(reason) || 0) + 1);
    });
  
  // Convert to array and sort by count (descending)
  const failureReasons = Array.from(failureReasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 failure reasons
  
  return {
    totalExecutions,
    successCount,
    failureCount,
    successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal place
    averageExecutionTime: Math.round(averageExecutionTime),
    failureReasons,
  };
}

/**
 * Get health statistics for all schedule types (last 7 days)
 */
export async function getAllScheduleHealthStats(): Promise<{
  snkrdunk: ScheduleHealthStats;
  trending: ScheduleHealthStats;
}> {
  const [snkrdunk, trending] = await Promise.all([
    getScheduleHealthStats('snkrdunk_update'),
    getScheduleHealthStats('trending_update'),
  ]);
  
  return {
    snkrdunk,
    trending,
  };
}
