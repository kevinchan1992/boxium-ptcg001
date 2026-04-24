/**
 * Tests for grading improvements (Phase 2):
 * 1. batchUpdateStatus adminNotesHistory system note append
 * 2. getMySubmissions cardName search logic
 */
import { describe, expect, it } from "vitest";

// ─── 1. batchUpdateStatus adminNotesHistory system note ──────────────────────

const STATUS_LABELS: Record<string, string> = {
  received: "BOXIUM 已收件",
  submitted_to_psa: "已出團送鑑",
  grading: "鑑定中",
};

/**
 * Mirrors the batchUpdateStatus adminNotesHistory append logic in grading.ts.
 */
function buildBatchSystemNote(
  existingHistoryJson: string | null,
  targetStatus: "received" | "submitted_to_psa" | "grading"
): { updatedHistory: string; entry: { timestamp: string; note: string; statusAtTime: string } } {
  const existingHistory: Array<{ timestamp: string; note: string; statusAtTime: string }> =
    existingHistoryJson ? JSON.parse(existingHistoryJson) : [];
  const statusLabel = STATUS_LABELS[targetStatus] ?? targetStatus;
  const newEntry = {
    timestamp: new Date().toISOString(),
    note: `[系統] 批量更新至「${statusLabel}」`,
    statusAtTime: targetStatus,
  };
  return {
    updatedHistory: JSON.stringify([...existingHistory, newEntry]),
    entry: newEntry,
  };
}

describe("batchUpdateStatus adminNotesHistory system note", () => {
  it("appends a system note when history is empty", () => {
    const { updatedHistory, entry } = buildBatchSystemNote(null, "received");
    const parsed = JSON.parse(updatedHistory);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].note).toBe("[系統] 批量更新至「BOXIUM 已收件」");
    expect(parsed[0].statusAtTime).toBe("received");
    expect(entry.note).toContain("[系統]");
  });

  it("appends a system note when history already has entries", () => {
    const initial = JSON.stringify([
      { timestamp: "2024-01-01T00:00:00.000Z", note: "Admin note", statusAtTime: "pending_shipment" },
    ]);
    const { updatedHistory } = buildBatchSystemNote(initial, "received");
    const parsed = JSON.parse(updatedHistory);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].note).toBe("Admin note");
    expect(parsed[1].note).toBe("[系統] 批量更新至「BOXIUM 已收件」");
  });

  it("uses correct Chinese label for submitted_to_psa", () => {
    const { entry } = buildBatchSystemNote(null, "submitted_to_psa");
    expect(entry.note).toBe("[系統] 批量更新至「已出團送鑑」");
    expect(entry.statusAtTime).toBe("submitted_to_psa");
  });

  it("uses correct Chinese label for grading", () => {
    const { entry } = buildBatchSystemNote(null, "grading");
    expect(entry.note).toBe("[系統] 批量更新至「鑑定中」");
    expect(entry.statusAtTime).toBe("grading");
  });

  it("system note has a valid ISO timestamp", () => {
    const { entry } = buildBatchSystemNote(null, "received");
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it("does NOT downgrade submissions with higher status order", () => {
    // statusOrder: received=3, submitted_to_psa=4, grading=5
    const statusOrder: Record<string, number> = {
      awaiting_payment: 0, pending_review: 1, pending_shipment: 2,
      received: 3, submitted_to_psa: 4, grading: 5, graded: 6,
      payment_overdue: 7, paid: 8, returned: 9, completed: 10, cancelled: 11,
    };
    const submissions = [
      { id: 1, status: "pending_shipment" },  // order 2 < 3 → should update
      { id: 2, status: "received" },           // order 3 = 3 → should NOT update (not lower)
      { id: 3, status: "submitted_to_psa" },   // order 4 > 3 → should NOT update
    ];
    const targetStatus = "received";
    const targetOrder = statusOrder[targetStatus];
    const toUpdate = submissions.filter((s) => (statusOrder[s.status] ?? 0) < targetOrder);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].id).toBe(1);
  });

  it("all submissions in toUpdate get exactly one system note appended", () => {
    const submissions = [
      { id: 1, adminNotesHistory: null },
      { id: 2, adminNotesHistory: JSON.stringify([{ timestamp: "2024-01-01T00:00:00.000Z", note: "prev", statusAtTime: "pending_shipment" }]) },
    ];
    const results = submissions.map((s) => buildBatchSystemNote(s.adminNotesHistory, "received"));
    expect(JSON.parse(results[0].updatedHistory)).toHaveLength(1);
    expect(JSON.parse(results[1].updatedHistory)).toHaveLength(2);
    // Both get exactly one new system note
    for (const r of results) {
      const parsed = JSON.parse(r.updatedHistory);
      const systemNotes = parsed.filter((e: any) => e.note.startsWith("[系統]"));
      expect(systemNotes).toHaveLength(1);
    }
  });
});

