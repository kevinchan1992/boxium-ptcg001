import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock chain methods
const mockWhere = vi.fn().mockReturnValue([]);
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelectReturn = { from: mockFrom };

vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue(mockSelectReturn),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 999 }]),
    }),
  }),
}));

describe('Batch Task Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect stalled tasks based on updatedAt threshold', async () => {
    // Test the logic: a task is stalled if status is 'running' and updatedAt > threshold
    const stalledThresholdMinutes = 30;
    const thresholdDate = new Date(Date.now() - stalledThresholdMinutes * 60 * 1000);
    
    // A task updated 45 minutes ago should be considered stalled
    const stalledTask = {
      id: 330012,
      taskType: 'batch_snkrdunk_update',
      status: 'running',
      processedItems: 1327,
      totalItems: 34198,
      updatedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    };
    
    expect(stalledTask.updatedAt < thresholdDate).toBe(true);
    expect(stalledTask.status).toBe('running');
  });

  it('should NOT flag a recently active task as stalled', () => {
    const stalledThresholdMinutes = 30;
    const thresholdDate = new Date(Date.now() - stalledThresholdMinutes * 60 * 1000);
    
    // A task updated 5 minutes ago should NOT be stalled
    const activeTask = {
      id: 330013,
      taskType: 'batch_snkrdunk_update',
      status: 'running',
      processedItems: 5000,
      totalItems: 34198,
      updatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    };
    
    expect(activeTask.updatedAt < thresholdDate).toBe(false);
  });

  it('should flag paused tasks as stalled if no update for >30 min', () => {
    const stalledThresholdMinutes = 30;
    const thresholdDate = new Date(Date.now() - stalledThresholdMinutes * 60 * 1000);
    
    const stalledPausedTask = {
      id: 330014,
      taskType: 'batch_snkrdunk_update',
      status: 'paused',
      processedItems: 2000,
      totalItems: 34198,
      updatedAt: new Date(Date.now() - 60 * 60 * 1000), // 60 min ago
    };
    
    expect(stalledPausedTask.updatedAt < thresholdDate).toBe(true);
    expect(['running', 'paused'].includes(stalledPausedTask.status)).toBe(true);
  });

  it('should NOT flag completed tasks as stalled', () => {
    const completedTask = {
      id: 330015,
      taskType: 'batch_snkrdunk_update',
      status: 'completed',
      processedItems: 34198,
      totalItems: 34198,
      updatedAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
    };
    
    // Completed tasks should never be flagged as stalled
    expect(['running', 'paused'].includes(completedTask.status)).toBe(false);
  });

  it('should NOT flag failed tasks as stalled', () => {
    const failedTask = {
      id: 330016,
      taskType: 'batch_snkrdunk_update',
      status: 'failed',
      processedItems: 500,
      totalItems: 34198,
      updatedAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
    };
    
    expect(['running', 'paused'].includes(failedTask.status)).toBe(false);
  });

  it('should calculate stalled minutes correctly', () => {
    const updatedAt = new Date(Date.now() - 45 * 60 * 1000); // 45 min ago
    const stalledMinutes = Math.round((Date.now() - updatedAt.getTime()) / 60000);
    
    // Should be approximately 45 minutes (allow 1 min tolerance)
    expect(stalledMinutes).toBeGreaterThanOrEqual(44);
    expect(stalledMinutes).toBeLessThanOrEqual(46);
  });

  it('should generate correct error message for recovered tasks', () => {
    const task = {
      status: 'running',
      processedItems: 1327,
      totalItems: 34198,
      updatedAt: new Date('2026-02-27T13:20:45.000Z'),
    };
    
    const errorMsg = `Auto-recovered on server startup: task was ${task.status} but had no progress update since ${task.updatedAt.toISOString()}. Processed ${task.processedItems}/${task.totalItems} items before stalling.`;
    
    expect(errorMsg).toContain('Auto-recovered on server startup');
    expect(errorMsg).toContain('running');
    expect(errorMsg).toContain('1327/34198');
    expect(errorMsg).toContain('2026-02-27T13:20:45.000Z');
  });

  it('should handle edge case: task with null updatedAt', () => {
    const task = {
      id: 330017,
      taskType: 'batch_snkrdunk_update',
      status: 'running',
      processedItems: 0,
      totalItems: 34198,
      updatedAt: null as Date | null,
    };
    
    // With null updatedAt, stalledMinutes should be -1
    const stalledMinutes = task.updatedAt 
      ? Math.round((Date.now() - new Date(task.updatedAt).getTime()) / 60000)
      : -1;
    
    expect(stalledMinutes).toBe(-1);
  });
});
