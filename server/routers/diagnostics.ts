/**
 * Diagnostics Router
 * Provides diagnostic endpoints for troubleshooting production issues
 */

import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { playwrightPool } from "../services/playwrightPool";

export const diagnosticsRouter = router({
  /**
   * Test if Playwright can launch a browser
   */
  testPlaywright: adminProcedure.query(async () => {
    const startTime = Date.now();
    const result: any = {
      success: false,
      error: null,
      browserLaunched: false,
      pageLoaded: false,
      snkrdunkAccessible: false,
      duration: 0,
      logs: [],
    };

    try {
      result.logs.push(`[${new Date().toISOString()}] Starting Playwright test...`);

      // Test 1: Launch browser
      result.logs.push(`[${new Date().toISOString()}] Attempting to launch browser...`);
      const browser = await playwrightPool.getBrowser();
      result.browserLaunched = true;
      result.logs.push(`[${new Date().toISOString()}] ✅ Browser launched successfully`);

      // Test 2: Create page
      result.logs.push(`[${new Date().toISOString()}] Creating new page...`);
      const page = await browser.newPage();
      result.pageLoaded = true;
      result.logs.push(`[${new Date().toISOString()}] ✅ Page created successfully`);

      // Test 3: Access SNKRDUNK
      result.logs.push(`[${new Date().toISOString()}] Accessing SNKRDUNK website...`);
      const testUrl = "https://snkrdunk.com/en/trading-cards/737036/used?sort=latest&isOnlyOnSale=true";
      
      try {
        await page.goto(testUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        result.snkrdunkAccessible = true;
        result.logs.push(`[${new Date().toISOString()}] ✅ SNKRDUNK website accessible`);

        // Get page title
        const title = await page.title();
        result.logs.push(`[${new Date().toISOString()}] Page title: ${title}`);

        // Check if page loaded correctly
        const bodyText = await page.evaluate(() => document.body.innerText);
        result.logs.push(`[${new Date().toISOString()}] Page content length: ${bodyText.length} characters`);

      } catch (navError: any) {
        result.logs.push(`[${new Date().toISOString()}] ❌ Failed to access SNKRDUNK: ${navError.message}`);
        result.error = `Navigation error: ${navError.message}`;
      }

      await page.close();
      result.logs.push(`[${new Date().toISOString()}] Page closed`);

      result.success = result.browserLaunched && result.pageLoaded;
      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] Test completed in ${result.duration}ms`);

    } catch (error: any) {
      result.error = error.message;
      result.logs.push(`[${new Date().toISOString()}] ❌ Error: ${error.message}`);
      result.logs.push(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
      result.duration = Date.now() - startTime;
    }

    return result;
  }),

  /**
   * Test SNKRDUNK scraping for a specific card
   */
  testSnkrdunkScraping: adminProcedure
    .input(z.object({ snkrdunkId: z.string() }))
    .query(async ({ input }: { input: { snkrdunkId: string } }) => {
      const startTime = Date.now();
      const result: any = {
        success: false,
        error: null,
        listings: [],
        duration: 0,
        logs: [],
      };

      try {
        result.logs.push(`[${new Date().toISOString()}] Testing SNKRDUNK scraping for ID: ${input.snkrdunkId}`);

        // Import scraping function
        const { scrapeSnkrdunkListings } = await import("../services/snkrdunkPlaywright");

        // Attempt to scrape
        const listings = await scrapeSnkrdunkListings(input.snkrdunkId);
        
        result.success = true;
        result.listings = listings;
        result.duration = Date.now() - startTime;
        result.logs.push(`[${new Date().toISOString()}] ✅ Scraping successful: ${listings.length} listings found`);
        result.logs.push(`[${new Date().toISOString()}] Duration: ${result.duration}ms`);

      } catch (error: any) {
        result.error = error.message;
        result.logs.push(`[${new Date().toISOString()}] ❌ Scraping failed: ${error.message}`);
        result.logs.push(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
        result.duration = Date.now() - startTime;
      }

      return result;
    }),



  /**
   * Install Playwright browsers manually
   * This is a fallback solution when automatic installation fails
   */
  installPlaywright: adminProcedure.mutation(async () => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    const result: any = {
      success: false,
      error: null,
      logs: [],
      duration: 0,
    };

    const startTime = Date.now();

    try {
      result.logs.push(`[${new Date().toISOString()}] Starting Playwright installation...`);
      result.logs.push(`[${new Date().toISOString()}] This may take 2-3 minutes (downloading ~280MB)`);
      result.logs.push(`[${new Date().toISOString()}] Command: pnpm exec playwright install chromium`);

      // Execute installation command with 5 minute timeout
      const { stdout, stderr } = await execAsync(
        "pnpm exec playwright install chromium",
        { 
          timeout: 300000, // 5 minutes
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        }
      );

      result.logs.push(`[${new Date().toISOString()}] Installation output:`);
      if (stdout) {
        stdout.split('\n').forEach(line => {
          if (line.trim()) result.logs.push(`  ${line}`);
        });
      }

      if (stderr) {
        result.logs.push(`[${new Date().toISOString()}] Installation warnings:`);
        stderr.split('\n').forEach(line => {
          if (line.trim()) result.logs.push(`  ${line}`);
        });
      }

      // Verify installation
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      
      const homeDir = os.homedir();
      const playwrightCache = path.join(homeDir, ".cache", "ms-playwright");
      const chromiumDir = path.join(playwrightCache, "chromium-1208");
      const headlessShellDir = path.join(playwrightCache, "chromium_headless_shell-1208");

      result.logs.push(`[${new Date().toISOString()}] Verifying installation...`);
      result.logs.push(`[${new Date().toISOString()}] Home directory: ${homeDir}`);
      result.logs.push(`[${new Date().toISOString()}] Playwright cache: ${playwrightCache}`);

      const chromiumExists = fs.existsSync(chromiumDir);
      const headlessShellExists = fs.existsSync(headlessShellDir);

      if (chromiumExists) {
        result.logs.push(`[${new Date().toISOString()}] ✅ Chromium found at: ${chromiumDir}`);
      } else {
        result.logs.push(`[${new Date().toISOString()}] ❌ Chromium NOT found at: ${chromiumDir}`);
      }

      if (headlessShellExists) {
        result.logs.push(`[${new Date().toISOString()}] ✅ Headless Shell found at: ${headlessShellDir}`);
      } else {
        result.logs.push(`[${new Date().toISOString()}] ❌ Headless Shell NOT found at: ${headlessShellDir}`);
      }

      if (chromiumExists && headlessShellExists) {
        result.success = true;
        result.logs.push(`[${new Date().toISOString()}] ✅ Installation verified successfully`);
      } else {
        result.success = false;
        result.error = "Installation completed but browsers not found in expected locations";
        result.logs.push(`[${new Date().toISOString()}] ⚠️ Installation completed but verification failed`);
      }

      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] Total duration: ${result.duration}ms`);

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] ❌ Installation failed: ${error.message}`);
      
      if (error.stdout) {
        result.logs.push(`[${new Date().toISOString()}] Stdout: ${error.stdout}`);
      }
      if (error.stderr) {
        result.logs.push(`[${new Date().toISOString()}] Stderr: ${error.stderr}`);
      }
    }

    return result;
  }),

  /**
   * Install Playwright from CDN (pre-packaged browsers)
   * This bypasses network restrictions by downloading from Manus CDN
   */
  installPlaywrightFromCDN: adminProcedure.mutation(async () => {
    const result: any = {
      success: false,
      error: null,
      logs: [],
      duration: 0,
    };

    const startTime = Date.now();
    const CDN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz";

    try {
      result.logs.push(`[${new Date().toISOString()}] Starting Playwright installation from CDN...`);
      result.logs.push(`[${new Date().toISOString()}] CDN URL: ${CDN_URL}`);
      result.logs.push(`[${new Date().toISOString()}] This may take 2-3 minutes (downloading 257MB)`);

      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      const homeDir = os.homedir();
      const cacheDir = path.join(homeDir, ".cache");
      const playwrightCache = path.join(cacheDir, "ms-playwright");
      const tempFile = path.join(homeDir, "playwright-browsers.tar.gz");

      result.logs.push(`[${new Date().toISOString()}] Home directory: ${homeDir}`);
      result.logs.push(`[${new Date().toISOString()}] Target directory: ${playwrightCache}`);

      // Create cache directory if it doesn't exist
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        result.logs.push(`[${new Date().toISOString()}] Created cache directory: ${cacheDir}`);
      }

      // Download file from CDN
      result.logs.push(`[${new Date().toISOString()}] Downloading from CDN...`);
      const downloadStart = Date.now();

      const response = await fetch(CDN_URL);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(buffer));

      const downloadDuration = Date.now() - downloadStart;
      result.logs.push(`[${new Date().toISOString()}] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB in ${downloadDuration}ms`);

      // Extract tar.gz
      result.logs.push(`[${new Date().toISOString()}] Extracting archive...`);
      const extractStart = Date.now();

      const { stdout, stderr } = await execAsync(
        `cd ${cacheDir} && tar -xzf ${tempFile}`,
        { timeout: 180000 } // 3 minutes
      );

      const extractDuration = Date.now() - extractStart;
      result.logs.push(`[${new Date().toISOString()}] Extraction completed in ${extractDuration}ms`);

      if (stdout) result.logs.push(`[${new Date().toISOString()}] Stdout: ${stdout}`);
      if (stderr) result.logs.push(`[${new Date().toISOString()}] Stderr: ${stderr}`);

      // Clean up temp file
      fs.unlinkSync(tempFile);
      result.logs.push(`[${new Date().toISOString()}] Cleaned up temp file`);

      // Verify installation
      const chromiumDir = path.join(playwrightCache, "chromium-1208");
      const headlessShellDir = path.join(playwrightCache, "chromium_headless_shell-1208");

      result.logs.push(`[${new Date().toISOString()}] Verifying installation...`);

      const chromiumExists = fs.existsSync(chromiumDir);
      const headlessShellExists = fs.existsSync(headlessShellDir);

      if (chromiumExists) {
        result.logs.push(`[${new Date().toISOString()}] ✅ Chromium found at: ${chromiumDir}`);
      } else {
        result.logs.push(`[${new Date().toISOString()}] ❌ Chromium NOT found at: ${chromiumDir}`);
      }

      if (headlessShellExists) {
        result.logs.push(`[${new Date().toISOString()}] ✅ Headless Shell found at: ${headlessShellDir}`);
      } else {
        result.logs.push(`[${new Date().toISOString()}] ❌ Headless Shell NOT found at: ${headlessShellDir}`);
      }

      if (chromiumExists && headlessShellExists) {
        result.success = true;
        result.logs.push(`[${new Date().toISOString()}] ✅ Installation verified successfully`);
      } else {
        result.success = false;
        result.error = "Installation completed but browsers not found in expected locations";
        result.logs.push(`[${new Date().toISOString()}] ⚠️ Installation completed but verification failed`);
      }

      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] Total duration: ${result.duration}ms`);

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] ❌ Installation failed: ${error.message}`);
      
      if (error.stack) {
        result.logs.push(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
      }
    }

    return result;
  }),

  /**
   * Diagnose Playwright installation environment
   * Check system commands, file permissions, disk space, and download capabilities
   */
  diagnosePlaywrightInstallation: adminProcedure.mutation(async () => {
    const result: any = {
      success: true,
      checks: [],
      recommendations: [],
    };

    const CDN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/uGDgObfxThbgKrfL.gz";

    try {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      const homeDir = os.homedir();
      const cacheDir = path.join(homeDir, ".cache");
      const playwrightCache = path.join(cacheDir, "ms-playwright");
      const tempFile = path.join(homeDir, "playwright-test.tar.gz");

      result.checks.push({
        name: "System Information",
        status: "info",
        details: {
          platform: os.platform(),
          arch: os.arch(),
          homeDir: homeDir,
          cacheDir: cacheDir,
          playwrightCache: playwrightCache,
        },
      });

      // Check 1: tar command availability
      try {
        const { stdout: tarVersion } = await execAsync("tar --version", { timeout: 5000 });
        result.checks.push({
          name: "tar command",
          status: "success",
          details: tarVersion.split('\n')[0],
        });
      } catch (error: any) {
        result.checks.push({
          name: "tar command",
          status: "error",
          details: `tar command not found or failed: ${error.message}`,
        });
        result.success = false;
        result.recommendations.push("Install tar command or use Node.js native decompression");
      }

      // Check 2: gzip command availability
      try {
        const { stdout: gzipVersion } = await execAsync("gzip --version", { timeout: 5000 });
        result.checks.push({
          name: "gzip command",
          status: "success",
          details: gzipVersion.split('\n')[0],
        });
      } catch (error: any) {
        result.checks.push({
          name: "gzip command",
          status: "error",
          details: `gzip command not found or failed: ${error.message}`,
        });
        result.recommendations.push("Install gzip command or use Node.js native decompression");
      }

      // Check 3: Directory creation and write permissions
      try {
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const testFile = path.join(cacheDir, "test-write.txt");
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        result.checks.push({
          name: "Cache directory write permission",
          status: "success",
          details: `Can write to ${cacheDir}`,
        });
      } catch (error: any) {
        result.checks.push({
          name: "Cache directory write permission",
          status: "error",
          details: `Cannot write to ${cacheDir}: ${error.message}`,
        });
        result.success = false;
        result.recommendations.push("Check file system permissions");
      }

      // Check 4: Disk space
      try {
        const { stdout: dfOutput } = await execAsync(`df -h ${homeDir}`, { timeout: 5000 });
        result.checks.push({
          name: "Disk space",
          status: "info",
          details: dfOutput,
        });
      } catch (error: any) {
        result.checks.push({
          name: "Disk space",
          status: "warning",
          details: `Cannot check disk space: ${error.message}`,
        });
      }

      // Check 5: Download test (first 1MB only)
      try {
        result.checks.push({
          name: "CDN download test",
          status: "info",
          details: "Starting download test (first 1MB)...",
        });

        const downloadStart = Date.now();
        const response = await fetch(CDN_URL, {
          headers: {
            'Range': 'bytes=0-1048575', // First 1MB only
          },
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const downloadDuration = Date.now() - downloadStart;

        result.checks.push({
          name: "CDN download test",
          status: "success",
          details: `Downloaded ${(buffer.byteLength / 1024).toFixed(2)}KB in ${downloadDuration}ms (${((buffer.byteLength / 1024) / (downloadDuration / 1000)).toFixed(2)}KB/s)`,
        });
      } catch (error: any) {
        result.checks.push({
          name: "CDN download test",
          status: "error",
          details: `Download failed: ${error.message}`,
        });
        result.success = false;
        result.recommendations.push("Check network connectivity to Manus CDN");
      }

      // Check 6: Full download and extraction test
      if (result.success) {
        try {
          result.checks.push({
            name: "Full download and extraction test",
            status: "info",
            details: "Starting full download (257MB)...",
          });

          const downloadStart = Date.now();
          const response = await fetch(CDN_URL);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const buffer = await response.arrayBuffer();
          fs.writeFileSync(tempFile, Buffer.from(buffer));
          const downloadDuration = Date.now() - downloadStart;

          result.checks.push({
            name: "Full download",
            status: "success",
            details: `Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB in ${downloadDuration}ms`,
          });

          // Test extraction
          result.checks.push({
            name: "Extraction test",
            status: "info",
            details: "Testing tar extraction...",
          });

          const extractStart = Date.now();
          const { stdout, stderr } = await execAsync(
            `cd ${cacheDir} && tar -tzf ${tempFile} | head -10`,
            { timeout: 30000 }
          );
          const extractDuration = Date.now() - extractStart;

          result.checks.push({
            name: "Extraction test",
            status: "success",
            details: `Can list archive contents in ${extractDuration}ms. First 10 files:\n${stdout}`,
          });

          // Clean up
          fs.unlinkSync(tempFile);
          result.checks.push({
            name: "Cleanup",
            status: "success",
            details: "Temp file cleaned up",
          });

        } catch (error: any) {
          result.checks.push({
            name: "Full download and extraction test",
            status: "error",
            details: `Failed: ${error.message}`,
            stderr: error.stderr || null,
            stdout: error.stdout || null,
          });
          result.success = false;

          // Clean up on error
          try {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          } catch {}

          if (error.message.includes("tar")) {
            result.recommendations.push("tar command failed. Consider using Node.js native decompression (tar-stream + zlib)");
          }
          if (error.message.includes("pattern")) {
            result.recommendations.push("Pattern matching error suggests shell command execution issue. May need alternative approach.");
          }
        }
      }

      // Check 7: Check if Playwright is already installed
      const chromiumDir = path.join(playwrightCache, "chromium-1208");
      const headlessShellDir = path.join(playwrightCache, "chromium_headless_shell-1208");
      
      if (fs.existsSync(chromiumDir) && fs.existsSync(headlessShellDir)) {
        result.checks.push({
          name: "Playwright installation status",
          status: "success",
          details: "Playwright is already installed",
        });
      } else {
        result.checks.push({
          name: "Playwright installation status",
          status: "warning",
          details: "Playwright is NOT installed",
        });
      }

    } catch (error: any) {
      result.success = false;
      result.checks.push({
        name: "Diagnostic error",
        status: "error",
        details: error.message,
        stack: error.stack,
      });
    }

    return result;
  }),

  /**
   * Get system information
   */
  getSystemInfo: adminProcedure.query(async () => {
    const os = await import("os");
    const process = await import("process");

    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        // Don't expose sensitive env vars
      },
    };
  }),
});
