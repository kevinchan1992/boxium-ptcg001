import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Heart, TrendingUp, Bell, FileText } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: favorites } = trpc.favorites.list.useQuery();
  const { data: notifications } = trpc.notifications.unreadCount.useQuery();

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 bg-white border-gray-200 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">請先登入</h2>
          <p className="text-gray-600 mb-6">您需要登入才能查看儀表板</p>
          <Link href="/">
            <Button className="bg-[#06038d] hover:bg-[#06038d]/90 text-white">返回首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="container mx-auto px-4">
        {/* Logo 和標題區域 */}
        <div className="mb-8 flex items-center gap-4">
          <img 
            src="/boxium-logo.png" 
            alt="BOXIUM PTCG Logo" 
            className="h-16 w-auto"
          />
          <div>
            <h1 className="text-4xl font-bold text-[#06038d] mb-2">歡迎回來，{user.name}</h1>
            <p className="text-gray-600">這是您的個人儀表板</p>
          </div>
        </div>

        {/* 統計卡片區域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 我的收藏 */}
          <Card className="p-6 bg-white border-2 border-gray-200 hover:border-[#fedd00] transition-all shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Heart className="w-8 h-8 text-[#fedd00]" fill="#fedd00" />
              <span className="text-3xl font-bold text-[#06038d]">{favorites?.length || 0}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">我的收藏</h3>
            <Link href="/favorites">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors"
              >
                查看收藏
              </Button>
            </Link>
          </Card>

          {/* 未讀通知 */}
          <Card className="p-6 bg-white border-2 border-gray-200 hover:border-[#06038d] transition-all shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Bell className="w-8 h-8 text-[#06038d]" />
              <span className="text-3xl font-bold text-[#06038d]">{notifications || 0}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">未讀通知</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors"
            >
              查看通知
            </Button>
          </Card>

          {/* 市場趨勢 */}
          <Card className="p-6 bg-white border-2 border-gray-200 hover:border-[#fedd00] transition-all shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-[#fedd00]" />
              <span className="text-3xl font-bold text-[#06038d]">-</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">市場趨勢</h3>
            <Link href="/trending">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors"
              >
                查看趨勢
              </Button>
            </Link>
          </Card>

          {/* 最新消息 */}
          <Card className="p-6 bg-white border-2 border-gray-200 hover:border-[#06038d] transition-all shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-[#06038d]" />
              <span className="text-3xl font-bold text-[#06038d]">-</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">最新消息</h3>
            <Link href="/blog">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors"
              >
                查看文章
              </Button>
            </Link>
          </Card>
        </div>

        {/* 最近收藏的卡牌 */}
        <Card className="p-6 bg-white border-2 border-gray-200 shadow-md">
          <h2 className="text-2xl font-bold text-[#06038d] mb-4">最近收藏的卡牌</h2>
          {favorites && favorites.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {favorites.slice(0, 6).map((fav) => (
                <Link key={fav.id} href={`/card/${fav.cardId}`}>
                  <div className="group cursor-pointer">
                    <div className="aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden mb-2 border-2 border-gray-200 group-hover:border-[#fedd00] transition-colors">
                      {fav.card?.imageUrl && (
                        <img
                          src={fav.card.imageUrl}
                          alt={fav.card?.name || '卡牌'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                    <p className="text-sm text-gray-900 text-center truncate font-medium">{fav.card?.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">您還沒有收藏任何卡牌</p>
              <Link href="/search">
                <Button 
                  variant="outline" 
                  className="border-[#06038d] text-[#06038d] hover:bg-[#06038d] hover:text-white transition-colors"
                >
                  開始搜尋卡牌
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
