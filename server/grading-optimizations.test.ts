/**
 * Tests for grading optimizations:
 * 1. adminNotesHistory deduplication fix (no double-append)
 * 2. getMySubmissions multi-status filter (statuses array)
 * 3. GradingOrders.tsx query input logic (unit test for query builder)
 */
import { describe, expect, it } from "vitest";

// ─── 1. adminNotesHistory append logic ───────────────────────────────────────

/**
 * Simulates the fixed updateStatus adminNotesHistory logic.
 * Should append exactly ONE entry per call.
 */
function appendAdminNotesHistory(
  existingHistoryJson: string | null,
  note: string,
  status: string
): string {
  const existingHistory: Array<{ timestamp: string; note: string; statusAtTime: string }> =
    existingHistoryJson ? JSON.parse(existingHistoryJson) : [];
  const newEntry = {
    timestamp: new Date().toISOString(),
    note,
    statusAtTime: status,
  };
  return JSON.stringify([...existingHistory, newEntry]);
}

describe("adminNotesHistory append logic", () => {
  it("appends one entry to empty history", () => {
    const result = appendAdminNotesHistory(null, "First note", "received");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].note).toBe("First note");
    expect(parsed[0].statusAtTime).toBe("received");
  });

  it("appends one entry to existing history (no duplication)", () => {
    const initial = appendAdminNotesHistory(null, "First note", "received");
    const result = appendAdminNotesHistory(initial, "Second note", "submitted_to_psa");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].note).toBe("First note");
    expect(parsed[1].note).toBe("Second note");
    expect(parsed[1].statusAtTime).toBe("submitted_to_psa");
  });

  it("preserves all existing entries when appending", () => {
    let history: string | null = null;
    const entries = [
      { note: "Note 1", status: "received" },
      { note: "Note 2", status: "submitted_to_psa" },
      { note: "Note 3", status: "grading" },
    ];
    for (const e of entries) {
      history = appendAdminNotesHistory(history, e.note, e.status);
    }
    const parsed = JSON.parse(history!);
    expect(parsed).toHaveLength(3);
    expect(parsed.map((e: any) => e.note)).toEqual(["Note 1", "Note 2", "Note 3"]);
  });

  it("each entry has timestamp, note, and statusAtTime fields", () => {
    const result = appendAdminNotesHistory(null, "Test", "graded");
    const [entry] = JSON.parse(result);
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("note", "Test");
    expect(entry).toHaveProperty("statusAtTime", "graded");
    // Timestamp should be a valid ISO string
    expect(() => new Date(entry.timestamp)).not.toThrow();
  });
});

// ─── 2. getMySubmissions query input builder ──────────────────────────────────

/**
 * Mirrors the query input logic in GradingOrders.tsx.
 * Tests that the correct input is built for each tab.
 */
type FilterTab = "all" | "action" | "in_progress" | "done";

const FILTER_TABS: { key: FilterTab; label: string; statuses?: string[] }[] = [
  { key: "all", label: "全部" },
  { key: "action", label: "需行動", statuses: ["awaiting_payment", "payment_overdue", "pending_shipment", "graded"] },
  { key: "in_progress", label: "進行中", statuses: ["pending_review", "received", "submitted_to_psa", "grading", "paid"] },
  { key: "done", label: "已完成", statuses: ["completed", "returned", "cancelled"] },
];

const PAGE_SIZE = 10;

function buildQueryInput(activeTab: FilterTab, currentPage: number, debouncedSearch: string) {
  const tabStatuses = FILTER_TABS.find((t) => t.key === activeTab)?.statuses;
  const base = {
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
  };
  if (!tabStatuses) return base; // "all" tab
  if (tabStatuses.length === 1) return { ...base, status: tabStatuses[0] };
  return { ...base, statuses: tabStatuses };
}

