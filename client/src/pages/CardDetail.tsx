import { useState } from "react";
import { useRoute } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useRef } from "react";

const grades = ["PSA 10", "BGS BL", "BGS 10", "ARS 10+", "ARS 10"];

export default function CardDetail() {
  const [, params] = useRoute("/card/:id");
  const [activeSource, setActiveSource] = useState<"snkrdunk" | "ebay">("snkrdunk");
  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  const cardId = params?.id ? parseInt(params.id, 10) : null;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Fetch card details
  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId, retry: 1 }
  );

  // Fetch price history
  const { data: priceHistory = [], isLoading: priceLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: activeSource === "snkrdunk" ? "snkrdunk" : "ebay",
      grade: activeGrade || undefined,
      limit: 50,
    },
    { enabled: !!cardId, retry: 1 }
  );

  if (!cardId) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">無效的卡牌 ID</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (cardLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (cardError || !card) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">找不到卡牌</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Calculate average price
  const avgPrice = priceHistory.length > 0
    ? (priceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / priceHistory.length).toFixed(2)
    : "N/A";

  // Group prices by grade
  const pricesByGrade: Record<string, typeof priceHistory> = {};
  priceHistory.forEach((p) => {
    const grade = p.grade || "未評級";
    if (!pricesByGrade[grade]) {
      pricesByGrade[grade] = [];
    }
    pricesByGrade[grade].push(p);
  });

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {card.name}
          </h1>
          {card.nameJa && (
            <p className="text-lg text-muted-foreground mb-4">{card.nameJa}</p>
          )}
          <div className="flex gap-2">
            <Button variant="default" size="sm">
              格價
            </Button>
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
            <div className="flex flex-wrap gap-2">
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
                參考價格: HKD ${avgPrice}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                基於 {priceHistory.length} 筆交易記錄
              </p>
            </div>

            {/* Price History Table - Horizontal Scroll */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                  {activeSource === "snkrdunk" ? "SNKRDUNK" : "eBay"} 上的最近交易
                </h3>
              </div>
              {priceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : priceHistory.length > 0 ? (
                <div className="relative">
                  {/* Scroll Container */}
                  <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-3 pb-4 min-w-min">
                      {priceHistory.slice(0, 30).map((item, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 bg-muted rounded-lg p-4 min-w-[200px] border border-border hover:border-primary transition-colors"
                        >
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {item.soldAt
                                ? new Date(item.soldAt).toLocaleString("zh-HK")
                                : "N/A"}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">
                                {item.grade || "未評級"}
                              </span>
                              <span className="text-lg font-bold text-primary">
                                HKD ${item.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Scroll Indicator */}
                  <div className="text-xs text-muted-foreground text-center mt-2">
                    ← 向左滾動查看更多交易 →
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  暫無價格歷史數據
                </p>
              )}
            </div>

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
                <div className="flex">
                  <dt className="text-muted-foreground w-32">添加時間:</dt>
                  <dd className="text-foreground">
                    {new Date(card.createdAt).toLocaleString("zh-HK")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
