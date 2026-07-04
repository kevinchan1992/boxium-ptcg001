/**
 * ListingCard — 統一商品卡片組件
 * ─────────────────────────────────────────────────────────────────────────────
 * 使用 CVA 管理三種變體：
 *   - "marketplace"：一般商品（方形縮圖、Buy Now）
 *   - "auction"：拍賣商品（3:4 縮圖、倒計時、出價）
 *   - "compact"：精簡版（用於首頁、推薦區塊）
 *
 * 所有顏色使用 Brand Token（var(--brand-*)），不硬編碼。
 * 舊頁面可繼續使用 #06038D / #FEDD00，新組件統一用此組件。
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Heart, Share2, Check, ShoppingCart, Gavel,
  Clock, TrendingUp, Zap, Star, Package, Award
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/img-proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

// ─── CVA Variants ────────────────────────────────────────────────────────────
const cardVariants = cva(
  // Base styles — shared across all variants
  [
    "group relative flex flex-col overflow-hidden",
    "border transition-all duration-300 cursor-pointer",
    "bg-[var(--brand-surface-card)]",
    "border-[var(--brand-border-default)]",
    "shadow-[var(--brand-shadow-card)]",
  ].join(" "),
  {
    variants: {
      variant: {
        marketplace: [
          "rounded-xl",
          "hover:border-[var(--brand-border-hover)]",
          "hover:shadow-[var(--brand-shadow-hover)]",
        ].join(" "),
        auction: [
          "rounded-2xl",
          "hover:border-[var(--brand-primary)]",
          "hover:shadow-[var(--brand-shadow-md)]",
        ].join(" "),
        compact: [
          "rounded-lg",
          "hover:border-[var(--brand-border-hover)]",
          "hover:shadow-[var(--brand-shadow-sm)]",
        ].join(" "),
      },
      soldOut: {
        true: "cursor-not-allowed opacity-70",
        false: "",
      },
    },
    defaultVariants: {
      variant: "marketplace",
      soldOut: false,
    },
  }
);

// ─── TCG Badge Maps ───────────────────────────────────────────────────────────
const TCG_BADGE: Record<string, string> = {
  pokemon:  "bg-yellow-100 text-yellow-800",
  onepiece: "bg-red-100 text-red-800",
  yugioh:   "bg-purple-100 text-purple-800",
};
const TCG_LABEL: Record<string, string> = {
  pokemon:  "Pokémon",
  onepiece: "One Piece",
  yugioh:   "Yu-Gi-Oh!",
};
const TCG_LOGO: Record<string, string> = {
  pokemon:  "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif",
  onepiece: "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif",
  yugioh:   "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp",
};
const CONDITION_BADGE: Record<string, string> = {
  psa10:       "bg-yellow-400/90 text-yellow-900 border border-yellow-500/30",
  psa9:        "bg-yellow-300/90 text-yellow-900 border border-yellow-400/30",
  psa8_below:  "bg-yellow-200/90 text-yellow-800 border border-yellow-300/30",
  bgs10:       "bg-blue-400/90 text-white border border-blue-500/30",
  bgs9:        "bg-blue-300/90 text-blue-900 border border-blue-400/30",
  bgs8_below:  "bg-blue-200/90 text-blue-800 border border-blue-300/30",
  tag10:       "bg-green-400/90 text-white border border-green-500/30",
  tag9_below:  "bg-green-200/90 text-green-800 border border-green-300/30",
  raw_a:       "bg-gray-100/90 text-gray-700 border border-gray-300",
  raw_b:       "bg-gray-100/90 text-gray-600 border border-gray-300",
  raw_c:       "bg-gray-100/90 text-gray-500 border border-gray-300",
  raw_d:       "bg-gray-100/90 text-gray-400 border border-gray-300",
};
const CONDITION_SHORT: Record<string, string> = {
  psa10: "PSA 10", psa9: "PSA 9", psa8_below: "PSA 8↓",
  bgs10: "BGS 10", bgs9: "BGS 9", bgs8_below: "BGS 8↓",
  tag10: "TAG 10", tag9_below: "TAG 9↓",
  raw_a: "NM", raw_b: "EX", raw_c: "VG", raw_d: "PO",
};

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(endAt: string | null | undefined) {
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!endAt) return;
    const update = () => {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setText("已結束"); setUrgent(false); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setUrgent(diff < 3600000);
      setText(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return { text, urgent };
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ListingCardProps extends VariantProps<typeof cardVariants> {
  listing: {
    id: number;
    title: string;
    images?: string | null;
    condition?: string | null;
    tcgSeries?: string | null;
    priceHkd?: string | number | null;
    quantity?: number;
    remainingQuantity?: number;
    status?: string;
    sellerType?: string;
    sellerProfile?: {
      avgRating?: string | null;
      ratingCount?: number;
    } | null;
    // Auction-specific
    listingMode?: string;
    auctionStatus?: string;
    auctionEndAt?: string | null;
    startingBid?: string | number | null;
    currentHighestBid?: string | number | null;
    buyNowPrice?: string | number | null;
    bidCount?: number;
  };
  wishlistIds?: number[];
  onWishlistToggle?: (id: number) => void;
  className?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ListingCard({
  listing,
  variant = "marketplace",
  wishlistIds,
  onWishlistToggle,
  className,
}: ListingCardProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  const isAuction = variant === "auction" || listing.listingMode === "auction";
  const isSoldOut = listing.remainingQuantity === 0 || listing.status === "sold";
  const isEnded = listing.auctionStatus === "ended_sold" || listing.auctionStatus === "ended_unsold";
  const isWishlisted = wishlistIds?.includes(listing.id) ?? false;

  const images: string[] | null = (() => {
    try { return listing.images ? JSON.parse(listing.images) : null; }
    catch { return null; }
  })();
  const coverImage = getProxiedImageUrl(images?.[0]);
  const conditionKey = listing.condition ?? "";

  const currentBid = listing.currentHighestBid
    ? parseFloat(String(listing.currentHighestBid))
    : listing.startingBid
      ? parseFloat(String(listing.startingBid))
      : 0;
  const hasBids = (listing.bidCount ?? 0) > 0;

  const { text: countdownText, urgent } = useCountdown(
    isAuction ? listing.auctionEndAt : null
  );

  const handleClick = () => {
    if (isSoldOut && !isAuction) return;
    if (isAuction) {
      setLocation(`/auctions/${listing.id}`);
    } else {
      setLocation(`/marketplace/${listing.id}`);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const path = isAuction ? `/auctions/${listing.id}` : `/marketplace/${listing.id}`;
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const aspectClass = isAuction ? "aspect-[3/4]" : "aspect-square";

  return (
    <div
      className={cn(cardVariants({ variant, soldOut: isSoldOut && !isAuction }), className)}
      onClick={handleClick}
    >
      {/* ── Image ── */}
      <div className={`relative ${aspectClass} bg-gray-50 overflow-hidden`}>
        {coverImage ? (
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            {isAuction
              ? <Gavel className="w-10 h-10 text-gray-200" />
              : <Package className="w-10 h-10 text-gray-200" />
            }
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Sold out overlay */}
        {isSoldOut && !isAuction && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
              <span className="text-[var(--brand-primary)] font-bold text-sm tracking-wider">
                {t("marketplace.soldOut", "Sold Out")}
              </span>
            </div>
          </div>
        )}

        {/* Auction ended overlay */}
        {isAuction && isEnded && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
              {listing.auctionStatus === "ended_sold"
                ? t("auctionCard.sold", "Sold")
                : t("auctionCard.ended", "Ended")}
            </span>
          </div>
        )}

        {/* ── Overlay Badges ── */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Auction badge */}
          {isAuction && (
            <span className="flex items-center gap-1 bg-[var(--brand-primary)] text-[var(--brand-text-on-primary)] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <Gavel className="w-2.5 h-2.5" />
              {t("auctionCard.auction", "Auction")}
            </span>
          )}
          {/* Condition badge */}
          {conditionKey && CONDITION_BADGE[conditionKey] && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm backdrop-blur-sm ${CONDITION_BADGE[conditionKey]}`}>
              {CONDITION_SHORT[conditionKey] ?? conditionKey}
            </span>
          )}
          {/* TCG series badge (non-pokemon) */}
          {listing.tcgSeries && listing.tcgSeries !== "pokemon" && listing.tcgSeries !== "all" && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm backdrop-blur-sm ${TCG_BADGE[listing.tcgSeries] ?? "bg-gray-100 text-gray-700"}`}>
              {TCG_LABEL[listing.tcgSeries] ?? listing.tcgSeries}
            </span>
          )}
        </div>

        {/* Top-right badges */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {/* Platform official badge */}
          {listing.sellerType === "platform" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--brand-primary)]/90 text-[var(--brand-accent)] shadow-sm backdrop-blur-sm">
              {t("marketplace.official", "Official")}
            </span>
          )}
          {/* Ending soon (auction) */}
          {isAuction && !isEnded && urgent && (
            <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
              <Zap className="w-2.5 h-2.5" />
              {t("auctionCard.endingSoon", "Ending Soon")}
            </span>
          )}
          {/* Wishlist button */}
          {onWishlistToggle && !isAuction && (
            <button
              className="w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:scale-110 transition-transform z-10"
              onClick={e => { e.stopPropagation(); onWishlistToggle(listing.id); }}
              aria-label={isWishlisted ? t("marketplace.removeWishlist") : t("marketplace.addWishlist")}
            >
              <Heart className={`w-3.5 h-3.5 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"}`} />
            </button>
          )}
        </div>

        {/* Buy Now badge (auction bottom-right) */}
        {isAuction && listing.buyNowPrice && !isEnded && (
          <div className="absolute bottom-2 right-2">
            <span className="bg-[var(--brand-accent)] text-[var(--brand-text-on-accent)] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              {t("auctionCard.buyNow", "Buy Now")}
            </span>
          </div>
        )}

        {/* Hover CTA (marketplace) */}
        {!isAuction && !isSoldOut && (
          <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <div className="bg-[var(--brand-primary)]/90 backdrop-blur-sm text-[var(--brand-text-on-primary)] font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-lg">
              <ShoppingCart className="w-3.5 h-3.5" />
              {t("marketplace.viewDetails", "View Details")}
            </div>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        {/* Title */}
        <p className="text-sm font-medium text-[var(--brand-text-main)] line-clamp-2 leading-snug flex-1 min-h-[2.5rem]">
          {listing.title}
        </p>

        {/* Auction: current bid + countdown */}
        {isAuction ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[var(--brand-text-muted)]">
                  {hasBids
                    ? t("auctionCard.currentBid", "Current Bid")
                    : t("auctionCard.startingBid", "Starting Bid")}
                </p>
                <p className="text-sm font-bold text-[var(--brand-primary)]">
                  HK${currentBid.toLocaleString()}
                </p>
              </div>
              {(listing.bidCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-[var(--brand-text-muted)]">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-[10px]">
                    {t("auctionCard.bidCount", { count: listing.bidCount ?? 0 })}
                  </span>
                </div>
              )}
            </div>
            {/* Countdown */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${
              isEnded ? "bg-gray-50" : urgent ? "bg-red-50" : "bg-[var(--brand-primary-light)]"
            }`}>
              <Clock className={`w-3 h-3 shrink-0 ${
                isEnded ? "text-gray-400" : urgent ? "text-red-500" : "text-[var(--brand-primary)]"
              }`} />
              <span className={`text-[10px] font-bold ${
                isEnded ? "text-gray-400" : urgent ? "text-red-600" : "text-[var(--brand-primary)]"
              }`}>
                {countdownText}
              </span>
            </div>
            {/* Buy now price */}
            {listing.buyNowPrice && !isEnded && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--brand-text-muted)]">
                  {t("auctionCard.buyNowPrice", "Buy Now")}
                </span>
                <span className="font-bold text-amber-600">
                  HK${parseFloat(String(listing.buyNowPrice)).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Marketplace: price + seller info */
          <>
            <div className="flex items-end justify-between gap-1">
              <p className="text-lg font-bold text-[var(--brand-primary)] leading-tight">
                HK${Number(listing.priceHkd).toLocaleString()}
              </p>
              {(listing.quantity ?? 0) <= 3 && (listing.quantity ?? 0) > 0 && (
                <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5 bg-orange-50 px-1.5 py-0.5 rounded-md shrink-0">
                  <Zap className="w-2.5 h-2.5" />
                  {t("marketplace.onlyLeft", { count: listing.quantity })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              {listing.sellerType === "seller" && listing.sellerProfile ? (
                <div className="flex items-center gap-1 text-[11px] text-[var(--brand-text-secondary)]">
                  {(listing.sellerProfile.ratingCount ?? 0) > 0 ? (
                    <>
                      <Star className="w-3 h-3 fill-[var(--brand-accent)] text-[var(--brand-accent)]" />
                      <span className="font-medium text-[var(--brand-text-main)]">
                        {parseFloat(listing.sellerProfile.avgRating ?? "0").toFixed(1)}
                      </span>
                      <span>({listing.sellerProfile.ratingCount})</span>
                    </>
                  ) : (
                    <span className="text-[var(--brand-text-muted)]">
                      {t("marketplace.newSeller", "New Seller")}
                    </span>
                  )}
                </div>
              ) : <span />}
              <div className="flex items-center gap-1.5">
                {listing.tcgSeries && TCG_LOGO[listing.tcgSeries] && (
                  <img
                    src={getProxiedImageUrl(TCG_LOGO[listing.tcgSeries]) ?? undefined}
                    alt={TCG_LABEL[listing.tcgSeries] ?? listing.tcgSeries}
                    className="h-6 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
                  />
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-[var(--brand-primary)] hover:bg-gray-100 transition-all"
                  title={t("marketplace.copyProductLink", "Copy link")}
                >
                  {copied
                    ? <Check className="w-3 h-3 text-green-500" />
                    : <Share2 className="w-3 h-3" />
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export interface ListingCardSkeletonProps {
  variant?: "marketplace" | "auction" | "compact";
  className?: string;
}

export function ListingCardSkeleton({ variant = "marketplace", className }: ListingCardSkeletonProps) {
  const isAuction = variant === "auction";
  const aspectClass = isAuction ? "aspect-[3/4]" : "aspect-square";
  const radiusClass = isAuction ? "rounded-2xl" : variant === "compact" ? "rounded-lg" : "rounded-xl";

  return (
    <div className={cn(
      `${radiusClass} overflow-hidden border border-[var(--brand-border-default)] bg-[var(--brand-surface-card)] animate-pulse`,
      className
    )}>
      <Skeleton className={`${aspectClass} w-full rounded-none`} />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        {isAuction && <Skeleton className="h-8 w-full rounded-lg" />}
      </div>
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
/**
 * 統一狀態 Badge 組件
 * 使用 Brand Token 的 status 變數，確保全站狀態顏色一致。
 */
export type StatusBadgeVariant =
  | "active" | "sold" | "pending" | "disputed"
  | "auction" | "ended" | "info" | "warning";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
  {
    variants: {
      status: {
        active:   "bg-[var(--brand-status-active-bg)] text-[var(--brand-status-active-text)] border-[var(--brand-status-active-border)]",
        sold:     "bg-[var(--brand-status-sold-bg)] text-[var(--brand-status-sold-text)] border-[var(--brand-status-sold-border)]",
        pending:  "bg-[var(--brand-status-pending-bg)] text-[var(--brand-status-pending-text)] border-[var(--brand-status-pending-border)]",
        disputed: "bg-[var(--brand-status-disputed-bg)] text-[var(--brand-status-disputed-text)] border-[var(--brand-status-disputed-border)]",
        auction:  "bg-[var(--brand-status-auction-bg)] text-[var(--brand-status-auction-text)] border-[var(--brand-status-auction-border)]",
        ended:    "bg-gray-100 text-gray-600 border-gray-200",
        info:     "bg-blue-50 text-blue-700 border-blue-200",
        warning:  "bg-orange-50 text-orange-700 border-orange-200",
      },
    },
    defaultVariants: { status: "info" },
  }
);

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, icon, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)}>
      {icon}
      {children}
    </span>
  );
}
