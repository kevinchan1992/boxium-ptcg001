/**
 * capacitor.integration.test.ts
 *
 * Tests for Capacitor APP integration:
 * 1. capacitor.config.ts structure validation
 * 2. Package version compatibility checks
 * 3. CSS file existence checks
 * 4. Key file existence checks
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const projectRoot = join(__dirname, "..");

// ── 1. capacitor.config.ts validation ────────────────────────────────────

describe("Capacitor Config", () => {
  it("capacitor.config.ts should exist", () => {
    const configPath = join(projectRoot, "capacitor.config.ts");
    expect(existsSync(configPath)).toBe(true);
  });

  it("capacitor.config.ts should contain correct appId", () => {
    const configPath = join(projectRoot, "capacitor.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("asia.boxium.ptcg");
  });

  it("capacitor.config.ts should contain correct appName", () => {
    const configPath = join(projectRoot, "capacitor.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("BOXIUM TCG");
  });

  it("capacitor.config.ts should point to correct webDir", () => {
    const configPath = join(projectRoot, "capacitor.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("dist/public");
  });
});

// ── 2. Package version compatibility ─────────────────────────────────────

describe("Capacitor Package Versions", () => {
  const pkgPath = join(projectRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  it("@capacitor/core should be installed", () => {
    expect(allDeps["@capacitor/core"]).toBeDefined();
  });

  it("@capacitor/cli should be installed", () => {
    expect(allDeps["@capacitor/cli"]).toBeDefined();
  });

  it("@capacitor/ios should be installed", () => {
    expect(allDeps["@capacitor/ios"]).toBeDefined();
  });

  it("@capacitor/android should be installed", () => {
    expect(allDeps["@capacitor/android"]).toBeDefined();
  });

  it("@capacitor/push-notifications should be installed", () => {
    expect(allDeps["@capacitor/push-notifications"]).toBeDefined();
  });

  it("@capacitor/status-bar should be installed", () => {
    expect(allDeps["@capacitor/status-bar"]).toBeDefined();
  });

  it("@capacitor/keyboard should be installed", () => {
    expect(allDeps["@capacitor/keyboard"]).toBeDefined();
  });

  it("@capacitor/haptics should be installed", () => {
    expect(allDeps["@capacitor/haptics"]).toBeDefined();
  });

  it("@capacitor/preferences should be installed", () => {
    expect(allDeps["@capacitor/preferences"]).toBeDefined();
  });

  it("All Capacitor packages should be version 8.x (no --force needed)", () => {
    const capacitorPackages = Object.entries(allDeps)
      .filter(([key]) => key.startsWith("@capacitor/"))
      .filter(([key]) => key !== "@capacitor/cli"); // CLI can be different

    for (const [name, version] of capacitorPackages) {
      const versionStr = String(version);
      // Should be 8.x.x (with or without ^ prefix)
      expect(
        versionStr.startsWith("^8") || versionStr.startsWith("8"),
        `${name} should be version 8.x, got ${versionStr}`
      ).toBe(true);
    }
  });
});

// ── 3. Key files existence ────────────────────────────────────────────────

describe("Capacitor Integration Files", () => {
  it("useCapacitor hook should exist", () => {
    const hookPath = join(projectRoot, "client/src/hooks/useCapacitor.ts");
    expect(existsSync(hookPath)).toBe(true);
  });

  it("capacitor-app.css should exist", () => {
    const cssPath = join(projectRoot, "client/src/capacitor-app.css");
    expect(existsSync(cssPath)).toBe(true);
  });

  it("BottomTabBar component should exist", () => {
    const componentPath = join(projectRoot, "client/src/components/BottomTabBar.tsx");
    expect(existsSync(componentPath)).toBe(true);
  });

  it("CapacitorInit component should exist", () => {
    const componentPath = join(projectRoot, "client/src/components/CapacitorInit.tsx");
    expect(existsSync(componentPath)).toBe(true);
  });

  it("pushNotificationService should exist", () => {
    const servicePath = join(projectRoot, "client/src/services/pushNotificationService.ts");
    expect(existsSync(servicePath)).toBe(true);
  });

  it("biometricAuthService should exist", () => {
    const servicePath = join(projectRoot, "client/src/services/biometricAuthService.ts");
    expect(existsSync(servicePath)).toBe(true);
  });

  it("PWA manifest.json should exist", () => {
    const manifestPath = join(projectRoot, "client/public/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("README-mobile.md should exist", () => {
    const readmePath = join(projectRoot, "README-mobile.md");
    expect(existsSync(readmePath)).toBe(true);
  });
});

// ── 4. PWA manifest.json validation ──────────────────────────────────────

describe("PWA Manifest", () => {
  const manifestPath = join(projectRoot, "client/public/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("manifest should have correct name", () => {
    expect(manifest.name).toBe("BOXIUM TCG");
  });

  it("manifest should have standalone display mode", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("manifest should have dark theme color", () => {
    expect(manifest.theme_color).toBe("#000000");
  });

  it("manifest should have shortcuts", () => {
    expect(manifest.shortcuts).toBeDefined();
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
  });

  it("manifest should have icons", () => {
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

// ── 5. index.html PWA meta tags ───────────────────────────────────────────

describe("index.html PWA Meta Tags", () => {
  const indexPath = join(projectRoot, "client/index.html");
  const content = readFileSync(indexPath, "utf-8");

  it("should have manifest link", () => {
    expect(content).toContain('rel="manifest"');
    expect(content).toContain('href="/manifest.json"');
  });

  it("should have apple-mobile-web-app-capable meta", () => {
    expect(content).toContain('apple-mobile-web-app-capable');
  });

  it("should have viewport-fit=cover", () => {
    expect(content).toContain('viewport-fit=cover');
  });

  it("should have theme-color meta", () => {
    expect(content).toContain('name="theme-color"');
  });
});

// ── 6. Safe Area CSS ──────────────────────────────────────────────────────

describe("Safe Area CSS", () => {
  const cssPath = join(projectRoot, "client/src/capacitor-app.css");
  const content = readFileSync(cssPath, "utf-8");

  it("should define safe-area CSS variables", () => {
    expect(content).toContain("--safe-area-top");
    expect(content).toContain("--safe-area-bottom");
  });

  it("should use env(safe-area-inset-top)", () => {
    expect(content).toContain("env(safe-area-inset-top");
  });

  it("should use env(safe-area-inset-bottom)", () => {
    expect(content).toContain("env(safe-area-inset-bottom");
  });

  it("should disable long-press context menu", () => {
    expect(content).toContain("-webkit-touch-callout: none");
  });

  it("should disable double-tap zoom", () => {
    expect(content).toContain("touch-action: manipulation");
  });

  it("should disable rubber-band scroll", () => {
    expect(content).toContain("overscroll-behavior: none");
  });
});
