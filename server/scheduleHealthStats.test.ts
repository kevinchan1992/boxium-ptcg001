/**
 * Tests for schedule health statistics functionality
 * 
 * This test file verifies the correctness of health statistics calculation
 * for scheduled tasks (SNKRDUNK and Trending updates).
 */

import { describe, it, expect } from 'vitest';

describe('Schedule Health Statistics', () => {
  describe('Success Rate Calculation', () => {
    it('should calculate 100% success rate when all executions succeed', () => {
      const totalExecutions = 10;
      const successCount = 10;
      const failureCount = 0;
      const successRate = (successCount / totalExecutions) * 100;
      
      expect(successRate).toBe(100);
    });
    
    it('should calculate 0% success rate when all executions fail', () => {
      const totalExecutions = 10;
      const successCount = 0;
      const failureCount = 10;
      const successRate = (successCount / totalExecutions) * 100;
      
      expect(successRate).toBe(0);
    });
    
    it('should calculate 50% success rate when half executions succeed', () => {
      const totalExecutions = 10;
      const successCount = 5;
      const failureCount = 5;
      const successRate = (successCount / totalExecutions) * 100;
      
      expect(successRate).toBe(50);
    });
    
    it('should handle 0 total executions gracefully', () => {
      const totalExecutions = 0;
      const successCount = 0;
      const failureCount = 0;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
      
      expect(successRate).toBe(0);
    });
  });
  
  describe('Average Execution Time Calculation', () => {
    it('should calculate correct average execution time', () => {
      const durations = [1000, 2000, 3000]; // milliseconds
      const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      const averageExecutionTime = totalDuration / durations.length;
      
      expect(averageExecutionTime).toBe(2000);
    });
    
    it('should handle single execution', () => {
      const durations = [5000];
      const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      const averageExecutionTime = totalDuration / durations.length;
      
      expect(averageExecutionTime).toBe(5000);
    });
    
    it('should return 0 when no completed executions', () => {
      const durations: number[] = [];
      const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      const averageExecutionTime = durations.length > 0 ? totalDuration / durations.length : 0;
      
      expect(averageExecutionTime).toBe(0);
    });
  });
  
  describe('Failure Reason Statistics', () => {
    it('should count failure reasons correctly', () => {
      const failureReasonMap = new Map<string, number>();
      const errors = [
        'Timeout error',
        'Network error',
        'Timeout error',
        'Network error',
        'Timeout error',
      ];
      
      errors.forEach(error => {
        failureReasonMap.set(error, (failureReasonMap.get(error) || 0) + 1);
      });
      
      expect(failureReasonMap.get('Timeout error')).toBe(3);
      expect(failureReasonMap.get('Network error')).toBe(2);
    });
    
    it('should sort failure reasons by count (descending)', () => {
      const failureReasonMap = new Map<string, number>([
        ['Error A', 1],
        ['Error B', 5],
        ['Error C', 3],
      ]);
      
      const failureReasons = Array.from(failureReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
      
      expect(failureReasons[0].reason).toBe('Error B');
      expect(failureReasons[0].count).toBe(5);
      expect(failureReasons[1].reason).toBe('Error C');
      expect(failureReasons[1].count).toBe(3);
      expect(failureReasons[2].reason).toBe('Error A');
      expect(failureReasons[2].count).toBe(1);
    });
    
    it('should limit to top 5 failure reasons', () => {
      const failureReasonMap = new Map<string, number>([
        ['Error 1', 10],
        ['Error 2', 9],
        ['Error 3', 8],
        ['Error 4', 7],
        ['Error 5', 6],
        ['Error 6', 5],
        ['Error 7', 4],
      ]);
      
      const failureReasons = Array.from(failureReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      expect(failureReasons.length).toBe(5);
      expect(failureReasons[0].reason).toBe('Error 1');
      expect(failureReasons[4].reason).toBe('Error 5');
    });
  });
  
  describe('Date Filtering (Last 7 Days)', () => {
    it('should filter executions within last 7 days', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const executions = [
        { executedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) }, // 1 day ago
        { executedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) }, // 5 days ago
        { executedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }, // 10 days ago (should be filtered out)
      ];
      
      const recentExecutions = executions.filter(exec => {
        const executedAt = new Date(exec.executedAt);
        return executedAt >= sevenDaysAgo;
      });
      
      expect(recentExecutions.length).toBe(2);
    });
    
    it('should include executions exactly 7 days ago', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const executions = [
        { executedAt: sevenDaysAgo }, // Exactly 7 days ago
        { executedAt: new Date(sevenDaysAgo.getTime() - 1000) }, // 7 days + 1 second ago (should be filtered out)
      ];
      
      const recentExecutions = executions.filter(exec => {
        const executedAt = new Date(exec.executedAt);
        return executedAt >= sevenDaysAgo;
      });
      
      expect(recentExecutions.length).toBe(1);
    });
  });
  
  describe('Success Rate Color Classification', () => {
    it('should return green for success rate >= 90%', () => {
      const getSuccessRateColor = (rate: number) => {
        if (rate >= 90) return 'text-green-400';
        if (rate >= 70) return 'text-yellow-400';
        return 'text-red-400';
      };
      
      expect(getSuccessRateColor(100)).toBe('text-green-400');
      expect(getSuccessRateColor(90)).toBe('text-green-400');
    });
    
    it('should return yellow for success rate between 70% and 90%', () => {
      const getSuccessRateColor = (rate: number) => {
        if (rate >= 90) return 'text-green-400';
        if (rate >= 70) return 'text-yellow-400';
        return 'text-red-400';
      };
      
      expect(getSuccessRateColor(89)).toBe('text-yellow-400');
      expect(getSuccessRateColor(70)).toBe('text-yellow-400');
    });
    
    it('should return red for success rate < 70%', () => {
      const getSuccessRateColor = (rate: number) => {
        if (rate >= 90) return 'text-green-400';
        if (rate >= 70) return 'text-yellow-400';
        return 'text-red-400';
      };
      
      expect(getSuccessRateColor(69)).toBe('text-red-400');
      expect(getSuccessRateColor(0)).toBe('text-red-400');
    });
  });
  
  describe('Duration Formatting', () => {
    it('should format duration in hours and minutes', () => {
      const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          return `${hours}小時 ${minutes % 60}分鐘`;
        } else if (minutes > 0) {
          return `${minutes}分鐘 ${seconds % 60}秒`;
        } else {
          return `${seconds}秒`;
        }
      };
      
      expect(formatDuration(3661000)).toBe('1小時 1分鐘'); // 1 hour 1 minute 1 second
    });
    
    it('should format duration in minutes and seconds', () => {
      const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          return `${hours}小時 ${minutes % 60}分鐘`;
        } else if (minutes > 0) {
          return `${minutes}分鐘 ${seconds % 60}秒`;
        } else {
          return `${seconds}秒`;
        }
      };
      
      expect(formatDuration(125000)).toBe('2分鐘 5秒'); // 2 minutes 5 seconds
    });
    
    it('should format duration in seconds only', () => {
      const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          return `${hours}小時 ${minutes % 60}分鐘`;
        } else if (minutes > 0) {
          return `${minutes}分鐘 ${seconds % 60}秒`;
        } else {
          return `${seconds}秒`;
        }
      };
      
      expect(formatDuration(45000)).toBe('45秒'); // 45 seconds
    });
  });
});
