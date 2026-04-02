import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Star, Package, ShoppingBag, ArrowLeft, MessageSquare, Calendar, Award, Gavel, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
        />
      ))}
    </div>
  );
}

/** Countdown timer for auction end time */
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
    <div className={`flex items-center gap-1 text-xs ${isUrgent ? "text-red-400" : "text-gray-400"}`}>
      <Clock className="w-3 h-3" />
      <span>{timeLeft || "計算中..."}</span>
    </div>
  );
}

export default function SellerPublicProfile() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const sellerId = parseInt(params.id ?? "0");

  const { data, isLoading, error } = trpc.marketplace.getSellerPublicProfile.useQuery(
    { sellerId },
    { enabled: !!sellerId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] pt-20 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">{t("sellerPublicProfile.sellerNotFound")}</p>
          <Link href="/marketplace">
            <Button className="bg-[#FEDD00] text-black hover:bg-[#FEDD00]/90">{t("sellerPublicProfile.returnToMarketplace")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { seller, listings, activeAuctions, reviews, reviewTotal } = data as any;
  const avgRating = parseFloat(seller.avgRating as string ?? "0");
  const auctionCount = (activeAuctions ?? []).length;

  return (
    <div className="min-h-screen bg-[#0a0a1a] pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" className="text-white hover:text-[#FEDD00] mb-4 p-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回商城
          </Button>
        </Link>

        {/* Seller Profile Header */}
        <Card className="bg-gradient-to-br from-[#06038d]/40 to-[#0a0a1a] border border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FEDD00] to-[#06038d] flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white">
                {seller.avatarUrl ? (
                  <img src={seller.avatarUrl} alt={seller.displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  seller.displayName.charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-white mb-1">{seller.displayName}</h1>
                {seller.bio && <p className="text-gray-400 text-sm mb-3 line-clamp-2">{seller.bio}</p>}

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <StarRating rating={avgRating} size="sm" />
                    <span className="text-yellow-400 font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-gray-400">({seller.ratingCount} 評價)</span>
                  </div>

                  {/* Total Sales */}
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{seller.totalSales} 筆成交</span>
                  </div>

                  {/* Member Since */}
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>加入於 {new Date(seller.memberSince).toLocaleDateString("zh-HK", { year: "numeric", month: "long" })}</span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-col gap-2">
                {avgRating >= 4.5 && seller.ratingCount >= 5 && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <Award className="w-3 h-3 mr-1" />
                    優質賣家
                  </Badge>
                )}
                {(seller.totalSales ?? 0) >= 10 && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <ShoppingBag className="w-3 h-3 mr-1" />
                    活躍賣家
                  </Badge>
                )}
                {auctionCount > 0 && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    <Gavel className="w-3 h-3 mr-1" />
                    拍賣中
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Listings, Auctions & Reviews */}
        <Tabs defaultValue={auctionCount > 0 && listings.length === 0 ? "auctions" : "listings"}>
          <TabsList className="bg-white/5 border border-white/10 mb-4">
            <TabsTrigger value="listings" className="text-white data-[state=active]:bg-[#06038d] data-[state=active]:text-white">
              在售商品 ({listings.length})
            </TabsTrigger>
            {auctionCount > 0 && (
              <TabsTrigger value="auctions" className="text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                <Gavel className="w-3.5 h-3.5 mr-1.5" />
                進行中拍賣 ({auctionCount})
              </TabsTrigger>
            )}
            <TabsTrigger value="reviews" className="text-white data-[state=active]:bg-[#06038d] data-[state=active]:text-white">
              買家評價 ({reviewTotal})
            </TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings">
            {listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{t("sellerPublicProfile.noListings")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {listings.map((listing: any) => (
                  <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                    <Card className="bg-white/5 border border-white/10 hover:border-[#FEDD00]/40 transition-all cursor-pointer group">
                      <CardContent className="p-0">
                        {listing.images?.[0] ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-40 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-40 bg-white/5 rounded-t-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="text-white text-sm font-medium line-clamp-2 group-hover:text-[#FEDD00] transition-colors">
                            {listing.title}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[#FEDD00] font-bold text-sm">
                              HKD {parseFloat(listing.priceHkd).toLocaleString()}
                            </span>
                            <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                              {listing.condition === "new" ? "全新" :
                               listing.condition === "like_new" ? "近全新" :
                               listing.condition === "good" ? "良好" : "一般"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Auctions Tab */}
          {auctionCount > 0 && (
            <TabsContent value="auctions">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(activeAuctions ?? []).map((auction: any) => {
                  const imgs = (() => { try { return JSON.parse(auction.images ?? "[]"); } catch { return []; } })();
                  const currentBid = auction.currentHighestBid
                    ? parseFloat(auction.currentHighestBid)
                    : parseFloat(auction.startingBid ?? "0");
                  const isCurrentBid = !!auction.currentHighestBid;
                  return (
                    <Link key={auction.id} href={`/auction/${auction.id}`}>
                      <Card className="bg-white/5 border border-white/10 hover:border-orange-400/50 transition-all cursor-pointer group">
                        <CardContent className="p-0">
                          {/* Image */}
                          {imgs[0] ? (
                            <div className="relative">
                              <img
                                src={imgs[0]}
                                alt={auction.title}
                                className="w-full h-40 object-cover rounded-t-lg"
                              />
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0.5 border-0">
                                  <Gavel className="w-2.5 h-2.5 mr-1" />競標中
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-full h-40 bg-white/5 rounded-t-lg flex items-center justify-center">
                              <Gavel className="w-8 h-8 text-orange-400" />
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0.5 border-0">
                                  <Gavel className="w-2.5 h-2.5 mr-1" />競標中
                                </Badge>
                              </div>
                            </div>
                          )}
                          <div className="p-3">
                            <p className="text-white text-sm font-medium line-clamp-2 group-hover:text-orange-400 transition-colors">
                              {auction.title}
                            </p>
                            {/* Current bid */}
                            <div className="mt-2">
                              <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                                <TrendingUp className="w-3 h-3" />
                                <span>{isCurrentBid ? "當前出價" : "起拍價"}</span>
                              </div>
                              <span className="text-orange-400 font-bold text-sm">
                                HK${currentBid.toLocaleString()}
                              </span>
                            </div>
                            {/* Bid count & countdown */}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">{auction.bidCount ?? 0} 次出價</span>
                              <AuctionCountdown endAt={auction.auctionEndAt} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </TabsContent>
          )}

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{t("sellerPublicProfile.noReviews")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <Card key={r.review.id} className="bg-white/5 border border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#06038d] flex items-center justify-center text-white text-sm font-bold">
                            {(r.buyerName ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{r.buyerName ?? "匿名買家"}</p>
                            <StarRating rating={r.review.rating} size="sm" />
                          </div>
                        </div>
                        <span className="text-gray-500 text-xs">
                          {new Date(r.review.createdAt).toLocaleDateString("zh-HK")}
                        </span>
                      </div>
                      {r.review.comment && (
                        <p className="text-gray-300 text-sm mt-2">{r.review.comment}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {reviewTotal > reviews.length && (
                  <p className="text-center text-gray-500 text-sm py-2">
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
