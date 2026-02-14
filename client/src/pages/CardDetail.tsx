import { useState } from "react";
import { useRoute } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";

import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, AlertCircle, ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { ShareButton } from "@/components/ShareButton";


const grades = ["PSA 10", "BGS 10", "中古"];

export default function CardDetail() {
  const [, params] = useRoute("/card/:id");
  const [activeSource, setActiveSource] = useState<"snkrdunk" | "ebay">("snkrdunk");
  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  const cardId = params?.id ? parseInt(params.id, 10) : null;

  // Fetch card details
  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId, retry: 1 }
  );

  // Check if card is favorited
  const { data: favoriteStatus } = trpc.favorites.isFavorited.useQuery(
    { cardId: cardId! },
    { enabled: !!cardId, retry: false }
  );

  const utils = trpc.useUtils();

  // Add to favorites mutation
  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      utils.favorites.isFavorited.invalidate({ cardId: cardId! });
      toast.success("已添加到收藏");
    },
    onError: () => {
      toast.error("添加收藏失敗，請先登入");
    },
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      utils.favorites.isFavorited.invalidate({ cardId: cardId! });
      toast.success("已取消收藏");
    },
    onError: () => {
      toast.error("取消收藏失敗");
    },
  });

  const handleToggleFavorite = () => {
    if (!cardId) return;

    if (favoriteStatus?.isFavorited) {
      removeFavoriteMutation.mutate({ cardId });
    } else {
      addFavoriteMutation.mutate({ cardId });
    }
  };

  // Fetch price history from SNKRDUNK
  const normalizeGrade = (grade: string | null) => {
    if (!grade) return undefined;
    // Handle special case for "中古" which should match A, B, C, D grades
    if (grade === "中古") return "中古";
    return grade.replace(/\s+/g, '');
  };

  const { data: priceHistory = [], isLoading: priceLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "snkrdunk",
      grade: normalizeGrade(activeGrade),
      limit: 50,
    },
    { enabled: !!cardId && activeSource === "snkrdunk", retry: 1 }
  );

  // Fetch eBay price history from database (PSA10 only) - 優先從資料庫載入緩存數據
  const { data: ebayPriceHistory = [], isLoading: ebayHistoryLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "ebay",
      grade: "PSA10",
      limit: 50,
    },
    { enabled: !!cardId && activeSource === "ebay", retry: 1 }
  );

  // Fetch eBay sold items (PSA10 only) - 備用，當資料庫無數據時使用
  const { data: ebaySoldItems = [], isLoading: ebayLoading } = trpc.cards.getEbaySoldItems.useQuery(
    { cardId: cardId!, limit: 20 },
    { enabled: !!cardId && activeSource === "ebay" && ebayPriceHistory.length === 0, retry: 1 }
  );

  // Fetch eBay Browse API market price (active listings) - 備用，當資料庫無數據且 API 也無數據時使用
  const { data: ebayMarketPrice = [], isLoading: ebayMarketLoading } = trpc.cards.searchEbayMarketPrice.useQuery(
    { 
      cardName: card?.name || "",
      cardNumber: card?.cardNumber || undefined,
      limit: 10 
    },
    { enabled: !!card && activeSource === "ebay" && ebayPriceHistory.length === 0 && ebaySoldItems.length === 0, retry: 1 }
  );

  // Fetch current USD to HKD exchange rate
  const { data: exchangeRate } = trpc.cards.getExchangeRate.useQuery(
    undefined,
    { enabled: activeSource === "ebay", retry: 1 }
  );

  // Fetch price trend data
  const { data: priceTrendData, isLoading: trendLoading } = trpc.cards.getPriceTrendData.useQuery(
    { cardId: cardId!, days: 90 },
    { enabled: !!cardId, retry: 1 }
  );

  if (!cardId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">無效的卡牌 ID</p>
        </div>
      </div>
    );
  }

  if (cardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">找不到卡牌</p>
        </div>
      </div>
    );
  }

  // Calculate average price based on active source
  const avgPrice = activeSource === "snkrdunk"
    ? priceHistory.length > 0
      ? (priceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / priceHistory.length).toFixed(2)
      : "N/A"
    : ebayPriceHistory.length > 0
      ? (ebayPriceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / ebayPriceHistory.length).toFixed(2)
      : ebaySoldItems.length > 0
        ? (ebaySoldItems.reduce((sum, item) => sum + item.price, 0) / ebaySoldItems.length).toFixed(2)
        : "N/A";

  // Get record count based on active source
  const recordCount = activeSource === "snkrdunk" 
    ? priceHistory.length 
    : ebayPriceHistory.length > 0 
      ? ebayPriceHistory.length 
      : ebaySoldItems.length;

  // Group prices by grade
  const pricesByGrade: Record<string, typeof priceHistory> = {};
  priceHistory.forEach((p) => {
    const grade = p.grade || "中古";
    if (!pricesByGrade[grade]) {
      pricesByGrade[grade] = [];
    }
    pricesByGrade[grade].push(p);
  });

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: "主頁", href: "/" },
            { label: "搜尋", href: "/research" },
            { label: card.name }
          ]}
        />
        
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-base sm:text-xl font-bold text-foreground mb-1">
            {card.name}
          </h1>
          {card.nameJa && (
            <p className="text-sm sm:text-base text-muted-foreground mb-2">{card.nameJa}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm">
              格價
            </Button>
            <Button
              variant={favoriteStatus?.isFavorited ? "default" : "outline"}
              size="sm"
              onClick={handleToggleFavorite}
              disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
            >
              <Heart
                className={`h-4 w-4 mr-2 ${favoriteStatus?.isFavorited ? "fill-current" : ""}`}
              />
              {favoriteStatus?.isFavorited ? "已收藏" : "收藏"}
            </Button>
            <ShareButton cardName={card.name} cardId={cardId!} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Card Image */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">無卡牌圖片</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Card Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Source and Grade Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={activeSource === "snkrdunk" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("snkrdunk")}
              >
                SNKRDUNK
              </Button>
              <Button
                variant={activeSource === "ebay" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("ebay")}
              >
                eBay
              </Button>
              <div className="w-px h-8 bg-border mx-2" />
              {grades.map((grade) => (
                <Button
                  key={grade}
                  variant={activeGrade === grade ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                >
                  {grade}
                </Button>
              ))}
            </div>

            {/* Reference Price */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-2xl font-bold text-foreground">
                參考價格: {activeSource === "snkrdunk" ? "HKD" : "USD"} ${avgPrice}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                基於 {recordCount} 筆交易記錄 {activeSource === "ebay" && "(PSA 10)"}
              </p>
            </div>

            {/* Price History Table - Vertical Scroll */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {activeSource === "snkrdunk" ? "SNKRDUNK" : "eBay"} 上的最近交易
                </h3>
              </div>
              {(activeSource === "snkrdunk" ? priceLoading : (ebayHistoryLoading || ebayLoading)) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : activeSource === "snkrdunk" && priceHistory.length > 0 ? (
                <div className="overflow-y-auto max-h-96 scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                          日期
                        </th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium text-sm w-24">
                          評級
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">
                          金額
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {priceHistory.map((item, index) => {
                        // Determine display grade - show original grade (A, B, C, D) or badge for ungraded
                        const displayGrade = item.grade;
                        const isUngraded = !item.grade;
                        
                        return (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {item.soldAt
                                ? new Date(item.soldAt).toLocaleString("zh-HK", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </td>
                            <td className="py-3 px-4 text-center text-foreground text-sm w-24">
                              {isUngraded ? (
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                  中古
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center font-medium">{displayGrade}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
                              HKD ${item.price}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : activeSource === "ebay" && ebayPriceHistory.length > 0 ? (
                <div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✅ 以下為資料庫中的 eBay 市場參考價（已緩存）。
                      最後更新時間：{new Date(ebayPriceHistory[0].createdAt).toLocaleString("zh-HK")}
                    </p>
                  </div>
                  <div className="overflow-y-auto max-h-96 scrollbar-hide">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                            日期
                          </th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-32">
                            HKD 價格
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ebayPriceHistory.map((record, index) => (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-foreground text-sm">
                              {record.listingUrl ? (
                                <a
                                  href={record.listingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary hover:underline flex items-center gap-2"
                                >
                                  {new Date(record.soldAt || record.createdAt).toLocaleDateString("zh-HK")}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                new Date(record.soldAt || record.createdAt).toLocaleDateString("zh-HK")
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-foreground font-medium text-sm">
                              ${parseFloat(record.price).toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeSource === "ebay" && ebaySoldItems.length > 0 ? (
                <div className="overflow-y-auto max-h-96 scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                          標題
                        </th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium text-sm w-32">
                          日期
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-24">
                          價格
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ebaySoldItems.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-foreground text-sm">
                            <a
                              href={item.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline flex items-center gap-2"
                            >
                              {item.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground text-sm w-32">
                            {new Date(item.soldDate).toLocaleDateString("zh-HK", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
                            {item.currency} ${item.price.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : activeSource === "ebay" && ebayMarketPrice.length > 0 ? (
                <div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ℹ️ 以下為 eBay 活躍商品的「市場參考價」，非已售出交易記錄。
                      {exchangeRate && (
                        <span className="ml-1">
                          當前匯率：1 USD = {exchangeRate.rate.toFixed(4)} HKD
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="overflow-y-auto max-h-96 scrollbar-hide">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                            商品標題
                          </th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-28">
                            USD 價格
                          </th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-28">
                            HKD 價格
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ebayMarketPrice.map((item, index) => (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-foreground text-sm">
                              <a
                                href={item.itemWebUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary hover:underline flex items-center gap-2"
                              >
                                {item.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-muted-foreground text-sm">
                              ${parseFloat(item.price.value).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
                              ${item.priceHkd.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {activeSource === "ebay" 
                    ? "暫無 eBay 交易記錄（可能超出 API 調用限制，請稍後再試）" 
                    : "暫無符合該等級的數據"}
                </p>
              )}
            </div>

            {/* Price Trend Chart */}
            {priceTrendData && (
              <PriceTrendChart
                cardName={card.name}
                trendData={priceTrendData.trendData}
                stats={priceTrendData.stats}
                isLoading={trendLoading}
              />
            )}

            {/* Basic Information */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                基本資料
              </h3>
              <dl className="space-y-3">
                <div className="flex">
                  <dt className="text-muted-foreground w-32">卡牌名稱:</dt>
                  <dd className="text-foreground">{card.name}</dd>
                </div>
                {card.nameJa && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">日文名稱:</dt>
                    <dd className="text-foreground">{card.nameJa}</dd>
                  </div>
                )}
                {card.cardNumber && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">卡牌編號:</dt>
                    <dd className="text-foreground">{card.cardNumber}</dd>
                  </div>
                )}
                {card.series && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">所屬系列:</dt>
                    <dd className="text-foreground">{card.series}</dd>
                  </div>
                )}

              </dl>
            </div>
          </div>
        </div>
    </div>
  );
}
