import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Heart, History, TrendingUp, Edit, Trash2, X, Package } from "lucide-react";

export default function Profile() {
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  const [activeTab, setActiveTab] = useState("watchlist");

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] flex items-center justify-center">
        <div className="text-white text-xl">載入中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-[#ffed00] rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-[#06038d]" />
            </div>
            <CardTitle className="text-white text-2xl">請先登入</CardTitle>
            <CardDescription className="text-gray-400">您需要登入才能查看個人頁面</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-[#ffed00] hover:bg-[#ffed00]/90 text-[#06038d] font-bold">
              <a href="/login">前往登入</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] py-8 md:py-12">
      <div className="container max-w-7xl px-4">
        {/* Page Header with User Avatar */}
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
            {/* User Avatar */}
            <div className="w-24 h-24 md:w-32 md:h-32 bg-[#ffed00] rounded-full flex items-center justify-center shadow-lg">
              <User className="w-12 h-12 md:w-16 md:h-16 text-[#06038d]" />
            </div>
            
            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {user.name || "用戶"}
              </h1>
              <p className="text-[#ffed00] text-lg md:text-xl font-medium mb-2">
                {user.role === "admin" ? "🎖️ 管理員" : "📦 收藏家"}
              </p>
              <p className="text-gray-300 text-sm md:text-base">
                加入時間：{new Date(user.createdAt).toLocaleDateString("zh-TW")}
              </p>
            </div>
          </div>
          
          {/* Welcome Message */}
          <div className="bg-zinc-900/50 border border-[#ffed00]/20 rounded-lg p-4 md:p-6">
            <p className="text-white text-base md:text-lg">
              歡迎回來！在這裡管理您的卡牌收藏和瀏覽記錄 🎴
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger 
              value="info" 
              className="flex items-center gap-2 data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-sm md:text-base"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">個人資訊</span>
              <span className="sm:hidden">資訊</span>
            </TabsTrigger>
            <TabsTrigger 
              value="watchlist" 
              className="flex items-center gap-2 data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-sm md:text-base"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">關注清單</span>
              <span className="sm:hidden">關注</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex items-center gap-2 data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-sm md:text-base"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">瀏覽歷史</span>
              <span className="sm:hidden">歷史</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="flex items-center gap-2 data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-sm md:text-base"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">收藏統計</span>
              <span className="sm:hidden">統計</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="info">
            <PersonalInfoSection user={user} />
          </TabsContent>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist">
            <WatchlistSection />
          </TabsContent>

          {/* View History Tab */}
          <TabsContent value="history">
            <ViewHistorySection />
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats">
            <StatisticsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Personal Info Section Component
function PersonalInfoSection({ user }: { user: any }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-[#06038d]" />
          </div>
          個人資訊
        </CardTitle>
        <CardDescription className="text-gray-400">查看和編輯您的個人資料</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-[#ffed00] font-medium">用戶名稱</Label>
            <Input 
              value={user.name || "未設置"} 
              disabled 
              className="mt-2 bg-zinc-800 border-zinc-700 text-white" 
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">Email</Label>
            <Input 
              value={user.email} 
              disabled 
              className="mt-2 bg-zinc-800 border-zinc-700 text-white" 
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">角色</Label>
            <Input
              value={user.role === "admin" ? "🎖️ 管理員" : "📦 普通用戶"}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">登入方式</Label>
            <Input
              value={user.loginMethod === "password" ? "🔑 密碼登入" : "🔐 Google OAuth"}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">註冊時間</Label>
            <Input
              value={new Date(user.createdAt).toLocaleString("zh-TW")}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">最後登入</Label>
            <Input
              value={
                user.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleString("zh-TW")
                  : "未記錄"
              }
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        {user.loginMethod === "password" && (
          <div className="pt-4 border-t border-zinc-800">
            <Button 
              variant="outline" 
              className="border-[#ffed00] text-[#ffed00] hover:bg-[#ffed00] hover:text-[#06038d]"
            >
              修改密碼
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Watchlist Section Component
function WatchlistSection() {
  const { data: watchlist, isLoading, refetch } = trpc.profile.getWatchlist.useQuery();
  const removeFromWatchlist = trpc.profile.removeFromWatchlist.useMutation({
    onSuccess: () => {
      toast.success("已從關注清單中移除");
      refetch();
    },
    onError: (error) => {
      toast.error(`移除失敗：${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <Heart className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 mb-4 text-lg">您還沒有關注任何卡牌</p>
          <Button 
            asChild 
            className="bg-[#ffed00] hover:bg-[#ffed00]/90 text-[#06038d] font-bold"
          >
            <a href="/research">前往搜尋卡牌</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white text-2xl flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
            <Heart className="w-4 h-4 text-[#06038d]" />
          </div>
          我的關注清單
        </CardTitle>
        <CardDescription className="text-gray-400">共 {watchlist.length} 張卡牌</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-[#ffed00]">卡牌</TableHead>
                <TableHead className="text-[#ffed00]">系列</TableHead>
                <TableHead className="text-[#ffed00]">最新價格</TableHead>
                <TableHead className="text-[#ffed00]">備註</TableHead>
                <TableHead className="text-[#ffed00]">添加時間</TableHead>
                <TableHead className="text-right text-[#ffed00]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.map((item: any) => (
                <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.cardName || ""}
                          className="w-12 h-16 object-cover rounded border-2 border-[#ffed00]/20"
                        />
                      )}
                      <div>
                        <div className="font-medium text-white">{item.cardName}</div>
                        <div className="text-sm text-gray-400">{item.cardNumber}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{item.series || "-"}</TableCell>
                  <TableCell>
                    {item.latestPrice ? (
                      <div>
                        <div className="font-medium text-[#ffed00]">
                          {item.latestPrice.currency} {parseFloat(item.latestPrice.price).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.latestPrice.source}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">暫無價格</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-gray-300">{item.notes || "-"}</TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(item.createdAt).toLocaleDateString("zh-TW")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromWatchlist.mutate({ watchlistId: item.id })}
                      className="hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// View History Section Component
function ViewHistorySection() {
  const { data: history, isLoading, refetch } = trpc.profile.getViewHistory.useQuery({ limit: 50 });
  const clearHistory = trpc.profile.clearViewHistory.useMutation({
    onSuccess: () => {
      toast.success("瀏覽歷史已清除");
      refetch();
    },
    onError: (error) => {
      toast.error(`清除失敗：${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <History className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">暫無瀏覽記錄</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-white text-2xl flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
              <History className="w-4 h-4 text-[#06038d]" />
            </div>
            瀏覽歷史
          </CardTitle>
          <CardDescription className="text-gray-400">最近 {history.length} 筆記錄</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清除歷史
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">確認清除</DialogTitle>
              <DialogDescription className="text-gray-400">
                此操作將清除所有瀏覽歷史記錄，且無法復原。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {}}
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => clearHistory.mutate()}
                className="bg-red-500 hover:bg-red-600"
              >
                確認清除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-[#ffed00]">卡牌</TableHead>
                <TableHead className="text-[#ffed00]">系列</TableHead>
                <TableHead className="text-[#ffed00]">瀏覽時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item: any) => (
                <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.cardName || ""}
                          className="w-12 h-16 object-cover rounded border-2 border-[#ffed00]/20"
                        />
                      )}
                      <div>
                        <div className="font-medium text-white">{item.cardName}</div>
                        <div className="text-sm text-gray-400">{item.cardNumber}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{item.series || "-"}</TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(item.viewedAt).toLocaleString("zh-TW")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Statistics Section Component
function StatisticsSection() {
  const { data: stats, isLoading } = trpc.profile.getWatchlistStats.useQuery();

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">暫無統計數據</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-[#ffed00] to-[#ffed00]/80 border-none">
          <CardHeader>
            <CardTitle className="text-[#06038d] flex items-center gap-2">
              <Heart className="w-5 h-5" />
              關注卡牌
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#06038d]">{stats.totalCount || 0}</div>
            <p className="text-[#06038d]/70 text-sm mt-1">張卡牌</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#06038d] to-[#06038d]/80 border-[#ffed00]/20">
          <CardHeader>
            <CardTitle className="text-[#ffed00] flex items-center gap-2">
              <History className="w-5 h-5" />
              瀏覽記錄
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">-</div>
            <p className="text-gray-300 text-sm mt-1">筆記錄</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-[#ffed00] flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              活躍度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">
              {stats.totalCount > 0 ? Math.min(100, stats.totalCount * 5) : 0}%
            </div>
            <p className="text-gray-300 text-sm mt-1">收藏活躍度</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#06038d]" />
            </div>
            收藏統計
          </CardTitle>
          <CardDescription className="text-gray-400">您的卡牌收藏數據分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">關注清單總數</span>
              <span className="text-[#ffed00] font-bold text-lg">{stats.totalCount || 0} 張</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">總價值</span>
              <span className="text-[#ffed00] font-bold text-lg">{stats.currency} {stats.totalValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">最高價卡牌</span>
              <span className="text-[#ffed00] font-bold text-lg">
                {stats.top5Cards && stats.top5Cards.length > 0
                  ? stats.top5Cards[0].cardName
                  : "暫無記錄"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
