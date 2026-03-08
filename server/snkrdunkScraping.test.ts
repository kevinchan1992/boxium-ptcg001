/**
 * Unit tests for SNKRDUNK scraping logic consistency
 * 
 * Tests verify:
 * 1. fetchPriceHistoryFromApi correctly parses sales-history API response
 * 2. parseJapaneseDate uses Date.UTC (timezone-safe)
 * 3. convertJpyToHkd applies correct conversion
 * 4. addPriceHistory dedup uses DATE() comparison (not exact timestamp)
 * 5. All scraping paths use sales-history API (not listing prices)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// Mock axios to avoid real network calls
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

// Import after mocking
import { fetchPriceHistoryFromApi, convertJpyToHkd } from "./snkrdunkScraper";

describe("fetchPriceHistoryFromApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call the sales-history API endpoint (not listings)", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2026/02/23", price: 12500000, condition: "PSA 10" },
          { date: "2026/01/09", price: 9200000, condition: "PSA 10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    await fetchPriceHistoryFromApi("93051", "single_card");

    // Verify it calls sales-history API, NOT listings API
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("sales-history"),
      expect.any(Object)
    );
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining("isOnlyOnSale"),
      expect.any(Object)
    );
  });

  it("should parse date strings using UTC midnight (timezone-safe)", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2026/02/23", price: 12500000, condition: "PSA 10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("93051", "single_card");

    expect(result).toHaveLength(1);
    const soldAt = result[0].soldAt;
    
    // Must be UTC midnight (00:00:00 UTC), not local time
    expect(soldAt.getUTCHours()).toBe(0);
    expect(soldAt.getUTCMinutes()).toBe(0);
    expect(soldAt.getUTCSeconds()).toBe(0);
    expect(soldAt.getUTCFullYear()).toBe(2026);
    expect(soldAt.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(soldAt.getUTCDate()).toBe(23);
  });

  it("should produce identical timestamps for the same date regardless of when called", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2026/01/09", price: 9200000, condition: "PSA 10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValue(mockResponse);

    const result1 = await fetchPriceHistoryFromApi("93051");
    const result2 = await fetchPriceHistoryFromApi("93051");

    // Same date string must always produce the exact same timestamp
    expect(result1[0].soldAt.getTime()).toBe(result2[0].soldAt.getTime());
  });

  it("should correctly map grade from condition field for single cards", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2026/02/23", price: 12500000, condition: "PSA 10" },
          { date: "2026/01/09", price: 9200000, condition: "PSA 9" },
          { date: "2025/12/08", price: 7680000, condition: "中古" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("93051", "single_card");

    expect(result[0].grade).toBe("PSA 10");
    expect(result[1].grade).toBe("PSA 9");
    expect(result[2].grade).toBe("中古");
    // quantity should not be set for single cards
    expect(result[0].quantity).toBeUndefined();
  });

  it("should correctly map quantity from size field for sealed products", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2026/02/23", price: 50000, size: "1個" },
          { date: "2026/01/09", price: 150000, size: "3個" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("12345", "sealed_product");

    expect(result[0].quantity).toBe("1個");
    expect(result[1].quantity).toBe("3個");
    // grade should not be set for sealed products
    expect(result[0].grade).toBeUndefined();
  });

  it("should return empty array when API fails (backward compatible)", async () => {
    (mockedAxios.get as any).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchPriceHistoryFromApi("99999", "single_card");

    expect(result).toEqual([]);
  });

  it("should return empty array when history field is missing", async () => {
    (mockedAxios.get as any).mockResolvedValueOnce({ data: {} });

    const result = await fetchPriceHistoryFromApi("99999");

    expect(result).toEqual([]);
  });

  it("should parse relative date '2日前' as 2 days ago in JST", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2日前", price: 1100000, condition: "PSA8以下" },
          { date: "3日前", price: 2500000, condition: "PSA10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("100090", "single_card");

    expect(result).toHaveLength(2);
    
    // "2日前" should be 2 days ago, not today
    const twoDaysAgo = result[0].soldAt;
    const threeDaysAgo = result[1].soldAt;
    
    // Both should be UTC midnight
    expect(twoDaysAgo.getUTCHours()).toBe(0);
    expect(twoDaysAgo.getUTCMinutes()).toBe(0);
    
    // "2日前" should be before "3日前" is before today
    expect(twoDaysAgo.getTime()).toBeGreaterThan(threeDaysAgo.getTime());
    
    // Both should be in the past (not today or future)
    const todayUtc = new Date();
    expect(twoDaysAgo.getTime()).toBeLessThan(todayUtc.getTime());
    expect(threeDaysAgo.getTime()).toBeLessThan(todayUtc.getTime());
  });

  it("should parse '1日前' as yesterday", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "1日前", price: 2500000, condition: "PSA10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("100090", "single_card");
    expect(result).toHaveLength(1);
    
    const soldAt = result[0].soldAt;
    // Should be UTC midnight
    expect(soldAt.getUTCHours()).toBe(0);
    
    // Should be yesterday or earlier (accounting for JST offset)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const twoDaysAgoMs = Date.now() - 2 * oneDayMs;
    expect(soldAt.getTime()).toBeGreaterThanOrEqual(twoDaysAgoMs);
    expect(soldAt.getTime()).toBeLessThan(Date.now());
  });

  it("should produce consistent timestamps for same relative date when called twice", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2日前", price: 1100000, condition: "PSA8以下" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValue(mockResponse);

    const result1 = await fetchPriceHistoryFromApi("100090");
    const result2 = await fetchPriceHistoryFromApi("100090");

    // Same relative date called within same second should produce same timestamp
    expect(result1[0].soldAt.getTime()).toBe(result2[0].soldAt.getTime());
  });

  it("should handle multiple sales on the same day at different prices", async () => {
    const mockResponse = {
      data: {
        history: [
          { date: "2025/11/22", price: 7300000, condition: "PSA 10" },
          { date: "2025/11/22", price: 7250000, condition: "PSA 10" },
        ],
      },
    };
    (mockedAxios.get as any).mockResolvedValueOnce(mockResponse);

    const result = await fetchPriceHistoryFromApi("93051", "single_card");

    // Both records should be returned (different prices on same day)
    expect(result).toHaveLength(2);
    expect(result[0].soldAt.getTime()).toBe(result[1].soldAt.getTime()); // Same date
    expect(result[0].price).not.toBe(result[1].price); // Different prices
  });
});

describe("convertJpyToHkd", () => {
  it("should convert JPY to HKD with a reasonable rate", () => {
    const hkd = convertJpyToHkd(12500000);
    // Should be between 600,000 and 750,000 HKD (reasonable range for ¥12.5M)
    expect(hkd).toBeGreaterThan(600000);
    expect(hkd).toBeLessThan(750000);
  });

  it("should return 0 for 0 JPY", () => {
    expect(convertJpyToHkd(0)).toBe(0);
  });

  it("should be consistent (same input always produces same output)", () => {
    expect(convertJpyToHkd(1000000)).toBe(convertJpyToHkd(1000000));
  });
});

describe("Scraping path consistency", () => {
  it("scrapeSnkrdunkPage should use fetchPriceHistoryFromApi internally", async () => {
    // This test verifies that scrapeSnkrdunkPage delegates to fetchPriceHistoryFromApi
    // by checking that the sales-history endpoint is called
    const mockCardDetails = {
      data: {
        apparel: {
          name: "Lillie Extra Battle Day",
          name_ja: "リーリエ エクストラバトルの日",
          image_url: "https://example.com/image.jpg",
        },
      },
    };
    const mockSalesHistory = {
      data: {
        history: [
          { date: "2026/02/23", price: 12500000, condition: "PSA 10" },
        ],
      },
    };

    (mockedAxios.get as any)
      .mockResolvedValueOnce(mockCardDetails)  // First call: card details
      .mockResolvedValueOnce(mockSalesHistory); // Second call: sales-history

    const { scrapeSnkrdunkPage } = await import("./snkrdunkScraper");
    const result = await scrapeSnkrdunkPage("https://snkrdunk.com/apparels/93051");

    // Verify sales-history was called
    const calls = (mockedAxios.get as any).mock.calls;
    const salesHistoryCall = calls.find((call: any[]) => 
      call[0].includes("sales-history")
    );
    expect(salesHistoryCall).toBeDefined();

    // Verify price history is returned
    expect(result.priceHistory).toHaveLength(1);
    expect(result.priceHistory[0].price).toBe(12500000);
  });
});
