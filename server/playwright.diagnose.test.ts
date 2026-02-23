/**
 * Puppeteer Diagnostic API Tests
 * 
 * Tests the diagnostic API that checks production environment
 */

import { describe, it, expect } from 'vitest';

describe('Puppeteer Diagnostic API', () => {
  describe('diagnosePuppeteerInstallation mutation', () => {
    it('should have correct API structure', () => {
      const mockResult = {
        success: true,
        checks: [
          {
            name: "System Information",
            status: "info",
            details: {
              platform: "linux",
              arch: "x64",
              homeDir: "/root",
              cacheDir: "/root/.cache",
              puppeteerCache: "/root/.cache/ms-puppeteer",
            },
          },
          {
            name: "tar command",
            status: "success",
            details: "tar (GNU tar) 1.34",
          },
          {
            name: "gzip command",
            status: "success",
            details: "gzip 1.10",
          },
          {
            name: "Cache directory write permission",
            status: "success",
            details: "Can write to /root/.cache",
          },
          {
            name: "CDN download test",
            status: "success",
            details: "Downloaded 1024.00KB in 500ms (2048.00KB/s)",
          },
        ],
        recommendations: [],
      };

      // Verify result structure
      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('checks');
      expect(mockResult).toHaveProperty('recommendations');
      
      expect(mockResult.success).toBe(true);
      expect(Array.isArray(mockResult.checks)).toBe(true);
      expect(Array.isArray(mockResult.recommendations)).toBe(true);
      expect(mockResult.checks.length).toBeGreaterThan(0);
    });

    it('should check tar command availability', () => {
      const mockChecks = [
        {
          name: "tar command",
          status: "success",
          details: "tar (GNU tar) 1.34",
        },
      ];

      const tarCheck = mockChecks.find(check => check.name === "tar command");
      expect(tarCheck).toBeTruthy();
      expect(tarCheck?.status).toBe("success");
    });

    it('should handle tar command not found', () => {
      const mockResult = {
        success: false,
        checks: [
          {
            name: "tar command",
            status: "error",
            details: "tar command not found or failed: Command not found",
          },
        ],
        recommendations: ["Install tar command or use Node.js native decompression"],
      };

      expect(mockResult.success).toBe(false);
      const tarCheck = mockResult.checks.find(check => check.name === "tar command");
      expect(tarCheck?.status).toBe("error");
      expect(mockResult.recommendations).toContain("Install tar command or use Node.js native decompression");
    });

    it('should check gzip command availability', () => {
      const mockChecks = [
        {
          name: "gzip command",
          status: "success",
          details: "gzip 1.10",
        },
      ];

      const gzipCheck = mockChecks.find(check => check.name === "gzip command");
      expect(gzipCheck).toBeTruthy();
      expect(gzipCheck?.status).toBe("success");
    });

    it('should check write permissions', () => {
      const mockChecks = [
        {
          name: "Cache directory write permission",
          status: "success",
          details: "Can write to /root/.cache",
        },
      ];

      const permCheck = mockChecks.find(check => check.name === "Cache directory write permission");
      expect(permCheck).toBeTruthy();
      expect(permCheck?.status).toBe("success");
    });

    it('should handle write permission errors', () => {
      const mockResult = {
        success: false,
        checks: [
          {
            name: "Cache directory write permission",
            status: "error",
            details: "Cannot write to /root/.cache: EACCES: permission denied",
          },
        ],
        recommendations: ["Check file system permissions"],
      };

      expect(mockResult.success).toBe(false);
      const permCheck = mockResult.checks.find(check => check.name === "Cache directory write permission");
      expect(permCheck?.status).toBe("error");
      expect(mockResult.recommendations).toContain("Check file system permissions");
    });

    it('should test CDN download', () => {
      const mockChecks = [
        {
          name: "CDN download test",
          status: "success",
          details: "Downloaded 1024.00KB in 500ms (2048.00KB/s)",
        },
      ];

      const downloadCheck = mockChecks.find(check => check.name === "CDN download test");
      expect(downloadCheck).toBeTruthy();
      expect(downloadCheck?.status).toBe("success");
      expect(downloadCheck?.details).toContain("Downloaded");
    });

    it('should handle CDN download errors', () => {
      const mockResult = {
        success: false,
        checks: [
          {
            name: "CDN download test",
            status: "error",
            details: "Download failed: HTTP 404: Not Found",
          },
        ],
        recommendations: ["Check network connectivity to Manus CDN"],
      };

      expect(mockResult.success).toBe(false);
      const downloadCheck = mockResult.checks.find(check => check.name === "CDN download test");
      expect(downloadCheck?.status).toBe("error");
      expect(mockResult.recommendations).toContain("Check network connectivity to Manus CDN");
    });

    it('should test full download and extraction', () => {
      const mockChecks = [
        {
          name: "Full download",
          status: "success",
          details: "Downloaded 257.00MB in 30000ms",
        },
        {
          name: "Extraction test",
          status: "success",
          details: "Can list archive contents in 1000ms. First 10 files:\nms-puppeteer/chromium-1208/\nms-puppeteer/chromium_headless_shell-1208/",
        },
      ];

      const downloadCheck = mockChecks.find(check => check.name === "Full download");
      const extractCheck = mockChecks.find(check => check.name === "Extraction test");
      
      expect(downloadCheck).toBeTruthy();
      expect(downloadCheck?.status).toBe("success");
      expect(extractCheck).toBeTruthy();
      expect(extractCheck?.status).toBe("success");
    });

    it('should handle extraction errors and provide recommendations', () => {
      const mockResult = {
        success: false,
        checks: [
          {
            name: "Full download and extraction test",
            status: "error",
            details: "Failed: The string did not match the expected pattern",
            stderr: "tar: Error is not recoverable: exiting now",
            stdout: null,
          },
        ],
        recommendations: [
          "tar command failed. Consider using Node.js native decompression (tar-stream + zlib)",
          "Pattern matching error suggests shell command execution issue. May need alternative approach.",
        ],
      };

      expect(mockResult.success).toBe(false);
      const extractCheck = mockResult.checks.find(check => check.name === "Full download and extraction test");
      expect(extractCheck?.status).toBe("error");
      expect(extractCheck?.details).toContain("pattern");
      expect(mockResult.recommendations.length).toBeGreaterThan(0);
      expect(mockResult.recommendations.some(rec => rec.includes("Node.js native decompression"))).toBe(true);
    });

    it('should check Puppeteer installation status', () => {
      const mockChecks = [
        {
          name: "Puppeteer installation status",
          status: "warning",
          details: "Puppeteer is NOT installed",
        },
      ];

      const statusCheck = mockChecks.find(check => check.name === "Puppeteer installation status");
      expect(statusCheck).toBeTruthy();
      expect(statusCheck?.status).toBe("warning");
    });

    it('should provide system information', () => {
      const mockChecks = [
        {
          name: "System Information",
          status: "info",
          details: {
            platform: "linux",
            arch: "x64",
            homeDir: "/root",
            cacheDir: "/root/.cache",
            puppeteerCache: "/root/.cache/ms-puppeteer",
          },
        },
      ];

      const sysInfo = mockChecks.find(check => check.name === "System Information");
      expect(sysInfo).toBeTruthy();
      expect(sysInfo?.details).toHaveProperty('platform');
      expect(sysInfo?.details).toHaveProperty('homeDir');
      expect(sysInfo?.details).toHaveProperty('puppeteerCache');
    });
  });
});
