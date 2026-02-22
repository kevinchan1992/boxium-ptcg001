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
import { User, Heart, History, TrendingUp, Edit, Trash2, X } from "lucide-react";

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
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>請先登入</CardTitle>
            <CardDescription>您需要登入才能查看個人頁面</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/login">前往登入</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] py-8">
      <div className="container max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">個人中心</h1>
          <p className="text-gray-300">管理您的卡牌收藏和瀏覽記錄</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              個人資訊
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              關注清單
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              瀏覽歷史
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              收藏統計
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
    <Card>
      <CardHeader>
        <CardTitle>個人資訊</CardTitle>
        <CardDescription>查看和編輯您的個人資料</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>用戶名稱</Label>
            <Input value={user.name || "未設置"} disabled className="mt-2" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="mt-2" />
          </div>
          <div>
            <Label>角色</Label>
            <Input
              value={user.role === "admin" ? "管理員" : "普通用戶"}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label>登入方式</Label>
            <Input
              value={user.loginMethod === "password" ? "密碼登入" : "Google OAuth"}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label>註冊時間</Label>
            <Input
              value={new Date(user.createdAt).toLocaleString("zh-TW")}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label>最後登入</Label>
            <Input
              value={
                user.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleString("zh-TW")
                  : "未記錄"
              }
              disabled
              className="mt-2"
            />
          </div>
        </div>

        {user.loginMethod === "password" && (
          <div className="pt-4 border-t">
            <Button variant="outline">修改密碼</Button>
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
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">您還沒有關注任何卡牌</p>
          <Button asChild>
            <a href="/research">前往搜尋卡牌</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的關注清單</CardTitle>
        <CardDescription>共 {watchlist.length} 張卡牌</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>卡牌</TableHead>
              <TableHead>系列</TableHead>
              <TableHead>最新價格</TableHead>
              <TableHead>備註</TableHead>
              <TableHead>添加時間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {watchlist.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.cardName || ""}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div>
                      <div className="font-medium">{item.cardName}</div>
                      <div className="text-sm text-gray-500">{item.cardNumber}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{item.series || "-"}</TableCell>
                <TableCell>
                  {item.latestPrice ? (
                    <div>
                      <div className="font-medium">
                        {item.latestPrice.currency} {parseFloat(item.latestPrice.price).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.latestPrice.source}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">暫無價格</span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate">{item.notes || "-"}</TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleDateString("zh-TW")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromWatchlist.mutate({ watchlistId: item.id })}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">暫無瀏覽記錄</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>瀏覽歷史</CardTitle>
          <CardDescription>最近瀏覽的 {history.length} 張卡牌</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("確定要清除所有瀏覽歷史嗎？")) {
              clearHistory.mutate();
            }
          }}
        >
          <X className="w-4 h-4 mr-2" />
          清除歷史
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {history.map((item: any) => (
            <a
              key={item.id}
              href={`/card/${item.cardId}`}
              className="block group"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-2">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.cardName || ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <div className="text-sm font-medium truncate">{item.cardName}</div>
              <div className="text-xs text-gray-500">
                {new Date(item.viewedAt).toLocaleDateString("zh-TW")}
              </div>
            </a>
          ))}
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
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          載入中...
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          無法載入統計數據
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              關注卡牌總數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              總市場價值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.currency} {stats.totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              平均單卡價值
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.currency}{" "}
              {stats.totalCount > 0
                ? (stats.totalValue / stats.totalCount).toLocaleString()
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Cards */}
      {stats.top5Cards && stats.top5Cards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最有價值的卡牌 Top 5</CardTitle>
            <CardDescription>按當前市場價格排序</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>卡牌</TableHead>
                  <TableHead>系列</TableHead>
                  <TableHead className="text-right">當前價格</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top5Cards.map((card: any, index: number) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-bold">#{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {card.imageUrl && (
                          <img
                            src={card.imageUrl}
                            alt={card.cardName || ""}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium">{card.cardName}</div>
                          <div className="text-sm text-gray-500">{card.cardNumber}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{card.series || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {card.latestPrice?.currency}{" "}
                      {parseFloat(card.latestPrice?.price || "0").toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
