import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";
import { LazyImage } from "@/components/LazyImage";

interface CardSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (cardData: string) => void;
}

export function CardSelectionDialog({ open, onOpenChange, onInsert }: CardSelectionDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search cards
  const { data: cards, isLoading } = trpc.blog.searchCardsForBlog.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length > 0 }
  );

  // Get full card details with price statistics
  const { data: cardDetails, isLoading: isLoadingDetails, refetch: refetchCardDetails } = trpc.blog.getCardDetailsForBlog.useQuery(
    { cardIds: selectedCardIds },
    { enabled: showPreview && selectedCardIds.length > 0 }
  );

  // Toggle card selection
  const toggleCardSelection = (cardId: number) => {
    setSelectedCardIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      return [...prev, cardId];
    });
    setShowPreview(false);
  };

  // Preview card data before inserting
  const handlePreview = () => {
    if (selectedCardIds.length === 0) { toast.error(t("cardSelectionDialog.selectAtLeastOneCard")); return; }
    setShowPreview(true);
    refetchCardDetails();
  };

  // Handle insert
  const handleInsert = async () => {
    if (!cardDetails || cardDetails.length === 0) { toast.error(t("cardSelectionDialog.failedToFetchCardData")); return; }
    const formattedData = formatCardData(cardDetails);
    onInsert(formattedData);
    setSelectedCardIds([]);
    setSearchQuery('');
    setShowPreview(false);
    onOpenChange(false);
    toast.success(`已插入 ${cardDetails.length} 張卡牌的完整資料`);
  };

  const formatPriceChange = (change: number): string => {
    if (change > 0) return `+${change.toFixed(1)}%`;
    if (change < 0) return `${change.toFixed(1)}%`;
    return '0%';
  };

  const formatCardData = (cards: any[]) => {
    let formatted = '【卡牌市場數據】\n\n';
    cards.forEach((card: any, index: number) => {
      formatted += `━━━ 卡牌 ${index + 1} ━━━\n`;
      formatted += `名稱：${card.name}\n`;
      if (card.nameJa) formatted += `日文名：${card.nameJa}\n`;
      if (card.cardNumber) formatted += `卡號：${card.cardNumber}\n`;
      if (card.series) formatted += `系列：${card.series}\n`;
      if (card.setName) formatted += `套組：${card.setName}\n`;
      if (card.rarity) formatted += `稀有度：${card.rarity}\n`;
      if (card.imageUrl) formatted += `圖片：${card.imageUrl}\n`;
      formatted += '\n📊 PSA10 鑑定卡價格統計：\n';
      if (card.psa10Stats && card.psa10Stats.totalVolume > 0) {
        formatted += `  - 平均價格：HKD$${Math.round(card.psa10Stats.avgPrice).toLocaleString()}\n`;
        formatted += `  - 最低價格：HKD$${Math.round(card.psa10Stats.minPrice).toLocaleString()}\n`;
        formatted += `  - 最高價格：HKD$${Math.round(card.psa10Stats.maxPrice).toLocaleString()}\n`;
        formatted += `  - 7天價格變化：${formatPriceChange(card.psa10Stats.priceChange7d)}\n`;
        formatted += `  - 30天價格變化：${formatPriceChange(card.psa10Stats.priceChange30d)}\n`;
        formatted += `  - 成交量：${card.psa10Stats.totalVolume} 筆\n`;
      } else {
        formatted += '  - 暫無 PSA10 成交記錄\n';
      }
      formatted += '\n📊 中古 A 級價格統計：\n';
      if (card.usedStats && card.usedStats.totalVolume > 0) {
        formatted += `  - 平均價格：HKD$${Math.round(card.usedStats.avgPrice).toLocaleString()}\n`;
        formatted += `  - 最低價格：HKD$${Math.round(card.usedStats.minPrice).toLocaleString()}\n`;
        formatted += `  - 最高價格：HKD$${Math.round(card.usedStats.maxPrice).toLocaleString()}\n`;
        formatted += `  - 7天價格變化：${formatPriceChange(card.usedStats.priceChange7d)}\n`;
        formatted += `  - 30天價格變化：${formatPriceChange(card.usedStats.priceChange30d)}\n`;
        formatted += `  - 成交量：${card.usedStats.totalVolume} 筆\n`;
      } else {
        formatted += '  - 暫無中古 A 級成交記錄\n';
      }
      if (card.peakPrice > 0) {
        formatted += `\n🏆 歷史最高價：HKD$${Math.round(card.peakPrice).toLocaleString()}`;
        if (card.peakDate) formatted += `（${new Date(card.peakDate).toLocaleDateString('zh-TW')}）`;
        formatted += '\n';
      }
      formatted += '\n';
    });
    return formatted;
  };

  // Price change badge component
  const PriceChangeBadge = ({ change }: { change: number }) => {
    if (change > 0) return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-400">
        <TrendingUp className="w-3 h-3" />+{change.toFixed(1)}%
      </span>
    );
    if (change < 0) return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-400">
        <TrendingDown className="w-3 h-3" />{change.toFixed(1)}%
      </span>
    );
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="w-3 h-3" />0%
      </span>
    );
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setShowPreview(false);
        onOpenChange(v);
      }}
      title={
        <span className="flex items-center gap-2 text-white">
          <BarChart3 className="w-5 h-5 text-[#FEDD00]" />
          插入卡牌市場數據
        </span>
      }
      description={t("cardSelectionDialog.searchDescription")}
      className="bg-zinc-900 border-zinc-800 text-white sm:max-w-3xl"
    >
      <div className="flex flex-col gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("cardSelectionDialog.searchPlaceholder")}
            className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
          />
        </div>

        {/* Selected Count & Actions */}
        {selectedCardIds.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-[#FEDD00]/20 text-[#FEDD00] border-[#FEDD00]/30">
                {t("cardSelection.selected")} {selectedCardIds.length} 張卡牌
              </Badge>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                插入時將包含完整的價格統計和成交數據
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                className="border-zinc-700 text-white hover:bg-zinc-800 flex-1"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                預覽數據
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCardIds([])}
                className="border-zinc-700 text-gray-400 hover:bg-zinc-800 flex-1"
              >
                {t("common.clear")}選擇
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="min-h-[200px]">
          {/* Preview Mode */}
          {showPreview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">{t("cardSelectionDialog.dataPreview")}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ← 返回搜尋
                </Button>
              </div>

              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FEDD00]" />
                  <span className="ml-3 text-gray-400 text-sm">{t("cardSelectionDialog.fetchingData")}</span>
                </div>
              ) : cardDetails && cardDetails.length > 0 ? (
                cardDetails.map((card: any) => (
                  <div key={card.id} className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
                    {/* Card header */}
                    <div className="flex gap-3 p-3">
                      {card.imageUrl && (
                        <div className="w-16 h-22 flex-shrink-0 rounded overflow-hidden">
                          <LazyImage src={getProxiedImageUrl(card.imageUrl) ?? ""} alt={card.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white leading-tight">{card.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {card.cardNumber && (
                            <Badge variant="outline" className="border-zinc-600 text-gray-300 text-[10px] px-1.5 py-0">
                              {card.cardNumber}
                            </Badge>
                          )}
                          {card.rarity && (
                            <Badge variant="outline" className="border-[#FEDD00]/30 text-[#FEDD00] text-[10px] px-1.5 py-0">
                              {card.rarity}
                            </Badge>
                          )}
                        </div>
                        {card.nameJa && (
                          <div className="text-xs text-gray-400 mt-1 leading-tight">{card.nameJa}</div>
                        )}
                      </div>
                    </div>

                    {/* Price Statistics — stacked vertically on all sizes for clarity */}
                    <div className="border-t border-zinc-700">
                      {/* PSA10 */}
                      <div className="p-3 border-b border-zinc-700">
                        <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />PSA10 鑑定卡
                        </div>
                        {card.psa10Stats && card.psa10Stats.totalVolume > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">{t("cardSelectionDialog.avgPrice")}</span>
                              <span className="text-white font-medium">HKD${Math.round(card.psa10Stats.avgPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs gap-2">
                              <span className="text-gray-400 flex-shrink-0">{t("cardSelectionDialog.priceRange")}</span>
                              <span className="text-white text-right break-all">HKD${Math.round(card.psa10Stats.minPrice).toLocaleString()} ~ HKD${Math.round(card.psa10Stats.maxPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">7天變化</span>
                              <PriceChangeBadge change={card.psa10Stats.priceChange7d} />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">30天變化</span>
                              <PriceChangeBadge change={card.psa10Stats.priceChange30d} />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">{t("cardSelectionDialog.volume")}</span>
                              <span className="text-white">{card.psa10Stats.totalVolume} 筆</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic">{t("cardSelectionDialog.noTransactions")}</div>
                        )}
                      </div>

                      {/* Used Grade A */}
                      <div className="p-3">
                        <div className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />中古 A 級
                        </div>
                        {card.usedStats && card.usedStats.totalVolume > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">{t("cardSelectionDialog.avgPrice")}</span>
                              <span className="text-white font-medium">HKD${Math.round(card.usedStats.avgPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs gap-2">
                              <span className="text-gray-400 flex-shrink-0">{t("cardSelectionDialog.priceRange")}</span>
                              <span className="text-white text-right break-all">HKD${Math.round(card.usedStats.minPrice).toLocaleString()} ~ HKD${Math.round(card.usedStats.maxPrice).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">7天變化</span>
                              <PriceChangeBadge change={card.usedStats.priceChange7d} />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">30天變化</span>
                              <PriceChangeBadge change={card.usedStats.priceChange30d} />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">{t("cardSelectionDialog.volume")}</span>
                              <span className="text-white">{card.usedStats.totalVolume} 筆</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic">{t("cardSelectionDialog.noTransactions")}</div>
                        )}
                      </div>
                    </div>

                    {/* Peak Price */}
                    {card.peakPrice > 0 && (
                      <div className="px-3 py-2 bg-zinc-800/50 border-t border-zinc-700 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">🏆 歷史最高價</span>
                        <span className="text-sm font-semibold text-[#FEDD00]">HKD${Math.round(card.peakPrice).toLocaleString()}</span>
                        {card.peakDate && (
                          <span className="text-xs text-gray-500">({new Date(card.peakDate).toLocaleDateString('zh-TW')})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">{t("cardSelectionDialog.failedToFetchCardData")}</div>
              )}
            </div>
          ) : (
            /* Search Results */
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FEDD00]" />
                </div>
              ) : debouncedQuery.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">{t("cardSelectionDialog.enterSearchKeyword")}</div>
              ) : cards && cards.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className={`relative bg-zinc-800 rounded-lg border-2 transition-all cursor-pointer hover:border-[#FEDD00]/50 ${
                        selectedCardIds.includes(card.id) ? 'border-[#FEDD00] ring-2 ring-[#FEDD00]/30' : 'border-zinc-700'
                      }`}
                      onClick={() => toggleCardSelection(card.id)}
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={selectedCardIds.includes(card.id)}
                          onCheckedChange={() => toggleCardSelection(card.id)}
                          className="bg-zinc-900 border-zinc-600 data-[state=checked]:bg-[#FEDD00] data-[state=checked]:border-[#FEDD00]"
                        />
                      </div>
                      <div className="aspect-[2.5/3.5] overflow-hidden rounded-t-lg">
                        <LazyImage src={card.imageUrl || ''} alt={card.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2 space-y-0.5">
                        <div className="text-xs font-medium text-white line-clamp-2 leading-tight">{card.name}</div>
                        {card.cardNumber && <div className="text-[10px] text-gray-400">{card.cardNumber}</div>}
                        {card.latestPrice && (
                          <div className="text-[10px] text-[#FEDD00] font-semibold">HKD${Number(card.latestPrice).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm">{t("cardSelectionDialog.noMatchingCards")}</div>
              )}
            </>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex gap-2 pt-2 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedCardIds([]);
              setSearchQuery('');
              setShowPreview(false);
              onOpenChange(false);
            }}
            className="border-zinc-700 text-white hover:bg-zinc-800 flex-1"
          >
            {t("common.cancel")}
          </Button>
          {showPreview ? (
            <Button
              onClick={handleInsert}
              disabled={!cardDetails || cardDetails.length === 0}
              className="bg-[#FEDD00] text-[#06038d] hover:bg-[#FEDD00]/90 font-semibold flex-1"
            >
              插入數據 {cardDetails && `(${cardDetails.length} 張)`}
            </Button>
          ) : (
            <Button
              onClick={handlePreview}
              disabled={selectedCardIds.length === 0}
              className="bg-[#FEDD00] text-[#06038d] hover:bg-[#FEDD00]/90 font-semibold flex-1"
            >
              預覽數據 {selectedCardIds.length > 0 && `(${selectedCardIds.length})`}
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
