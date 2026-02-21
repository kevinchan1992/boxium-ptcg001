#!/bin/bash
# Ensure Playwright browsers are installed before starting the server

BROWSERS_PATH="/home/ubuntu/boxium-ptcg/.playwright-browsers"

# Check if browsers are already installed
if [ -d "$BROWSERS_PATH/chromium-1208" ]; then
  echo "[Playwright] Browsers already installed at $BROWSERS_PATH"
else
  echo "[Playwright] Installing browsers to $BROWSERS_PATH..."
  export PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_PATH"
  pnpm exec playwright install chromium
  echo "[Playwright] Installation complete"
fi
