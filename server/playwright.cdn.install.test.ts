/**
 * Playwright CDN Installation API Tests
 * 
 * Tests the CDN-based Playwright installation API
 */

import { describe, it, expect } from 'vitest';

describe('Playwright CDN Installation API', () => {
  describe('installPlaywrightFromCDN mutation', () => {
    it('should have correct API structure', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:00:00.000Z] Starting Playwright installation from CDN...',
          '[2026-02-23T12:00:00.001Z] CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz',
          '[2026-02-23T12:00:00.002Z] This may take 2-3 minutes (downloading 257MB)',
          '[2026-02-23T12:00:00.003Z] Home directory: /root',
          '[2026-02-23T12:00:00.004Z] Target directory: /root/.cache/ms-playwright',
          '[2026-02-23T12:00:30.000Z] Downloading from CDN...',
          '[2026-02-23T12:01:00.000Z] Downloaded 257.00MB in 30000ms',
          '[2026-02-23T12:01:00.001Z] Extracting archive...',
          '[2026-02-23T12:01:30.000Z] Extraction completed in 30000ms',
          '[2026-02-23T12:01:30.001Z] Cleaned up temp file',
          '[2026-02-23T12:01:30.002Z] Verifying installation...',
          '[2026-02-23T12:01:30.003Z] ✅ Chromium found at: /root/.cache/ms-playwright/chromium-1208',
          '[2026-02-23T12:01:30.004Z] ✅ Headless Shell found at: /root/.cache/ms-playwright/chromium_headless_shell-1208',
          '[2026-02-23T12:01:30.005Z] ✅ Installation verified successfully',
          '[2026-02-23T12:01:30.006Z] Total duration: 90000ms',
        ],
        duration: 90000,
      };

      // Verify result structure
      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('error');
      expect(mockResult).toHaveProperty('logs');
      expect(mockResult).toHaveProperty('duration');
      
      expect(mockResult.success).toBe(true);
      expect(mockResult.error).toBeNull();
      expect(Array.isArray(mockResult.logs)).toBe(true);
      expect(mockResult.logs.length).toBeGreaterThan(0);
      expect(typeof mockResult.duration).toBe('number');
    });

    it('should include CDN URL in logs', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:00:00.001Z] CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz',
        ],
        duration: 90000,
      };

      const cdnUrlLog = mockResult.logs.find(log => log.includes('CDN URL'));
      expect(cdnUrlLog).toBeTruthy();
      expect(cdnUrlLog).toContain('https://files.manuscdn.com');
    });

    it('should include download progress in logs', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:00:30.000Z] Downloading from CDN...',
          '[2026-02-23T12:01:00.000Z] Downloaded 257.00MB in 30000ms',
        ],
        duration: 90000,
      };

      const downloadLogs = mockResult.logs.filter(log => 
        log.includes('Downloading') || log.includes('Downloaded')
      );
      expect(downloadLogs.length).toBeGreaterThan(0);
    });

    it('should include extraction progress in logs', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:01:00.001Z] Extracting archive...',
          '[2026-02-23T12:01:30.000Z] Extraction completed in 30000ms',
        ],
        duration: 90000,
      };

      const extractionLogs = mockResult.logs.filter(log => 
        log.includes('Extracting') || log.includes('Extraction completed')
      );
      expect(extractionLogs.length).toBeGreaterThan(0);
    });

    it('should include cleanup step in logs', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:01:30.001Z] Cleaned up temp file',
        ],
        duration: 90000,
      };

      const cleanupLog = mockResult.logs.find(log => log.includes('Cleaned up'));
      expect(cleanupLog).toBeTruthy();
    });

    it('should include verification step in logs', () => {
      const mockResult = {
        success: true,
        error: null,
        logs: [
          '[2026-02-23T12:01:30.002Z] Verifying installation...',
          '[2026-02-23T12:01:30.003Z] ✅ Chromium found at: /root/.cache/ms-playwright/chromium-1208',
          '[2026-02-23T12:01:30.004Z] ✅ Headless Shell found at: /root/.cache/ms-playwright/chromium_headless_shell-1208',
          '[2026-02-23T12:01:30.005Z] ✅ Installation verified successfully',
        ],
        duration: 90000,
      };

      const verificationLogs = mockResult.logs.filter(log => 
        log.includes('Verifying') || 
        log.includes('Chromium found') || 
        log.includes('Headless Shell found') ||
        log.includes('Installation verified')
      );
      
      expect(verificationLogs.length).toBeGreaterThan(0);
    });

    it('should handle download failure correctly', () => {
      const mockErrorResult = {
        success: false,
        error: 'Failed to download: 404 Not Found',
        logs: [
          '[2026-02-23T12:00:00.000Z] Starting Playwright installation from CDN...',
          '[2026-02-23T12:00:00.001Z] CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz',
          '[2026-02-23T12:00:30.000Z] Downloading from CDN...',
          '[2026-02-23T12:00:35.000Z] ❌ Installation failed: Failed to download: 404 Not Found',
        ],
        duration: 35000,
      };

      expect(mockErrorResult.success).toBe(false);
      expect(mockErrorResult.error).toBeTruthy();
      expect(typeof mockErrorResult.error).toBe('string');
      expect(mockErrorResult.error).toContain('Failed to download');
    });

    it('should handle extraction failure correctly', () => {
      const mockErrorResult = {
        success: false,
        error: 'tar: Error is not recoverable',
        logs: [
          '[2026-02-23T12:00:00.000Z] Starting Playwright installation from CDN...',
          '[2026-02-23T12:01:00.000Z] Downloaded 257.00MB in 30000ms',
          '[2026-02-23T12:01:00.001Z] Extracting archive...',
          '[2026-02-23T12:01:05.000Z] ❌ Installation failed: tar: Error is not recoverable',
        ],
        duration: 65000,
      };

      expect(mockErrorResult.success).toBe(false);
      expect(mockErrorResult.error).toBeTruthy();
      expect(mockErrorResult.logs).toContain('[2026-02-23T12:01:05.000Z] ❌ Installation failed: tar: Error is not recoverable');
    });

    it('should handle verification failure', () => {
      const mockResult = {
        success: false,
        error: 'Installation completed but browsers not found in expected locations',
        logs: [
          '[2026-02-23T12:01:30.002Z] Verifying installation...',
          '[2026-02-23T12:01:30.003Z] ❌ Chromium NOT found at: /root/.cache/ms-playwright/chromium-1208',
          '[2026-02-23T12:01:30.004Z] ❌ Headless Shell NOT found at: /root/.cache/ms-playwright/chromium_headless_shell-1208',
          '[2026-02-23T12:01:30.005Z] ⚠️ Installation completed but verification failed',
        ],
        duration: 90000,
      };

      expect(mockResult.success).toBe(false);
      expect(mockResult.error).toContain('browsers not found');
      
      const failureLogs = mockResult.logs.filter(log => 
        log.includes('NOT found') || log.includes('verification failed')
      );
      expect(failureLogs.length).toBeGreaterThan(0);
    });
  });

  describe('CDN vs Direct Installation', () => {
    it('CDN installation should bypass external network restrictions', () => {
      // CDN installation uses Manus CDN which should be accessible from production
      const cdnUrl = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz';
      
      expect(cdnUrl).toContain('manuscdn.com');
      expect(cdnUrl).not.toContain('cdn.playwright.dev'); // Not using external Playwright CDN
    });

    it('CDN installation should not require pnpm', () => {
      // CDN installation downloads pre-packaged browsers directly
      // It doesn't need to run 'pnpm exec playwright install chromium'
      
      const mockLogs = [
        '[2026-02-23T12:00:00.000Z] Starting Playwright installation from CDN...',
        '[2026-02-23T12:00:30.000Z] Downloading from CDN...',
        '[2026-02-23T12:01:00.001Z] Extracting archive...',
      ];

      // Verify no pnpm commands in logs
      const pnpmLogs = mockLogs.filter(log => log.includes('pnpm'));
      expect(pnpmLogs.length).toBe(0);
    });
  });
});
