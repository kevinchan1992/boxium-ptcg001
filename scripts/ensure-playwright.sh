#!/bin/bash
# Ensure Playwright browsers are installed for production scraping
# This script is called during build to install Chromium browser
#
# NOTE: Playwright Chromium (~600MB) is NOT installed during build.
# Installing it at build time causes deployment timeout because:
# 1. The download is ~600MB and takes several minutes
# 2. Manus deployment has a strict build timeout
#
# Chromium is installed lazily at runtime on first use via the admin panel
# (Admin > Diagnostics > Install Playwright).
echo "Skipping Playwright install during build (installed lazily at runtime via admin panel)"
