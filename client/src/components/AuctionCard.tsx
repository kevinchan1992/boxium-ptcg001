import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Gavel, Clock, TrendingUp, Eye, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Countdown Hook ──────────────────────────────────────────────────────────
function useCountdown(endTime: Date | string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endTime) return;
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

function formatCountdown(ms: number): { text: string; urgent: boolean } {
  if (ms <= 0) return { text: "已結標", urgent: false };
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return { text: `${d}天 ${h % 24}時`, urgent: false };
  if (h > 0) return { text: `${h}時 ${m % 60}分`, urgent: h < 2 };
  if (m > 0) return { text: `${m}分 ${s % 60}秒`, urgent: true };
  return { text: `${s}秒`, urgent: true };
}

// ─── AuctionCard ─────────────────────────────────────────────────────────────
export function AuctionCard({ auction }: { auction: any }) {
  const [, setLocation] = useLocation();
  const remaining = useCountdown(auction.auctionEndTime);
  const { text: countdownText, urgent } = formatCountdown(remaining);

  const images: string[] | null = (() => {
    try { return auction.images ? JSON.parse(auction.images) : null; }
    catch { return null; }
  })();
  const coverImage = images && images.length > 0 ? images[0] : null;

  const currentPrice = auction.currentHighestBid
    ? parseFloat(auction.currentHighestBid)
    : parseFloat(auction.startingPrice || "0");

  const isEndingSoon = auction.auctionStatus === 'ending_soon' || (remaining > 0 && remaining < 30 * 60 * 1000);
  const isEnded = remaining <= 0 || auction.auctionStatus === 'ended_sold' || auction.auctionStatus === 'ended_no_bid';
  const hasBids = (auction.bidCount ?? 0) > 0;

  const TCG_BADGE: Record<string, string> = {
    pokemon:  "bg-yellow-100 text-yellow-800",
    onepiece: "bg-red-100 text-red-800",
    yugioh:   "bg-purple-100 text-purple-800",
  };

  return (
    <div
      onClick={() => setLocation(`/auction/${auction.id}`)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#06038D]/20 transition-all duration-200 cursor-pointer overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
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

        {/* Auction badge */}
        <div className="absolute top-2 left-2">
          <span className="flex items-center gap-1 bg-[#06038D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            <Gavel className="w-2.5 h-2.5" />
            拍賣
          </span>
        </div>

        {/* Ending soon badge */}
        {isEndingSoon && !isEnded && (
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
              <Zap className="w-2.5 h-2.5" />
              即將結標
            </span>
          </div>
        )}

        {/* Buy Now badge */}
        {auction.buyNowPrice && !isEnded && (
          <div className="absolute bottom-2 right-2">
            <span className="bg-[#FEDD00] text-[#06038D] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              即買
            </span>
          </div>
        )}

        {/* Ended overlay */}
        {isEnded && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
              {auction.auctionStatus === 'ended_sold' ? '已售出' : '已結標'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* TCG series badge */}
        {auction.tcgSeries && auction.tcgSeries !== 'all' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TCG_BADGE[auction.tcgSeries] ?? 'bg-gray-100 text-gray-600'}`}>
            {auction.tcgSeries === 'pokemon' ? 'Pokémon' : auction.tcgSeries === 'onepiece' ? 'One Piece' : 'Yu-Gi-Oh!'}
          </span>
        )}

        {/* Title */}
        <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">
          {auction.title}
        </p>

        {/* Current bid */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400">{hasBids ? '目前出價' : '起標價'}</p>
            <p className="text-sm font-bold text-[#06038D]">HK${currentPrice.toLocaleString()}</p>
          </div>
          {auction.bidCount > 0 && (
            <div className="flex items-center gap-1 text-gray-400">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px]">{auction.bidCount} 次</span>
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${
          isEnded
            ? 'bg-gray-50'
            : urgent
              ? 'bg-red-50'
              : 'bg-[#06038D]/5'
        }`}>
          <Clock className={`w-3 h-3 shrink-0 ${
            isEnded ? 'text-gray-400' : urgent ? 'text-red-500' : 'text-[#06038D]'
          }`} />
          <span className={`text-[10px] font-bold ${
            isEnded ? 'text-gray-400' : urgent ? 'text-red-600' : 'text-[#06038D]'
          }`}>
            {countdownText}
          </span>
        </div>

        {/* Buy now price */}
        {auction.buyNowPrice && !isEnded && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">即買價</span>
            <span className="font-bold text-amber-600">HK${parseFloat(auction.buyNowPrice).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AuctionCardSkeleton ──────────────────────────────────────────────────────
export function AuctionCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-8 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}
