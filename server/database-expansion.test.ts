import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { games, sealedProducts, cards, dataSources } from "../drizzle/schema_new";
import { eq } from "drizzle-orm";

describe("Database Expansion - Games and Product Types", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }
  });

  it("should have games table with Pokémon and One Piece", async () => {
    const allGames = await db.select().from(games);
    
    expect(allGames.length).toBeGreaterThanOrEqual(2);
    
    const pokemon = allGames.find(g => g.code === "pokemon");
    expect(pokemon).toBeDefined();
    expect(pokemon?.name).toBe("Pokémon TCG");
    expect(pokemon?.isActive).toBe(true);
    
    const onePiece = allGames.find(g => g.code === "one_piece");
    expect(onePiece).toBeDefined();
    expect(onePiece?.name).toBe("One Piece Card Game");
    expect(onePiece?.isActive).toBe(true);
  });

  it("should have cards table with gameId column", async () => {
    const sampleCards = await db.select().from(cards).limit(10);
    
    expect(sampleCards.length).toBeGreaterThan(0);
    
    // Check that all cards have gameId
    sampleCards.forEach(card => {
      expect(card.gameId).toBeDefined();
      expect(typeof card.gameId).toBe("number");
    });
  });

  it("should have dataSources table with gameId and productType columns", async () => {
    const sampleDataSources = await db.select().from(dataSources).limit(10);
    
    expect(sampleDataSources.length).toBeGreaterThan(0);
    
    // Check that all data sources have gameId and productType
    sampleDataSources.forEach(source => {
      expect(source.gameId).toBeDefined();
      expect(typeof source.gameId).toBe("number");
      expect(source.productType).toBeDefined();
      expect(["single_card", "sealed_product"]).toContain(source.productType);
    });
  });

  it("should have migrated existing data sources to Pokémon + single_card", async () => {
    const pokemonId = 1; // Pokémon game ID
    
    const pokemonDataSources = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.gameId, pokemonId))
      .limit(100);
    
    expect(pokemonDataSources.length).toBeGreaterThan(0);
    
    // Check that all are single_card type
    pokemonDataSources.forEach(source => {
      expect(source.productType).toBe("single_card");
    });
  });

  it("should have sealedProducts table structure", async () => {
    // Just check that the table exists and has the correct structure
    const result = await db.select().from(sealedProducts).limit(1);
    
    // Table should exist (even if empty)
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
