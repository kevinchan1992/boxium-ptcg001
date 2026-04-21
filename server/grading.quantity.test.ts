import { describe, it, expect } from "vitest";

// Unit test for grading quantity expansion logic
// This tests the core business logic without hitting the database

describe("Grading quantity expansion logic", () => {
  // Simulate the expansion logic from createSubmissionCheckout
  function expandItemsByQuantity(
    items: Array<{ cardName: string; tierId: number; quantity?: number }>,
    tierFeeMap: Map<number, string>
  ) {
    const expanded: Array<{ cardName: string; tierId: number; feeHkd: string }> = [];
    for (const item of items) {
      const qty = item.quantity ?? 1;
      for (let q = 0; q < qty; q++) {
        expanded.push({
          cardName: item.cardName,
          tierId: item.tierId,
          feeHkd: tierFeeMap.get(item.tierId) ?? "0",
        });
      }
    }
    return expanded;
  }

  function calculateTotalFee(
    items: Array<{ tierId: number; quantity?: number }>,
    tierFeeMap: Map<number, string>
  ) {
    return items.reduce((sum, item) => {
      const fee = parseFloat(tierFeeMap.get(item.tierId) ?? "0");
      return sum + fee * (item.quantity ?? 1);
    }, 0);
  }

  it("should expand single item with quantity=1 to 1 record", () => {
    const tierFeeMap = new Map([[1, "270.00"]]);
    const items = [{ cardName: "Pikachu", tierId: 1, quantity: 1 }];
    const expanded = expandItemsByQuantity(items, tierFeeMap);
    expect(expanded).toHaveLength(1);
    expect(expanded[0].cardName).toBe("Pikachu");
  });

  it("should expand single item with quantity=3 to 3 records", () => {
    const tierFeeMap = new Map([[1, "270.00"]]);
    const items = [{ cardName: "Pikachu", tierId: 1, quantity: 3 }];
    const expanded = expandItemsByQuantity(items, tierFeeMap);
    expect(expanded).toHaveLength(3);
    expanded.forEach((e) => expect(e.cardName).toBe("Pikachu"));
  });

  it("should expand multiple items with different quantities", () => {
    const tierFeeMap = new Map([[1, "270.00"], [2, "540.00"]]);
    const items = [
      { cardName: "Pikachu", tierId: 1, quantity: 2 },
      { cardName: "Charizard", tierId: 2, quantity: 3 },
    ];
    const expanded = expandItemsByQuantity(items, tierFeeMap);
    expect(expanded).toHaveLength(5);
    expect(expanded.filter((e) => e.cardName === "Pikachu")).toHaveLength(2);
    expect(expanded.filter((e) => e.cardName === "Charizard")).toHaveLength(3);
  });

  it("should default quantity to 1 when not specified", () => {
    const tierFeeMap = new Map([[1, "270.00"]]);
    const items = [{ cardName: "Pikachu", tierId: 1 }]; // no quantity
    const expanded = expandItemsByQuantity(items, tierFeeMap);
    expect(expanded).toHaveLength(1);
  });

  it("should calculate total fee correctly with quantities", () => {
    const tierFeeMap = new Map([[1, "270.00"], [2, "540.00"]]);
    const items = [
      { tierId: 1, quantity: 2 }, // 270 * 2 = 540
      { tierId: 2, quantity: 3 }, // 540 * 3 = 1620
    ];
    const total = calculateTotalFee(items, tierFeeMap);
    expect(total).toBe(2160);
  });

  it("should handle quantity=1000 (max)", () => {
    const tierFeeMap = new Map([[1, "270.00"]]);
    const items = [{ cardName: "Pikachu", tierId: 1, quantity: 1000 }];
    const expanded = expandItemsByQuantity(items, tierFeeMap);
    expect(expanded).toHaveLength(1000);
  });

  it("should calculate totalCardCount correctly", () => {
    const items = [
      { tierId: 1, quantity: 5 },
      { tierId: 2, quantity: 3 },
      { tierId: 1, quantity: 2 },
    ];
    const totalCardCount = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
    expect(totalCardCount).toBe(10);
  });
});
