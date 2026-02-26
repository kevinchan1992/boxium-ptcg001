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
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  const [activeTab, setActiveTab] = useState("watchlist");

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] flex items-center justify-center">
        <div className="text-white text-xl">{t('profile.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-[#ffed00] rounded-full mx-auto mb-4 flex items-center justify-center">
              <Package className="w-10 h-10 text-[#06038d]" />
            </div>
            <CardTitle className="text-white text-2xl">{t('profile.pleaseLogin')}</CardTitle>
            <CardDescription className="text-gray-400">{t('profile.loginRequired')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-[#ffed00] hover:bg-[#ffed00]/90 text-[#06038d] font-bold">
              <a href="/login">{t('profile.goToLogin')}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06038d] to-[#030156] py-8 px-4">
      <div className="container max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-zinc-900/50 border border-[#ffed00]/20 rounded-lg p-6 md:p-8 mb-6 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-[#ffed00] rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-12 h-12 md:w-16 md:h-16 text-[#06038d]" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {user.name || t('profile.user')}
            </h1>
            <p className="text-[#ffed00] text-lg md:text-xl font-medium mb-2">
              {user.role === "admin" ? t('profile.admin') : t('profile.collector')}
            </p>
            <p className="text-gray-300 text-sm md:text-base">
              {t('profile.joinedAt')}{new Date(user.createdAt).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-US' : 'zh-TW')}
            </p>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-zinc-900/50 border border-[#ffed00]/20 rounded-lg p-4 md:p-6 mb-6">
          <p className="text-white text-base md:text-lg">
            {t('profile.welcome')}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-zinc-900 border border-zinc-800 p-1 h-auto">
            <TabsTrigger 
              value="info" 
              className="data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-white flex items-center justify-center gap-1.5 px-2 py-2.5 whitespace-nowrap text-sm"
            >
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">{t('profile.tabs.info')}</span>
              <span className="md:hidden text-xs">{t('profile.tabs.infoShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="watchlist" 
              className="data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-white flex items-center justify-center gap-1.5 px-2 py-2.5 whitespace-nowrap text-sm"
            >
              <Heart className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">{t('profile.tabs.watchlist')}</span>
              <span className="md:hidden text-xs">{t('profile.tabs.watchlistShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-white flex items-center justify-center gap-1.5 px-2 py-2.5 whitespace-nowrap text-sm"
            >
              <History className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">{t('profile.tabs.history')}</span>
              <span className="md:hidden text-xs">{t('profile.tabs.historyShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="data-[state=active]:bg-[#ffed00] data-[state=active]:text-[#06038d] text-white flex items-center justify-center gap-1.5 px-2 py-2.5 whitespace-nowrap text-sm"
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">{t('profile.tabs.stats')}</span>
              <span className="md:hidden text-xs">{t('profile.tabs.statsShort')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <InfoSection user={user} />
          </TabsContent>

          <TabsContent value="watchlist">
            <WatchlistSection />
          </TabsContent>

          <TabsContent value="history">
            <HistorySection />
          </TabsContent>

          <TabsContent value="stats">
            <StatisticsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoSection({ user }: { user: any }) {
  const { t, i18n } = useTranslation();
  
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-[#ffed00] flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-[#06038d]" />
          </div>
          {t('profile.infoSection.title')}
        </CardTitle>
        <CardDescription className="text-gray-400">{t('profile.infoSection.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.username')}</Label>
            <Input 
              value={user.name || t('profile.infoSection.notSet')} 
              disabled 
              className="mt-2 bg-zinc-800 border-zinc-700 text-white" 
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.email')}</Label>
            <Input
              value={user.email || t('profile.infoSection.notSet')}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.role')}</Label>
            <Input
              value={user.role === "admin" ? t('profile.infoSection.adminRole') : t('profile.infoSection.normalUser')}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.loginMethod')}</Label>
            <Input
              value={user.loginMethod === "password" ? t('profile.infoSection.passwordLogin') : t('profile.infoSection.googleOAuth')}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.registeredAt')}</Label>
            <Input
              value={new Date(user.createdAt).toLocaleString(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-US' : 'zh-TW')}
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <Label className="text-[#ffed00] font-medium">{t('profile.infoSection.lastLogin')}</Label>
            <Input
              value={
                user.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleString(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-US' : 'zh-TW')
                  : t('profile.infoSection.noRecord')
              }
              disabled
              className="mt-2 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        <div className="pt-4">
          <Button 
            variant="outline" 
            className="border-[#ffed00] text-[#ffed00] hover:bg-[#ffed00] hover:text-[#06038d]"
          >
            {t('profile.infoSection.changePassword')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WatchlistSection() {
  const { t } = useTranslation();
  const { data: watchlist, isLoading, refetch } = trpc.profile.getWatchlist.useQuery();

  const removeFromWatchlist = trpc.profile.removeFromWatchlist.useMutation({
    onSuccess: () => {
      toast.success(t('profile.watchlistSection.removeSuccess'));
      refetch();
    },
    onError: (error) => {
      toast.error(t('profile.watchlistSection.removeFailed', { error: error.message }));
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          {t('profile.loading')}
        </CardContent>
      </Card>
    );
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <Heart className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 mb-4 text-lg">{t('profile.watchlistSection.empty')}</p>
          <Button 
            asChild 
            className="bg-[#ffed00] hover:bg-[#ffed00]/90 text-[#06038d] font-bold"
          >
            <a href="/research">{t('profile.watchlistSection.goToResearch')}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-[#ffed00] flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
            <Heart className="w-4 h-4 text-[#06038d]" />
          </div>
          {t('profile.watchlistSection.title')}
        </CardTitle>
        <CardDescription className="text-gray-400">{t('profile.watchlistSection.count', { count: watchlist.length })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-[#ffed00]">{t('profile.watchlistSection.table.card')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.watchlistSection.table.series')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.watchlistSection.table.latestPrice')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.watchlistSection.table.notes')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.watchlistSection.table.addedAt')}</TableHead>
                <TableHead className="text-right text-[#ffed00]">{t('profile.watchlistSection.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.map((item: any) => (
                <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableCell className="font-medium text-white">
                    <a href={`/card/${item.card.id}`} className="hover:text-[#ffed00] transition-colors">
                      {item.card.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-gray-300">{item.card.series || "-"}</TableCell>
                  <TableCell>
                    {item.latestPrice ? (
                      <div className="flex flex-col">
                        <span className="text-[#ffed00] font-semibold">
                          {item.currency} {item.latestPrice.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-500">{t('profile.watchlistSection.table.noPrice')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-300">{item.notes || "-"}</TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromWatchlist.mutate({ watchlistId: item.id })}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="w-4 h-4" />
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

function HistorySection() {
  const { t } = useTranslation();
  const { data: history, isLoading, refetch } = trpc.profile.getViewHistory.useQuery({});

  const clearHistory = trpc.profile.clearViewHistory.useMutation({
    onSuccess: () => {
      toast.success(t('profile.historySection.clearSuccess'));
      refetch();
    },
    onError: (error) => {
      toast.error(t('profile.historySection.clearFailed', { error: error.message }));
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          {t('profile.loading')}
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <History className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">{t('profile.historySection.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-[#ffed00] flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
              <History className="w-4 h-4 text-[#06038d]" />
            </div>
            {t('profile.historySection.title')}
          </CardTitle>
          <CardDescription className="text-gray-400">{t('profile.historySection.count', { count: history.length })}</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('profile.historySection.clearHistory')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">{t('profile.historySection.confirmClear')}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('profile.historySection.confirmDescription')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                {t('profile.historySection.cancel')}
              </Button>
            <Button
              onClick={() => clearHistory.mutate(undefined)}
              disabled={clearHistory.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
                {t('profile.historySection.confirm')}
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
                <TableHead className="text-[#ffed00]">{t('profile.historySection.table.card')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.historySection.table.series')}</TableHead>
                <TableHead className="text-[#ffed00]">{t('profile.historySection.table.viewedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item: any) => (
                <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableCell className="font-medium text-white">
                    <a href={`/card/${item.card.id}`} className="hover:text-[#ffed00] transition-colors">
                      {item.card.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-gray-300">{item.card.series || "-"}</TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(item.viewedAt).toLocaleString()}
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

function StatisticsSection() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = trpc.profile.getWatchlistStats.useQuery();

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center text-gray-400">
          {t('profile.loading')}
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-16 h-16 text-[#ffed00]/30 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">{t('profile.statsSection.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#ffed00]/10 to-[#ffed00]/5 border-[#ffed00]/20">
          <CardHeader>
            <CardTitle className="text-[#06038d] flex items-center gap-2">
              <Heart className="w-5 h-5" />
              {t('profile.statsSection.watchlistCards')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#06038d]">{stats.totalCount || 0}</div>
            <p className="text-[#06038d]/70 text-sm mt-1">{t('profile.statsSection.cardsCount')}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-[#ffed00] flex items-center gap-2">
              <History className="w-5 h-5" />
              {t('profile.statsSection.viewHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">-</div>
            <p className="text-gray-300 text-sm mt-1">{t('profile.statsSection.recordsCount')}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-[#ffed00] flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t('profile.statsSection.activity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">
              {stats.totalCount > 0 ? Math.min(100, stats.totalCount * 5) : 0}%
            </div>
            <p className="text-gray-300 text-sm mt-1">{t('profile.statsSection.activityLevel')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-[#ffed00] flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ffed00] rounded-full flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#06038d]" />
            </div>
            {t('profile.statsSection.title')}
          </CardTitle>
          <CardDescription className="text-gray-400">{t('profile.statsSection.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">{t('profile.statsSection.totalCount')}</span>
              <span className="text-[#ffed00] font-bold text-lg">{stats.totalCount || 0} {t('profile.statsSection.cardsCount')}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">{t('profile.statsSection.totalValue')}</span>
              <span className="text-[#ffed00] font-bold text-lg">{stats.currency} {stats.totalValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
              <span className="text-gray-300">{t('profile.statsSection.highestCard')}</span>
              <span className="text-[#ffed00] font-bold text-lg">
                {stats.top5Cards && stats.top5Cards.length > 0
                  ? stats.top5Cards[0].card.name
                  : t('profile.statsSection.noRecord')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
