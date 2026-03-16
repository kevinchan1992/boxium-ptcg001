/**
 * CardSearchDropdown
 *
 * A search input that shows a card-image dropdown as the user types.
 *
 * Key design decisions to avoid the "dropdown won't close" bug:
 *  - `isOpen` is ONLY set to true inside the onChange handler (user typing).
 *  - `isOpen` is set to false in exactly two places:
 *      1. handleSubmit  – user presses Enter / clicks Search
 *      2. handleBlur    – input loses focus (with mousedown guard)
 *  - No useEffect watches `suggestions` or `debouncedQuery` to re-open the panel.
 *  - The tRPC query is enabled only when `isOpen && debouncedQuery.length >= 2`.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

interface CardSearchDropdownProps {
  /** Controlled value of the input */
  value: string;
  /** Called whenever the user types */
  onChange: (value: string) => void;
  /**
   * Called when the user submits (Enter or Search button).
   * The parent is responsible for navigation.
   */
  onSubmit: (query: string) => void;
  /** Prefix for card link navigation, e.g. "card" → /card/{id}, "pricing" → /pricing/{id} */
  cardLinkPrefix?: "card" | "pricing";
  className?: string;
  inputClassName?: string;
  /** Optional placeholder override */
  placeholder?: string;
}

export function CardSearchDropdown({
  value,
  onChange,
  onSubmit,
  cardLinkPrefix = "card",
  className = "",
  inputClassName = "",
  placeholder,
}: CardSearchDropdownProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // ── Dropdown open/close state ────────────────────────────────────────────
  // RULE: only set to true inside handleChange (user is actively typing).
  const [isOpen, setIsOpen] = useState(false);

  // ── Debounced query for the tRPC call ────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Guard: if the user presses mousedown on a suggestion, don't close on blur
  const mousedownOnDropdownRef = useRef(false);

  // Input ref for programmatic blur
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the value → debouncedQuery (300 ms)
  useEffect(() => {
    if (!isOpen) {
      // Panel is closed – no need to fetch
      setDebouncedQuery("");
      return;
    }
    const id = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [value, isOpen]);

  // ── tRPC query ────────────────────────────────────────────────────────────
  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 5 },
    {
      enabled: isOpen && debouncedQuery.length >= 2,
      staleTime: 30_000,
    }
  );

  const suggestions = data?.cards ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      onChange(v);
      // Only open when user is actively typing and has enough chars
      setIsOpen(v.trim().length >= 2);
    },
    [onChange]
  );

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setDebouncedQuery("");
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      closeDropdown();
      inputRef.current?.blur();
      if (value.trim()) {
        onSubmit(value.trim());
      }
    },
    [value, onSubmit, closeDropdown]
  );

  const handleBlur = useCallback(() => {
    // If the user clicked a suggestion (mousedown fired first), don't close
    if (mousedownOnDropdownRef.current) return;
    closeDropdown();
  }, [closeDropdown]);

  const handleSuggestionClick = useCallback(
    (cardId: number) => {
      closeDropdown();
      inputRef.current?.blur();
      setLocation(`/${cardLinkPrefix}/${cardId}`);
    },
    [cardLinkPrefix, setLocation, closeDropdown]
  );

  // ── Format price ──────────────────────────────────────────────────────────
  const formatPrice = (price: number | null) => {
    if (!price) return null;
    return `HKD ${price.toLocaleString("zh-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search input */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder ?? t("research.searchPlaceholder")}
            className={`pl-12 pr-4 ${inputClassName}`}
            autoComplete="off"
          />
          {isFetching && isOpen && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </form>

      {/* Dropdown panel */}
      {isOpen && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          onMouseDown={() => {
            mousedownOnDropdownRef.current = true;
          }}
          onMouseUp={() => {
            // Reset after a tick so handleBlur can read the flag
            setTimeout(() => {
              mousedownOnDropdownRef.current = false;
            }, 0);
          }}
        >
          {/* Grid: 5 cols on desktop, 3 cols on mobile/tablet */}
          <div className="p-3 grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[420px] overflow-y-auto">
            {suggestions.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSuggestionClick(card.id)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-accent/60 transition-colors text-left group"
              >
                {/* Card image */}
                <div className="w-full aspect-[2/3] relative overflow-hidden rounded-md bg-muted">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name ?? ""}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      No Image
                    </div>
                  )}
                </div>

                {/* Card name */}
                <p className="text-[10px] sm:text-xs text-foreground font-medium leading-tight line-clamp-2 w-full text-center">
                  {card.name ?? card.nameJa ?? "—"}
                </p>

                {/* Card number */}
                {card.cardNumber && (
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight w-full text-center">
                    {card.cardNumber}
                  </p>
                )}

                {/* PSA10 price */}
                {card.latestPrice ? (
                  <p className="text-[9px] sm:text-[10px] font-semibold text-amber-400 leading-tight w-full text-center">
                    {formatPrice(card.latestPrice)}
                  </p>
                ) : (
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 leading-tight w-full text-center">
                    —
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Footer: "See all results" */}
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("search.showingTop5", { defaultValue: "顯示前 5 筆結果" })}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              className="text-xs text-primary hover:underline font-medium"
            >
              {t("search.viewAllResults", { defaultValue: "查看全部結果 →" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
