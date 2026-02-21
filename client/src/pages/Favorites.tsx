import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { LazyImage } from "@/components/LazyImage";

export default function Favorites() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Fetch user's favorites
  const { data: favorites, isLoading } = trpc.favorites.list.useQuery();

  // Remove from favorites mutation
  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      toast.success(t("favorites.removed"));
      utils.favorites.list.invalidate();
    },
    onError: (error) => {
      toast.error(t("favorites.removeError") + ": " + error.message);
    },
  });

  const handleRemove = (cardId: number) => {
    if (confirm(t("favorites.confirmRemove"))) {
      removeMutation.mutate({ cardId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header - 手機版優化 */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center gap-2 md:gap-3">
            <Heart className="h-5 w-5 md:h-6 md:w-6 text-red-500 fill-red-500" />
            <h1 className="text-xl md:text-2xl font-bold">{t("favorites.title")}</h1>
            <span className="text-xs md:text-sm text-gray-400">
              ({favorites?.length || 0} {t("favorites.items")})
            </span>
          </div>
        </div>
      </div>

      {/* Content - 手機版優化網格佈局 */}
      <div className="container mx-auto px-4 py-6 md:py-8">
        {!favorites || favorites.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <Heart className="h-12 w-12 md:h-16 md:w-16 mx-auto text-gray-600 mb-4" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-400 mb-2">
              {t("favorites.empty")}
            </h2>
            <p className="text-sm md:text-base text-gray-500 mb-6">{t("favorites.emptyDescription")}</p>
            <Link href="/research">
              {/* 觸控優化：確保按鈕至少 44x44px */}
              <Button variant="default" className="min-h-[44px] px-6">{t("favorites.startBrowsing")}</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {favorites.map((favorite) => (
              <Card
                key={favorite.id}
                className="bg-gray-900 border-gray-800 overflow-hidden hover:border-primary/50 transition-all group"
              >
                <Link href={`/card/${favorite.cardId}`}>
                  {/* 觸控優化：增加可點擊區域 */}
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-800 min-h-[120px]">
                    {favorite.card?.imageUrl ? (
                      <LazyImage
                        src={favorite.card.imageUrl}
                        alt={favorite.card.name || "Card"}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs md:text-sm">
                        No Image
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-2 md:p-4">
                  <Link href={`/card/${favorite.cardId}`}>
                    <h3 className="font-semibold text-white text-xs md:text-sm mb-1 hover:text-primary transition-colors line-clamp-2 min-h-[32px]">
                      {favorite.card?.name || "Unknown Card"}
                    </h3>
                  </Link>

                  {favorite.card?.nameJa && (
                    <p className="text-[10px] md:text-sm text-gray-400 mb-2 line-clamp-1">
                      {favorite.card.nameJa}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2 md:mt-4">
                    <span className="text-[9px] md:text-xs text-gray-500">
                      {new Date(favorite.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    </span>
                    {/* 觸控優化：增加按鈕觸控區域 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(favorite.cardId)}
                      disabled={removeMutation.isPending}
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px] p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
