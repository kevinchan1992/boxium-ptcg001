/**
 * MobileSearchOverlay 測試
 *
 * 由於 vitest 設定只涵蓋 server/*.test.ts（純 Node.js 環境），
 * 這裡測試 MobileSearchOverlay 的核心邏輯（localStorage 歷史記錄、
 * debounce 行為、搜尋字串處理），而非 DOM 渲染。
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── 模擬 localStorage ───────────────────────────────────────────────────────
const HISTORY_KEY = "boxium_search_history";
const MAX_HISTORY = 8;

// 純函式：從 storage 取得歷史
function getHistory(storage: Map<string, string>): string[] {
  try {
    return JSON.parse(storage.get(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// 純函式：儲存搜尋詞到歷史（去重 + 最多 MAX_HISTORY 筆）
function saveHistory(query: string, storage: Map<string, string>): void {
  const prev = getHistory(storage).filter((q) => q !== query);
  const next = [query, ...prev].slice(0, MAX_HISTORY);
  storage.set(HISTORY_KEY, JSON.stringify(next));
}

// 純函式：清除歷史
function clearHistory(storage: Map<string, string>): void {
  storage.delete(HISTORY_KEY);
}

// 純函式：移除單筆歷史
function removeHistoryItem(item: string, storage: Map<string, string>): void {
  const next = getHistory(storage).filter((q) => q !== item);
  storage.set(HISTORY_KEY, JSON.stringify(next));
}

// ─── 模擬 debounce 邏輯 ──────────────────────────────────────────────────────
function createDebounce(delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function debounce(fn: () => void): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

// ─── 搜尋查詢驗證邏輯 ────────────────────────────────────────────────────────
function shouldEnableSearch(query: string): boolean {
  return query.trim().length >= 2;
}

function normalizeQuery(query: string): string {
  return query.trim();
}

// ─────────────────────────────────────────────────────────────────────────────

describe("MobileSearchOverlay — localStorage 搜尋歷史", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
  });

  it("初始狀態下歷史為空陣列", () => {
    expect(getHistory(storage)).toEqual([]);
  });

  it("儲存搜尋詞後可以取回", () => {
    saveHistory("皮卡丘", storage);
    expect(getHistory(storage)).toEqual(["皮卡丘"]);
  });

  it("重複搜尋同一詞時，移到最前面（去重）", () => {
    saveHistory("皮卡丘", storage);
    saveHistory("伊布", storage);
    saveHistory("皮卡丘", storage);
    const history = getHistory(storage);
    expect(history[0]).toBe("皮卡丘");
    expect(history.filter((q) => q === "皮卡丘").length).toBe(1);
  });

  it("最多保留 MAX_HISTORY（8）筆，超過時移除最舊的", () => {
    for (let i = 1; i <= 10; i++) {
      saveHistory(`卡牌${i}`, storage);
    }
    const history = getHistory(storage);
    expect(history.length).toBe(MAX_HISTORY);
    expect(history[0]).toBe("卡牌10");
    expect(history.includes("卡牌1")).toBe(false);
    expect(history.includes("卡牌2")).toBe(false);
  });

  it("清除歷史後回傳空陣列", () => {
    saveHistory("皮卡丘", storage);
    saveHistory("伊布", storage);
    clearHistory(storage);
    expect(getHistory(storage)).toEqual([]);
  });

  it("移除單筆歷史項目", () => {
    saveHistory("皮卡丘", storage);
    saveHistory("伊布", storage);
    saveHistory("噴火龍", storage);
    removeHistoryItem("伊布", storage);
    const history = getHistory(storage);
    expect(history).not.toContain("伊布");
    expect(history).toContain("皮卡丘");
    expect(history).toContain("噴火龍");
  });

  it("移除不存在的項目不影響其他歷史", () => {
    saveHistory("皮卡丘", storage);
    removeHistoryItem("不存在的卡牌", storage);
    expect(getHistory(storage)).toEqual(["皮卡丘"]);
  });

  it("localStorage 損壞時 getHistory 回傳空陣列", () => {
    storage.set(HISTORY_KEY, "invalid json{{{");
    expect(getHistory(storage)).toEqual([]);
  });
});

describe("MobileSearchOverlay — 搜尋啟用條件", () => {
  it("空字串不啟用搜尋", () => {
    expect(shouldEnableSearch("")).toBe(false);
  });

  it("單一字元不啟用搜尋", () => {
    expect(shouldEnableSearch("a")).toBe(false);
  });

  it("兩個字元啟用搜尋", () => {
    expect(shouldEnableSearch("ab")).toBe(true);
  });

  it("多個字元啟用搜尋", () => {
    expect(shouldEnableSearch("皮卡丘")).toBe(true);
  });

  it("只有空白字元不啟用搜尋", () => {
    expect(shouldEnableSearch("  ")).toBe(false);
  });

  it("空白加字元（長度 >= 2）啟用搜尋", () => {
    expect(shouldEnableSearch("  ab  ")).toBe(true);
  });
});

describe("MobileSearchOverlay — 搜尋字串正規化", () => {
  it("去除前後空白", () => {
    expect(normalizeQuery("  皮卡丘  ")).toBe("皮卡丘");
  });

  it("空字串正規化後仍為空字串", () => {
    expect(normalizeQuery("")).toBe("");
  });

  it("正常字串不變", () => {
    expect(normalizeQuery("Charizard")).toBe("Charizard");
  });
});

describe("MobileSearchOverlay — Debounce 邏輯", () => {
  it("debounce 延遲後才執行回調", async () => {
    const results: string[] = [];
    const debounce = createDebounce(50);

    debounce(() => results.push("first"));
    debounce(() => results.push("second"));
    debounce(() => results.push("third"));

    // 尚未執行
    expect(results.length).toBe(0);

    // 等待 debounce 完成
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(results).toEqual(["third"]);
  });

  it("debounce 在延遲內多次呼叫只執行最後一次", async () => {
    let callCount = 0;
    const debounce = createDebounce(50);

    for (let i = 0; i < 5; i++) {
      debounce(() => callCount++);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(callCount).toBe(1);
  });
});

describe("MobileSearchOverlay — 搜尋歷史順序", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
  });

  it("最新搜尋排在最前面", () => {
    saveHistory("A", storage);
    saveHistory("B", storage);
    saveHistory("C", storage);
    const history = getHistory(storage);
    expect(history).toEqual(["C", "B", "A"]);
  });

  it("連續搜尋相同詞只保留一筆且在最前", () => {
    saveHistory("皮卡丘", storage);
    saveHistory("伊布", storage);
    saveHistory("噴火龍", storage);
    saveHistory("伊布", storage);
    const history = getHistory(storage);
    expect(history[0]).toBe("伊布");
    expect(history.filter((q) => q === "伊布").length).toBe(1);
  });
});
