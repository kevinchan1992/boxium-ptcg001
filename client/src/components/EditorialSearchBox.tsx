/**
 * EditorialSearchBox
 *
 * Luxury editorial-style search box for Research & Pricing homepages.
 *
 * Key behaviours:
 * 1. TypeAnimation runs as a CSS-overlay (NOT inside input.value) → no overflow
 * 2. onFocus: clear value + stop carousel (hide overlay)
 * 3. onBlur (no text): restore carousel
 * 4. Blinking cursor `|` appended to carousel text
 * 5. Focus → bottom-border scaleX 0→1 (framer-motion)
 * 6. Empty+focused → HOT SEARCHES glass panel
 * 7. Typing ≥2 chars → RESULTS glass panel
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Camera, TrendingUp, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getProxiedImageUrl } from "@/lib/utils";

interface EditorialSearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  cardLinkPrefix?: "card" | "pricing";
  hint?: string;
  showCameraButton?: boolean;
  onCameraClick?: () => void;
  randomCardNames?: string[];
}

// ── Blinking cursor component ─────────────────────────────────────────────────
function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ opacity: visible ? 0.7 : 0, transition: 'opacity 0.1s' }}>|</span>
  );
}

// ── Carousel overlay (renders outside <input>) ────────────────────────────────
function CarouselOverlay({ names }: { names: string[] }) {
  const [idx, setIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (names.length === 0) return;

    const currentName = names[idx % names.length];

    const tick = () => {
      if (phase === "typing") {
        setDisplayText((prev) => {
          const next = currentName.slice(0, prev.length + 1);
          if (next === currentName) {
            timeoutRef.current = setTimeout(() => setPhase("pause"), 2800);
          } else {
            timeoutRef.current = setTimeout(tick, 45);
          }
          return next;
        });
      } else if (phase === "pause") {
        timeoutRef.current = setTimeout(() => setPhase("erasing"), 0);
      } else if (phase === "erasing") {
        setDisplayText((prev) => {
          const next = prev.slice(0, -1);
          if (next === "") {
            setIdx((i) => i + 1);
            setPhase("typing");
          } else {
            timeoutRef.current = setTimeout(tick, 22);
          }
          return next;
        });
      }
    };

    timeoutRef.current = setTimeout(tick, phase === "typing" ? 45 : 0);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [phase, idx, names]);

  if (names.length === 0) return null;

  return (
    <div
      className="absolute left-7 top-1/2 -translate-y-1/2 pointer-events-none select-none flex items-center"
      style={{
        color: 'rgba(255,255,255,0.22)',
        fontSize: '14px',
        letterSpacing: '0.02em',
        maxWidth: 'calc(100% - 5rem)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="truncate">{displayText}</span>
      <BlinkingCursor />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function EditorialSearchBox({
  value,
  onChange,
  onSubmit,
  cardLinkPrefix = "card",
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

  // ── tRPC: card search suggestions ────────────────────────────────────────
  const { data: searchData, isFetching: isSearchFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 6 },
    { enabled: isOpen && debouncedQuery.length >= 2, staleTime: 30_000 }
  );
  const suggestions = searchData?.cards ?? [];

  // ── tRPC: hot searches ────────────────────────────────────────────────────
  const { data: hotSearchData, isLoading: isHotLoading } = trpc.trending.trending.getBySearches.useQuery(
    { limit: 6 },
    { enabled: isFocused, staleTime: 5 * 60_000 }
  );
  const hotCards = hotSearchData ?? [];

  // ── Panel visibility ──────────────────────────────────────────────────────
  const showSuggestions = isOpen && debouncedQuery.length >= 2 && suggestions.length > 0;
  const showHotPanel = isFocused && value.trim().length < 2;
  const showAnyPanel = showSuggestions || showHotPanel;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    // Clear value so user can type immediately without leftover text
    onChange("");
    setIsFocused(true);
    setIsOpen(false); // no suggestions yet (value just cleared)
  }, [onChange]);

  const handleBlur = useCallback(() => {
    if (mousedownOnPanelRef.current) return;
    setIsFocused(false);
    setIsOpen(false);
    setDebouncedQuery("");
    // If user cleared everything, restore carousel by leaving value = ""
    // (carousel overlay shows when !value && !isFocused)
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* ── Search input row ── */}
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          {/* Static dim bottom border */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          />
          {/* Animated bright bottom border on focus */}
          <motion.div
            className="absolute bottom-0 left-0 h-[1px] origin-left"
            style={{ background: 'rgba(255,255,255,0.55)', right: 0 }}
            animate={{ scaleX: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0 }}
            initial={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Search icon */}
          <Search
            className="absolute left-0 w-4 h-4 flex-shrink-0 transition-colors duration-300 z-10"
            strokeWidth={1.5}
            style={{ color: isFocused ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)' }}
          />

          {/* Actual input — value is always the real user text */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent border-0 outline-none ring-0 text-sm py-3 pl-7 pr-16 truncate"
            style={{
              color: '#FFFFFF',
              caretColor: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.02em',
            }}
          />

          {/* Carousel overlay — only when NOT focused AND value is empty */}
          {!isFocused && !value && randomCardNames.length > 0 && (
            <CarouselOverlay names={randomCardNames} />
          )}

          {/* Right-side controls */}
          <div className="absolute right-0 flex items-center gap-1 z-10">
            {/* Clear (×) button */}
            <AnimatePresence>
              {value && (
                <motion.button
                  type="button"
                  onClick={handleClear}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                  className="w-6 h-6 flex items-center justify-center"
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
                className="w-7 h-7 flex items-center justify-center"
                style={{ color: 'rgba(255,255,255,0.22)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.22)'; }}
              >
                <Camera className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {showAnyPanel && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -10, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top center' }}
            className="absolute left-0 right-0 top-full mt-3 z-50"
            onMouseDown={() => { mousedownOnPanelRef.current = true; }}
            onMouseUp={() => { setTimeout(() => { mousedownOnPanelRef.current = false; }, 0); }}
          >
            {/* Glass panel */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(12, 12, 14, 0.94)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 28px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.025)',
              }}
            >
              {/* ── HOT SEARCHES (focused + empty) ── */}
              {showHotPanel && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.28)' }} />
                    <span
                      className="text-[9px] uppercase tracking-[0.28em]"
                      style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}
                    >
                      HOT SEARCHES
                    </span>
                  </div>

                  {isHotLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[0,1,2,3,4,5].map((i) => (
                        <div key={i} className="flex flex-col gap-2 animate-pulse">
                          <div className="aspect-[3/4] rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
                          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '60%' }} />
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
                          className="flex flex-col items-center gap-1.5 text-left"
                        >
                          <div className="relative w-full aspect-[3/4]">
                            <div
                              className="w-full h-full rounded-lg overflow-hidden"
                              style={{
                                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
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
                                  style={{ color: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}
                                >
                                  —
                                </div>
                              )}
                            </div>
                            {/* Rank badge */}
                            <div
                              className="absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold"
                              style={{
                                background: i < 3 ? 'rgba(255,200,50,0.14)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${i < 3 ? 'rgba(255,200,50,0.28)' : 'rgba(255,255,255,0.1)'}`,
                                color: i < 3 ? 'rgba(255,200,50,0.9)' : 'rgba(255,255,255,0.35)',
                                fontFamily: 'monospace',
                              }}
                            >
                              {i + 1}
                            </div>
                          </div>

                          {card.cardNumber && (
                            <p
                              className="text-[8px] uppercase tracking-[0.1em] truncate w-full text-center"
                              style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}
                            >
                              {card.cardNumber}
                            </p>
                          )}
                          {card.currentPrice ? (
                            <p
                              className="text-[9px] w-full text-center"
                              style={{ color: 'rgba(255,255,255,0.5)' }}
                            >
                              {formatPrice(card.currentPrice)}
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-[10px] text-center py-4"
                      style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}
                    >
                      — NO DATA YET —
                    </p>
                  )}
                </div>
              )}

              {/* ── SEARCH RESULTS (typing ≥2 chars) ── */}
              {showSuggestions && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="w-3 h-3" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.28)' }} />
                    <span
                      className="text-[9px] uppercase tracking-[0.28em]"
                      style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}
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
                        className="flex flex-col items-center gap-1.5 text-left"
                      >
                        <div
                          className="relative w-full aspect-[3/4] rounded-lg overflow-hidden"
                          style={{
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
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
                              style={{ color: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}
                            >
                              —
                            </div>
                          )}
                        </div>

                        {card.cardNumber && (
                          <p
                            className="text-[8px] uppercase tracking-[0.1em] truncate w-full text-center"
                            style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}
                          >
                            {card.cardNumber}
                          </p>
                        )}
                        {card.latestPrice ? (
                          <p
                            className="text-[9px] w-full text-center"
                            style={{ color: 'rgba(255,255,255,0.5)' }}
                          >
                            {formatPrice(card.latestPrice)}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div
                    className="mt-4 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}
                    >
                      TOP 6 RESULTS
                    </span>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="text-[9px] uppercase tracking-[0.18em] transition-colors"
                      style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.38)'; }}
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

      {/* Hint text below search box */}
      {hint && !isFocused && (
        <p
          className="mt-2 text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
