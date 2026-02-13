import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Heart, ArrowLeft } from "lucide-react";

export default function Favorites() {
  const { data: favorites, isLoading } = trpc.favorites.list.useQuery();
  const utils = trpc.useUtils();

  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      utils.favorites.list.invalidate();
    },
  });

  const handleRemove = (cardId: number) => {
    if (confirm("確定要取消收藏此卡牌嗎？")) {
      removeMutation.mutate({ cardId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f9fa" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#06038d" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首頁
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#06038d" }}>
                我的收藏
              </h1>
              <p className="text-gray-600 mt-1">
                {favorites?.length || 0} 張卡牌
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {!favorites || favorites.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              還沒有收藏任何卡牌
            </h2>
            <p className="text-gray-500 mb-6">
              開始搜尋並收藏您喜歡的卡牌吧！
            </p>
            <Link href="/research">
              <Button style={{ backgroundColor: "#06038d", color: "white" }}>
                開始搜尋卡牌
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((fav) => (
              <Card key={fav.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {fav.card?.imageUrl && (
                  <div className="aspect-[3/4] bg-gray-100">
                    <img
                      src={fav.card.imageUrl}
                      alt={fav.card.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2" style={{ color: "#06038d" }}>
                    {fav.card?.name || "未知卡牌"}
                  </h3>
                  {fav.card?.cardNumber && (
                    <p className="text-sm text-gray-600 mb-2">
                      編號: {fav.card.cardNumber}
                    </p>
                  )}
                  {fav.card?.rarity && (
                    <p className="text-sm text-gray-600 mb-4">
                      稀有度: {fav.card.rarity}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Link href={`/card/${fav.cardId}`} className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full"
                        style={{ borderColor: "#06038d", color: "#06038d" }}
                      >
                        查看詳情
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemove(fav.cardId)}
                      disabled={removeMutation.isPending}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Heart className="h-4 w-4 fill-current" />
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
