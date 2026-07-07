/**
 * EditorialSearchBox
 *
 * A luxury editorial-style search box for Research & Pricing homepages.
 * Features:
 * - Minimal bottom-border style that smoothly expands on focus
 * - When empty + focused: shows "HOT SEARCHES" panel with trending cards
 * - When typing (≥2 chars): delegates to CardSearchDropdown logic for suggestions
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Camera, TrendingUp, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getProxiedImageUrl } from "@/lib/utils";
import { TypeAnimation } from "react-type-animation";

interface EditorialSearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  cardLinkPrefix?: "card" | "pricing";
  placeholder?: string;
  hint?: string;
  showCameraButton?: boolean;
  onCameraClick?: () => void;
  randomCardNames?: string[];
}

export function EditorialSearchBox({
  value,
  onChange,
  onSubmit,
  cardLinkPrefix = "card",
  placeholder = "",
  hint,
  showCameraButton = false,
  onCameraClick,
  randomCardNames = [],
}: EditorialSearchBoxProps) {
  const [, setLocation] = useLocation();
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mousedownOnPanelRef = useRef(false);

  // ── Debounce query ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || value.trim().length < 2) {
      setDebouncedQuery("");
      return;
    }
    const id = setTimeout(() => setDebouncedQuery(value.trim()), 300);
    return () => clearTimeout(id);
  }, [value, isOpen]);

  // ── tRPC: card search suggestions (when typing) ───────────────────────────
  const { data: searchData, isFetching: isSearchFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 6 },
    { enabled: isOpen && debouncedQuery.length >= 2, staleTime: 30_000 }
  );
  const suggestions = searchData?.cards ?? [];

  // ── tRPC: hot searches (when focused + empty) ─────────────────────────────
  const { data: hotSearchData, isLoading: isHotLoading } = trpc.trending.trending.getBySearches.useQuery(
    { limit: 6 },
    { enabled: isFocused, staleTime: 5 * 60_000 }
  );
  const hotCards = hotSearchData ?? [];

  // ── Panel visibility logic ────────────────────────────────────────────────
  // Show suggestions panel when typing ≥2 chars
  const showSuggestions = isOpen && debouncedQuery.length >= 2 && suggestions.length > 0;
  // Show hot searches panel when focused + empty (or < 2 chars)
  const showHotPanel = isFocused && value.trim().length < 2;
  const showAnyPanel = showSuggestions || showHotPanel;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setIsOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    if (mousedownOnPanelRef.current) return;
    setIsFocused(false);
    setIsOpen(false);
    setDebouncedQuery("");
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      onChange(v);
      setIsOpen(v.trim().length >= 2);
    },
    [onChange]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      setIsFocused(false);
      setIsOpen(false);
      setDebouncedQuery("");
      inputRef.current?.blur();
      if (value.trim()) onSubmit(value.trim());
    },
    [value, onSubmit]
  );

  const handleCardClick = useCallback(
    (cardId: number) => {
      setIsFocused(false);
      setIsOpen(false);
      setDebouncedQuery("");
      inputRef.current?.blur();
      setLocation(`/${cardLinkPrefix}/${cardId}`);
    },
    [cardLinkPrefix, setLocation]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setIsOpen(false);
    setDebouncedQuery("");
    inputRef.current?.focus();
  }, [onChange]);

  // ── Format price ──────────────────────────────────────────────────────────
  const formatPrice = (price: number | null | undefined) => {
    if (!price) return null;
    return `HKD ${price.toLocaleString("zh-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* ── Search input row ── */}
      <form onSubmit={handleSubmit}>
        <motion.div
          className="relative flex items-center"
          animate={{ opacity: 1 }}
          initial={{ opacity: 0.6 }}
          transition={{ duration: 0.3 }}
        >
          {/* Animated bottom border */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <motion.div
            className="absolute bottom-0 left-0 h-[1px] origin-left"
            style={{ background: 'rgba(255,255,255,0.5)' }}
            animate={{ scaleX: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0 }}
            initial={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Search icon */}
          <Search
            className="absolute left-0 w-4 h-4 flex-shrink-0 transition-colors duration-300"
            strokeWidth={1.5}
            style={{ color: isFocused ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}
          />

          {/* Input */}
          <motion.input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoComplete="off"
            className="w-full bg-transparent border-0 outline-none ring-0 text-sm py-3 pl-7 pr-16"
            style={{
              color: '#FFFFFF',
              caretColor: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.02em',
            }}
            animate={{ width: isFocused ? '100%' : '100%' }}
          />

          {/* Typing animation placeholder (only when empty + not focused) */}
          {!value && !isFocused && randomCardNames.length > 0 && (
            <div
              className="absolute left-7 top-1/2 -translate-y-1/2 pointer-events-none text-sm select-none"
              style={{ color: '#3a3a3a', letterSpacing: '0.02em' }}
            >
              <TypeAnimation
                sequence={randomCardNames.flatMap((name: string) => [name, 3000])}
                wrapper="span"
                speed={50}
                repeat={Infinity}
              />
            </div>
          )}

          {/* Right-side controls */}
          <div className="absolute right-0 flex items-center gap-1">
            {/* Clear button */}
            <AnimatePresence>
              {value && (
                <motion.button
                  type="button"
                  onClick={handleClear}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; }}
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Loading spinner */}
            {isSearchFetching && isOpen && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
            )}

            {/* Camera button */}
            {showCameraButton && onCameraClick && (
              <button
                type="button"
                onClick={onCameraClick}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{ color: 'rgba(255,255,255,0.25)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.25)'; }}
              >
                <Camera className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </motion.div>
      </form>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {showAnyPanel && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top center' }}
            className="absolute left-0 right-0 top-full mt-3 z-50 overflow-hidden"
            onMouseDown={() => { mousedownOnPanelRef.current = true; }}
            onMouseUp={() => { setTimeout(() => { mousedownOnPanelRef.current = false; }, 0); }}
          >
            {/* Glass panel */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(14, 14, 16, 0.92)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
              }}
            >
              {/* ── HOT SEARCHES panel (when empty) ── */}
              {showHotPanel && (
                <div className="p-4">
                  {/* Panel header */}
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span
                      className="text-[9px] uppercase tracking-[0.25em] font-medium"
                      style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                    >
                      HOT SEARCHES
                    </span>
                  </div>

                  {isHotLoading ? (
                    /* Skeleton */
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex flex-col gap-2 animate-pulse">
                          <div className="aspect-[3/4] rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
                          <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.05)', width: '70%' }} />
                        </div>
                      ))}
                    </div>
                  ) : hotCards.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {hotCards.map((card: any, i: number) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => handleCardClick(card.id)}
                          className="group flex flex-col items-center gap-1.5 text-left"
                        >
                          {/* Rank badge + card image */}
                          <div className="relative w-full aspect-[3/4]">
                            <div
                              className="w-full h-full rounded-lg overflow-hidden"
                              style={{
                                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
                              }}
                            >
                              {card.imageUrl ? (
                                <img
                                  src={getProxiedImageUrl(card.imageUrl) ?? ""}
                                  alt={card.name ?? ""}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-[9px]"
                                  style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)' }}
                                >
                                  —
                                </div>
                              )}
                            </div>
                            {/* Rank number */}
                            <div
                              className="absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold"
                              style={{
                                background: i < 3 ? 'rgba(255,200,50,0.15)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${i < 3 ? 'rgba(255,200,50,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                color: i < 3 ? 'rgba(255,200,50,0.9)' : 'rgba(255,255,255,0.4)',
                                fontFamily: 'monospace',
                              }}
                            >
                              {i + 1}
                            </div>
                          </div>

                          {/* Card number label */}
                          {card.cardNumber && (
                            <p
                              className="text-[8px] uppercase tracking-[0.1em] truncate w-full text-center"
                              style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                            >
                              {card.cardNumber}
                            </p>
                          )}

                          {/* Price */}
                          {card.currentPrice ? (
                            <p
                              className="text-[9px] font-medium w-full text-center"
                              style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}
                            >
                              {formatPrice(card.currentPrice)}
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Fallback: no hot data yet */
                    <p
                      className="text-[10px] text-center py-4"
                      style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}
                    >
                      — NO DATA YET —
                    </p>
                  )}
                </div>
              )}

              {/* ── SEARCH SUGGESTIONS panel (when typing) ── */}
              {showSuggestions && (
                <div className="p-4">
                  {/* Panel header */}
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span
                      className="text-[9px] uppercase tracking-[0.25em] font-medium"
                      style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                    >
                      RESULTS
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {suggestions.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleCardClick(card.id)}
                        className="group flex flex-col items-center gap-1.5 text-left"
                      >
                        <div
                          className="relative w-full aspect-[3/4] rounded-lg overflow-hidden"
                          style={{
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)';
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
                          }}
                        >
                          {card.imageUrl ? (
                            <img
                              src={getProxiedImageUrl(card.imageUrl) ?? ""}
                              alt={card.name ?? ""}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-[9px]"
                              style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)' }}
                            >
                              —
                            </div>
                          )}
                        </div>

                        {card.cardNumber && (
                          <p
                            className="text-[8px] uppercase tracking-[0.1em] truncate w-full text-center"
                            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
                          >
                            {card.cardNumber}
                          </p>
                        )}

                        {card.latestPrice ? (
                          <p
                            className="text-[9px] font-medium w-full text-center"
                            style={{ color: 'rgba(255,255,255,0.55)' }}
                          >
                            {formatPrice(card.latestPrice)}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  {/* Footer */}
                  <div
                    className="mt-4 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-[0.15em]"
                      style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}
                    >
                      TOP 6 RESULTS
                    </span>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="text-[9px] uppercase tracking-[0.15em] transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.15em' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                      VIEW ALL →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint text */}
      {hint && !isFocused && (
        <p
          className="mt-2 text-[10px] uppercase tracking-[0.15em]"
          style={{ color: '#444444', fontFamily: 'monospace' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
