import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

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
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            <h1 className="text-2xl font-bold">{t("favorites.title")}</h1>
            <span className="text-sm text-gray-400">
              ({favorites?.length || 0} {t("favorites.items")})
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {!favorites || favorites.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">
              {t("favorites.empty")}
            </h2>
            <p className="text-gray-500 mb-6">{t("favorites.emptyDescription")}</p>
            <Link href="/research">
              <Button variant="default">{t("favorites.startBrowsing")}</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((favorite) => (
              <Card
                key={favorite.id}
                className="bg-gray-900 border-gray-800 overflow-hidden hover:border-primary/50 transition-all group"
              >
                <Link href={`/card/${favorite.cardId}`}>
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-800">
                    {favorite.card?.imageUrl ? (
                      <img
                        src={favorite.card.imageUrl}
                        alt={favorite.card.name || "Card"}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        No Image
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link href={`/card/${favorite.cardId}`}>
                    <h3 className="font-semibold text-white mb-1 hover:text-primary transition-colors line-clamp-2">
                      {favorite.card?.name || "Unknown Card"}
                    </h3>
                  </Link>

                  {favorite.card?.nameJa && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-1">
                      {favorite.card.nameJa}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">
                      {new Date(favorite.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(favorite.cardId)}
                      disabled={removeMutation.isPending}
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
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