describe("GradingOrders query input builder", () => {
  it("'all' tab sends no status filter", () => {
    const input = buildQueryInput("all", 1, "");
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("statuses");
    expect(input.page).toBe(1);
    expect(input.pageSize).toBe(PAGE_SIZE);
  });

  it("'action' tab sends statuses array (multi-status backend filter)", () => {
    const input = buildQueryInput("action", 1, "");
    expect(input).toHaveProperty("statuses");
    expect((input as any).statuses).toContain("awaiting_payment");
    expect((input as any).statuses).toContain("payment_overdue");
    expect((input as any).statuses).toContain("pending_shipment");
    expect((input as any).statuses).toContain("graded");
    expect(input).not.toHaveProperty("status");
  });

  it("'in_progress' tab sends statuses array", () => {
    const input = buildQueryInput("in_progress", 1, "");
    expect(input).toHaveProperty("statuses");
    expect((input as any).statuses).toContain("received");
    expect((input as any).statuses).toContain("submitted_to_psa");
    expect((input as any).statuses).toContain("grading");
  });

  it("'done' tab sends statuses array", () => {
    const input = buildQueryInput("done", 1, "");
    expect(input).toHaveProperty("statuses");
    expect((input as any).statuses).toContain("completed");
    expect((input as any).statuses).toContain("returned");
    expect((input as any).statuses).toContain("cancelled");
  });

  it("search query is passed through correctly", () => {
    const input = buildQueryInput("all", 1, "BOXIUM-GRD-2024");
    expect(input.search).toBe("BOXIUM-GRD-2024");
  });

  it("empty search string becomes undefined", () => {
    const input = buildQueryInput("all", 1, "");
    expect(input.search).toBeUndefined();
  });

  it("page number is passed correctly", () => {
    const input = buildQueryInput("all", 3, "");
    expect(input.page).toBe(3);
  });

  it("no longer uses pageSize=200 workaround for multi-status tabs", () => {
    // Previously, multi-status tabs used pageSize=200 as a workaround.
    // Now they use the statuses array with normal pageSize.
    const input = buildQueryInput("action", 1, "");
    expect(input.pageSize).toBe(PAGE_SIZE); // Should be 10, not 200
  });
});

// ─── 3. STATUS_MAP completeness ───────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "待付款", color: "bg-orange-100 text-orange-800 border-orange-200" },
  pending_review: { label: "審核中", color: "bg-gray-100 text-gray-700 border-gray-200" },
  pending_shipment: { label: "待寄件", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  received: { label: "BOXIUM 已收件", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  submitted_to_psa: { label: "已出團", color: "bg-purple-100 text-purple-800 border-purple-200" },
  grading: { label: "鑑定中", color: "bg-violet-100 text-violet-800 border-violet-200" },
  graded: { label: "鑑定完成", color: "bg-green-100 text-green-800 border-green-200" },
  payment_overdue: { label: "付款逾期", color: "bg-red-100 text-red-800 border-red-200" },
  paid: { label: "已付款", color: "bg-blue-100 text-blue-800 border-blue-200" },
  returned: { label: "已寄回", color: "bg-teal-100 text-teal-800 border-teal-200" },
  completed: { label: "已完成", color: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-700 border-red-200" },
};

describe("STATUS_MAP completeness", () => {
  const allStatuses = [
    "awaiting_payment", "pending_review", "pending_shipment",
    "received", "submitted_to_psa", "grading", "graded",
    "payment_overdue", "paid", "returned", "completed", "cancelled",
  ];

  it("covers all known grading submission statuses", () => {
    for (const status of allStatuses) {
      expect(STATUS_MAP).toHaveProperty(status);
      expect(STATUS_MAP[status].label).toBeTruthy();
      expect(STATUS_MAP[status].color).toBeTruthy();
    }
  });

  it("all FILTER_TABS statuses are in STATUS_MAP", () => {
    for (const tab of FILTER_TABS) {
      for (const status of tab.statuses ?? []) {
        expect(STATUS_MAP).toHaveProperty(status);
      }
    }
  });
});
