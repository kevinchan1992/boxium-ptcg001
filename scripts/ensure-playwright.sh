#!/bin/bash
# Ensure Playwright browsers are installed for production scraping
# This script is called during build to install Chromium browser

if [ "$NODE_ENV" = "production" ] || [ -z "$NODE_ENV" ]; then
  echo "Installing Playwright Chromium browser..."
  npx playwright install chromium --with-deps 2>/dev/null || echo "Playwright install skipped (may not be available in build env)"
else
  echo "Skipping Playwright install in development mode"
fi
