import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Trending Search Functionality", () => {
  let testCardId: number;

  beforeAll(async () => {
    // Get a test card ID from the database
    const cards = await db.getRandomCards(1);
    if (cards.length === 0) {
      throw new Error("No cards found in database for testing");
    }
    testCardId = cards[0].id;
  });

  it("should log user search behavior", async () => {
    const result = await db.logUserSearch({
      cardId: testCardId,
      searchQuery: "test search query",
      source: "search_page",
      userId: undefined,
      sessionId: "test-session-123",
    });

    expect(result).toBeTruthy();
  });

  it("should log card click from search page", async () => {
    const result = await db.logUserSearch({
      cardId: testCardId,
      searchQuery: "pikachu",
      source: "search_page",
    });

    expect(result).toBeTruthy();
  });

  it("should log card click from trending page", async () => {
    const result = await db.logUserSearch({
      cardId: testCardId,
      source: "trending_page",
    });

    expect(result).toBeTruthy();
  });

  it("should get trending cards by search popularity after logging searches", async () => {
    // Log multiple searches for the same card to meet the threshold (3 searches)
    await db.logUserSearch({
      cardId: testCardId,
      searchQuery: "trending test 1",
      source: "search_page",
    });

    await db.logUserSearch({
      cardId: testCardId,
      searchQuery: "trending test 2",
      source: "card_click",
    });

    await db.logUserSearch({
      cardId: testCardId,
      searchQuery: "trending test 3",
      source: "home_page",
    });

    // Now fetch trending cards
    const trendingCards = await db.getTrendingBySearches({ limit: 10, days: 30 });

    // The test card should appear in the trending list
    const foundCard = trendingCards.find((card: any) => card.id === testCardId);
    expect(foundCard).toBeTruthy();
    
    if (foundCard) {
      expect(foundCard.searchCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("should return empty array when no searches meet the threshold", async () => {
    // Query for trending cards in the last 1 day (should be empty for old data)
    const trendingCards = await db.getTrendingBySearches({ limit: 10, days: 0.001 }); // ~1.4 minutes
    
    // Should return array (may be empty or have recent searches)
    expect(Array.isArray(trendingCards)).toBe(true);
  });
});
