#!/usr/bin/env node
/**
 * Download font files from public CDN at build time.
 * Fonts are stored externally to avoid committing large binary files to git.
 */
import { createWriteStream, mkdirSync, existsSync, statSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "..", "server", "fonts");

// Public CDN URLs for font files
const FONT_FILES = [
  {
    name: "NotoSansTC-Bold.otf",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/ErlKSZNwnzVeYczk.otf",
    minSize: 5000000,
  },
  {
    name: "NotoSansTC-Regular.otf",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/dryikHGyYAfIXgqE.otf",
    minSize: 5000000,
  },
  {
    name: "NotoSerifTC-Bold.ttf",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/gvpGbSwSnjorYUwj.ttf",
    minSize: 9000000,
  },
  {
    name: "Orbitron-Bold.ttf",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/NVDSrVIUUDYPEVdI.ttf",
    minSize: 10000,
  },
  {
    name: "Jaapokki-Subtract.otf",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/YGOvFQNSilfBiyjw.otf",
    minSize: 200000,
  },
  {
    name: "boxium-logo-pdf.png",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/IMpmxkaMWGMcvFqd.png",
    minSize: 10000,
  },
  {
    name: "boxium-logo-white-pdf.png",
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320884517/SEReMUzKAFisEYeK.png",
    minSize: 10000,
  },
];

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(destPath));
}

async function main() {
  mkdirSync(FONTS_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const font of FONT_FILES) {
    const destPath = path.join(FONTS_DIR, font.name);

    // Skip if file exists and is large enough (not corrupted)
    if (existsSync(destPath)) {
      const size = statSync(destPath).size;
      if (size >= font.minSize) {
        console.log(`✓ ${font.name} (cached, ${Math.round(size / 1024)}KB)`);
        skipped++;
        continue;
      }
      console.log(`⚠  ${font.name} exists but too small (${size} bytes), re-downloading...`);
    }

    try {
      console.log(`⬇  Downloading ${font.name}...`);
      await downloadFile(font.url, destPath);
      const size = statSync(destPath).size;
      console.log(`✓ ${font.name} (${Math.round(size / 1024)}KB)`);
      downloaded++;
    } catch (err) {
      console.error(`✗ ${font.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nFonts: ${downloaded} downloaded, ${skipped} cached, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Font download failed:", err);
  process.exit(1);
});
