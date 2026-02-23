/**
 * Ensure Playwright Browser is Installed
 * 
 * This script checks if Playwright Chromium browser is installed,
 * and installs it automatically if missing.
 * 
 * This should be run during server startup to ensure the browser
 * is always available, even after deployments.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Expected Playwright browser path
const PLAYWRIGHT_CACHE_DIR = path.join(require('os').homedir(), '.cache', 'ms-playwright');
const CHROMIUM_DIR = path.join(PLAYWRIGHT_CACHE_DIR, 'chromium-1208');
const CHROMIUM_HEADLESS_SHELL_DIR = path.join(PLAYWRIGHT_CACHE_DIR, 'chromium_headless_shell-1208');

/**
 * Check if Playwright Chromium is installed
 */
function isPlaywrightInstalled() {
  try {
    // Check if both chromium and chromium_headless_shell directories exist
    const chromiumExists = fs.existsSync(CHROMIUM_DIR);
    const headlessShellExists = fs.existsSync(CHROMIUM_HEADLESS_SHELL_DIR);
    
    if (chromiumExists && headlessShellExists) {
      console.log('[Playwright Setup] ✅ Playwright Chromium is already installed');
      console.log(`[Playwright Setup] Chromium path: ${CHROMIUM_DIR}`);
      console.log(`[Playwright Setup] Headless Shell path: ${CHROMIUM_HEADLESS_SHELL_DIR}`);
      return true;
    }
    
    console.log('[Playwright Setup] ❌ Playwright Chromium is NOT installed');
    if (!chromiumExists) {
      console.log(`[Playwright Setup] Missing: ${CHROMIUM_DIR}`);
    }
    if (!headlessShellExists) {
      console.log(`[Playwright Setup] Missing: ${CHROMIUM_HEADLESS_SHELL_DIR}`);
    }
    return false;
  } catch (error) {
    console.error('[Playwright Setup] Error checking Playwright installation:', error);
    return false;
  }
}

/**
 * Install Playwright Chromium
 */
function installPlaywright() {
  try {
    console.log('[Playwright Setup] 🔧 Installing Playwright Chromium...');
    console.log('[Playwright Setup] This may take 2-3 minutes...');
    
    const startTime = Date.now();
    
    // Run playwright install chromium
    execSync('pnpm exec playwright install chromium', {
      stdio: 'inherit',
      cwd: __dirname,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Playwright Setup] ✅ Playwright Chromium installed successfully in ${duration}s`);
    
    return true;
  } catch (error) {
    console.error('[Playwright Setup] ❌ Failed to install Playwright Chromium:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('[Playwright Setup] ========================================');
  console.log('[Playwright Setup] Checking Playwright Installation...');
  console.log('[Playwright Setup] ========================================');
  
  if (isPlaywrightInstalled()) {
    console.log('[Playwright Setup] ✅ All checks passed. Playwright is ready.');
    process.exit(0);
  }
  
  console.log('[Playwright Setup] 📦 Playwright Chromium needs to be installed');
  console.log('[Playwright Setup] Starting automatic installation...');
  
  const success = installPlaywright();
  
  if (success) {
    console.log('[Playwright Setup] ========================================');
    console.log('[Playwright Setup] ✅ Setup Complete!');
    console.log('[Playwright Setup] Playwright Chromium is now ready to use');
    console.log('[Playwright Setup] ========================================');
    process.exit(0);
  } else {
    console.error('[Playwright Setup] ========================================');
    console.error('[Playwright Setup] ❌ Setup Failed!');
    console.error('[Playwright Setup] Please install Playwright manually:');
    console.error('[Playwright Setup] pnpm exec playwright install chromium');
    console.error('[Playwright Setup] ========================================');
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('[Playwright Setup] Unexpected error:', error);
  process.exit(1);
});
