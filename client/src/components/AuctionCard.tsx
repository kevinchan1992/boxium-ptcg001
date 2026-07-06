import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Gavel, Clock, TrendingUp, Zap } from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { BidDrawer } from "@/components/BidDrawer";

// ─── Countdown Hook ──────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endTime) {
      setRemaining(0);
      return;
    }
    const end = new Date(endTime).getTime();
    const tick = () => {
      const diff = end - Date.now();
      setRemaining(Math.max(0, diff));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  return remaining;
}

function formatCountdown(ms: number, t: (key: string, opts?: any) => string): { text: string; urgent: boolean } {
  if (ms <= 0) return { text: t("auctionCard.ended"), urgent: false };
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return { text: t("auctionCard.countdown.dh", { d, h: h % 24 }), urgent: false };
  if (h > 0) return { text: t("auctionCard.countdown.hm", { h, m: m % 60 }), urgent: h < 2 };
  if (m > 0) return { text: t("auctionCard.countdown.ms", { m, s: s % 60 }), urgent: true };
  return { text: t("auctionCard.countdown.s", { s }), urgent: true };
}

// ─── AuctionCard ─────────────────────────────────────────────────────────────
export function AuctionCard({ auction }: { auction: any }) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [bidDrawerOpen, setBidDrawerOpen] = useState(false);

  const remaining = useCountdown(auction.auctionEndAt);
  const remainingMs = remaining ?? Infinity;
  const { text: countdownText, urgent } = remaining !== null ? formatCountdown(remaining, t) : { text: '...', urgent: false };

  const images: string[] | null = (() => {
    try { return auction.images ? JSON.parse(auction.images) : null; }
    catch { return null; }
  })();
  const coverImageRaw = images && images.length > 0 ? images[0] : null;
  const coverImage = getProxiedImageUrl(coverImageRaw);

  const currentPrice = auction.currentHighestBid
    ? parseFloat(auction.currentHighestBid)
    : parseFloat(auction.startingBid || "0");

  const isEndingSoon = auction.auctionStatus === 'ending_soon' || (remainingMs > 0 && remainingMs < 3600_000);
  const isEnded = (remaining !== null && remaining <= 0) || auction.auctionStatus === 'ended_sold' || auction.auctionStatus === 'ended_no_bid';
  const hasBids = (auction.bidCount ?? 0) > 0;

  const TCG_BADGE: Record<string, string> = {
    pokemon:  "bg-yellow-50 text-yellow-700 border border-yellow-200",
    onepiece: "bg-red-50 text-red-700 border border-red-200",
    yugioh:   "bg-purple-50 text-purple-700 border border-purple-200",
  };
  const TCG_LABEL: Record<string, string> = {
    pokemon: "Pokémon",
    onepiece: "One Piece",
    yugioh: "Yu-Gi-Oh!",
  };

  return (
    <>
      <div
        onClick={() => setLocation(`/auction/${auction.id}`)}
        className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden group"
      >
        {/* Image */}
        <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={auction.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gavel className="w-12 h-12 text-gray-200" />
            </div>
          )}

          {/* Ending soon badge */}
          {isEndingSoon && !isEnded && (
            <div className="absolute top-2 right-2">
              <span className="flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                <Zap className="w-2 h-2" />
                HOT
              </span>
            </div>
          )}

          {/* Buy Now badge */}
          {auction.buyNowPrice && !isEnded && (
            <div className="absolute bottom-2 left-2">
              <span className="bg-amber-400 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full">
                {t("auctionCard.buyNow")}
              </span>
            </div>
          )}

          {/* Ended overlay */}
          {isEnded && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white/90 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                {auction.auctionStatus === 'ended_sold' ? t("auctionCard.sold") : t("auctionCard.ended")}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          {/* TCG series badge */}
          {auction.tcgSeries && auction.tcgSeries !== 'all' && (
            <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TCG_BADGE[auction.tcgSeries] ?? 'bg-gray-100 text-gray-500'}`}>
              {TCG_LABEL[auction.tcgSeries] ?? auction.tcgSeries}
            </span>
          )}

          {/* Title */}
          <p className="text-xs font-semibold text-[#1a1a2e] line-clamp-2 leading-snug group-hover:text-[#06038D] transition-colors">
            {auction.title}
          </p>

          {/* Price row */}
          <div className="flex items-end justify-between gap-1">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                {hasBids ? t("auctionCard.currentBid") : t("auctionCard.startingBid")}
              </p>
              <p className="text-sm font-bold text-[#06038D] leading-none">HK${currentPrice.toLocaleString()}</p>
            </div>
            {auction.bidCount > 0 && (
              <div className="flex items-center gap-0.5 text-gray-400 shrink-0">
                <TrendingUp className="w-2.5 h-2.5" />
                <span className="text-[9px]">{auction.bidCount}</span>
              </div>
            )}
          </div>

          {/* Countdown bar */}
          <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${
            isEnded ? 'bg-gray-50' : urgent ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <Clock className={`w-2.5 h-2.5 shrink-0 ${
              isEnded ? 'text-gray-300' : urgent ? 'text-red-400' : 'text-gray-400'
            }`} />
            <span className={`text-[10px] font-semibold tabular-nums ${
              isEnded ? 'text-gray-400' : urgent ? 'text-red-500' : 'text-gray-600'
            }`}>
              {countdownText}
            </span>
          </div>

          {/* Buy now price */}
          {auction.buyNowPrice && !isEnded && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-400">{t("auctionCard.buyNowPrice")}</span>
              <span className="font-bold text-amber-600">HK${parseFloat(auction.buyNowPrice).toLocaleString()}</span>
            </div>
          )}

          {/* Place Bid button — only show when active */}
          {!isEnded && (
            <button
              onClick={e => { e.stopPropagation(); setBidDrawerOpen(true); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1a1a2e] hover:bg-[#06038D] text-white text-[11px] font-bold transition-colors duration-200"
            >
              <Gavel className="w-3 h-3" />
              {t("auctionDetail.bidPanel.placeBid")}
            </button>
          )}
        </div>
      </div>

      {/* ── BidDrawer ── */}
      <BidDrawer
        listing={auction}
        open={bidDrawerOpen}
        onClose={() => setBidDrawerOpen(false)}
        onBidSuccess={() => setBidDrawerOpen(false)}
      />
    </>
  );
}

// ─── AuctionCardSkeleton ──────────────────────────────────────────────────────
export function AuctionCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-7 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}
