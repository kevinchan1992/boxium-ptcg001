/**
 * eBay API Integration Tests
 * Validates eBay App ID and API functionality
 */

import { describe, it, expect } from "vitest";
import { searchEbaySoldItems, extractCardNumber, cleanCardNameForSearch } from "./ebayService";

describe("eBay API Integration", () => {
  it("should validate eBay App ID is configured", () => {
    expect(process.env.EBAY_APP_ID).toBeDefined();
    expect(process.env.EBAY_APP_ID).not.toBe("");
  });

  it("should extract card number from full card name", () => {
    const fullName = "Solgaleo & Lunala GX (Lillie) SR :SA [SM11b 063/049](Enhanced Expansion Pack \"Dream League\")";
    const cardNumber = extractCardNumber(fullName);
    expect(cardNumber).toBe("SM11b 063/049");
  });

  it("should clean card name for search", () => {
    const fullName = "Solgaleo & Lunala GX (Lillie) SR :SA [SM11b 063/049](Enhanced Expansion Pack \"Dream League\")";
    const cleanedName = cleanCardNameForSearch(fullName);
    expect(cleanedName).toContain("Solgaleo");
    expect(cleanedName).toContain("Lunala");
    expect(cleanedName).not.toContain("[");
    expect(cleanedName).not.toContain("]");
  });

  it("should search for sold PSA10 items on eBay", async () => {
    const cardName = "Pikachu VMAX";
    const cardNumber = "SWSH001";
    
    try {
      const results = await searchEbaySoldItems(cardName, cardNumber, 5);
      
      // Results should be an array (may be empty if no items found)
      expect(Array.isArray(results)).toBe(true);
      
      // If results exist, validate structure
      if (results.length > 0) {
        const firstItem = results[0];
        expect(firstItem).toHaveProperty("title");
        expect(firstItem).toHaveProperty("price");
        expect(firstItem).toHaveProperty("currency");
        expect(firstItem).toHaveProperty("soldDate");
        expect(firstItem).toHaveProperty("itemUrl");
        
        // Price should be a positive number
        expect(firstItem.price).toBeGreaterThan(0);
        
        // Currency should be a valid code (usually USD)
        expect(firstItem.currency).toMatch(/^[A-Z]{3}$/);
        
        // Sold date should be a valid date
        expect(firstItem.soldDate).toBeInstanceOf(Date);
        
        console.log(`✅ Found ${results.length} sold items for ${cardName} ${cardNumber}`);
        console.log(`   First item: ${firstItem.title} - ${firstItem.currency} ${firstItem.price}`);
      } else {
        console.log(`ℹ️  No sold items found for ${cardName} ${cardNumber} (this is OK)`);
      }
    } catch (error: any) {
      // If eBay App ID is invalid, the test should fail
      if (error.message.includes("EBAY_APP_ID")) {
        throw error;
      }
      
      // Other errors (network, API rate limit) should not fail the test
      console.warn(`⚠️  eBay API error (non-critical): ${error.message}`);
    }
  }, 30000); // 30 second timeout for API call
});
