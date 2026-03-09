import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, X, Layers } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface SelectedCard {
  id: number;
  name: string;
  nameJa?: string | null;
  imageUrl?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  series?: string | null;
  productType: "single_card" | "sealed_product";
  referencePrice?: number | string | null;
}

interface CardPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (card: SelectedCard) => void;
  selectedCardId?: number | null;
}

/** Simple inline debounce hook */
function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CardPickerDialog({ open, onOpenChange, onSelect, selectedCardId }: CardPickerDialogProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  const { data, isLoading } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.trim().length >= 1 }
  );

  // cards.search returns { cards: [...], total }
  const results = data?.cards ?? [];

  const handleSelect = useCallback((card: (typeof results)[number]) => {
    onSelect({
      id: card.id,
      name: card.name,
      nameJa: card.nameJa ?? null,
      imageUrl: card.imageUrl ?? null,
      cardNumber: card.cardNumber ?? null,
      rarity: card.rarity ?? null,
      series: card.series ?? null,
      productType: "single_card",
      referencePrice: (card as any).latestPrice ?? null,
    });
    onOpenChange(false);
    setQuery("");
  }, [onSelect, onOpenChange]);

  const handleClose = () => {
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent bottomSheet className="max-h-[85dvh] sm:max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#06038d]">選擇卡牌</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 mt-1">搜索並選擇對應的卡牌，系統將自動關聯市場數據</p>
          {/* Search Input */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              autoFocus
              className="pl-9 pr-9 h-10 text-sm bg-gray-50 border-gray-200 focus:border-[#06038d]"
              placeholder="輸入卡牌名稱或卡號（例如：pikachu、sv8a）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setQuery("")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!debouncedQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">請輸入搜尋關鍵字查找卡牌</p>
              <p className="text-xs mt-1 opacity-70">支援中文、英文、日文及卡號</p>
            </div>
          )}

          {debouncedQuery.trim() && isLoading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <div className="w-5 h-5 border-2 border-[#06038d]/30 border-t-[#06038d] rounded-full animate-spin mr-2" />
              <span className="text-sm">搜尋中...</span>
            </div>
          )}

          {debouncedQuery.trim() && !isLoading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Layers className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">找不到相關卡牌</p>
              <p className="text-xs mt-1 opacity-70">可嘗試其他關鍵字，或直接填寫商品名稱</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-gray-50">
              {results.map((card) => {
                const isSelected = card.id === selectedCardId;
                return (
                  <button
                    key={card.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-indigo-50/60 ${isSelected ? "bg-indigo-50" : ""}`}
                    onClick={() => handleSelect(card)}
                  >
                    {/* Card Image */}
                    <div className="w-12 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Layers className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{card.name}</p>
                      {card.nameJa && card.nameJa !== card.name && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{card.nameJa}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {card.cardNumber && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-300 text-gray-500">
                            {card.cardNumber}
                          </Badge>
                        )}
                        {card.rarity && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600 bg-amber-50">
                            {card.rarity}
                          </Badge>
                        )}
                      </div>
                      {card.series && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{card.series}</p>
                      )}
                      {card.latestPrice && (
                        <p className="text-xs font-semibold text-[#06038d] mt-0.5">
                          市場均價 HKD {Number(card.latestPrice).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#06038d] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {results.length > 0
              ? `顯示 ${results.length} 個結果（共 ${(data as any)?.total ?? results.length} 項）`
              : "點擊卡牌即可選擇"}
          </p>
          <Button variant="outline" size="sm" onClick={handleClose}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
