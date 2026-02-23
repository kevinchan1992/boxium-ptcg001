#!/bin/bash
# Ensure Playwright browsers are installed before starting the server
# This script runs automatically on server startup

# DO NOT use 'set -e' to prevent blocking server startup if installation fails
# Instead, we'll log errors and let the server start anyway

# Use default Playwright cache directory
PLAYWRIGHT_CACHE="$HOME/.cache/ms-playwright"
CHROMIUM_DIR="$PLAYWRIGHT_CACHE/chromium-1208"
HEADLESS_SHELL_DIR="$PLAYWRIGHT_CACHE/chromium_headless_shell-1208"

echo "============================================================"
echo "[Playwright Setup] Playwright Auto-Install Script"
echo "============================================================"
echo "[Playwright Setup] Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "[Playwright Setup] Current user: $(whoami)"
echo "[Playwright Setup] HOME directory: $HOME"
echo "[Playwright Setup] Playwright cache: $PLAYWRIGHT_CACHE"
echo "[Playwright Setup] Node.js version: $(node --version 2>/dev/null || echo 'N/A')"
echo "[Playwright Setup] pnpm version: $(pnpm --version 2>/dev/null || echo 'N/A')"
echo "============================================================"

# Check if both chromium and chromium_headless_shell are installed
echo "[Playwright Setup] Checking Playwright installation..."

if [ -d "$CHROMIUM_DIR" ]; then
  echo "[Playwright Setup] ✅ Chromium found at: $CHROMIUM_DIR"
  CHROMIUM_INSTALLED=true
else
  echo "[Playwright Setup] ❌ Chromium NOT found at: $CHROMIUM_DIR"
  CHROMIUM_INSTALLED=false
fi

if [ -d "$HEADLESS_SHELL_DIR" ]; then
  echo "[Playwright Setup] ✅ Headless Shell found at: $HEADLESS_SHELL_DIR"
  HEADLESS_SHELL_INSTALLED=true
else
  echo "[Playwright Setup] ❌ Headless Shell NOT found at: $HEADLESS_SHELL_DIR"
  HEADLESS_SHELL_INSTALLED=false
fi

if [ "$CHROMIUM_INSTALLED" = true ] && [ "$HEADLESS_SHELL_INSTALLED" = true ]; then
  echo "[Playwright Setup] ✅ Playwright Chromium is already installed"
  echo "[Playwright Setup] Skipping installation..."
  echo "============================================================"
  exit 0
fi

# Playwright is not installed, attempt installation
echo "[Playwright Setup] ❌ Playwright Chromium is NOT installed"
echo "[Playwright Setup] 🔧 Starting installation process..."
echo "[Playwright Setup] This may take 2-3 minutes (downloading ~280MB)..."
echo "[Playwright Setup] Installation command: pnpm exec playwright install chromium"
echo "============================================================"

# Create cache directory if it doesn't exist
mkdir -p "$PLAYWRIGHT_CACHE" 2>/dev/null || true

# Install Playwright Chromium with verbose output
echo "[Playwright Setup] Running: pnpm exec playwright install chromium"
if pnpm exec playwright install chromium 2>&1 | tee /tmp/playwright-install.log; then
  echo "============================================================"
  echo "[Playwright Setup] ✅ Playwright Chromium installed successfully"
  echo "[Playwright Setup] Verifying installation..."
  
  # Verify installation
  if [ -d "$CHROMIUM_DIR" ] && [ -d "$HEADLESS_SHELL_DIR" ]; then
    echo "[Playwright Setup] ✅ Installation verified successfully"
    echo "[Playwright Setup] Chromium path: $CHROMIUM_DIR"
    echo "[Playwright Setup] Headless Shell path: $HEADLESS_SHELL_DIR"
  else
    echo "[Playwright Setup] ⚠️ Installation completed but directories not found"
    echo "[Playwright Setup] Expected paths:"
    echo "[Playwright Setup]   - $CHROMIUM_DIR"
    echo "[Playwright Setup]   - $HEADLESS_SHELL_DIR"
    echo "[Playwright Setup] Listing cache directory:"
    ls -la "$PLAYWRIGHT_CACHE" 2>/dev/null || echo "[Playwright Setup] Cache directory does not exist"
  fi
else
  INSTALL_EXIT_CODE=$?
  echo "============================================================"
  echo "[Playwright Setup] ❌ Failed to install Playwright Chromium"
  echo "[Playwright Setup] Exit code: $INSTALL_EXIT_CODE"
  echo "[Playwright Setup] Installation log saved to: /tmp/playwright-install.log"
  echo "[Playwright Setup] ⚠️ Server will start anyway, but scraping features will not work"
  echo "[Playwright Setup] Please check the logs and try manual installation:"
  echo "[Playwright Setup]   cd $(pwd) && pnpm exec playwright install chromium"
  echo "============================================================"
  # DO NOT exit with error code - let the server start anyway
  exit 0
fi

echo "============================================================"
echo "[Playwright Setup] ✅ Setup complete. Playwright is ready."
echo "[Playwright Setup] Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
