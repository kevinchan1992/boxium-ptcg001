import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";

interface PricingItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  source: "ebay" | "snkrdunk";
  buyUrl: string;
  seller?: string;
  condition?: string;
}

export default function PricingDetail() {
  const { t } = useTranslation();
  const [, params] = useRoute("/pricing/:id");
  const [, setLocation] = useLocation();
  const cardId = params?.id ? parseInt(params.id, 10) : null;

  // Fetch card details
  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId, retry: 1 }
  );

  // Fetch pricing data (eBay + SNKRDUNK)
  const { data: pricingData, isLoading: pricingLoading, refetch } = trpc.pricing.getListings.useQuery(
    { cardId: cardId! },
    { 
      enabled: !!cardId, 
      retry: 1,
      staleTime: 30 * 60 * 1000, // 30 minutes cache
    }
  );

  const handleRefresh = () => {
    refetch();
  };

  const handleBack = () => {
    setLocation("/pricing");
  };

  // Calculate price statistics
  const allPrices = pricingData?.listings.map(item => item.price) || [];
  const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const highestPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const averagePrice = allPrices.length > 0 
    ? allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length 
    : 0;

  if (cardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">{t("pricing.loading")}</span>
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t("pricing.cardNotFound")}</p>
          <Button onClick={handleBack} className="mt-4">
            {t("common.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
      {/* Breadcrumb */}
      <Breadcrumb 
        items={[
          { label: t("common.home"), href: "/" },
          { label: t("common.pricing"), href: "/pricing" },
          { label: card.name }
        ]}
      />

      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("common.back")}
      </Button>

      {/* Card Header */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Card Image */}
          <div className="w-full md:w-64 flex-shrink-0">
            <img
              src={card.imageUrl || "https://via.placeholder.com/256x352?text=No+Image"}
              alt={card.name}
              className="w-full rounded-lg shadow-lg"
            />
          </div>

          {/* Card Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">{card.name}</h1>
            {card.nameJa && (
              <p className="text-lg text-muted-foreground mb-2">{card.nameJa}</p>
            )}
            {card.cardNumber && (
              <p className="text-sm text-muted-foreground mb-4">
                {t("pricing.cardNumber")}: {card.cardNumber}
              </p>
            )}
            {card.series && (
              <p className="text-sm text-muted-foreground mb-4">
                {t("pricing.series")}: {card.series}
              </p>
            )}

            {/* Price Statistics */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("pricing.lowestPrice")}</p>
                <p className="text-xl font-bold text-green-500">
                  {lowestPrice > 0 ? formatCurrency(lowestPrice) : "N/A"}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("pricing.averagePrice")}</p>
                <p className="text-xl font-bold text-primary">
                  {averagePrice > 0 ? formatCurrency(averagePrice) : "N/A"}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("pricing.highestPrice")}</p>
                <p className="text-xl font-bold text-red-500">
                  {highestPrice > 0 ? formatCurrency(highestPrice) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Listings Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          {t("pricing.psa10Listings")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={pricingLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${pricingLoading ? "animate-spin" : ""}`} />
          {t("pricing.refresh")}
        </Button>
      </div>

      {/* Listings Grid */}
      {pricingLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{t("pricing.loadingListings")}</span>
        </div>
      ) : pricingData && pricingData.listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pricingData.listings.map((item: PricingItem) => (
            <div
              key={item.id}
              className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Item Image */}
              <div className="aspect-square relative bg-muted">
                <img
                  src={item.imageUrl || "https://via.placeholder.com/300?text=No+Image"}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {/* Source Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    item.source === "ebay" 
                      ? "bg-blue-500 text-white" 
                      : "bg-orange-500 text-white"
                  }`}>
                    {item.source === "ebay" ? "eBay" : "SNKRDUNK"}
                  </span>
                </div>
              </div>

              {/* Item Info */}
              <div className="p-4">
                <h3 className="font-semibold text-foreground text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                  {item.title}
                </h3>
                
                {/* Price */}
                <p className="text-2xl font-bold text-primary mb-2">
                  {item.currency === "USD" ? `$${item.price.toFixed(2)}` : formatCurrency(item.price)}
                </p>

                {/* Seller Info */}
                {item.seller && (
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("pricing.seller")}: {item.seller}
                  </p>
                )}

                {/* Condition */}
                {item.condition && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("pricing.condition")}: {item.condition}
                  </p>
                )}

                {/* Buy Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(item.buyUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("pricing.buyNow")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("pricing.noListings")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
