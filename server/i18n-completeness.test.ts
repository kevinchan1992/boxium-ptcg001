import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const localesDir = path.join(__dirname, "../client/src/locales");

function loadJson(filename: string) {
  const content = fs.readFileSync(path.join(localesDir, filename), "utf-8");
  return JSON.parse(content);
}

function flattenKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...flattenKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n Translation Completeness", () => {
  const zhTW = loadJson("zh-TW.json");
  const en = loadJson("en.json");
  const ja = loadJson("ja.json");

  const zhKeys = flattenKeys(zhTW).sort();
  const enKeys = flattenKeys(en).sort();
  const jaKeys = flattenKeys(ja).sort();

  it("all three locale files should exist", () => {
    expect(fs.existsSync(path.join(localesDir, "zh-TW.json"))).toBe(true);
    expect(fs.existsSync(path.join(localesDir, "en.json"))).toBe(true);
    expect(fs.existsSync(path.join(localesDir, "ja.json"))).toBe(true);
  });

  it("zh-TW, en, and ja should have the same number of keys", () => {
    expect(enKeys.length).toBe(zhKeys.length);
    expect(jaKeys.length).toBe(zhKeys.length);
  });

  it("en.json should not have any keys missing from zh-TW.json", () => {
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it("ja.json should not have any keys missing from zh-TW.json", () => {
    const missingInJa = zhKeys.filter((k) => !jaKeys.includes(k));
    expect(missingInJa).toEqual([]);
  });

  it("en.json values should not be empty strings", () => {
    function checkEmpty(obj: any, prefix = ""): string[] {
      const empties: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === "object" && obj[key] !== null) {
          empties.push(...checkEmpty(obj[key], fullKey));
        } else if (obj[key] === "") {
          empties.push(fullKey);
        }
      }
      return empties;
    }
    const emptyKeys = checkEmpty(en);
    expect(emptyKeys).toEqual([]);
  });

  it("ja.json values should not be empty strings", () => {
    function checkEmpty(obj: any, prefix = ""): string[] {
      const empties: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === "object" && obj[key] !== null) {
          empties.push(...checkEmpty(obj[key], fullKey));
        } else if (obj[key] === "") {
          empties.push(fullKey);
        }
      }
      return empties;
    }
    const emptyKeys = checkEmpty(ja);
    expect(emptyKeys).toEqual([]);
  });

  it("should have at least 1600 translation keys", () => {
    expect(zhKeys.length).toBeGreaterThanOrEqual(1600);
  });

  it("auction admin quick reject reasons should be in zh-TW translations", () => {
    // Verify that auction-related keys exist
    const auctionKeys = zhKeys.filter((k) => k.startsWith("auction"));
    expect(auctionKeys.length).toBeGreaterThan(0);
  });
});
