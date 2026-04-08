import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  Star, Package, ShoppingBag, ArrowLeft, MessageSquare,
  Calendar, Award, Gavel, Clock, TrendingUp, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

/* ─── Star Rating ─────────────────────────────────────────── */
function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${i <= Math.round(rating) ? "text-[#FEDD00] fill-[#FEDD00]" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

/* ─── Auction Countdown ───────────────────────────────────── */
function AuctionCountdown({ endAt }: { endAt: Date | string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!endAt) return;
    const end = new Date(endAt).getTime();
    const update = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft("已結標"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}天 ${h}時`);
      else if (h > 0) setTimeLeft(`${h}時 ${m}分`);
      else setTimeLeft(`${m}分 ${s}秒`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endAt]);

  const isUrgent = endAt && (new Date(endAt).getTime() - Date.now()) < 3600000;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? "text-red-500" : "text-gray-500"}`}>
      <Clock className="w-3 h-3" />
      {timeLeft || "計算中..."}
    </span>
  );
}

/* ─── Stat Pill ───────────────────────────────────────────── */
function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-500">
      {icon}
      <span>{label}</span>
    </div>
  );
}

/* ─── Listing Card ────────────────────────────────────────── */
function ListingCard({ listing }: { listing: any }) {
  const conditionLabel: Record<string, string> = {
    new: "全新", like_new: "近全新", good: "良好", fair: "一般"
  };
  // images is stored as JSON string in DB, parse it
  const imgs = (() => { try { return JSON.parse(listing.images ?? "[]"); } catch { return []; } })();
  return (
    <Link href={`/marketplace/${listing.id}`}>
      <div className="group bg-white rounded-2xl border border-gray-100 hover:border-[#06038D]/30 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
        {/* Image */}
        <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
          {imgs[0] ? (
            <img
              src={imgs[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
          )}
          {listing.condition && (
            <span className="absolute top-2 left-2 text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
              {conditionLabel[listing.condition] ?? listing.condition}
            </span>
          )}
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-gray-800 text-sm font-medium line-clamp-2 leading-snug mb-2 group-hover:text-[#06038D] transition-colors">
            {listing.title}
          </p>
          <p className="text-[#06038D] font-bold text-base">
            HK${parseFloat(listing.priceHkd).toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ─── Auction Card ────────────────────────────────────────── */
function AuctionCard({ auction }: { auction: any }) {
  const imgs = (() => { try { return JSON.parse(auction.images ?? "[]"); } catch { return []; } })();
  const currentBid = auction.currentHighestBid
    ? parseFloat(auction.currentHighestBid)
    : parseFloat(auction.startingBid ?? "0");
  const isCurrentBid = !!auction.currentHighestBid;

  return (
    <Link href={`/auction/${auction.id}`}>
      <div className="group bg-white rounded-2xl border border-gray-100 hover:border-[#06038D]/30 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer">
        {/* Image */}
        <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
          {imgs[0] ? (
            <img
              src={imgs[0]}
              alt={auction.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gavel className="w-10 h-10 text-gray-300" />
            </div>
          )}
          {/* Live badge */}
          <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold bg-[#06038D] text-white px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FEDD00] animate-pulse" />
            競標中
          </span>
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-gray-800 text-sm font-medium line-clamp-2 leading-snug mb-2 group-hover:text-[#06038D] transition-colors">
            {auction.title}
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{isCurrentBid ? "當前出價" : "起拍價"}</p>
              <p className="text-[#06038D] font-bold text-base">HK${currentBid.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">{auction.bidCount ?? 0} 次出價</p>
              <AuctionCountdown endAt={auction.auctionEndAt} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function SellerPublicProfile() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const sellerId = parseInt(params.id ?? "0");

  const { data, isLoading, error } = trpc.marketplace.getSellerPublicProfile.useQuery(
    { sellerId },
    { enabled: !!sellerId }
  );

  /* Loading */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 space-y-4">
          <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-48 bg-white rounded-2xl animate-pulse border border-gray-100" />
          <div className="h-12 bg-white rounded-xl animate-pulse border border-gray-100" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* Error */
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-700 text-lg font-semibold mb-1">{t("sellerPublicProfile.sellerNotFound")}</p>
          <p className="text-gray-400 text-sm mb-6">找不到此賣家的資料</p>
          <Link href="/marketplace">
            <Button className="bg-[#06038D] hover:bg-[#06038D]/90 text-white rounded-xl px-6">
              返回商城
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { seller, listings, activeAuctions, reviews, reviewTotal } = data as any;
  const avgRating = parseFloat(seller.avgRating as string ?? "0");
  const auctionCount = (activeAuctions ?? []).length;
  const isTopSeller = avgRating >= 4.5 && seller.ratingCount >= 5;
  const isActiveSeller = (seller.totalSales ?? 0) >= 10;
  const defaultTab = auctionCount > 0 && listings.length === 0 ? "auctions" : "listings";

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4">

        {/* Back */}
        <Link href="/marketplace">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#06038D] transition-colors mb-5 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            返回商城
          </button>
        </Link>

        {/* ── Hero Profile Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          {/* Top banner strip */}
          <div className="h-2 bg-gradient-to-r from-[#06038D] via-[#3730a3] to-[#06038D]" />

          <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-[#06038D] to-[#3730a3] flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-md">
                  {seller.avatarUrl ? (
                    <img src={seller.avatarUrl} alt={seller.displayName} className="w-full h-full object-cover" />
                  ) : (
                    seller.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                {/* Online dot */}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-[#06038D]">{seller.displayName}</h1>
                  {isTopSeller && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#FEDD00] text-[#06038D] px-2.5 py-1 rounded-full">
                      <Award className="w-3 h-3" />
                      優質賣家
                    </span>
                  )}
                  {isActiveSeller && !isTopSeller && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                      <ShoppingBag className="w-3 h-3" />
                      活躍賣家
                    </span>
                  )}
                  {auctionCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#06038D]/10 text-[#06038D] px-2.5 py-1 rounded-full">
                      <Gavel className="w-3 h-3" />
                      拍賣中
                    </span>
                  )}
                </div>

                {seller.bio && (
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2">{seller.bio}</p>
                )}

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <StarRating rating={avgRating} size="sm" />
                    <span className="text-[#06038D] font-bold text-sm">{avgRating.toFixed(1)}</span>
                    <span className="text-gray-400 text-sm">({seller.ratingCount} 評價)</span>
                  </div>
                  <StatPill icon={<ShoppingBag className="w-4 h-4 text-gray-400" />} label={`${seller.totalSales} 筆成交`} />
                  <StatPill
                    icon={<Calendar className="w-4 h-4 text-gray-400" />}
                    label={`加入於 ${new Date(seller.memberSince).toLocaleDateString("zh-HK", { year: "numeric", month: "long" })}`}
                  />
                </div>
              </div>

              {/* CTA arrow */}
              <div className="hidden md:flex items-center self-center">
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: "在售商品", value: listings.length, icon: <Package className="w-4 h-4" /> },
              { label: "進行中拍賣", value: auctionCount, icon: <Gavel className="w-4 h-4" /> },
              { label: "買家評價", value: reviewTotal, icon: <MessageSquare className="w-4 h-4" /> },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center py-4 gap-1">
                <div className="flex items-center gap-1.5 text-[#06038D]">
                  {stat.icon}
                  <span className="text-xl font-bold">{stat.value}</span>
                </div>
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-white border border-gray-100 shadow-sm rounded-xl p-1 mb-5 w-full sm:w-auto">
            <TabsTrigger
              value="listings"
              className="rounded-lg text-gray-500 data-[state=active]:bg-[#06038D] data-[state=active]:text-white data-[state=active]:shadow-sm font-medium transition-all"
            >
              <Package className="w-3.5 h-3.5 mr-1.5" />
              在售商品 ({listings.length})
            </TabsTrigger>
            <TabsTrigger
              value="auctions"
              className="rounded-lg text-gray-500 data-[state=active]:bg-[#06038D] data-[state=active]:text-white data-[state=active]:shadow-sm font-medium transition-all"
            >
              <Gavel className="w-3.5 h-3.5 mr-1.5" />
              進行中拍賣 ({auctionCount})
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="rounded-lg text-gray-500 data-[state=active]:bg-[#06038D] data-[state=active]:text-white data-[state=active]:shadow-sm font-medium transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              買家評價 ({reviewTotal})
            </TabsTrigger>
          </TabsList>

          {/* ── Listings Tab ── */}
          <TabsContent value="listings">
            {listings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">{t("sellerPublicProfile.noListings")}</p>
                <p className="text-gray-400 text-sm mt-1">此賣家暫無在售商品</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {listings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Auctions Tab ── */}
          <TabsContent value="auctions">
            {auctionCount === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Gavel className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">暫無進行中拍賣</p>
                <p className="text-gray-400 text-sm mt-1">此賣家目前沒有競標中的商品</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {(activeAuctions ?? []).map((auction: any) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Reviews Tab ── */}
          <TabsContent value="reviews">
            {reviews.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">{t("sellerPublicProfile.noReviews")}</p>
                <p className="text-gray-400 text-sm mt-1">此賣家暫無買家評價</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#06038D] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {(r.buyerName ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-gray-800 text-sm font-semibold">{r.buyerName ?? "匿名買家"}</p>
                          <StarRating rating={r.review.rating} size="sm" />
                        </div>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {new Date(r.review.createdAt).toLocaleDateString("zh-HK")}
                      </span>
                    </div>
                    {r.review.comment && (
                      <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-3">
                        {r.review.comment}
                      </p>
                    )}
                  </div>
                ))}
                {reviewTotal > reviews.length && (
                  <p className="text-center text-gray-400 text-sm py-3">
                    顯示最新 {reviews.length} 則，共 {reviewTotal} 則評價
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