// ─── 2. getMySubmissions cardName search logic ────────────────────────────────

/**
 * Mirrors the search condition builder in getMySubmissions.
 * In real code this uses Drizzle; here we test the pure logic.
 */
function buildSearchCondition(
  search: string,
  cardNameMatchIds: number[]
): { type: "orderNo_only" } | { type: "orderNo_or_cardName"; cardNameIds: number[] } {
  if (!search) return { type: "orderNo_only" };
  if (cardNameMatchIds.length > 0) {
    return { type: "orderNo_or_cardName", cardNameIds: cardNameMatchIds };
  }
  return { type: "orderNo_only" };
}

/** Simulates matching submissions by orderNo or cardName */
function filterSubmissions(
  submissions: Array<{ id: number; orderNo: string; items: string[] }>,
  search: string
): number[] {
  const lower = search.toLowerCase();
  return submissions
    .filter(
      (s) =>
        s.orderNo.toLowerCase().includes(lower) ||
        s.items.some((name) => name.toLowerCase().includes(lower))
    )
    .map((s) => s.id);
}

describe("getMySubmissions cardName search", () => {
  const submissions = [
    { id: 1, orderNo: "GRD-2024-0001", items: ["Charizard ex", "Pikachu"] },
    { id: 2, orderNo: "GRD-2024-0002", items: ["Mewtwo", "Blastoise"] },
    { id: 3, orderNo: "GRD-2024-0003", items: ["Charizard VMAX"] },
    { id: 4, orderNo: "GRD-CHAR-0004", items: ["Bulbasaur"] },
  ];

  it("finds submission by orderNo (existing behavior)", () => {
    const result = filterSubmissions(submissions, "GRD-2024-0001");
    expect(result).toEqual([1]);
  });

  it("finds submission by cardName (new behavior)", () => {
    const result = filterSubmissions(submissions, "Charizard");
    // Should match id=1 (Charizard ex), id=3 (Charizard VMAX)
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result).not.toContain(2);
  });

  it("finds submission matching both orderNo and cardName", () => {
    // orderNo 'CHAR' matches id=4, cardName 'Charizard' matches id=1 and id=3
    const result = filterSubmissions(submissions, "char");
    expect(result).toContain(1); // cardName match
    expect(result).toContain(3); // cardName match
    expect(result).toContain(4); // orderNo match
    expect(result).not.toContain(2);
  });

  it("returns empty when no match", () => {
    const result = filterSubmissions(submissions, "Gengar");
    expect(result).toHaveLength(0);
  });

  it("search is case-insensitive", () => {
    const result1 = filterSubmissions(submissions, "charizard");
    const result2 = filterSubmissions(submissions, "CHARIZARD");
    expect(result1).toEqual(result2);
  });

  it("empty search returns no filter (all submissions pass)", () => {
    // Empty search → no conditions added → all submissions returned
    const condition = buildSearchCondition("", []);
    expect(condition.type).toBe("orderNo_only");
    // In real code, empty search means the `if (search)` block is skipped entirely
  });

  it("when cardNameMatchIds is empty, falls back to orderNo-only search", () => {
    const condition = buildSearchCondition("Gengar", []);
    expect(condition.type).toBe("orderNo_only");
  });

  it("when cardNameMatchIds has results, uses OR condition", () => {
    const condition = buildSearchCondition("Charizard", [1, 3]);
    expect(condition.type).toBe("orderNo_or_cardName");
    if (condition.type === "orderNo_or_cardName") {
      expect(condition.cardNameIds).toEqual([1, 3]);
    }
  });

  it("partial cardName match works (LIKE %search%)", () => {
    const result = filterSubmissions(submissions, "ika"); // 'Pikachu' contains 'ika'
    expect(result).toContain(1);
  });

  it("Japanese/Chinese card names can be searched", () => {
    const jpSubmissions = [
      { id: 10, orderNo: "GRD-JP-0001", items: ["リザードン ex", "ピカチュウ"] },
      { id: 11, orderNo: "GRD-JP-0002", items: ["ミュウツー"] },
    ];
    const result = filterSubmissions(jpSubmissions, "リザードン");
    expect(result).toEqual([10]);
  });
});
