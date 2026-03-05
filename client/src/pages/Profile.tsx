
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Heart, History, Trash2, Package, ShoppingBag, Crown, Calendar, Mail, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";

// ─── Brand tokens ──────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FFD700";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();


  const locale = i18n.language === "ja" ? "ja-JP" : i18n.language === "en" ? "en-US" : "zh-TW";

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Blue hero skeleton */}
        <div className="h-48" style={{ background: BRAND_BLUE }} />
        <div className="max-w-5xl mx-auto px-4 -mt-16 pb-12 space-y-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-gray-200 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: BRAND_BLUE }}
            >
              <Package className="w-10 h-10" style={{ color: BRAND_YELLOW }} />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">{t("profile.pleaseLogin")}</CardTitle>
            <CardDescription className="text-gray-500">{t("profile.loginRequired")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full font-bold text-base"
              style={{ background: BRAND_BLUE, color: "white" }}
            >
              <a href="/login">{t("profile.goToLogin")}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const joinDate = new Date(user.createdAt).toLocaleDateString(locale);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero Banner ── */}
      <div
        className="relative"
        style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0a06b5 100%)` }}
      >
        {/* Decorative yellow accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: BRAND_YELLOW }} />
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-20">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            {/* Avatar */}
            <div
              className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
              style={{ background: BRAND_YELLOW, borderColor: "white" }}
            >
              <User className="w-12 h-12 md:w-14 md:h-14" style={{ color: BRAND_BLUE }} />
            </div>
            {/* Name & meta */}
            <div className="text-center md:text-left pb-1">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {user.name || t("profile.user")}
                </h1>
                {isAdmin && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                  >
                    <Crown className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-white/70 text-sm flex items-center gap-1.5 justify-center md:justify-start">
                <Calendar className="w-3.5 h-3.5" />
                {t("profile.joinedAt")}{joinDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-4 -mt-10 pb-16">
        {/* Tabs card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <BrandTabs defaultValue="info" variant="light">
            <div className="px-4 pt-4 border-b border-gray-100">
              <BrandTabsList className="border-0 bg-transparent gap-1">
                <BrandTabsTrigger value="info" icon={<User className="w-4 h-4" />}>
                  <span className="hidden sm:inline">{t("profile.tabs.info")}</span>
                  <span className="sm:hidden">{t("profile.tabs.infoShort")}</span>
                </BrandTabsTrigger>
                <BrandTabsTrigger value="watchlist" icon={<Heart className="w-4 h-4" />}>
                  <span className="hidden sm:inline">{t("profile.tabs.watchlist")}</span>
                  <span className="sm:hidden">{t("profile.tabs.watchlistShort")}</span>
                </BrandTabsTrigger>
                <BrandTabsTrigger value="history" icon={<History className="w-4 h-4" />}>
                  <span className="hidden sm:inline">{t("profile.tabs.history")}</span>
                  <span className="sm:hidden">{t("profile.tabs.historyShort")}</span>
                </BrandTabsTrigger>
              </BrandTabsList>
            </div>
            <div className="p-6">
              <BrandTabsContent value="info">
                <InfoSection user={user} locale={locale} />
              </BrandTabsContent>
              <BrandTabsContent value="watchlist">
                <WatchlistSection />
              </BrandTabsContent>
              <BrandTabsContent value="history">
                <HistorySection />
              </BrandTabsContent>
            </div>
          </BrandTabs>
        </div>
      </div>
    </div>
  );
}

// ─── Info Section ──────────────────────────────────────────────
function InfoSection({ user, locale }: { user: any; locale: string }) {
  const { t } = useTranslation();

  const fields = [
    { icon: User, label: t("profile.infoSection.username"), value: user.name || t("profile.infoSection.notSet") },
    { icon: Mail, label: t("profile.infoSection.email"), value: user.email || t("profile.infoSection.notSet") },
    { icon: Shield, label: t("profile.infoSection.role"), value: user.role === "admin" ? t("profile.infoSection.adminRole") : t("profile.infoSection.normalUser") },
    { icon: Calendar, label: t("profile.infoSection.registeredAt"), value: new Date(user.createdAt).toLocaleString(locale) },
    {
      icon: Calendar,
      label: t("profile.infoSection.lastLogin"),
      value: user.lastSignedIn
        ? new Date(user.lastSignedIn).toLocaleString(locale)
        : t("profile.infoSection.noRecord"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t("profile.infoSection.title")}</h2>
        <p className="text-sm text-gray-500">{t("profile.infoSection.description")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ icon: Icon, label, value }) => (
          <div key={label} className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
              {label}
            </Label>
            <Input
              value={value}
              disabled
              className="bg-gray-50 border-gray-200 text-gray-800 disabled:opacity-100 disabled:cursor-default"
            />
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <Button
          variant="outline"
          className="font-semibold border-2"
          style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
        >
          {t("profile.infoSection.changePassword")}
        </Button>
      </div>
    </div>
  );
}

// ─── Watchlist Section ─────────────────────────────────────────
function WatchlistSection() {
  const { t } = useTranslation();
  const { data: watchlist, isLoading, refetch } = trpc.profile.getWatchlist.useQuery();

  const removeFromWatchlist = trpc.profile.removeFromWatchlist.useMutation({
    onSuccess: () => {
      toast.success(t("profile.watchlistSection.removeSuccess"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("profile.watchlistSection.removeFailed", { error: error.message }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <div className="py-16 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${BRAND_BLUE}10` }}
        >
          <Heart className="w-8 h-8" style={{ color: BRAND_BLUE }} />
        </div>
        <p className="text-gray-500 mb-5 text-base">{t("profile.watchlistSection.empty")}</p>
        <Button
          asChild
          className="font-bold"
          style={{ background: BRAND_BLUE, color: "white" }}
        >
          <a href="/research">{t("profile.watchlistSection.goToResearch")}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{t("profile.watchlistSection.title")}</h2>
        <Badge
          className="text-xs font-semibold"
          style={{ background: `${BRAND_BLUE}15`, color: BRAND_BLUE, border: "none" }}
        >
          {watchlist.length} {t("profile.statsSection.cardsCount")}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100" style={{ background: `${BRAND_BLUE}08` }}>
              <TableHead className="font-semibold text-gray-700">{t("profile.watchlistSection.table.card")}</TableHead>
              <TableHead className="font-semibold text-gray-700">{t("profile.watchlistSection.table.series")}</TableHead>
              <TableHead className="font-semibold text-gray-700">{t("profile.watchlistSection.table.latestPrice")}</TableHead>
              <TableHead className="font-semibold text-gray-700">{t("profile.watchlistSection.table.addedAt")}</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">{t("profile.watchlistSection.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {watchlist.map((item: any) => (
              <TableRow key={item.id} className="border-gray-100 hover:bg-gray-50 transition-colors">
                <TableCell className="font-medium">
                  <a
                    href={`/card/${item.card.id}`}
                    className="font-semibold transition-colors hover:underline"
                    style={{ color: BRAND_BLUE }}
                  >
                    {item.card.name}
                  </a>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">{item.card.series || "—"}</TableCell>
                <TableCell>
                  {item.latestPrice ? (
                    <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>
                      {item.currency} {item.latestPrice.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromWatchlist.mutate({ watchlistId: item.id })}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── History Section ───────────────────────────────────────────
function HistorySection() {
  const { t } = useTranslation();
  const { data: history, isLoading, refetch } = trpc.profile.getViewHistory.useQuery({});

  const clearHistory = trpc.profile.clearViewHistory.useMutation({
    onSuccess: () => {
      toast.success(t("profile.historySection.clearSuccess"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("profile.historySection.clearFailed", { error: error.message }));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-16 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: `${BRAND_BLUE}10` }}
        >
          <History className="w-8 h-8" style={{ color: BRAND_BLUE }} />
        </div>
        <p className="text-gray-500 text-base">{t("profile.historySection.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("profile.historySection.title")}</h2>
          <p className="text-sm text-gray-500">{t("profile.historySection.count", { count: history.length })}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400 font-semibold"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {t("profile.historySection.clearHistory")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900">{t("profile.historySection.confirmClear")}</DialogTitle>
              <DialogDescription className="text-gray-500">
                {t("profile.historySection.confirmDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="border-gray-200 text-gray-700">
                {t("profile.historySection.cancel")}
              </Button>
              <Button
                onClick={() => clearHistory.mutate(undefined)}
                disabled={clearHistory.isPending}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {t("profile.historySection.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100" style={{ background: `${BRAND_BLUE}08` }}>
              <TableHead className="font-semibold text-gray-700">{t("profile.historySection.table.card")}</TableHead>
              <TableHead className="font-semibold text-gray-700">{t("profile.historySection.table.series")}</TableHead>
              <TableHead className="font-semibold text-gray-700">{t("profile.historySection.table.viewedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((item: any) => (
              <TableRow key={item.id} className="border-gray-100 hover:bg-gray-50 transition-colors">
                <TableCell className="font-medium">
                  <a
                    href={`/card/${item.card.id}`}
                    className="font-semibold transition-colors hover:underline"
                    style={{ color: BRAND_BLUE }}
                  >
                    {item.card.name}
                  </a>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">{item.card.series || "—"}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(item.viewedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
