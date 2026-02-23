#!/bin/bash
# Ensure Playwright browsers are installed before starting the server

set -e  # Exit on error

# Use default Playwright cache directory
PLAYWRIGHT_CACHE="$HOME/.cache/ms-playwright"
CHROMIUM_DIR="$PLAYWRIGHT_CACHE/chromium-1208"
HEADLESS_SHELL_DIR="$PLAYWRIGHT_CACHE/chromium_headless_shell-1208"

echo "[Playwright Setup] ========================================"
echo "[Playwright Setup] Playwright Auto-Install Script"
echo "[Playwright Setup] ========================================"
echo "[Playwright Setup] Current user: $(whoami)"
echo "[Playwright Setup] HOME directory: $HOME"
echo "[Playwright Setup] Playwright cache: $PLAYWRIGHT_CACHE"
echo "[Playwright Setup] Checking Playwright installation..."

# Check if both chromium and chromium_headless_shell are installed
if [ -d "$CHROMIUM_DIR" ]; then
  echo "[Playwright Setup] ✅ Chromium found at: $CHROMIUM_DIR"
else
  echo "[Playwright Setup] ❌ Chromium NOT found at: $CHROMIUM_DIR"
fi

if [ -d "$HEADLESS_SHELL_DIR" ]; then
  echo "[Playwright Setup] ✅ Headless Shell found at: $HEADLESS_SHELL_DIR"
else
  echo "[Playwright Setup] ❌ Headless Shell NOT found at: $HEADLESS_SHELL_DIR"
fi

if [ -d "$CHROMIUM_DIR" ] && [ -d "$HEADLESS_SHELL_DIR" ]; then
  echo "[Playwright Setup] ✅ Playwright Chromium is already installed"
  echo "[Playwright Setup] Skipping installation..."
else
  echo "[Playwright Setup] ❌ Playwright Chromium is NOT installed"
  echo "[Playwright Setup] 🔧 Installing Playwright Chromium..."
  echo "[Playwright Setup] This may take 2-3 minutes..."
  echo "[Playwright Setup] Installation command: pnpm exec playwright install chromium"
  
  # Install Playwright Chromium with verbose output
  if pnpm exec playwright install chromium; then
    echo "[Playwright Setup] ✅ Playwright Chromium installed successfully"
    echo "[Playwright Setup] Verifying installation..."
    
    if [ -d "$CHROMIUM_DIR" ] && [ -d "$HEADLESS_SHELL_DIR" ]; then
      echo "[Playwright Setup] ✅ Installation verified"
    else
      echo "[Playwright Setup] ⚠️ Installation completed but directories not found"
      echo "[Playwright Setup] Expected paths:"
      echo "[Playwright Setup]   - $CHROMIUM_DIR"
      echo "[Playwright Setup]   - $HEADLESS_SHELL_DIR"
      ls -la "$PLAYWRIGHT_CACHE" 2>/dev/null || echo "[Playwright Setup] Cache directory does not exist"
    fi
  else
    echo "[Playwright Setup] ❌ Failed to install Playwright Chromium"
    echo "[Playwright Setup] Exit code: $?"
    exit 1
  fi
fi

echo "[Playwright Setup] ✅ Setup complete. Playwright is ready."
echo "[Playwright Setup] ========================================"
