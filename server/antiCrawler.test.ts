/**
 * Anti-Crawler Mechanism Tests
 * 
 * 測試反爬取機制的各項功能：
 * 1. IP 封鎖和解封
 * 2. User-Agent 黑名單檢測
 * 3. 請求日誌記錄
 * 4. 異常請求模式分析
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockIP,
  isIPBlocked,
  unblockIP,
  getBlockedIPs,
  getRequestLogs,
  analyzeRequestPatterns,
} from './middleware/antiCrawler';

describe('Anti-Crawler Mechanism', () => {
  describe('IP Blocking', () => {
    beforeEach(() => {
      // 清理所有被封鎖的 IP
      const blockedIPs = getBlockedIPs();
      blockedIPs.forEach(b => unblockIP(b.ip));
    });

    it('should block an IP address', () => {
      const testIP = '192.168.1.100';
      blockIP(testIP, 'Test blocking', 60000);
      
      expect(isIPBlocked(testIP)).toBe(true);
    });

    it('should unblock an IP address', () => {
      const testIP = '192.168.1.101';
      blockIP(testIP, 'Test blocking', 60000);
      expect(isIPBlocked(testIP)).toBe(true);
      
      const success = unblockIP(testIP);
      expect(success).toBe(true);
      expect(isIPBlocked(testIP)).toBe(false);
    });

    it('should return false when unblocking non-existent IP', () => {
      const testIP = '192.168.1.102';
      const success = unblockIP(testIP);
      expect(success).toBe(false);
    });

    it('should list all blocked IPs', () => {
      const testIPs = ['192.168.1.103', '192.168.1.104', '192.168.1.105'];
      testIPs.forEach(ip => blockIP(ip, 'Test blocking', 60000));
      
      const blockedIPs = getBlockedIPs();
      expect(blockedIPs.length).toBeGreaterThanOrEqual(3);
      
      const blockedIPAddresses = blockedIPs.map(b => b.ip);
      testIPs.forEach(ip => {
        expect(blockedIPAddresses).toContain(ip);
      });
    });

    it('should include block reason and expiry time', () => {
      const testIP = '192.168.1.106';
      const reason = 'Excessive rate limit violations';
      const duration = 60000;
      
      blockIP(testIP, reason, duration);
      
      const blockedIPs = getBlockedIPs();
      const blocked = blockedIPs.find(b => b.ip === testIP);
      
      expect(blocked).toBeDefined();
      expect(blocked!.reason).toBe(reason);
      expect(blocked!.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should automatically unblock expired IPs', async () => {
      const testIP = '192.168.1.107';
      blockIP(testIP, 'Test expiry', 100); // 100ms
      
      expect(isIPBlocked(testIP)).toBe(true);
      
      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(isIPBlocked(testIP)).toBe(false);
    });
  });

  describe('Request Logging', () => {
    it('should return recent request logs', () => {
      const logs = getRequestLogs(10);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeLessThanOrEqual(10);
    });

    it('should include required fields in logs', () => {
      const logs = getRequestLogs(1);
      if (logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty('ip');
        expect(log).toHaveProperty('path');
        expect(log).toHaveProperty('method');
        expect(log).toHaveProperty('userAgent');
        expect(log).toHaveProperty('timestamp');
      }
    });
  });

  describe('Request Pattern Analysis', () => {
    it('should analyze request patterns', () => {
      const patterns = analyzeRequestPatterns();
      
      expect(patterns).toHaveProperty('suspiciousIPs');
      expect(patterns).toHaveProperty('topUserAgents');
      expect(patterns).toHaveProperty('topPaths');
      
      expect(Array.isArray(patterns.suspiciousIPs)).toBe(true);
      expect(Array.isArray(patterns.topUserAgents)).toBe(true);
      expect(Array.isArray(patterns.topPaths)).toBe(true);
    });

    it('should return top user agents with counts', () => {
      const patterns = analyzeRequestPatterns();
      
      patterns.topUserAgents.forEach(ua => {
        expect(ua).toHaveProperty('userAgent');
        expect(ua).toHaveProperty('count');
        expect(typeof ua.count).toBe('number');
      });
    });

    it('should return top paths with counts', () => {
      const patterns = analyzeRequestPatterns();
      
      patterns.topPaths.forEach(path => {
        expect(path).toHaveProperty('path');
        expect(path).toHaveProperty('count');
        expect(typeof path.count).toBe('number');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple concurrent blocks and unblocks', () => {
      const testIPs = Array.from({ length: 10 }, (_, i) => `192.168.1.${200 + i}`);
      
      // 封鎖所有 IP
      testIPs.forEach(ip => blockIP(ip, 'Concurrent test', 60000));
      
      // 驗證全部被封鎖
      testIPs.forEach(ip => {
        expect(isIPBlocked(ip)).toBe(true);
      });
      
      // 解封一半
      testIPs.slice(0, 5).forEach(ip => unblockIP(ip));
      
      // 驗證狀態
      testIPs.slice(0, 5).forEach(ip => {
        expect(isIPBlocked(ip)).toBe(false);
      });
      testIPs.slice(5).forEach(ip => {
        expect(isIPBlocked(ip)).toBe(true);
      });
    });

    it('should maintain data integrity across operations', () => {
      const testIP = '192.168.1.250';
      
      // 初始狀態
      expect(isIPBlocked(testIP)).toBe(false);
      
      // 封鎖
      blockIP(testIP, 'Integrity test', 60000);
      expect(isIPBlocked(testIP)).toBe(true);
      
      // 獲取列表
      const blockedIPs = getBlockedIPs();
      const found = blockedIPs.find(b => b.ip === testIP);
      expect(found).toBeDefined();
      expect(found!.reason).toBe('Integrity test');
      
      // 解封
      unblockIP(testIP);
      expect(isIPBlocked(testIP)).toBe(false);
      
      // 再次獲取列表
      const blockedIPsAfter = getBlockedIPs();
      const foundAfter = blockedIPsAfter.find(b => b.ip === testIP);
      expect(foundAfter).toBeUndefined();
    });
  });
});
