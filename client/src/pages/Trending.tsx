import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Flame, Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";
import { formatCurrency, formatPriceChange } from "@/lib/formatCurrency";
import { useLocation } from "wouter";

type TrendingTab = 'searches' | 'priceIncrease' | 'priceDecrease';

export default function Trending() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TrendingTab>('searches');
  const days = 60; // Fixed to 60 days (2 months) to match backend calculation

  // Fetch trending data based on active tab
  const { data: searchData, isLoading: searchLoading, refetch: refetchSearch } = trpc.trending.getBySearches.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'searches', refetchInterval: 5 * 60 * 1000 } // Refresh every 5 minutes
  );

  const { data: priceIncreaseData, isLoading: priceIncreaseLoading, refetch: refetchPriceIncrease } = trpc.trending.getByPriceIncrease.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'priceIncrease', refetchInterval: 5 * 60 * 1000 }
  );

  const { data: priceDecreaseData, isLoading: priceDecreaseLoading, refetch: refetchPriceDecrease } = trpc.trending.getByPriceDecrease.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'priceDecrease', refetchInterval: 5 * 60 * 1000 }
  );



  const getCurrentData = () => {
    switch (activeTab) {
      case 'searches': return searchData || [];
      case 'priceIncrease': return priceIncreaseData || [];
      case 'priceDecrease': return priceDecreaseData || [];

      default: return [];
    }
  };

  const isLoading = searchLoading || priceIncreaseLoading || priceDecreaseLoading;
  const currentData = getCurrentData();

  // Generate JSON-LD structured data for SEO
  const generateStructuredData = () => {
    const topCards = currentData.slice(0, 10);
    
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": t('trending.title'),
      "description": t('trending.subtitle'),
      "url": "https://boxiumptcg.manus.space/trending",
      "numberOfItems": topCards.length,
      "itemListElement": topCards.map((card, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Product",
          "name": card.name || "Unknown Card",
          "image": card.imageUrl || card.imageUrlHiRes || "",
          "offers": {
            "@type": "Offer",
            "price": card.currentPrice || 0,
            "priceCurrency": "JPY"
          }
        }
      }))
    };
  };

  // Generate BreadcrumbList structured data for SEO
  const generateBreadcrumbData = () => {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": t('common.home'),
          "item": "https://boxiumptcg.manus.space/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": t('trending.title'),
          "item": "https://boxiumptcg.manus.space/trending"
        }
      ]
    };
  };

  const handleRefresh = () => {
    switch (activeTab) {
      case 'searches': refetchSearch(); break;
      case 'priceIncrease': refetchPriceIncrease(); break;
      case 'priceDecrease': refetchPriceDecrease(); break;

    }
  };

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <StructuredData data={generateStructuredData()} />
      <StructuredData data={generateBreadcrumbData()} />
      
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200" style={{ backgroundColor: "#06038D" }}>
          <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
                  {t('trending.title')}
                </h1>
                <p className="text-gray-200 text-sm md:text-base">
                  {t('trending.subtitle')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  className="bg-white border-white hover:bg-gray-100"
                  style={{ color: "#06038D" }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6 md:py-8">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TrendingTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 border border-gray-200 h-auto p-1">
              <TabsTrigger 
                value="searches" 
                className="flex-col md:flex-row gap-1 md:gap-2 py-3 md:py-3 text-xs md:text-sm font-medium"
                style={{
                  color: activeTab === 'searches' ? '#06038D' : '#6B7280',
                  backgroundColor: activeTab === 'searches' ? '#FFED00' : 'transparent',
                }}
              >
                <Flame className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">{t('trending.searchHeat')}</span>
                <span className="sm:hidden">{t('trending.searchHeatShort')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="priceIncrease" 
                className="flex-col md:flex-row gap-1 md:gap-2 py-3 md:py-3 text-xs md:text-sm font-medium"
                style={{
                  color: activeTab === 'priceIncrease' ? '#06038D' : '#6B7280',
                  backgroundColor: activeTab === 'priceIncrease' ? '#FFED00' : 'transparent',
                }}
              >
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">{t('trending.priceSurge')}</span>
                <span className="sm:hidden">{t('trending.priceSurgeShort')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="priceDecrease" 
                className="flex-col md:flex-row gap-1 md:gap-2 py-3 md:py-3 text-xs md:text-sm font-medium"
                style={{
                  color: activeTab === 'priceDecrease' ? '#06038D' : '#6B7280',
                  backgroundColor: activeTab === 'priceDecrease' ? '#FFED00' : 'transparent',
                }}
              >
                <TrendingDown className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">{t('trending.priceDrop')}</span>
                <span className="sm:hidden">{t('trending.priceDropShort')}</span>
              </TabsTrigger>

            </TabsList>

            {/* Tab Content */}
            <div className="mt-6 md:mt-8">
              {isLoading ? (
                <LoadingSkeleton />
              ) : currentData.length === 0 ? (
                <EmptyState activeTab={activeTab} />
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {currentData.map((card, index) => (
                    <RankingCard key={card.id} card={card} rank={index + 1} type={activeTab} />
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}

// Ranking Card Component
function RankingCard({ card, rank, type }: { card: any; rank: number; type: TrendingTab }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const imageUrl = card.imageUrl || card.imageUrlHiRes || '';
  const hasValidImage = imageUrl && imageUrl.trim() !== '';

  const handleCardClick = () => {
    setLocation(`/card/${card.id}`);
  };

  const getRankBadgeStyle = () => {
    if (rank === 1) return { backgroundColor: "#FFED00", color: "#06038D", fontSize: "1.5rem", fontWeight: "bold" };
    if (rank === 2) return { backgroundColor: "#D1D5DB", color: "#06038D", fontSize: "1.25rem", fontWeight: "bold" };
    if (rank === 3) return { backgroundColor: "#CD7F32", color: "white", fontSize: "1.25rem", fontWeight: "bold" };
    return { backgroundColor: "#F3F4F6", color: "#6B7280", fontSize: "1rem", fontWeight: "600" };
  };

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return "#10B981"; // Green
    if (change < 0) return "#EF4444"; // Red
    return "#6B7280"; // Gray
  };

  return (
    <Card 
      className="overflow-hidden bg-white border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Rank Badge */}
          <div 
            className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center"
            style={getRankBadgeStyle()}
          >
            {rank}
          </div>

          {/* Card Image */}
          <div className="flex-shrink-0">
            {hasValidImage ? (
              <img
                src={imageUrl}
                alt={card.name || t('trending.noImage')}
                className="w-16 h-22 md:w-20 md:h-28 object-cover rounded-lg shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-16 h-22 md:w-20 md:h-28 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-xs">{t('trending.noImage')}</span>
              </div>
            )}
          </div>

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-semibold truncate mb-1" style={{ color: "#06038D" }}>
              {card.name || "Unknown Card"}
            </h3>
            <div className="flex flex-col gap-1 text-sm">
              {type === 'searches' && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{t('trending.searchCount')}:</span>
                  <span className="font-semibold" style={{ color: "#06038D" }}>{card.searchCount || 0}</span>
                </div>
              )}
              {(type === 'priceIncrease' || type === 'priceDecrease') && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{t('trending.currentPrice')}:</span>
                    <span className="font-semibold" style={{ color: "#06038D" }}>
                      {formatCurrency(card.currentPrice)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{t('trending.priceChange')}:</span>
                    <span 
                      className="font-semibold"
                      style={{ color: getPriceChangeColor(card.priceChangePercent || 0) }}
                    >
                      {formatPriceChange(card.priceChangePercent || 0)}
                    </span>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* External Link Icon */}
          <div className="flex-shrink-0">
            <ExternalLink className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="overflow-hidden bg-white border border-gray-200">
          <div className="p-4 md:p-6">
            <div className="flex items-center gap-4 md:gap-6">
              <Skeleton className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
              <Skeleton className="w-16 h-22 md:w-20 md:h-28 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Empty State Component
function EmptyState({ activeTab }: { activeTab: TrendingTab }) {
  const { t } = useTranslation();
  
  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'searches': return t('trending.emptySearches');
      case 'priceIncrease': return t('trending.emptyPriceIncrease');
      case 'priceDecrease': return t('trending.emptyPriceDecrease');

      default: return t('trending.emptyHint');
    }
  };

  return (
    <div className="text-center py-16 md:py-24">
      <div className="text-gray-400 text-5xl md:text-6xl mb-4">📊</div>
      <p className="text-gray-600 text-base md:text-lg mb-2">{getEmptyMessage()}</p>
      <p className="text-gray-500 text-sm">{t('trending.emptyHint')}</p>
    </div>
  );
}
