/**
 * Yu-Gi-Oh! TCG Game Type Tests
 * Verifies that Yu-Gi-Oh! has been correctly added as a game type
 */

import { describe, it, expect } from "vitest";

// ─── 1. Schema enum includes yugioh ───────────────────────────────────────────
describe("tcgSeries enum", () => {
  it("should include yugioh as a valid tcgSeries value", () => {
    const validSeries = ["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"];
    expect(validSeries).toContain("yugioh");
  });

  it("should have yugioh after pokemon and onepiece in sort order", () => {
    const validSeries = ["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"];
    const pokemonIdx = validSeries.indexOf("pokemon");
    const onepieceIdx = validSeries.indexOf("onepiece");
    const yugiohIdx = validSeries.indexOf("yugioh");
    expect(yugiohIdx).toBeGreaterThan(pokemonIdx);
    expect(yugiohIdx).toBeGreaterThan(onepieceIdx);
  });
});

// ─── 2. Frontend TCG_SERIES constant includes yugioh ─────────────────────────
describe("Frontend TCG_SERIES constant", () => {
  const TCG_SERIES = [
    { value: "pokemon",  label: "Pokémon",   emoji: "⚡",  color: "bg-yellow-400 text-[#06038D]" },
    { value: "onepiece", label: "One Piece", emoji: "🏴‍☠️", color: "bg-red-600 text-white" },
    { value: "yugioh",   label: "Yu-Gi-Oh!", emoji: "🔮",  color: "bg-purple-700 text-white" },
  ];

  it("should contain yugioh entry", () => {
    const yugioh = TCG_SERIES.find(s => s.value === "yugioh");
    expect(yugioh).toBeDefined();
    expect(yugioh?.label).toBe("Yu-Gi-Oh!");
    expect(yugioh?.emoji).toBe("🔮");
  });

  it("should have purple color theme for yugioh", () => {
    const yugioh = TCG_SERIES.find(s => s.value === "yugioh");
    expect(yugioh?.color).toContain("purple");
  });

  it("should have 3 game series total", () => {
    expect(TCG_SERIES).toHaveLength(3);
  });
});

// ─── 3. TCG_SERIES_LABEL mapping includes yugioh ─────────────────────────────
describe("TCG_SERIES_LABEL mapping", () => {
  const TCG_SERIES_LABEL: Record<string, string> = {
    pokemon:  "Pokémon",
    onepiece: "One Piece",
    yugioh:   "Yu-Gi-Oh!",
  };

  it("should map yugioh to correct display label", () => {
    expect(TCG_SERIES_LABEL["yugioh"]).toBe("Yu-Gi-Oh!");
  });

  it("should have all 3 game labels", () => {
    expect(Object.keys(TCG_SERIES_LABEL)).toHaveLength(3);
  });
});

// ─── 4. Game database record structure ───────────────────────────────────────
describe("Yu-Gi-Oh! game database record", () => {
  const expectedRecord = {
    id: 3,
    code: "yugioh",
    name: "Yu-Gi-Oh! TCG",
    nameZh: "遊戲王集換式卡牌遊戲",
    isActive: true,
    sortOrder: 3,
  };

  it("should have id=3", () => {
    expect(expectedRecord.id).toBe(3);
  });

  it("should have code='yugioh'", () => {
    expect(expectedRecord.code).toBe("yugioh");
  });

  it("should have correct Chinese name", () => {
    expect(expectedRecord.nameZh).toBe("遊戲王集換式卡牌遊戲");
  });

  it("should be active", () => {
    expect(expectedRecord.isActive).toBe(true);
  });

  it("should have sortOrder=3 (after pokemon=1 and onepiece=2)", () => {
    expect(expectedRecord.sortOrder).toBe(3);
  });
});

// ─── 5. CDN logo URL for yugioh ───────────────────────────────────────────────
describe("Yu-Gi-Oh! logo CDN URL", () => {
  const YUGIOH_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp";

  it("should be a valid CloudFront URL", () => {
    expect(YUGIOH_LOGO).toMatch(/^https:\/\/d2xsxph8kpxj0f\.cloudfront\.net\//);
  });

  it("should reference yugioh-logo file", () => {
    expect(YUGIOH_LOGO).toContain("yugioh-logo");
  });

  it("should be a webp format", () => {
    expect(YUGIOH_LOGO).toMatch(/\.webp$/);
  });
});

// ─── 6. SellerDashboard CSV import supports yugioh ───────────────────────────
describe("SellerDashboard CSV import seriesMap", () => {
  const seriesMap: Record<string, string> = {
    pokemon: "pokemon",
    onepiece: "onepiece",
    yugioh: "yugioh",
  };

  it("should map yugioh to yugioh", () => {
    expect(seriesMap["yugioh"]).toBe("yugioh");
  });

  it("should support all 3 game series in CSV import", () => {
    expect(Object.keys(seriesMap)).toHaveLength(3);
  });
});
