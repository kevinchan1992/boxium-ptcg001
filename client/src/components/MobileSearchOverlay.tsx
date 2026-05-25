/**
 * MobileSearchOverlay
 * 手機版搜尋觸發器
 * - 點擊搜尋框後直接跳轉到搜尋結果頁（已移除底部彈出面板）
 * - 桌面版不顯示（md:hidden）
 */
import { useRef } from "react";
import { useLocation } from "wouter";
import { Search, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onSearch(value);
      setLocation(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  return (
    <div className="md:hidden relative">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl text-muted-foreground pr-14">
          <Search className="w-5 h-5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            defaultValue={initialQuery}
            placeholder={placeholder || t("research.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
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
