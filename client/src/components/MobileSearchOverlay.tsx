/**
 * MobileSearchOverlay
 * 手機版搜尋觸發器
 * - 搜尋框顯示卡牌名稱輪播 placeholder（TypeAnimation）
 * - 點擊搜尋框後直接跳轉到搜尋結果頁（已移除底部彈出面板）
 * - 桌面版不顯示（md:hidden）
 */
import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from "react-type-animation";

interface MobileSearchOverlayProps {
  /** 初始搜尋詞（從外部傳入，例如 Research 頁面的 searchQuery） */
  initialQuery?: string;
  /** 搜尋框的 placeholder（靜態，當沒有 cardNames 時使用） */
  placeholder?: string;
  /** 用於輪播的卡牌名稱陣列 */
  cardNames?: string[];
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

  // Sync when initialQuery changes (e.g., URL param update)
  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (value) {
      onSearch(value);
      setLocation(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  const showCarousel = !inputValue && !isFocused && cardNames.length > 0;
  const staticPlaceholder = placeholder || t("research.searchPlaceholder");

  return (
    <div className="md:hidden relative">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl text-muted-foreground pr-14 relative">
          <Search className="w-5 h-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 relative overflow-hidden">
            {/* Real input */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {/* Animated placeholder overlay — only shown when input is empty and not focused */}
            {showCarousel ? (
              <div className="absolute inset-0 pointer-events-none flex items-center">
                <TypeAnimation
                  sequence={cardNames.flatMap((name: string) => [name, 2800])}
                  wrapper="span"
                  speed={55}
                  repeat={Infinity}
                  className="text-sm text-muted-foreground truncate"
                />
              </div>
            ) : !inputValue && !isFocused ? (
              <div className="absolute inset-0 pointer-events-none flex items-center">
                <span className="text-sm text-muted-foreground truncate">{staticPlaceholder}</span>
              </div>
            ) : null}
          </div>
        </div>
      </form>
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
  );
}
