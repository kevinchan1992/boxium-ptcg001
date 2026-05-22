/**
 * MobileSearchOverlay
 * 手機版全螢幕搜尋覆蓋層
 * - 點擊搜尋框後從底部滑出（手機版）
 * - 顯示搜尋歷史（localStorage）
 * - 顯示即時建議（trpc.cards.search）
 * - 桌面版不顯示（md:hidden）
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, X, Clock, TrendingUp, ArrowRight, Loader2, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

const HISTORY_KEY = "boxium_search_history";
const MAX_HISTORY = 8;

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(query: string) {
  const prev = getHistory().filter((q) => q !== query);
  const next = [query, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

interface MobileSearchOverlayProps {
  /** 初始搜尋詞（從外部傳入，例如 Research 頁面的 searchQuery） */
  initialQuery?: string;
  /** 搜尋框的 placeholder */
  placeholder?: string;
  /** 觸發搜尋時的回調（跳轉到搜尋結果頁） */
  onSearch: (query: string) => void;
  /** 點擊卡牌建議時的回調 */
  cardLinkPrefix?: string;
  /** 點擊相機按鈕時的回調（圖片搜尋） */
  onCameraClick?: () => void;
}

export function MobileSearchOverlay({
  initialQuery = "",
  placeholder,
  onSearch,
  cardLinkPrefix = "card",
  onCameraClick,
}: MobileSearchOverlayProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce query for API call
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // tRPC search suggestions
  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 6 },
    {
      enabled: debouncedQuery.trim().length >= 2,
      staleTime: 30_000,
    }
  );
  const suggestions = data?.cards ?? [];

  const openOverlay = useCallback(() => {
    setHistory(getHistory());
    setIsOpen(true);
    // Focus input after animation
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOpen(false);
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      saveHistory(trimmed);
      setIsOpen(false);
      onSearch(trimmed);
    },
    [onSearch]
  );

  const handleCardClick = useCallback(
    (cardId: number) => {
      setIsOpen(false);
      setLocation(`/${cardLinkPrefix}/${cardId}`);
    },
    [cardLinkPrefix, setLocation]
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  const handleRemoveHistoryItem = useCallback((item: string) => {
    const next = getHistory().filter((q) => q !== item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  }, []);

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeOverlay]);

  const showSuggestions = debouncedQuery.trim().length >= 2;
  const showHistory = !showSuggestions && history.length > 0;

  return (
    <>
      {/* Trigger button — only visible on mobile (< md) */}
      <div className="md:hidden relative">
        <button
          type="button"
          onClick={openOverlay}
          className="w-full text-left"
          aria-label="開啟搜尋"
        >
          <div className="flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl text-muted-foreground pr-14">
            <Search className="w-5 h-5 shrink-0" />
            <span className="text-sm truncate">
              {initialQuery || placeholder || t("research.searchPlaceholder")}
            </span>
          </div>
        </button>
        {onCameraClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCameraClick(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
            aria-label="圖片搜尋"
            title="圖片搜尋"
          >
            <Camera className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-[200] bg-background/80 backdrop-blur-sm"
          onClick={closeOverlay}
        />
      )}

      {/* Overlay panel — slides up from bottom */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-[201] bg-background rounded-t-2xl shadow-2xl border-t border-border transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "90dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Search input */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch(query);
                }}
                placeholder={placeholder || t("research.searchPlaceholder")}
                className="w-full pl-9 pr-8 py-3 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={closeOverlay}
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground px-1 py-2"
            >
              取消
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="overflow-y-auto pb-safe" style={{ maxHeight: "calc(90dvh - 100px)" }}>
          {/* Loading indicator */}
          {isFetching && showSuggestions && (
            <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>搜尋中...</span>
            </div>
          )}

          {/* Instant suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                搜尋建議
              </p>
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map((card: any) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleCardClick(card.id)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50 hover:bg-muted active:scale-95 transition-all text-left"
                  >
                    <div className="w-full aspect-[2/3] relative overflow-hidden rounded-md bg-muted">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name ?? ""}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-foreground font-medium leading-tight line-clamp-2 w-full text-center">
                      {card.name ?? card.nameJa ?? "—"}
                    </p>
                    {card.latestPrice && (
                      <p className="text-[9px] font-semibold text-amber-400 w-full text-center">
                        HKD {card.latestPrice.toLocaleString()}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {/* View all results */}
              <button
                type="button"
                onClick={() => handleSearch(query)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 active:scale-95 transition-all"
              >
                查看「{query}」的全部結果
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* No results */}
          {showSuggestions && !isFetching && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">
              找不到符合「{query}」的卡牌
            </div>
          )}

          {/* Search history */}
          {showHistory && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  最近搜尋
                </p>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  清除
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-0.5 bg-muted rounded-full px-2.5 py-1 max-w-[160px]"
                  >
                    <button
                      type="button"
                      onClick={() => handleSearch(item)}
                      className="text-xs text-foreground truncate"
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveHistoryItem(item)}
                      className="text-muted-foreground hover:text-foreground ml-0.5 flex-shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — no history, no query */}
          {!showSuggestions && !showHistory && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>輸入卡牌名稱開始搜尋</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
