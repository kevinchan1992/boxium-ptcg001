#!/bin/bash
# Ensure Playwright browsers are installed before starting the server

# Use default Playwright cache directory
PLAYWRIGHT_CACHE="$HOME/.cache/ms-playwright"
CHROMIUM_DIR="$PLAYWRIGHT_CACHE/chromium-1208"
HEADLESS_SHELL_DIR="$PLAYWRIGHT_CACHE/chromium_headless_shell-1208"

echo "[Playwright Setup] Checking Playwright installation..."

# Check if both chromium and chromium_headless_shell are installed
if [ -d "$CHROMIUM_DIR" ] && [ -d "$HEADLESS_SHELL_DIR" ]; then
  echo "[Playwright Setup] ✅ Playwright Chromium is already installed"
  echo "[Playwright Setup] Chromium path: $CHROMIUM_DIR"
  echo "[Playwright Setup] Headless Shell path: $HEADLESS_SHELL_DIR"
else
  echo "[Playwright Setup] ❌ Playwright Chromium is NOT installed"
  echo "[Playwright Setup] 🔧 Installing Playwright Chromium..."
  echo "[Playwright Setup] This may take 2-3 minutes..."
  
  # Install Playwright Chromium
  pnpm exec playwright install chromium
  
  if [ $? -eq 0 ]; then
    echo "[Playwright Setup] ✅ Playwright Chromium installed successfully"
  else
    echo "[Playwright Setup] ❌ Failed to install Playwright Chromium"
    exit 1
  fi
fi

echo "[Playwright Setup] ✅ Setup complete. Playwright is ready."
