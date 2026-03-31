
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import {
  User, Heart, Trash2, Package, ShoppingBag, Crown, Calendar, Mail,
  Shield, MapPin, Plus, Edit2, Star, Check, Phone, Save, X, Lock,
  Search, Tag, CreditCard, Loader2, CheckCircle, Truck, Clock,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Flag, MessageSquare,
  ChevronRight, Bell, CheckCheck, DollarSign, Info, AlertTriangle, Filter
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { searchSFPointsAsync, validateSFCode, findSFPointByCodeAsync, type SFPoint } from "@/lib/sfStations";
import { useTranslation } from "react-i18next";

// ─── Brand tokens ──────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";

// ─── Order status helpers (mirrored from Orders.tsx) ──────────
const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="w-3.5 h-3.5" /> },
  paid_held: { label: "已付款，等待出貨", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-3.5 h-3.5" /> },
  payment_received: { label: "已收款", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CreditCard className="w-3.5 h-3.5" /> },
  processing: { label: "已付款，等待出貨", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-3.5 h-3.5" /> },
  shipped: { label: "已出貨", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="w-3.5 h-3.5" /> },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800 border-teal-200", icon: <Truck className="w-3.5 h-3.5" /> },
  completed: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="w-3.5 h-3.5" /> },
  disputed: { label: "爭議中", color: "bg-red-100 text-red-800 border-red-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS_LABEL[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Nav items definition ──────────────────────────────────────
type NavItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
};

// ─── Main Profile Component ────────────────────────────────────
export default function Profile() {
  const { t, i18n } = useTranslation();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  const { data: orders } = trpc.marketplace.getMyOrders.useQuery();
  const [location] = useLocation();
  // 讀取 URL ?tab= 參數以支援從 /orders 重定向過來
  const urlTab = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tab") ?? "info"
    : "info";
  const [activeSection, setActiveSection] = useState(urlTab);

  // 當 URL ?tab 參數變化時同步更新 activeSection
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") ?? "info";
    setActiveSection(tab);
  }, [location]);

  // 監聽瀏覽器返回鍵（popstate），同步標籤狀態
  useEffect(() => {
    const handlePopState = () => {
      const tab = new URLSearchParams(window.location.search).get("tab") ?? "info";
      setActiveSection(tab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const locale = i18n.language === "ja" ? "ja-JP" : i18n.language === "en" ? "en-US" : "zh-TW";

  const activeOrdersCount = (orders ?? []).filter(o => !["completed", "cancelled"].includes((o as any).orderStatus)).length;

  // 未讀通知數量
  const { data: unreadCountData } = trpc.notifications.getUnreadCount.useQuery(undefined, { enabled: !!user });
  const unreadNotifCount = (unreadCountData as any)?.count ?? 0;

  // 活躍競拍數量
  const { data: myBidsData } = trpc.auction.myBids.useQuery(undefined, { enabled: !!user });
  const activeBidsCount = (myBidsData ?? []).filter((b: any) => b.status === 'active' || b.status === 'winning').length;

  const navItems: NavItem[] = [
    { id: "info", icon: <User className="w-4 h-4" />, label: t("profile.tabs.info") },
    { id: "watchlist", icon: <Heart className="w-4 h-4" />, label: t("profile.tabs.watchlist") },
    { id: "addresses", icon: <MapPin className="w-4 h-4" />, label: "收貨地址" },
    { id: "orders", icon: <ShoppingBag className="w-4 h-4" />, label: "我的訂單", badge: activeOrdersCount > 0 ? activeOrdersCount : undefined },
    { id: "offers", icon: <Tag className="w-4 h-4" />, label: "我的出價" },
    { id: "auctions", icon: <DollarSign className="w-4 h-4" />, label: "我的競拍", badge: activeBidsCount > 0 ? activeBidsCount : undefined },
    { id: "notifications", icon: <Bell className="w-4 h-4" />, label: "通知中心", badge: unreadNotifCount > 0 ? unreadNotifCount : undefined },
  ];

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-48" style={{ background: BRAND_BLUE }} />
        <div className="max-w-6xl mx-auto px-4 -mt-16 pb-12 space-y-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-0" style={{ background: BRAND_BLUE }}>
          <CardHeader className="text-center pb-4">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${BRAND_YELLOW}20`, border: `2px solid ${BRAND_YELLOW}` }}>
              <Package className="w-10 h-10" style={{ color: BRAND_YELLOW }} />
            </div>
            <CardTitle className="text-2xl font-bold text-white">{t("profile.pleaseLogin")}</CardTitle>
            <CardDescription className="text-white/70">{t("profile.loginRequired")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full font-bold text-base" style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Hero Banner (Mobile-first compact design) ── */}
      <div className="relative" style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #0a06b5 100%)` }}>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: BRAND_YELLOW }} />
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-5">
          {/* Mobile: compact horizontal layout */}
          <div className="flex items-center gap-4 md:hidden">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-lg flex-shrink-0"
              style={{ background: BRAND_YELLOW, borderColor: "rgba(255,255,255,0.6)" }}
            >
              <User className="w-7 h-7" style={{ color: BRAND_BLUE }} />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white truncate">{user.name || t("profile.user")}</h1>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                    <Crown className="w-2.5 h-2.5" />Admin
                  </span>
                )}
              </div>
              <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {t("profile.joinedAt")}{joinDate}
              </p>
            </div>
          </div>
          {/* Desktop: original layout */}
          <div className="hidden md:block">
            <div className="mb-5">
              <Link href="/">
                <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
              </Link>
            </div>
            <div className="flex flex-row items-end gap-6">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
                style={{ background: BRAND_YELLOW, borderColor: "white" }}
              >
                <User className="w-14 h-14" style={{ color: BRAND_BLUE }} />
              </div>
              <div className="text-left pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold text-white">{user.name || t("profile.user")}</h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                      <Crown className="w-3 h-3" />Admin
                    </span>
                  )}
                </div>
                <p className="text-white/70 text-sm flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {t("profile.joinedAt")}{joinDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="max-w-6xl mx-auto px-3 py-3 pb-20 md:pb-16 md:px-4 md:py-6">
        {/* Mobile: compact icon tabs */}
        <div className="md:hidden mb-3">
          <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {navItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  const url = item.id === 'info' ? '/profile' : `/profile?tab=${item.id}`;
                  window.history.pushState({ tab: item.id }, '', url);
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 relative transition-all ${
                  idx !== 0 ? "border-l border-gray-100" : ""
                } ${
                  activeSection === item.id ? "" : "hover:bg-gray-50"
                }`}
                style={activeSection === item.id ? { background: `${BRAND_BLUE}0d` } : {}}
              >
                {/* Active indicator */}
                {activeSection === item.id && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full" style={{ background: BRAND_BLUE }} />
                )}
                {/* Icon with badge */}
                <div className="relative">
                  <span style={{ color: activeSection === item.id ? BRAND_BLUE : "#9ca3af" }}>
                    {item.icon}
                  </span>
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 text-[9px] font-bold rounded-full flex items-center justify-center" style={{ background: "#ef4444", color: "white" }}>
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                {/* Label */}
                <span className={`text-[10px] mt-0.5 font-medium leading-tight text-center ${
                  activeSection === item.id ? "" : "text-gray-400"
                }`} style={activeSection === item.id ? { color: BRAND_BLUE } : {}}>
                  {item.label.length > 4 ? item.label.slice(0, 4) : item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          {/* ── Left sidebar nav (desktop) ── */}
          <aside className="hidden md:flex flex-col w-52 flex-shrink-0">
            <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-4">
              {navItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    const url = item.id === 'info' ? '/profile' : `/profile?tab=${item.id}`;
                    window.history.pushState({ tab: item.id }, '', url);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all text-left group relative ${
                    idx !== 0 ? "border-t border-gray-50" : ""
                  } ${
                    activeSection === item.id
                      ? "text-white"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  style={activeSection === item.id ? { background: BRAND_BLUE } : {}}
                >
                  {/* Active indicator bar */}
                  {activeSection === item.id && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full" style={{ background: BRAND_YELLOW }} />
                  )}
                  <span className={activeSection === item.id ? "text-white" : "text-gray-400 group-hover:text-gray-600"}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                      {item.badge}
                    </span>
                  )}
                  {activeSection !== item.id && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Right content area ── */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Section header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: `${BRAND_BLUE}06` }}>
                <span style={{ color: BRAND_BLUE }}>
                  {navItems.find(n => n.id === activeSection)?.icon}
                </span>
                <h2 className="font-bold text-gray-900">
                  {navItems.find(n => n.id === activeSection)?.label}
                </h2>
              </div>
              <div className="p-6">
                {activeSection === "info" && <InfoSection user={user} locale={locale} />}
                {activeSection === "watchlist" && <WatchlistSection />}
                {activeSection === "addresses" && <ShippingAddressSection />}
                {activeSection === "orders" && <EmbeddedOrdersSection />}
                {activeSection === "offers" && <EmbeddedOffersSection userId={user.id} />}
                {activeSection === "auctions" && <MyAuctionsSection bids={myBidsData ?? []} />}
                {activeSection === "notifications" && <EmbeddedNotificationsSection />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password Dialog ────────────────────────────────────
function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("密碼已成功修改");
      setOpen(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: (err) => toast.error(`修改失敗：${err.message}`),
  });

  const handleSubmit = () => {
    if (!currentPw || !newPw || !confirmPw) { toast.error("請填寫所有欄位"); return; }
    if (newPw.length < 8) { toast.error("新密碼至少需要 8 個字元"); return; }
    if (newPw !== confirmPw) { toast.error("新密碼與確認密碼不一致"); return; }
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="font-semibold border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
          style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
        >
          <Lock className="w-4 h-4 mr-1.5" /> 修改密碼
        </Button>
      </DialogTrigger>
      <DialogContent style={{ background: "#ffffff", color: "#111827" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#111827" }}>修改密碼</DialogTitle>
          <DialogDescription style={{ color: "#6b7280" }}>請輸入現有密碼及新密碼以完成修改</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label style={{ color: "#374151" }}>現有密碼</Label>
            <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="請輸入現有密碼" style={{ background: "#f9fafb", color: "#111827", borderColor: "#d1d5db" }} />
          </div>
          <div className="space-y-1.5">
            <Label style={{ color: "#374151" }}>新密碼</Label>
            <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="至少 8 個字元" style={{ background: "#f9fafb", color: "#111827", borderColor: "#d1d5db" }} />
          </div>
          <div className="space-y-1.5">
            <Label style={{ color: "#374151" }}>確認新密碼</Label>
            <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="再次輸入新密碼" style={{ background: "#f9fafb", color: "#111827", borderColor: "#d1d5db" }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} style={{ borderColor: "#d1d5db", color: "#374151", background: "#ffffff" }}>取消</Button>
          <Button onClick={handleSubmit} disabled={changePassword.isPending} style={{ background: BRAND_BLUE, color: "white" }}>
            {changePassword.isPending ? "修改中..." : "確認修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Info Section ──────────────────────────────────────────────
function InfoSection({ user, locale }: { user: any; locale: string }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("個人資料已更新");
      setIsEditing(false);
      utils.auth.me.invalidate();
    },
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });
  const readonlyFields = [
    { icon: Mail, label: t("profile.infoSection.email"), value: user.email || t("profile.infoSection.notSet") },
    { icon: Shield, label: t("profile.infoSection.role"), value: user.role === "admin" ? t("profile.infoSection.adminRole") : t("profile.infoSection.normalUser") },
    { icon: Calendar, label: t("profile.infoSection.registeredAt"), value: new Date(user.createdAt).toLocaleString(locale) },
    {
      icon: Calendar,
      label: t("profile.infoSection.lastLogin"),
      value: user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString(locale) : t("profile.infoSection.noRecord"),
    },
  ];
  return (
    <div className="space-y-4">
      {/* ── Editable Profile Block (iOS-style list rows) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND_BLUE}15` }}>
              <User className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
            </div>
            <span className="text-sm font-bold text-gray-900">個人資料</span>
          </div>
          {!isEditing ? (
            <button
              onClick={() => { setEditName(user.name || ""); setEditPhone(user.phone || ""); setIsEditing(true); }}
              className="flex items-center gap-1 text-sm font-semibold transition-colors"
              style={{ color: BRAND_BLUE }}
            >
              <Edit2 className="w-3.5 h-3.5" />編輯
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => updateProfile.mutate({ name: editName || undefined, phone: editPhone || null })}
                disabled={updateProfile.isPending}
                className="flex items-center gap-1 text-sm font-semibold"
                style={{ color: BRAND_BLUE }}
              >
                <Save className="w-3.5 h-3.5" />{updateProfile.isPending ? "儲存中..." : "儲存"}
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setIsEditing(false)} className="text-sm font-medium text-gray-500">取消</button>
            </div>
          )}
        </div>
        {/* Username row */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2 w-24 flex-shrink-0">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-500">{t("profile.infoSection.username")}</span>
          </div>
          {isEditing ? (
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="輸入姓名"
              className="flex-1 border-0 border-b border-gray-200 rounded-none px-0 h-7 text-sm focus-visible:ring-0 bg-transparent text-gray-900"
            />
          ) : (
            <span className="flex-1 text-sm text-right text-gray-700 truncate">
              {user.name || <span className="text-gray-400 text-xs">{t("profile.infoSection.notSet")}</span>}
            </span>
          )}
        </div>
        {/* Phone row */}
        <div className="flex items-center px-4 py-3.5">
          <div className="flex items-center gap-2 w-24 flex-shrink-0">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-500">電話</span>
          </div>
          {isEditing ? (
            <Input
              value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              placeholder="+852 XXXX XXXX"
              className="flex-1 border-0 border-b border-gray-200 rounded-none px-0 h-7 text-sm focus-visible:ring-0 bg-transparent text-gray-900"
            />
          ) : (
            <span className="flex-1 text-sm text-right text-gray-700">
              {user.phone || <span className="text-gray-400 text-xs">未設定</span>}
            </span>
          )}
        </div>
      </div>

      {/* ── Read-only Account Info (iOS-style) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND_BLUE}15` }}>
            <Shield className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
          </div>
          <span className="text-sm font-bold text-gray-900">帳戶資訊</span>
        </div>
        {readonlyFields.map(({ icon: Icon, label, value }, idx) => (
          <div key={label} className={`flex items-center px-4 py-3.5 ${idx < readonlyFields.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div className="flex items-center gap-2 w-28 flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm text-gray-500 truncate">{label}</span>
            </div>
            <span className="flex-1 text-sm text-right text-gray-600 truncate pl-2">{value}</span>
          </div>
        ))}
      </div>

      {/* ── Security ── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND_BLUE}15` }}>
            <Lock className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
          </div>
          <span className="text-sm font-bold text-gray-900">安全設定</span>
        </div>
        <div className="px-4 py-3">
          <ChangePasswordDialog />
        </div>
      </div>
    </div>
  );
}

// ─── Watchlist Section ─────────────────────────────────────────
function WatchlistSection() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"cards" | "listings">("cards");

  // Card watchlist
  const { data: watchlist, isLoading: watchlistLoading, refetch: refetchWatchlist } = trpc.profile.getWatchlist.useQuery();
  const removeFromWatchlist = trpc.profile.removeFromWatchlist.useMutation({
    onSuccess: () => { toast.success(t("profile.watchlistSection.removeSuccess")); refetchWatchlist(); },
    onError: (error) => { toast.error(t("profile.watchlistSection.removeFailed", { error: error.message })); },
  });

  // Listing wishlist
  const utils = trpc.useUtils();
  const { data: wishlist, isLoading: wishlistLoading } = trpc.marketplace.getMyWishlist.useQuery();
  const toggleWishlist = trpc.marketplace.toggleWishlist.useMutation({
    onSuccess: (res) => {
      utils.marketplace.getMyWishlist.invalidate();
      utils.marketplace.getWishlistIds.invalidate();
      toast.success(res.wishlisted ? "已加入收藏" : "已移除收藏");
    },
  });
  const addToCart = trpc.marketplace.addToCart.useMutation({
    onSuccess: () => { utils.marketplace.getCartCount.invalidate(); toast.success("已加入購物車"); },
    onError: (err) => toast.error(err.message || "加入失敗"),
  });

  // Sort state for listings
  const [sortBy, setSortBy] = useState<"time_desc" | "time_asc" | "price_asc" | "price_desc">("time_desc");
  // Sort state for card watchlist
  const [cardSortBy, setCardSortBy] = useState<"time_desc" | "time_asc" | "price_asc" | "price_desc">("time_desc");

  const isLoading = watchlistLoading || wishlistLoading;
  const cardCount = watchlist?.length ?? 0;
  const listingCount = wishlist?.length ?? 0;

  // Sorted card watchlist
  const sortedWatchlist = watchlist ? [...(watchlist as any[])].sort((a, b) => {
    if (cardSortBy === "time_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (cardSortBy === "time_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (cardSortBy === "price_asc") return (a.latestPrice ?? 0) - (b.latestPrice ?? 0);
    if (cardSortBy === "price_desc") return (b.latestPrice ?? 0) - (a.latestPrice ?? 0);
    return 0;
  }) : [];

  // Sorted wishlist
  const sortedWishlist = wishlist ? [...(wishlist as any[])].sort((a, b) => {
    if (sortBy === "time_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "time_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === "price_asc") return Number(a.listing.priceHkd) - Number(b.listing.priceHkd);
    if (sortBy === "price_desc") return Number(b.listing.priceHkd) - Number(a.listing.priceHkd);
    return 0;
  }) : [];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: `${BRAND_BLUE}08` }}>
        <button
          onClick={() => setActiveTab("cards")}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
          style={activeTab === "cards" ? { background: BRAND_BLUE, color: "white" } : { color: BRAND_BLUE }}
        >
          <Heart className="w-4 h-4" />
          卡牧追蹤
          {cardCount > 0 && (
            <span className="text-xs rounded-full px-1.5 py-0.5" style={activeTab === "cards" ? { background: "rgba(255,255,255,0.25)" } : { background: `${BRAND_BLUE}20` }}>
              {cardCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("listings")}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
          style={activeTab === "listings" ? { background: BRAND_BLUE, color: "white" } : { color: BRAND_BLUE }}
        >
          <ShoppingBag className="w-4 h-4" />
          收藏商品
          {listingCount > 0 && (
            <span className="text-xs rounded-full px-1.5 py-0.5" style={activeTab === "listings" ? { background: "rgba(255,255,255,0.25)" } : { background: `${BRAND_BLUE}20` }}>
              {listingCount}
            </span>
          )}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      )}

      {/* Card watchlist tab */}
      {!isLoading && activeTab === "cards" && (
        cardCount === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${BRAND_BLUE}10` }}>
              <Heart className="w-8 h-8" style={{ color: BRAND_BLUE }} />
            </div>
            <p className="text-gray-500 mb-5 text-base">{t("profile.watchlistSection.empty")}</p>
            <Button asChild className="font-bold" style={{ background: BRAND_BLUE, color: "white" }}>
              <a href="/research">{t("profile.watchlistSection.goToResearch")}</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Card sort controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">排序：</span>
              <div className="flex gap-1 flex-wrap">
                {([
                  { value: "time_desc" as const, label: "最新追蹤" },
                  { value: "time_asc" as const, label: "最早追蹤" },
                  { value: "price_asc" as const, label: "價格↑" },
                  { value: "price_desc" as const, label: "價格↓" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCardSortBy(opt.value)}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all"
                    style={cardSortBy === opt.value
                      ? { background: BRAND_BLUE, color: "white" }
                      : { background: `${BRAND_BLUE}10`, color: BRAND_BLUE }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
                {sortedWatchlist.map((item: any) => (
                  <TableRow key={item.id} className="border-gray-100 hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium">
                      <a href={`/card/${item.card.id}`} className="font-semibold transition-colors hover:underline" style={{ color: BRAND_BLUE }}>
                        {item.card.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{item.card.series || "—"}</TableCell>
                    <TableCell>
                      {item.latestPrice ? (
                        <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>{item.currency} {item.latestPrice.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeFromWatchlist.mutate({ watchlistId: item.id })} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )
      )}

      {/* Listing wishlist tab */}
      {!isLoading && activeTab === "listings" && (
        listingCount === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${BRAND_BLUE}10` }}>
              <ShoppingBag className="w-8 h-8" style={{ color: BRAND_BLUE }} />
            </div>
            <p className="text-gray-500 mb-5 text-base">尚未收藏任何商品</p>
            <Button asChild className="font-bold" style={{ background: BRAND_BLUE, color: "white" }}>
              <a href="/marketplace">前往市集瀏覽</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sort controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">排序：</span>
              <div className="flex gap-1 flex-wrap">
                {([
                  { value: "time_desc" as const, label: "最新收藏" },
                  { value: "time_asc" as const, label: "最早收藏" },
                  { value: "price_asc" as const, label: "價格↑" },
                  { value: "price_desc" as const, label: "價格↓" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all"
                    style={sortBy === opt.value
                      ? { background: BRAND_BLUE, color: "white" }
                      : { background: `${BRAND_BLUE}10`, color: BRAND_BLUE }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {sortedWishlist.map((item: any) => {
              const listing = item.listing;
              const imgs: string[] | null = (() => { try { return listing.images ? JSON.parse(listing.images) : null; } catch { return null; } })();
              const imgUrl = imgs && imgs.length > 0 ? imgs[0] : null;
              const isActive = listing.status === "active";
              const isSold = listing.status === "sold";
              const isRemoved = listing.status === "removed" || listing.status === "draft";
              return (
                <div key={item.wishlistId} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {imgUrl ? (
                      <img src={imgUrl} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isActive && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">在售</span>}
                      {isSold && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">已售出</span>}
                      {isRemoved && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-500">已下架</span>}
                    </div>
                    <a href={`/marketplace/${listing.id}`} className="font-semibold text-sm line-clamp-1 hover:underline" style={{ color: BRAND_BLUE }}>
                      {listing.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-sm" style={{ color: BRAND_BLUE }}>HKD {Number(listing.priceHkd).toLocaleString()}</span>
                      <span className="text-xs text-gray-400">收藏於 {new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {isActive && (
                      <Button
                        size="sm"
                        className="text-xs h-8 px-2.5 font-bold"
                        style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                        disabled={addToCart.isPending}
                        onClick={() => addToCart.mutate({ listingId: listing.id })}
                      >
                        <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                        加入購物車
                      </Button>
                    )}
                    {(isSold || isRemoved) && listing.cardId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2.5"
                        style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
                        onClick={() => window.location.href = `/marketplace?cardId=${listing.cardId}`}
                      >
                        <Search className="w-3.5 h-3.5 mr-1" />
                        尋找同款
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 px-2.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => toggleWishlist.mutate({ listingId: listing.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Shipping Address Section ────────────────────────────────
function ShippingAddressSection() {
  const utils = trpc.useUtils();
  const { data: addresses, isLoading } = trpc.marketplace.getMyShippingAddresses.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Cache for SF station/locker full addresses (code -> address string)
  const [sfAddressCache, setSfAddressCache] = useState<Record<string, string>>({});
  const fetchedCodesRef = useRef<Set<string>>(new Set());

  // Preload SF addresses for all saved sf_station type addresses
  useEffect(() => {
    if (!addresses) return;
    const sfAddrs = (addresses as any[]).filter(a => a.addressType === 'sf_station' && a.sfStationCode);
    sfAddrs.forEach(async (addr) => {
      const code = addr.sfStationCode as string;
      if (fetchedCodesRef.current.has(code)) return;
      fetchedCodesRef.current.add(code);
      const point = await findSFPointByCodeAsync(code);
      if (point) {
        setSfAddressCache(prev => ({ ...prev, [code]: point.address }));
      }
    });
  }, [addresses]);
  const [form, setForm] = useState({ label: "預設地址", addressType: "normal" as "normal" | "sf_station", recipientName: "", phone: "", address: "", district: "", region: "香港", sfStationCode: "", sfStationName: "", sfStationAddress: "", isDefault: false });
  const [sfSearchQuery, setSfSearchQuery] = useState("");
  const [sfSearchRegion, setSfSearchRegion] = useState("");
  const [sfPointType, setSfPointType] = useState<'all' | 'station' | 'locker'>('all');
  const [showSfDropdown, setShowSfDropdown] = useState(false);
  const [sfResults, setSfResults] = useState<SFPoint[]>([]);
  useEffect(() => {
    if (form.addressType !== 'sf_station') return;
    searchSFPointsAsync(sfSearchQuery, sfSearchRegion || undefined, sfPointType === 'all' ? 'all' : sfPointType).then(setSfResults);
  }, [sfSearchQuery, sfSearchRegion, sfPointType, form.addressType]);
  const addMutation = trpc.marketplace.addShippingAddress.useMutation({
    onSuccess: () => { utils.marketplace.getMyShippingAddresses.invalidate(); setShowForm(false); resetForm(); toast.success("地址已新增"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.marketplace.updateShippingAddress.useMutation({
    onSuccess: () => { utils.marketplace.getMyShippingAddresses.invalidate(); setShowForm(false); setEditingId(null); resetForm(); toast.success("地址已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.marketplace.deleteShippingAddress.useMutation({
    onSuccess: () => { utils.marketplace.getMyShippingAddresses.invalidate(); toast.success("地址已刪除"); },
    onError: (e) => toast.error(e.message),
  });
  const setDefaultMutation = trpc.marketplace.setDefaultShippingAddress.useMutation({
    onSuccess: () => { utils.marketplace.getMyShippingAddresses.invalidate(); toast.success("預設地址已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const resetForm = () => { setForm({ label: "預設地址", addressType: "normal", recipientName: "", phone: "", address: "", district: "", region: "香港", sfStationCode: "", sfStationName: "", sfStationAddress: "", isDefault: false }); setSfSearchQuery(""); setSfSearchRegion(""); setSfPointType('all'); setShowSfDropdown(false); setSfResults([]); };
  const handleEdit = (addr: any) => {
    setEditingId(addr.id);
    setForm({ label: addr.label, addressType: addr.addressType || "normal", recipientName: addr.recipientName, phone: addr.phone, address: addr.address || "", district: addr.district || "", region: addr.region || "香港", sfStationCode: addr.sfStationCode || "", sfStationName: addr.sfStationName || "", sfStationAddress: "", isDefault: addr.isDefault });
    setShowForm(true);
  };
  const handleSubmit = () => {
    if (!form.recipientName.trim()) { toast.error("請輸入收件人姓名"); return; }
    if (!form.phone.trim()) { toast.error("請輸入聯繫電話"); return; }
    if (form.addressType === "sf_station") {
      if (!form.sfStationCode.trim()) { toast.error("請選擇順豐自提站"); return; }
      const sfValidation = validateSFCode(form.sfStationCode);
      if (!sfValidation.valid) { toast.error(sfValidation.message || "順豐站點編號格式不正確"); return; }
    } else {
      if (!form.address.trim()) { toast.error("請輸入地址"); return; }
    }
    const payload = { label: form.label, addressType: form.addressType, recipientName: form.recipientName, phone: form.phone, address: form.addressType === "normal" ? form.address : "", district: form.district, region: form.region, sfStationCode: form.addressType === "sf_station" ? form.sfStationCode : undefined, sfStationName: form.addressType === "sf_station" ? form.sfStationName : undefined, isDefault: form.isDefault };
    if (editingId) { updateMutation.mutate({ id: editingId, ...payload }); }
    else { addMutation.mutate(payload); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">管理您的收貨地址，付款時可快速帶入</p>
        {!showForm && (
          <Button size="sm" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="gap-1.5 font-semibold" style={{ background: BRAND_BLUE, color: "white" }}>
            <Plus className="w-3.5 h-3.5" /> 新增地址
          </Button>
        )}
      </div>
      {showForm && (
        <Card className="border-2 shadow-sm bg-white text-gray-900" style={{ borderColor: `${BRAND_BLUE}30` }}>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">地址標籤</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="如：家、公司" className="text-sm bg-white text-gray-900 border-gray-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">地址類型</Label>
                <div className="flex gap-2">
                  {(["normal", "sf_station"] as const).map(type => (
                    <button key={type} onClick={() => setForm(f => ({ ...f, addressType: type }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-all ${form.addressType === type ? "text-white border-transparent" : "border-gray-300 text-gray-700 bg-gray-50 hover:border-gray-400"}`}
                      style={form.addressType === type ? { background: BRAND_BLUE } : {}}>
                      {type === "normal" ? "普通地址" : "順豐自提"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">收件人姓名</Label>
                <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="收件人全名" className="text-sm bg-white text-gray-900 border-gray-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">聯繫電話</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+852 XXXX XXXX" className="text-sm bg-white text-gray-900 border-gray-300" />
              </div>
            </div>
            {form.addressType === "sf_station" ? (
              <div className="space-y-3">
                {/* Type filter */}
                <div className="flex gap-1.5">
                  {([['all', '全部'], ['station', '順豐站'], ['locker', '智能櫃']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => { setSfPointType(val); setShowSfDropdown(true); }}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${sfPointType === val ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      style={sfPointType === val ? { background: BRAND_BLUE } : {}}>{label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">搜尋站點 / 智能櫃</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input value={sfSearchQuery} onChange={e => { setSfSearchQuery(e.target.value); setShowSfDropdown(true); }} placeholder="輸入名稱、地址或編號" className="pl-8 text-sm bg-white text-gray-900 border-gray-300" onFocus={() => setShowSfDropdown(true)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">地區篩選</Label>
                    <select value={sfSearchRegion} onChange={e => { setSfSearchRegion(e.target.value); setShowSfDropdown(true); }} className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm">
                      <option value="">全部地區</option>
                      {["香港島", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {showSfDropdown && sfResults.length > 0 && (
                  <div className="border rounded-lg overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                    {sfResults.map((point: SFPoint) => (
                      <button key={point.code} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 transition-colors"
                        onClick={() => { setForm(f => ({ ...f, sfStationCode: point.code, sfStationName: point.name, sfStationAddress: point.address })); setShowSfDropdown(false); setSfSearchQuery(""); }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: point.type === 'locker' ? '#f59e0b22' : '#06038D22', color: point.type === 'locker' ? '#b45309' : '#06038D' }}>{point.type === 'locker' ? '智能櫃' : '順豐站'}</span>
                          <p className="text-sm font-medium text-gray-900">{point.name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{point.address} · <span className="font-mono">{point.code}</span></p>
                      </button>
                    ))}
                  </div>
                )}
                {form.sfStationCode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-blue-800">{form.sfStationCode.startsWith('H') ? '已選擇智能櫃' : '已選擇順豐站'}</p>
                      <p className="text-sm font-medium text-blue-900 mt-0.5">{form.sfStationName}</p>
                      <p className="text-xs text-blue-600 font-mono">{form.sfStationCode}</p>
                      {form.sfStationAddress && <p className="text-xs text-blue-500 mt-0.5">{form.sfStationAddress}</p>}
                    </div>
                    <button onClick={() => setForm(f => ({ ...f, sfStationCode: '', sfStationName: '', sfStationAddress: '' }))} className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">✕ 清除</button>
                  </div>
                )}
                {!form.sfStationCode && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">或直接輸入站點編號</Label>
                    <Input
                      placeholder="例：852Z351 或 H852001P"
                      className={`text-sm font-mono ${form.sfStationCode && !validateSFCode(form.sfStationCode).valid ? "border-red-400 bg-red-50" : ""}`}
                      onChange={e => setForm(f => ({ ...f, sfStationCode: e.target.value, sfStationName: "" }))}
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500">資料來自順豐香港官方（2026-03），共 125 個順豐站、729 個智能櫃。如需查詢最新站點，請訪問順豐香港官網。</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">地區</Label>
                    <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="w-full h-9 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm">
                      {["香港", "九龍", "新界"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">區域（選填）</Label>
                    <Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="如：旺角、銅鸾灣" className="text-sm bg-white text-gray-900 border-gray-300" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">詳細地址</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="街道、大婦、樓層、單位" className="text-sm bg-white text-gray-900 border-gray-300" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
              <Label htmlFor="isDefault" className="text-sm cursor-pointer text-gray-800 font-medium">設為預設地址</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}
                className="font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] disabled:scale-100 disabled:shadow-none" style={{ background: BRAND_BLUE, color: "white" }}>
                {editingId ? "儲存更改" : "新增地址"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="transition-all duration-200 hover:scale-[1.02] hover:shadow-sm active:scale-[0.98] border-gray-400 text-gray-700 bg-white hover:bg-gray-50">取消</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : !addresses || addresses.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${BRAND_BLUE}10` }}>
            <MapPin className="w-8 h-8" style={{ color: BRAND_BLUE }} />
          </div>
          <p className="text-gray-500 mb-2">尚未新增收貨地址</p>
          <p className="text-sm text-gray-400">新增地址後，付款時可快速帶入，無需重複填寫</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr: any) => (
            <div key={addr.id} className={`rounded-xl border-2 p-4 transition-all ${addr.isDefault ? "border-blue-600 bg-blue-50/50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{addr.label}</span>
                    {addr.isDefault && (
                      <Badge className="text-xs" style={{ background: BRAND_BLUE, color: "white" }}>
                        <Star className="w-2.5 h-2.5 mr-1" /> 預設
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{addr.recipientName} · {addr.phone}</p>
                  {addr.addressType === "sf_station" ? (
                    <div className="mt-0.5">
                      <p className="text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200 mr-1">
                          {addr.sfStationCode?.startsWith('H') ? '🔒 智能櫃' : '📦 順豐自提站'}
                        </span>
                        {addr.sfStationName ? `${addr.sfStationName} ` : ""}
                        <span className="font-mono text-xs text-gray-600">{addr.sfStationCode}</span>
                      </p>
                      {sfAddressCache[addr.sfStationCode] && (
                        <p className="text-xs text-gray-400 mt-0.5 pl-1">{sfAddressCache[addr.sfStationCode]}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-0.5">{addr.district ? `${addr.district}，` : ""}{addr.address}，{addr.region}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.isDefault && (
                    <Button size="sm" variant="ghost" onClick={() => setDefaultMutation.mutate({ id: addr.id })}
                      className="h-7 text-xs text-blue-600 hover:bg-blue-50 transition-all duration-150 hover:scale-[1.05] active:scale-95" disabled={setDefaultMutation.isPending}>
                      <Check className="w-3 h-3 mr-1" /> 設為預設
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(addr)} className="h-7 w-7 p-0 text-blue-500 transition-all duration-150 hover:scale-110 hover:bg-blue-50 hover:text-blue-600 active:scale-90">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate({ id: addr.id })}
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150 hover:scale-110 active:scale-90" disabled={deleteMutation.isPending}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Embedded Orders Section ───────────────────────────────────────────────
function EmbeddedOrdersSection() {
  const { data: orders, isLoading } = trpc.marketplace.getMyOrders.useQuery();
  const { data: timeoutSettings } = trpc.system.getTimeoutSettings.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const paymentTimeoutMinutes = timeoutSettings?.paymentTimeoutMinutes ?? 30;
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
  }
  if (!orders || orders.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
          <ShoppingBag className="w-8 h-8" style={{ color: BRAND_BLUE, opacity: 0.4 }} />
        </div>
        <p className="font-medium text-gray-500">暫無訂單記錄</p>
        <Link href="/marketplace">
          <Button style={{ backgroundColor: BRAND_BLUE }} className="text-white font-bold">前往商城購物</Button>
        </Link>
      </div>
    );
  }

  // 狀態篩選映射
  const STATUS_GROUPS: Record<string, string[]> = {
    all: [],
    pending: ["pending_payment", "alipay_pending"],
    active: ["payment_submitted", "payment_confirmed", "processing", "shipped"],
    done: ["completed", "cancelled"],
  };

  const allOrders = orders as any[];

  // 先篩選狀態
  const statusFiltered = statusFilter === "all"
    ? allOrders
    : allOrders.filter(o => STATUS_GROUPS[statusFilter]?.includes(o.orderStatus));

  // 再搜尋訂單號
  const filtered = searchQuery.trim()
    ? statusFiltered.filter(o =>
        o.orderNo?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        o.listingTitle?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : statusFiltered;

  // Count orders by batch unit: one batchRef = one unit, standalone orders count individually.
  // Applied to ALL tabs for consistent display across the page.
  const countByBatch = (orders: any[]) => {
    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of orders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }
    return count;
  };

  const filterTabs = [
    { id: "all", label: "全部", count: countByBatch(allOrders) },
    { id: "pending", label: "待付款", count: countByBatch(allOrders.filter(o => STATUS_GROUPS.pending.includes(o.orderStatus))) },
    { id: "active", label: "進行中", count: countByBatch(allOrders.filter(o => STATUS_GROUPS.active.includes(o.orderStatus))) },
    { id: "done", label: "已完成", count: countByBatch(allOrders.filter(o => STATUS_GROUPS.done.includes(o.orderStatus))) },
  ];

  return (
    <div className="space-y-4">
      {/* 搜尋欄 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋訂單號或商品名稱..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06038d]/30 bg-gray-50"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 狀態篩選 */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              statusFilter === tab.id
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]"
            }`}
            style={statusFilter === tab.id ? { backgroundColor: BRAND_BLUE } : {}}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 訂單列表 */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Filter className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">
            {searchQuery ? `找不到「${searchQuery}」的訂單` : "此狀態暫無訂單"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // Group orders by batchRef; orders without batchRef are shown individually
            const rendered: React.ReactNode[] = [];
            const seenBatchRefs = new Set<string>();
            for (const order of filtered) {
              const batchRef = order.batchRef as string | null;
              if (batchRef) {
                if (seenBatchRefs.has(batchRef)) continue; // already rendered
                seenBatchRefs.add(batchRef);
                const batchOrders = filtered.filter((o: any) => o.batchRef === batchRef);
                rendered.push(<BatchOrderCard key={`batch-${batchRef}`} orders={batchOrders} paymentTimeoutMinutes={paymentTimeoutMinutes} />);
              } else {
                rendered.push(<EmbeddedOrderCard key={order.id} order={order} paymentTimeoutMinutes={paymentTimeoutMinutes} />);
              }
            }
            return rendered;
          })()}
          <p className="text-xs text-gray-400 text-center pt-1">共 {filtered.length} 筆訂單</p>
        </div>
      )}
    </div>
  );
}

// ─── Embedded Notifications Section ───────────────────────────
const notifTypeIcon = (type: string) => {
  switch (type) {
    case "trade": return <Package className="w-4 h-4" style={{ color: BRAND_BLUE }} />;
    case "payment": return <DollarSign className="w-4 h-4 text-green-600" />;
    case "system": return <Info className="w-4 h-4 text-gray-500" />;
    case "alert": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default: return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

function EmbeddedNotificationsSection() {
  const utils = trpc.useUtils();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const { data, isLoading } = trpc.notifications.getMyNotifications.useQuery(
    { limit: 50, offset: 0, unreadOnly, type: typeFilter }
  );
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      toast.success("已標記所有通知為已讀");
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });
  const deleteMutation = trpc.notifications.deleteNotification.useMutation({
    onSuccess: () => {
      utils.notifications.getMyNotifications.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const notifications = (data ?? []) as any[];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{unreadCount} 則未讀</span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 font-semibold"
            style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />全部已讀
          </Button>
        )}
      </div>

      {/* 已讀/未讀切換 */}
      <div className="flex gap-2">
        {[
          { value: false, label: "全部" },
          { value: true, label: "未讀" },
        ].map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => setUnreadOnly(opt.value)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              unreadOnly === opt.value
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]"
            }`}
            style={unreadOnly === opt.value ? { backgroundColor: BRAND_BLUE } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 類型篩選 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: undefined, label: "所有類型" },
          { value: "trade", label: "交易" },
          { value: "payment", label: "付款" },
          { value: "offer", label: "出價" },
          { value: "shipping", label: "物流" },
          { value: "dispute", label: "爭議" },
          { value: "system", label: "系統" },
        ].map(({ value, label }) => (
          <button
            key={label}
            onClick={() => setTypeFilter(value)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              typeFilter === value
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#06038d] hover:text-[#06038d]"
            }`}
            style={typeFilter === value ? { backgroundColor: BRAND_BLUE } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 通知列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#f0f4ff" }} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f0f4ff" }}>
            <Bell className="w-7 h-7" style={{ color: BRAND_BLUE, opacity: 0.3 }} />
          </div>
          <p className="text-gray-400">{unreadOnly ? "沒有未讀通知" : "暫無通知"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => (
            <div
              key={notif.id}
              className="rounded-xl border overflow-hidden transition-all"
              style={{
                borderLeft: !notif.isRead ? `4px solid ${BRAND_BLUE}` : "1px solid #e5e7eb",
                background: !notif.isRead ? "#f8faff" : "white",
              }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#e8edff" }}>
                    {notifTypeIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${notif.isRead ? "text-gray-600" : "text-gray-900"}`}>
                          {notif.title}
                          {!notif.isRead && <span className="ml-2 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString("zh-HK")}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notif.isRead && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-green-600"
                            onClick={() => markAsReadMutation.mutate({ notificationId: notif.id })}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => deleteMutation.mutate({ notificationId: notif.id })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {notif.linkUrl && (
                      <Link href={notif.linkUrl}>
                        <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs p-0 font-semibold hover:underline" style={{ color: BRAND_BLUE }}
                          onClick={() => !notif.isRead && markAsReadMutation.mutate({ notificationId: notif.id })}>
                          查看詳情 →
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Embedded Order Card ───────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)} onClick={() => onChange(star)} className="focus:outline-none">
          <Star className={`w-7 h-7 transition-colors ${star <= (hovered || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ─── Payment countdown hook (shared between BatchOrderCard and single order card) ───
function useBatchPaymentCountdown(createdAt: Date | string | null | undefined, timeoutMinutes: number, onExpire?: () => void) {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; expired: boolean } | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => {
    if (!createdAt || !timeoutMinutes) return;
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    let hasExpiredFired = false;
    const calc = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, expired: true });
        if (!hasExpiredFired) {
          hasExpiredFired = true;
          // Delay slightly to let UI update first, then trigger refresh
          setTimeout(() => onExpireRef.current?.(), 1500);
        }
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ minutes, seconds, expired: false });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [createdAt, timeoutMinutes]);
  return timeLeft;
}

// ─── Batch Order Card (multiple orders with same batchRef) ───
function BatchOrderCard({ orders, paymentTimeoutMinutes }: { orders: any[]; paymentTimeoutMinutes?: number }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();
  if (!orders.length) return null;
  const firstOrder = orders[0];
  const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.subtotalHkd ?? '0'), 0);
  // Use the "worst" status (pending_payment > others)
  const batchStatus = orders.some(o => o.orderStatus === 'pending_payment') ? 'pending_payment'
    : orders.some(o => ['payment_submitted', 'alipay_pending'].includes(o.orderStatus)) ? 'payment_submitted'
    : orders.some(o => ['paid_held', 'payment_received', 'processing'].includes(o.orderStatus)) ? 'processing'
    : orders.some(o => o.orderStatus === 'shipped') ? 'shipped'
    : orders.some(o => o.orderStatus === 'completed') ? 'completed'
    : firstOrder.orderStatus;
  const isPending = batchStatus === 'pending_payment';
  const isWaitingShipment = ['paid_held', 'payment_received', 'processing'].includes(batchStatus);
  // Check if ALL orders in the batch are cancelled
  const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === 'cancelled');
  // Payment countdown: use the earliest createdAt among pending orders
  const pendingOrder = orders.find(o => o.orderStatus === 'pending_payment');
  const paymentCountdown = useBatchPaymentCountdown(
    isPending ? pendingOrder?.createdAt : null,
    paymentTimeoutMinutes ?? 30,
    () => { utils.marketplace.getMyOrders.invalidate(); }
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* Brand Header Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
        <span className="text-xs text-white/80 font-mono tracking-wide">訂單批次 · {orders.length} 件商品</span>
        <OrderStatusBadge status={batchStatus} />
      </div>
      {/* Products list */}
      <div className="p-4 space-y-3">
        {orders.map((order: any) => {
          const imgs = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
          const thumb = imgs[0];
          return (
            <div key={order.id} className="flex items-center gap-3">
              {thumb ? (
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={thumb} alt={order.listingTitle ?? '商品'} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                  <span className="text-xl">🃏</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-gray-900">{order.listingTitle ?? '商品'}</p>
                <p className="text-xs text-gray-500 font-mono">#{order.orderNo}</p>
              </div>
              <p className="text-sm font-semibold flex-shrink-0" style={{ color: BRAND_BLUE }}>HKD {parseFloat(order.subtotalHkd ?? '0').toFixed(2)}</p>
            </div>
          );
        })}
        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-700">合計（不含運費）</span>
          <span className="text-base font-bold" style={{ color: BRAND_BLUE }}>HKD {totalAmount.toFixed(2)}</span>
        </div>
        {/* Payment method */}
        <p className="text-xs text-gray-500">{firstOrder.paymentMethod?.replace('_', ' ')} · {new Date(firstOrder.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      {/* Action buttons */}
      {(isPending || isWaitingShipment || isAllCancelled) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          {isPending && (
            <>
              <Link href={`/orders/${firstOrder.orderNo}`}>
                <Button size="sm" className="text-xs text-white font-bold" style={{ backgroundColor: BRAND_BLUE }}>
                  <CreditCard className="w-3.5 h-3.5 mr-1" />前往付款
                </Button>
              </Link>
              {paymentCountdown && !paymentCountdown.expired && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 font-mono font-semibold">
                  <Clock className="w-3 h-3 text-amber-500" />
                  剩 {String(paymentCountdown.minutes).padStart(2, '0')}:{String(paymentCountdown.seconds).padStart(2, '0')}
                </span>
              )}
              {paymentCountdown?.expired && (
                <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />付款時限已到
                </span>
              )}
            </>
          )}
          {isWaitingShipment && (
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />付款成功，等待賣家出貨
            </span>
          )}
          {isAllCancelled && (
            <>
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <span className="text-sm">❌</span>此批次已全部取消
              </span>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="text-xs font-semibold border-[#06038d] text-[#06038d] hover:bg-[#06038d]/5">
                  🛍️ 前往市集
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
      {/* Expand toggle */}
      <button
        className="w-full px-4 py-2.5 border-t text-xs text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起訂單詳情</> : <><ChevronDown className="w-3.5 h-3.5" />查看各訂單詳情</>}
      </button>
      {expanded && (
        <div className="border-t p-4 space-y-2" style={{ backgroundColor: '#f8f9fa' }}>
          {orders.map((order: any) => (
            <Link key={order.id} href={`/orders/${order.orderNo}`}>
              <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100 hover:border-[#06038d]/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-xs font-mono text-gray-500">#{order.orderNo}</p>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{order.listingTitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.orderStatus} />
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmbeddedOrderCard({ order, paymentTimeoutMinutes }: { order: any; paymentTimeoutMinutes?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [disputeEvidenceMimeTypes, setDisputeEvidenceMimeTypes] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const utils = trpc.useUtils();

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success("✅ 已確認收貨，款項將轉帳給賣家");
      setShowConfirmDialog(false);
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadDisputeEvidenceMutation = trpc.marketplace.uploadDisputeEvidence.useMutation();
  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
      setDisputeEvidenceUrls([]);
      setDisputeEvidenceMimeTypes([]);
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const submitReviewMutation = trpc.marketplace.submitReview.useMutation({
    onSuccess: () => {
      toast.success("⭐ 評價已提交，感謝你的反饋！");
      setShowReviewDialog(false);
      setReviewComment("");
      setReviewRating(5);
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: existingReview } = trpc.marketplace.getOrderReview.useQuery(
    { orderId: order.id },
    { enabled: order.orderStatus === "completed" && order.sellerType === "seller" }
  );

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (disputeEvidenceUrls.length + files.length > 3) { toast.error("最多可上傳 3 個檔案"); return; }
    setIsUploadingEvidence(true);
    try {
      const newUrls: string[] = [];
      const newMimeTypes: string[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith("video/");
        const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) { toast.error(isVideo ? "影片不能超過 30MB" : "圖片不能超過 5MB"); continue; }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadDisputeEvidenceMutation.mutateAsync({ orderId: order.id, fileBase64: base64, mimeType: file.type });
        newUrls.push(result.url);
        newMimeTypes.push(result.mimeType ?? file.type);
      }
      setDisputeEvidenceUrls(prev => [...prev, ...newUrls]);
      setDisputeEvidenceMimeTypes(prev => [...prev, ...newMimeTypes]);
      toast.success(`已上傳 ${newUrls.length} 個檔案`);
    } catch { toast.error("上傳失敗，請重試"); }
    finally { setIsUploadingEvidence(false); }
  };

  const shippingAddr = (() => { if (!order.shippingAddress) return null; try { return JSON.parse(order.shippingAddress); } catch { return null; } })();
  const canConfirm = order.orderStatus === "shipped" || order.orderStatus === "delivered";
  const canDispute = ["shipped", "delivered", "payment_received", "processing"].includes(order.orderStatus);
  const isCompleted = order.orderStatus === "completed";
  const isPending = order.orderStatus === "pending_payment";
  const isDisputed = order.orderStatus === "disputed";
  const isCancelled = order.orderStatus === "cancelled";
  const paymentCountdown = useBatchPaymentCountdown(
    isPending ? order.createdAt : null,
    paymentTimeoutMinutes ?? 30,
    () => { utils.marketplace.getMyOrders.invalidate(); }
  );
  const isWaitingShipment = ["paid_held", "payment_received", "processing"].includes(order.orderStatus);
  const canReview = isCompleted && order.sellerType === "seller" && !existingReview;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* Brand Header Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
        <span className="text-xs text-white/80 font-mono tracking-wide">#{order.orderNo}</span>
        <OrderStatusBadge status={order.orderStatus} />
      </div>
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3">
        {(() => {
          const imgs = (() => { try { return JSON.parse(order.listingImages ?? '[]'); } catch { return []; } })();
          const thumb = imgs[0];
          return thumb ? (
            <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
              <img src={thumb} alt={order.listingTitle ?? '商品'} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
              <span className="text-2xl">🃏</span>
            </div>
          );
        })()}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-gray-900">{order.listingTitle ?? "商品"}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <p className="font-bold" style={{ color: BRAND_BLUE }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</p>
          <p className="text-xs text-gray-500 capitalize">{order.paymentMethod?.replace("_", " ")}</p>
          <Link href={`/orders/${order.orderNo}`}>
            <Button variant="outline" size="sm" className="text-xs h-7 px-2" style={{ color: BRAND_BLUE, borderColor: `${BRAND_BLUE}40` }}>查看詳情</Button>
          </Link>
        </div>
      </div>
      {/* Action buttons */}
      {(canConfirm || canDispute || isPending || canReview || isDisputed || isCancelled) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          {canConfirm && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConfirmDialog(true)}>
              <CheckCircle className="w-4 h-4 mr-1.5" />確認收貨
            </Button>
          )}
          {canDispute && (
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDisputeDialog(true)}>
              <Flag className="w-4 h-4 mr-1.5" />申請爭議
            </Button>
          )}
          {canReview && (
            <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowReviewDialog(true)}>
              <Star className="w-4 h-4 mr-1.5" />評價賣家
            </Button>
          )}
          {isCompleted && existingReview && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />已評價 {existingReview.rating} 星
            </span>
          )}
          {isPending && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/orders/${order.orderNo}`}>
                <Button size="sm" className="text-xs text-white font-bold" style={{ backgroundColor: BRAND_BLUE }}>
                  <CreditCard className="w-3.5 h-3.5 mr-1" />前往付款
                </Button>
              </Link>
              {paymentCountdown && !paymentCountdown.expired && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 font-mono font-semibold">
                  <Clock className="w-3 h-3 text-amber-500" />
                  剩 {String(paymentCountdown.minutes).padStart(2, '0')}:{String(paymentCountdown.seconds).padStart(2, '0')}
                </span>
              )}
              {paymentCountdown?.expired && (
                <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />付款時限已到
                </span>
              )}
            </div>
          )}
          {isWaitingShipment && (
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />付款成功，等待賣家出貨
            </span>
          )}
          {isDisputed && (
            <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />爭議處理中，請等待管理員回覆
            </span>
          )}
          {isCancelled && (
            <>
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <span className="text-sm">❌</span>訂單已取消
              </span>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="text-xs font-semibold border-[#06038d] text-[#06038d] hover:bg-[#06038d]/5">
                  🛍️ 前往市集
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
      {/* Dispute info banner */}
      {isDisputed && order.disputeReason && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
          <div className="font-medium mb-1">爭議原因：</div>
          <div>{order.disputeReason}</div>
          {order.disputeResolution && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <div className="font-medium mb-1 text-green-700">處理結果：</div>
              <div className="text-green-700">{order.disputeResolution}</div>
            </div>
          )}
        </div>
      )}
      {/* Shipping info */}
      {(order.orderStatus === "shipped" || order.orderStatus === "delivered" || isCompleted) && order.trackingNumber && (
        <div className="mx-4 mb-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-indigo-800">
            <Truck className="w-4 h-4 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-medium">{order.shippingMethod ?? "快遞"}</span>
              <span className="mx-1">·</span>
              追蹤號：<span className="font-mono font-medium">{order.trackingNumber}</span>
            </div>
          </div>
        </div>
      )}
      {/* Auto-complete notice */}
      {order.orderStatus === "shipped" && order.autoCompleteAt && (
        <div className="mx-4 mb-3 text-xs text-muted-foreground bg-gray-50 border rounded-lg px-3 py-2">
          如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
        </div>
      )}
      {/* Expand toggle */}
      <button
        className="w-full px-4 py-2.5 border-t text-xs text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <><ChevronUp className="w-3.5 h-3.5" />收起詳情</> : <><ChevronDown className="w-3.5 h-3.5" />查看詳情</>}
      </button>
      {/* Expanded details */}
      {expanded && (
        <div className="border-t p-4 space-y-3" style={{ backgroundColor: "#f8f9fa" }}>
          {shippingAddr && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>收貨資料</p>
              <div className="text-sm space-y-1 text-gray-800">
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-gray-500" />{shippingAddr.name}</div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-500" />{shippingAddr.phone}</div>
                <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                  <span>{shippingAddr.address}{shippingAddr.district ? `，${shippingAddr.district}` : ""}{shippingAddr.region ? `，${shippingAddr.region}` : ""}</span>
                </div>
              </div>
            </div>
          )}
          <div className="border-t border-gray-200" />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>付款資料</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">商品金額</span><span className="text-gray-800">HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span className="text-gray-800">總計</span><span style={{ color: BRAND_BLUE }}>HKD {parseFloat(order.subtotalHkd ?? "0").toFixed(2)}</span></div>
            </div>
          </div>
          {order.listingId && (
            <Link href={`/marketplace/${order.listingId}`}>
              <Button variant="outline" size="sm" className="w-full text-xs" style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}>查看商品頁面</Button>
            </Link>
          )}
        </div>
      )}
      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">確認收貨</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">確認已收到商品並且狀態良好？確認後款項將轉帳給賣家，此操作無法撤銷。</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfirmDialog(false)}>取消</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={confirmReceiptMutation.isPending}
              onClick={() => confirmReceiptMutation.mutate({ orderId: order.id })}>
              {confirmReceiptMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</> : <><CheckCircle className="w-4 h-4 mr-2" />確認收貨</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-700 flex items-center gap-2"><Flag className="w-5 h-5" />申請爭議</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">爭議原因（至少 10 個字）</Label>
              <Textarea placeholder="請詳細描述問題，例如：商品與描述不符、未收到商品等..." value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4} className="text-sm" />
              <div className="text-xs text-muted-foreground text-right">{disputeReason.length} 字</div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">上傳佐證（選填，最多 3 個）</Label>
              <div className="flex flex-wrap gap-2">
                {disputeEvidenceUrls.map((url, i) => {
                  const isVideo = disputeEvidenceMimeTypes[i]?.startsWith("video/");
                  return (
                    <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                      {isVideo ? (
                        <video src={url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => { setDisputeEvidenceUrls(prev => prev.filter((_, idx) => idx !== i)); setDisputeEvidenceMimeTypes(prev => prev.filter((_, idx) => idx !== i)); }}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/80">×</button>
                    </div>
                  );
                })}
                {disputeEvidenceUrls.length < 3 && (
                  <label className={`w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${isUploadingEvidence ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingEvidence ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <><span className="text-2xl text-muted-foreground">+</span><span className="text-xs text-muted-foreground mt-0.5">上傳</span></>}
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleEvidenceUpload} />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">支援圖片（JPG/PNG/WebP，最大5MB）或影片（MP4/WebM，最大30MB）</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDisputeDialog(false); setDisputeReason(""); setDisputeEvidenceUrls([]); setDisputeEvidenceMimeTypes([]); }}>取消</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={openDisputeMutation.isPending || disputeReason.trim().length < 10 || isUploadingEvidence}
              onClick={() => openDisputeMutation.mutate({ orderId: order.id, reason: disputeReason.trim(), evidenceUrls: disputeEvidenceUrls.length > 0 ? disputeEvidenceUrls : undefined })}>
              {openDisputeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : <><Flag className="w-4 h-4 mr-2" />提交爭議</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" />評價賣家</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">評分</p>
              <StarRating value={reviewRating} onChange={setReviewRating} />
              <p className="text-xs text-muted-foreground">
                {reviewRating === 1 && "非常不滿意"}{reviewRating === 2 && "不滿意"}{reviewRating === 3 && "一般"}{reviewRating === 4 && "滿意"}{reviewRating === 5 && "非常滿意"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">評語（選填）</p>
              <Textarea placeholder="分享你的購物體驗..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} className="text-sm" maxLength={500} />
              <div className="text-xs text-muted-foreground text-right">{reviewComment.length}/500</div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>取消</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" disabled={submitReviewMutation.isPending || reviewRating === 0}
              onClick={() => submitReviewMutation.mutate({ orderId: order.id, rating: reviewRating, comment: reviewComment.trim() || undefined })}>
              {submitReviewMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : <><MessageSquare className="w-4 h-4 mr-2" />提交評價</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Embedded Offers Section ───────────────────────────────────
function EmbeddedOffersSection({ userId }: { userId: number }) {
  const utils = trpc.useUtils();
  const { data: offers, isLoading } = trpc.marketplace.getMyOffers.useQuery();
  const cancelOfferMutation = trpc.marketplace.cancelOffer.useMutation({
    onSuccess: () => { toast.success("出價已取消"); utils.marketplace.getMyOffers.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const offerStatusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "待回覆", color: "bg-yellow-100 text-yellow-800" },
    accepted: { label: "已接受", color: "bg-green-100 text-green-800" },
    rejected: { label: "已拒絕", color: "bg-red-100 text-red-800" },
    expired: { label: "已過期", color: "bg-gray-100 text-gray-600" },
    cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600" },
  };
  if (isLoading) return <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>;
  if (!offers || offers.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
          <Tag className="w-8 h-8" style={{ color: BRAND_BLUE, opacity: 0.3 }} />
        </div>
        <p className="font-medium text-gray-500">暫無出價記錄</p>
        <Link href="/marketplace">
          <Button style={{ backgroundColor: BRAND_BLUE }} className="text-white font-bold">前往商城出價</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {(offers as any[]).map((offer) => (
        <div key={offer.id} className="rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(90deg, #06038d 0%, #0a06b5 100%)" }}>
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">出價 #{offer.id}</span>
            </div>
            <Badge className={`text-xs ${offerStatusLabel[offer.status]?.color ?? "bg-gray-100"}`}>
              {offerStatusLabel[offer.status]?.label ?? offer.status}
            </Badge>
          </div>
          <div className="bg-white p-4 flex items-start gap-3">
            {(() => {
              const imgs = (() => { try { return JSON.parse(offer.listingImages ?? '[]'); } catch { return []; } })();
              const thumb = imgs[0];
              return thumb ? (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={thumb} alt={offer.listingTitle ?? '商品'} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
                  <span className="text-2xl">🃏</span>
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              {offer.listingTitle && <p className="font-semibold text-sm text-gray-900 truncate mb-0.5">{offer.listingTitle}</p>}
              <p className="font-medium text-gray-800">出價金額: <span style={{ color: BRAND_BLUE }}>HKD {parseFloat(offer.offerPriceHkd).toFixed(2)}</span></p>
              {offer.message && <p className="text-sm text-gray-500 mt-1">留言: {offer.message}</p>}
              {offer.rejectionReason && <p className="text-sm text-red-500 mt-1">拒絕原因: {offer.rejectionReason}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(offer.createdAt).toLocaleDateString("zh-HK")}</p>
              {offer.status === "pending" && <p className="text-xs text-amber-600 mt-1">到期: {new Date(offer.expiresAt).toLocaleString("zh-HK")}</p>}
              {offer.status === "accepted" && <p className="text-xs text-green-600 mt-1 font-medium">✅ 賣家已接受出價，請盡快完成付款</p>}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Link href={`/shop/${offer.listingId}`}>
                <Button size="sm" variant="outline" className="text-xs" style={{ color: BRAND_BLUE, borderColor: `${BRAND_BLUE}40` }}>查看商品</Button>
              </Link>
              {offer.status === "pending" && (
                <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-600 hover:bg-red-50"
                  disabled={cancelOfferMutation.isPending}
                  onClick={() => cancelOfferMutation.mutate({ offerId: offer.id })}>
                  取消出價
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── My Auctions Section ──────────────────────────────────────
function MyAuctionsSection({ bids }: { bids: any[] }) {
  const [tab, setTab] = useState<"active" | "won" | "history">("active");
  const utils = trpc.useUtils();

  const activeBids = bids.filter(b => b.status === "active" || b.status === "winning");
  const wonBids = bids.filter(b => b.status === "won");
  const historyBids = bids.filter(b => b.status === "lost" || b.status === "retracted");

  const tabs = [
    { id: "active" as const, label: "正在競拍", count: activeBids.length },
    { id: "won" as const, label: "已得標", count: wonBids.length },
    { id: "history" as const, label: "歷史競拍", count: historyBids.length },
  ];

  const currentBids = tab === "active" ? activeBids : tab === "won" ? wonBids : historyBids;

  function AuctionCountdown({ endAt }: { endAt: string | null }) {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
      if (!endAt) { setTimeLeft("—"); return; }
      const update = () => {
        const diff = new Date(endAt).getTime() - Date.now();
        if (diff <= 0) { setTimeLeft("已結標"); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
      };
      update();
      const t = setInterval(update, 1000);
      return () => clearInterval(t);
    }, [endAt]);
    const isUrgent = endAt && new Date(endAt).getTime() - Date.now() < 3600000;
    return (
      <span className={`text-xs font-mono font-bold ${isUrgent ? "text-red-600" : "text-gray-600"}`}>
        {timeLeft}
      </span>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `#06038d15` }}>
          <DollarSign className="w-8 h-8" style={{ color: "#06038d" }} />
        </div>
        <p className="text-gray-500 font-medium">您尚未參與任何拍賣</p>
        <p className="text-gray-400 text-sm mt-1">前往市集探索正在進行的拍賣</p>
        <Link href="/marketplace">
          <Button className="mt-4 font-semibold" style={{ background: "#06038d", color: "white" }}>
            前往市集
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
            style={tab === t.id ? { background: "#06038d" } : {}}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                tab === t.id ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bid list */}
      {currentBids.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">此分類暫無記錄</div>
      ) : (
        <div className="space-y-3">
          {currentBids.map((bid: any) => (
            <div key={bid.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                {/* Card image */}
                {bid.listing?.imageUrls?.[0] && (
                  <img
                    src={bid.listing.imageUrls[0]}
                    alt={bid.listing.title}
                    className="w-14 h-14 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {bid.listing?.title ?? `拍賣 #${bid.listingId}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {bid.listing?.cardName && `${bid.listing.cardName} · `}
                        {bid.listing?.grade && `PSA ${bid.listing.grade}`}
                      </p>
                    </div>
                    {/* Status badge */}
                    {bid.status === "winning" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#FEDD00", color: "#06038d" }}>
                        領先中
                      </span>
                    )}
                    {bid.status === "active" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-100 text-blue-700">
                        競拍中
                      </span>
                    )}
                    {bid.status === "won" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-green-100 text-green-700">
                        已得標
                      </span>
                    )}
                    {bid.status === "lost" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-500">
                        未得標
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-400">我的出價</p>
                        <p className="text-sm font-bold" style={{ color: "#06038d" }}>
                          ¥{bid.amount?.toLocaleString()}
                        </p>
                      </div>
                      {bid.listing?.currentBid && (
                        <div>
                          <p className="text-xs text-gray-400">當前最高</p>
                          <p className="text-sm font-bold text-gray-700">
                            ¥{bid.listing.currentBid?.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    {(bid.status === "active" || bid.status === "winning") && bid.listing?.auctionEndAt && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">剩餘時間</p>
                        <AuctionCountdown endAt={bid.listing.auctionEndAt} />
                      </div>
                    )}
                    {bid.status === "won" && bid.listing?.id && (
                      <Link href={`/auction/${bid.listing.id}`}>
                        <Button size="sm" className="text-xs font-semibold" style={{ background: "#06038d", color: "white" }}>
                          前往付款
                        </Button>
                      </Link>
                    )}
                    {(bid.status === "active" || bid.status === "winning") && bid.listing?.id && (
                      <Link href={`/auction/${bid.listing.id}`}>
                        <Button size="sm" variant="outline" className="text-xs font-semibold border-[#06038d] text-[#06038d]">
                          查看拍賣
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
