/**
 * CardSearchDropdown
 * A reusable search input with an auto-complete dropdown that shows card images.
 * Debounces the query (300 ms), fetches up to 5 results, and renders them as
 * image cards below the input.  Keyboard navigation (↑ ↓ Enter Esc) is supported.
 *
 * Responsive layout:
 *   - Mobile  (<640px): vertical list (1 column, image thumbnail + name + price)
 *   - Tablet  (640-1023px): 3-column grid
 *   - Desktop (1024px+): 5-column grid
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { LazyImage } from "@/components/LazyImage";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/formatCurrency";

interface CardSearchDropdownProps {
  /** Controlled value */
  value: string;
  /** Called on every keystroke */
  onChange: (value: string) => void;
  /** Called when the user submits the form (Enter or button) */
  onSubmit: (value: string) => void;
  /** Optional extra class for the outer wrapper */
  className?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Extra element rendered inside the input (e.g. camera button) */
  rightElement?: React.ReactNode;
  /** Extra element rendered inside the input (e.g. typing animation) */
  placeholderOverlay?: React.ReactNode;
  /** CSS class forwarded to the <Input> element */
  inputClassName?: string;
  /** Where to navigate on card click: "card" → /card/:id, "pricing" → /pricing/card/:id */
  cardLinkPrefix?: "card" | "pricing/card";
}

export function CardSearchDropdown({
  value,
  onChange,
  onSubmit,
  className = "",
  placeholder = "",
  rightElement,
  placeholderOverlay,
  inputClassName = "",
  cardLinkPrefix = "card",
}: CardSearchDropdownProps) {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (value.trim().length >= 2) {
      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(value.trim());
      }, 300);
    } else {
      setDebouncedQuery("");
      setIsOpen(false);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value]);

  // ── Fetch suggestions ─────────────────────────────────────────────────────
  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 5, offset: 0 },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 30_000,
      retry: 0,
    }
  );

  const suggestions = data?.cards?.slice(0, 5) ?? [];

  // Show dropdown when we have results
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsOpen(true);
      setActiveIndex(-1);
    }
  }, [debouncedQuery, suggestions.length]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, -1));
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const card = suggestions[activeIndex];
        if (card) handleCardClick(card);
      }
    },
    [isOpen, suggestions, activeIndex]
  );

  // ── Card click ────────────────────────────────────────────────────────────
  const handleCardClick = (card: any) => {
    setIsOpen(false);
    setActiveIndex(-1);
    setLocation(`/${cardLinkPrefix}/${card.id}`);
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    onSubmit(value);
  };

  const showDropdown = isOpen && debouncedQuery.length >= 2 && (isFetching || suggestions.length > 0);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleFormSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              if (debouncedQuery.length >= 2 && suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={`w-full pl-12 ${inputClassName}`}
            autoComplete="off"
          />
          {/* Typing animation overlay */}
          {placeholderOverlay}
          {/* Right element (e.g. camera button) */}
          {rightElement}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {isFetching && suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              搜尋中...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              找不到相關卡牌
            </div>
          ) : (
            <div className="p-2">
              {/* ── Mobile: vertical list ── */}
              <div className="flex flex-col gap-1 sm:hidden">
                {suggestions.map((card: any, idx: number) => (
                  <button
                    key={card.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCardClick(card);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                      activeIndex === idx
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {card.imageUrl ? (
                        <LazyImage
                          src={card.imageUrl}
                          alt={card.name || ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">
                          No Img
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-tight line-clamp-2 font-medium">
                        {card.name || card.nameJa || "—"}
                      </p>
                      {card.cardNumber && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {card.cardNumber}
                        </p>
                      )}
                      {/* PSA10 price */}
                      <p className={`text-xs mt-1 font-semibold ${card.latestPrice ? "text-primary" : "text-muted-foreground"}`}>
                        {card.latestPrice
                          ? formatCurrency(card.latestPrice, "HKD")
                          : "暫無價格"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* ── Tablet: 3-column grid ── */}
              <div className="hidden sm:grid lg:hidden grid-cols-3 gap-2">
                {suggestions.map((card: any, idx: number) => (
                  <CardGridItem
                    key={card.id}
                    card={card}
                    idx={idx}
                    activeIndex={activeIndex}
                    onMouseDown={() => handleCardClick(card)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  />
                ))}
              </div>

              {/* ── Desktop: 5-column grid ── */}
              <div className="hidden lg:grid grid-cols-5 gap-2">
                {suggestions.map((card: any, idx: number) => (
                  <CardGridItem
                    key={card.id}
                    card={card}
                    idx={idx}
                    activeIndex={activeIndex}
                    onMouseDown={() => handleCardClick(card)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  />
                ))}
              </div>

              {/* Footer hint */}
              <div className="mt-2 pt-2 border-t border-border flex items-center justify-between px-1">
                <p className="text-[10px] text-muted-foreground">
                  顯示前 {suggestions.length} 筆結果
                </p>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                    onSubmit(value);
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  查看全部結果 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared grid card item (tablet + desktop) ──────────────────────────────────
interface CardGridItemProps {
  card: any;
  idx: number;
  activeIndex: number;
  onMouseDown: () => void;
  onMouseEnter: () => void;
}

function CardGridItem({ card, idx, activeIndex, onMouseDown, onMouseEnter }: CardGridItemProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      onMouseEnter={onMouseEnter}
      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors text-left group ${
        activeIndex === idx
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-muted"
      }`}
    >
      {/* Card image */}
      <div className="w-full aspect-[2/3] rounded-md overflow-hidden bg-muted flex-shrink-0">
        {card.imageUrl ? (
          <LazyImage
            src={card.imageUrl}
            alt={card.name || ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No Image
          </div>
        )}
      </div>
      {/* Card name */}
      <p className="text-xs text-foreground leading-tight line-clamp-2 text-center w-full">
        {card.name || card.nameJa || "—"}
      </p>
      {/* Card number */}
      {card.cardNumber && (
        <p className="text-[10px] text-muted-foreground truncate w-full text-center">
          {card.cardNumber}
        </p>
      )}
      {/* PSA10 price */}
      <p className={`text-[10px] font-semibold w-full text-center ${card.latestPrice ? "text-primary" : "text-muted-foreground"}`}>
        {card.latestPrice
          ? formatCurrency(card.latestPrice, "HKD")
          : "暫無價格"}
      </p>
    </button>
  );
}
