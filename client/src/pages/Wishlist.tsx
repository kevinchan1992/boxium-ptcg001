import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Package, ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CONDITION_SHORT, CONDITION_BADGE, type ConditionValue } from "@/lib/conditions";
import { useTranslation } from "react-i18next";


export default function Wishlist() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: me, isLoading: authLoading } = trpc.auth.me.useQuery();
  const { data: wishlistItems = [], isLoading } = trpc.marketplace.getMyWishlist.useQuery(undefined, { enabled: !!me });

  const toggleMutation = trpc.marketplace.toggleWishlist.useMutation({
    onSuccess: () => {
      toast.success(t("wishlist.removedFromWishlist"));
      utils.marketplace.getMyWishlist.invalidate();
      utils.marketplace.getWishlistIds.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-gray-400">{t("wishlist.loading")}</div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Heart className="w-16 h-16 mx-auto text-gray-200" />
          <h2 className="text-xl font-bold text-gray-800">{t("wishlist.pleaseLogin")}</h2>
          <p className="text-gray-500">{t("wishlist.loginToView")}</p>
          <Button
            className="bg-[#06038d] hover:bg-[#0a06b5] text-white"
            onClick={() => setLocation("/login")}
          >
            立即登入
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#06038d] text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4">
          <button
            onClick={() => setLocation("/marketplace")}
            className="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回商城
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 fill-red-400 text-red-400" />
            <h1 className="text-lg font-bold">{t("wishlist.myWishlist")}</h1>
          </div>
          <span className="text-sm text-white/60 ml-auto">共 {wishlistItems.length} 件商品</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                <Skeleton className="aspect-[3/4] w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <Heart className="w-20 h-20 mx-auto text-gray-200" />
            <h3 className="text-xl font-semibold text-gray-600">{t("wishlist.isEmpty")}</h3>
            <p className="text-gray-400 text-sm">{t("wishlist.emptyHint")}</p>
            <Button
              onClick={() => setLocation("/marketplace")}
              className="bg-[#06038d] hover:bg-[#0a06b5] text-white mt-2"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              前往商城
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {wishlistItems.map((item: any) => {
              const listing = item.listing;
              const images: string[] | null = (() => {
                try { return listing.images ? JSON.parse(listing.images) : null; } catch { return null; }
              })();
              const coverImage = images && images.length > 0 ? images[0] : null;
              const conditionKey = listing.condition as ConditionValue;

              return (
                <div
                  key={item.wishlistId}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#FEDD00] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                  onClick={() => setLocation(`/marketplace/${listing.id}`)}
                >
                  {/* Image */}
                  <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {/* Condition badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONDITION_BADGE[conditionKey] ?? "bg-gray-100 text-gray-600"}`}>
                        {CONDITION_SHORT[conditionKey] ?? conditionKey}
                      </span>
                    </div>
                    {/* Remove from wishlist */}
                    <button
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:scale-110 transition-transform z-10"
                      onClick={e => {
                        e.stopPropagation();
                        toggleMutation.mutate({ listingId: listing.id });
                      }}
                      aria-label={t("wishlist.remove")}
                    >
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {listing.title}
                    </p>
                    <p className="text-base font-bold text-[#0A0A2E]">
                      HK${Number(listing.priceHkd).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      收藏於 {new Date(item.createdAt).toLocaleDateString("zh-HK")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
