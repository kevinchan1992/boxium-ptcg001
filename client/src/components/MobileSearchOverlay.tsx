/**
 * MobileSearchOverlay — Editorial Style
 *
 * Synced with EditorialSearchBox behaviour:
 * - No border box, only 1px bottom border
 * - Custom carousel overlay (not inside input.value)
 * - onFocus: clear value + hide carousel
 * - onBlur (empty): restore carousel
 * - Blinking cursor appended to carousel text
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Camera, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// ── Blinking cursor ───────────────────────────────────────────────────────────
function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ opacity: visible ? 0.6 : 0, transition: 'opacity 0.1s' }}>|</span>
  );
}

// ── Carousel overlay ──────────────────────────────────────────────────────────
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
      className="absolute inset-0 pointer-events-none flex items-center"
      style={{ paddingLeft: '2rem', paddingRight: '3rem' }}
    >
      <span
        className="flex items-center gap-0 truncate"
        style={{
          color: 'rgba(255,255,255,0.2)',
          fontSize: '14px',
          letterSpacing: '0.02em',
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <span className="truncate">{displayText}</span>
        <BlinkingCursor />
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface MobileSearchOverlayProps {
  initialQuery?: string;
  placeholder?: string;
  cardNames?: string[];
  onSearch: (query: string) => void;
  cardLinkPrefix?: string;
  onCameraClick?: () => void;
}

export function MobileSearchOverlay({
  initialQuery = "",
  placeholder,
  cardNames = [],
  onSearch,
  cardLinkPrefix = "card",
  onCameraClick,
}: MobileSearchOverlayProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);

  // Sync when initialQuery changes
  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  const handleFocus = useCallback(() => {
    setInputValue("");
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setInputValue("");
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (value) {
      onSearch(value);
      setLocation(`/search?q=${encodeURIComponent(value)}`);
    }
  }, [inputValue, onSearch, setLocation]);

  const showCarousel = !inputValue && !isFocused && cardNames.length > 0;

  return (
    <div className="md:hidden relative">
      <form onSubmit={handleSubmit}>
        {/* Editorial bottom-border style */}
        <div
          className="relative flex items-center"
          style={{
            borderBottom: isFocused
              ? '1px solid rgba(255,255,255,0.45)'
              : '1px solid rgba(255,255,255,0.12)',
            transition: 'border-color 0.3s ease',
          }}
        >
          {/* Search icon */}
          <Search
            className="absolute left-0 w-4 h-4 flex-shrink-0 transition-colors duration-300"
            strokeWidth={1.5}
            style={{ color: isFocused ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)' }}
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-transparent border-0 outline-none ring-0 text-sm py-3 pl-7 pr-16 truncate"
            style={{
              color: '#FFFFFF',
              caretColor: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.02em',
            }}
          />

          {/* Carousel overlay */}
          {showCarousel && <CarouselOverlay names={cardNames} />}

          {/* Right controls */}
          <div className="absolute right-0 flex items-center gap-1 z-10">
            {/* Clear button */}
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="w-6 h-6 flex items-center justify-center"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            )}

            {/* Camera button */}
            {onCameraClick && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCameraClick(); }}
                className="w-7 h-7 flex items-center justify-center"
                style={{ color: 'rgba(255,255,255,0.22)' }}
                aria-label={t("search.imageSearch")}
              >
                <Camera className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
