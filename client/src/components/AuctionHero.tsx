/**
 * AuctionHero — 拍賣大廳 Hero Section
 * Editorial / Auction House style (Sotheby's / Christie's aesthetic)
 * Shows the top featured auction with large image, countdown, live bid
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Gavel, Clock, TrendingUp, ArrowRight, Zap, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";

// ─── Countdown Hook ──────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!endTime) { setRemaining(0); return; }
    const end = new Date(endTime).getTime();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  return remaining;
}

function formatCountdownParts(ms: number) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return {
    d,
    h: h % 24,
    m: m % 60,
    s: s % 60,
    urgent: h < 1 && d === 0,
    endingSoon: h < 24 && d === 0,
  };
}

// ─── CountdownUnit ────────────────────────────────────────────────────────────
function CountdownUnit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-[3rem]">
      <div className={`
        text-2xl sm:text-3xl font-bold tabular-nums leading-none
        transition-all duration-300
        ${urgent ? "text-red-500" : "text-[#1a1a2e]"}
      `}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1 font-medium">{label}</div>
    </div>
  );
}

// ─── AuctionHeroCard ──────────────────────────────────────────────────────────
function AuctionHeroCard({ auction, rank }: { auction: any; rank: number }) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const remaining = useCountdown(auction.auctionEndAt);
  const remainingMs = remaining ?? Infinity;
  const parts = remaining !== null ? formatCountdownParts(remaining) : null;
  const isEnded = remainingMs === 0;

  const images: string[] | null = (() => {
    try { return auction.images ? JSON.parse(auction.images) : null; }
    catch { return null; }
  })();
  const coverImageRaw = images && images.length > 0 ? images[0] : null;
  const coverImage = getProxiedImageUrl(coverImageRaw);

  const currentPrice = auction.currentHighestBid
    ? parseFloat(auction.currentHighestBid)
    : parseFloat(auction.startingBid ?? "0");
  const hasBids = auction.bidCount > 0;

  const TCG_LABEL: Record<string, string> = {
    pokemon: "Pokémon",
    onepiece: "One Piece",
    yugioh: "Yu-Gi-Oh!",
  };

  return (
    <div
      className="group cursor-pointer"
      onClick={() => setLocation(`/auction/${auction.id}`)}
    >
      {/* Image */}
      <div className="relative overflow-hidden rounded-xl bg-gray-100 aspect-[3/4]">
        {coverImage ? (
          <img
            src={coverImage}
            alt={auction.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Gavel className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {/* Rank badge */}
        <div className="absolute top-3 left-3">
          <span className="font-serif italic text-xs font-bold text-white bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Lot {rank}
          </span>
        </div>
        {/* Ending soon pulse */}
        {parts?.urgent && !isEnded && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
              <Zap className="w-2.5 h-2.5" />
              LIVE
            </span>
          </div>
        )}
        {/* Ended overlay */}
        {isEnded && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-bold px-4 py-2 rounded-full tracking-widest uppercase">
              {auction.auctionStatus === "ended_sold" ? "Sold" : "Ended"}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1.5">
        {/* Series */}
        {auction.tcgSeries && auction.tcgSeries !== "all" && (
          <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-medium">
            {TCG_LABEL[auction.tcgSeries] ?? auction.tcgSeries}
          </p>
        )}
        {/* Title */}
        <p className="text-sm font-semibold text-[#1a1a2e] line-clamp-2 leading-snug group-hover:text-[#06038D] transition-colors">
          {auction.title}
        </p>
        {/* Price */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">
            {hasBids ? "Current Bid" : "Starting"}
          </span>
          <span className="text-base font-bold text-[#06038D]">
            HK${currentPrice.toLocaleString()}
          </span>
          {auction.bidCount > 0 && (
            <span className="text-[10px] text-gray-400">
              · {auction.bidCount} bids
            </span>
          )}
        </div>
        {/* Countdown */}
        {!isEnded && parts && (
          <div className={`text-[11px] font-medium flex items-center gap-1 ${parts.urgent ? "text-red-500" : "text-gray-500"}`}>
            <Clock className="w-3 h-3 shrink-0" />
            {parts.d > 0
              ? `${parts.d}d ${parts.h}h remaining`
              : parts.h > 0
              ? `${parts.h}h ${parts.m}m remaining`
              : `${parts.m}m ${parts.s}s remaining`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AuctionHero (main export) ────────────────────────────────────────────────
interface AuctionHeroProps {
  auctions: any[];
  total: number;
  isLoading: boolean;
  onViewAll: () => void;
}

export function AuctionHero({ auctions, total, isLoading, onViewAll }: AuctionHeroProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Featured = first auction (sorted by ending_soon)
  const featured = auctions[0] ?? null;
  const secondary = auctions.slice(1, 4); // up to 3 secondary lots

  const remaining = useCountdown(featured?.auctionEndAt ?? null);
  const remainingMs = remaining ?? Infinity;
  const parts = remaining !== null && featured ? formatCountdownParts(remaining) : null;
  const isEnded = remainingMs === 0;

  const featuredImages: string[] | null = (() => {
    try { return featured?.images ? JSON.parse(featured.images) : null; }
    catch { return null; }
  })();
  const featuredImageRaw = featuredImages && featuredImages.length > 0 ? featuredImages[0] : null;
  const featuredImage = getProxiedImageUrl(featuredImageRaw);

  const featuredPrice = featured
    ? (featured.currentHighestBid
        ? parseFloat(featured.currentHighestBid)
        : parseFloat(featured.startingBid ?? "0"))
    : 0;
  const featuredHasBids = (featured?.bidCount ?? 0) > 0;

  const TCG_LABEL: Record<string, string> = {
    pokemon: "Pokémon TCG",
    onepiece: "One Piece TCG",
    yugioh: "Yu-Gi-Oh! TCG",
  };

  if (isLoading) {
    return <AuctionHeroSkeleton />;
  }

  if (!featured) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Gavel className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">No Active Auctions</p>
        <p className="text-xs text-gray-300 mt-1">Check back soon for new lots</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ── Editorial Header ── */}
      <div className="flex items-end justify-between mb-6 sm:mb-8 border-b border-gray-200 pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-medium mb-1">
            The Exclusive Lots
          </p>
          <h2
            className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            本週焦點競投
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {total} active lots
            </span>
          )}
          <button
            onClick={onViewAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#06038D] hover:text-[#0805b8] transition-colors group"
          >
            View All
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* ── Main Layout: Featured + Secondary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-10">

        {/* ── Featured Lot (Left) ── */}
        <div
          className="group cursor-pointer"
          onClick={() => setLocation(`/auction/${featured.id}`)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr] gap-6 lg:gap-8 items-center">

            {/* Image */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-50 aspect-[3/4] sm:aspect-auto sm:h-[420px] lg:h-[480px]">
              {featuredImage ? (
                <img
                  src={featuredImage}
                  alt={featured.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-103"
                  loading="eager"
                  style={{ transform: "scale(1)" }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Gavel className="w-20 h-20 text-gray-200" />
                </div>
              )}
              {/* Lot badge */}
              <div className="absolute top-4 left-4">
                <span
                  className="text-xs font-bold text-white bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full italic"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Lot 001 · Featured
                </span>
              </div>
              {/* Ending soon */}
              {parts?.urgent && !isEnded && (
                <div className="absolute top-4 right-4">
                  <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                    <Zap className="w-3 h-3" />
                    Ending Soon
                  </span>
                </div>
              )}
              {/* Ended overlay */}
              {isEnded && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                  <span className="bg-white text-gray-800 text-sm font-bold px-6 py-3 rounded-full tracking-widest uppercase">
                    {featured.auctionStatus === "ended_sold" ? "Sold" : "Ended"}
                  </span>
                </div>
              )}
            </div>

            {/* Info Panel */}
            <div className="flex flex-col justify-center space-y-5">
              {/* Series label */}
              {featured.tcgSeries && featured.tcgSeries !== "all" && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                  {TCG_LABEL[featured.tcgSeries] ?? featured.tcgSeries}
                </p>
              )}

              {/* Title */}
              <div>
                <h3
                  className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1a1a2e] leading-tight group-hover:text-[#06038D] transition-colors"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {featured.title}
                </h3>
                {featured.condition && (
                  <p className="text-xs text-gray-400 mt-1.5 uppercase tracking-wide">{featured.condition}</p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100" />

              {/* Price */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-1">
                  {featuredHasBids ? "Current Bid" : "Starting Bid"}
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-3xl sm:text-4xl font-bold text-[#06038D] leading-none"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    HK${featuredPrice.toLocaleString()}
                  </span>
                  {featured.bidCount > 0 && (
                    <span className="text-sm text-gray-400 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {featured.bidCount} bids
                    </span>
                  )}
                </div>
                {featured.buyNowPrice && !isEnded && (
                  <p className="text-xs text-amber-600 mt-1">
                    Buy Now: HK${parseFloat(featured.buyNowPrice).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Countdown */}
              {!isEnded && parts && (
                <div className={`p-4 rounded-xl border ${parts.urgent ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-medium mb-3 ${parts.urgent ? "text-red-400" : "text-gray-400"}`}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {parts.urgent ? "Closing Soon" : "Time Remaining"}
                  </p>
                  <div className="flex items-center gap-3">
                    {parts.d > 0 && <CountdownUnit value={parts.d} label="Days" urgent={parts.urgent} />}
                    {parts.d > 0 && <span className={`text-xl font-light ${parts.urgent ? "text-red-300" : "text-gray-300"}`}>:</span>}
                    <CountdownUnit value={parts.h} label="Hours" urgent={parts.urgent} />
                    <span className={`text-xl font-light ${parts.urgent ? "text-red-300" : "text-gray-300"}`}>:</span>
                    <CountdownUnit value={parts.m} label="Min" urgent={parts.urgent} />
                    <span className={`text-xl font-light ${parts.urgent ? "text-red-300" : "text-gray-300"}`}>:</span>
                    <CountdownUnit value={parts.s} label="Sec" urgent={parts.urgent} />
                  </div>
                </div>
              )}

              {/* CTA */}
              {!isEnded && (
                <button
                  onClick={e => { e.stopPropagation(); setLocation(`/auction/${featured.id}`); }}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 bg-[#1a1a2e] text-white hover:bg-[#06038D] group/btn"
                >
                  <Gavel className="w-4 h-4" />
                  Place Bid
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
                </button>
              )}
              {isEnded && (
                <button
                  onClick={e => { e.stopPropagation(); setLocation(`/auction/${featured.id}`); }}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Results
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Secondary Lots (Right) ── */}
        {secondary.length > 0 && (
          <div className="lg:border-l lg:border-gray-100 lg:pl-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-4 hidden lg:block">
              Also Closing Soon
            </p>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-4 lg:gap-5">
              {secondary.map((auction, i) => (
                <AuctionHeroCard key={auction.id} auction={auction} rank={i + 2} />
              ))}
            </div>
            {/* View all button */}
            <button
              onClick={onViewAll}
              className="mt-5 w-full py-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:border-[#06038D] hover:text-[#06038D] transition-all duration-200 hidden lg:flex items-center justify-center gap-2 group"
            >
              View All {total} Lots
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function AuctionHeroSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="flex items-end justify-between mb-6 border-b border-gray-100 pb-4">
        <div>
          <div className="h-2.5 w-24 bg-gray-100 rounded mb-2" />
          <div className="h-7 w-48 bg-gray-100 rounded" />
        </div>
        <div className="h-4 w-16 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          <div className="aspect-[3/4] sm:h-[420px] bg-gray-100 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-8 w-full bg-gray-100 rounded" />
            <div className="h-px bg-gray-100" />
            <div className="h-10 w-32 bg-gray-100 rounded" />
            <div className="h-20 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
        </div>
        <div className="hidden lg:block space-y-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-16 h-20 bg-gray-100 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
