import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, RefreshCw, Edit, Trash2, Key, Shield, User, Mail, Calendar, Clock,
  MapPin, ShoppingBag, Eye, Ban, CheckCircle, Users, UserCheck, UserX, ChevronLeft, ChevronRight,
  Phone, Lock, Globe, AlertTriangle, UserCog, MoreVertical
} from "lucide-react";
import { toast } from "sonner";

// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color ?? "bg-muted"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 text-xs">
      <Shield className="w-3 h-3" /> 管理員
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 text-xs">
      <User className="w-3 h-3" /> 用戶
    </Badge>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────
function StatusBadge({ isBlocked }: { isBlocked: boolean }) {
  return isBlocked ? (
    <Badge variant="destructive" className="gap-1 text-xs">
      <Ban className="w-3 h-3" /> 已封鎖
    </Badge>
  ) : (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1 text-xs">
      <CheckCircle className="w-3 h-3" /> 正常
    </Badge>
  );
}

// ─── User Detail Dialog ───────────────────────────────────────────
function UserDetailDialog({ userId, onClose, onBlock, onUnblock, onChangeRole }: {
  userId: number | null;
  onClose: () => void;
  onBlock: (userId: number) => void;
  onUnblock: (userId: number) => void;
  onChangeRole: (userId: number, role: "admin" | "user") => void;
}) {
  const { data: detail, isLoading } = trpc.admin.getUserDetailWithStats.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  const loginMethodLabel: Record<string, string> = { password: "密碼登入", google: "Google OAuth" };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            帳號詳細資料
          </DialogTitle>
          <DialogDescription>查看用戶的完整帳號資訊、訂單統計及收貨地址</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                  {(detail.name || detail.email)?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{detail.name || "（未設定名稱）"}</p>
                <p className="text-sm text-muted-foreground truncate">{detail.email}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <RoleBadge role={detail.role} />
                  <StatusBadge isBlocked={detail.isBlocked} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Account Info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> 帳號資訊
              </p>
              <div className="border rounded-lg divide-y text-sm">
                <InfoRow label="用戶 ID" value={`#${detail.id}`} />
                <InfoRow label="電子郵件" value={detail.email} icon={<Mail className="w-3.5 h-3.5 text-muted-foreground" />} />
                <InfoRow label="電話" value={detail.phone ?? "未設定"} icon={<Phone className="w-3.5 h-3.5 text-muted-foreground" />} />
                <InfoRow label="登入方式" value={loginMethodLabel[detail.loginMethod] ?? detail.loginMethod} icon={<Globe className="w-3.5 h-3.5 text-muted-foreground" />} />
                <InfoRow label="Email 驗證" value={detail.emailVerified ? "已驗證" : "未驗證"} valueClass={detail.emailVerified ? "text-green-500" : "text-orange-500"} />
                <InfoRow label="角色" value={detail.role === "admin" ? "管理員" : "普通用戶"} icon={<Shield className="w-3.5 h-3.5 text-muted-foreground" />} />
                <InfoRow label="帳號狀態" value={detail.isBlocked ? `已封鎖${detail.blockReason ? `（${detail.blockReason}）` : ""}` : "正常"} valueClass={detail.isBlocked ? "text-destructive" : "text-green-500"} />
                <InfoRow label="註冊時間" value={new Date(detail.createdAt).toLocaleString("zh-HK")} icon={<Calendar className="w-3.5 h-3.5 text-muted-foreground" />} />
                <InfoRow label="最後登入" value={new Date(detail.lastSignedIn).toLocaleString("zh-HK")} icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />} />
              </div>
            </div>

            {/* Order Stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> 訂單統計
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{detail.orderStats.totalOrders}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">總訂單</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{detail.orderStats.completedOrders}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">已完成</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">HK${detail.orderStats.totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">總消費</p>
                </div>
              </div>
            </div>

            {/* Shipping Addresses */}
            {detail.shippingAddresses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> 收貨地址 ({detail.shippingAddresses.length})
                </p>
                <div className="space-y-2">
                  {detail.shippingAddresses.map((addr: any) => (
                    <div key={addr.id} className={`rounded-lg border p-3 text-sm ${addr.isDefault ? "border-primary/50 bg-primary/5" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{addr.label}</span>
                        {addr.isDefault && <Badge className="text-xs h-4">預設</Badge>}
                      </div>
                      <p className="text-muted-foreground">{addr.recipientName} · {addr.phone}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{addr.district ? `${addr.district}，` : ""}{addr.address}，{addr.region}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">找不到用戶資料</p>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {detail && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeRole(detail.id, detail.role === "admin" ? "user" : "admin")}
                className="gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                {detail.role === "admin" ? "降為普通用戶" : "升為管理員"}
              </Button>
              {detail.isBlocked ? (
                <Button variant="outline" size="sm" onClick={() => onUnblock(detail.id)} className="gap-1.5 text-green-600 border-green-600/30 hover:bg-green-600/10">
                  <CheckCircle className="w-3.5 h-3.5" /> 解除封鎖
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onBlock(detail.id)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Ban className="w-3.5 h-3.5" /> 封鎖帳號
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={onClose}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, icon, valueClass }: { label: string; value: string; icon?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 gap-4">
      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">{icon}{label}</span>
      <span className={`font-medium text-right break-all ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

// ─── Block Dialog ─────────────────────────────────────────────────
function BlockDialog({ userId, onConfirm, onClose }: { userId: number | null; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5" /> 封鎖帳號
          </DialogTitle>
          <DialogDescription>封鎖後該用戶將無法登入平台。請輸入封鎖原因（可選）。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>封鎖原因</Label>
          <Textarea
            placeholder="例如：違反使用條款、詐騙行為等..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant="destructive" onClick={() => { onConfirm(reason); setReason(""); }}>
            確認封鎖
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Role Dialog ───────────────────────────────────────────
function ChangeRoleDialog({ userId, targetRole, onConfirm, onClose }: {
  userId: number | null;
  targetRole: "admin" | "user" | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={!!userId && !!targetRole} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> 修改用戶角色
          </AlertDialogTitle>
          <AlertDialogDescription>
            確定要將此用戶角色改為「{targetRole === "admin" ? "管理員" : "普通用戶"}」嗎？
            {targetRole === "admin" && " 管理員擁有完整的後台管理權限，請謹慎操作。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={targetRole === "admin" ? "bg-amber-500 hover:bg-amber-600" : ""}>
            確認修改
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Edit User Dialog ─────────────────────────────────────────────
function EditUserDialog({ user, onSave, onClose }: { user: any; onSave: (name: string, email: string) => void; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" /> 編輯用戶</DialogTitle>
          <DialogDescription>修改用戶的基本資訊</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>名稱</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="輸入用戶名稱" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="輸入 Email" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(name, email)}>儲存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────
function ResetPasswordDialog({ userId, onSave, onClose }: { userId: number | null; onSave: (pw: string) => void; onClose: () => void }) {
  const [pw, setPw] = useState("");
  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> 重置密碼</DialogTitle>
          <DialogDescription>為用戶設置新密碼（至少 8 個字符）</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>新密碼</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="輸入新密碼" />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => { onSave(pw); setPw(""); }}>重置密碼</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export function AdminUserManagement() {
  const utils = trpc.useUtils();

  // Filter & pagination state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"admin" | "user" | "">("");
  const [loginMethodFilter, setLoginMethodFilter] = useState<"password" | "google" | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  // Dialog state
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [blockingUserId, setBlockingUserId] = useState<number | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<number | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ userId: number; role: "admin" | "user" } | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Queries
  const { data: userList, isLoading, refetch } = trpc.admin.getUserList.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    role: roleFilter || undefined,
    loginMethod: loginMethodFilter || undefined,
    isBlocked: statusFilter === "blocked" ? true : statusFilter === "active" ? false : undefined,
  });

  const { data: stats, refetch: refetchStats } = trpc.admin.getUserStats.useQuery();

  const refreshAll = useCallback(() => { refetch(); refetchStats(); }, [refetch, refetchStats]);

  // Mutations
  const blockMutation = trpc.admin.blockUser.useMutation({
    onSuccess: () => { toast.success("用戶已封鎖"); setBlockingUserId(null); setViewingUserId(null); refreshAll(); },
    onError: (e: any) => toast.error(`封鎖失敗：${e.message}`),
  });

  const unblockMutation = trpc.admin.unblockUser.useMutation({
    onSuccess: () => { toast.success("已解除封鎖"); setUnblockingUserId(null); setViewingUserId(null); refreshAll(); },
    onError: (e: any) => toast.error(`解封失敗：${e.message}`),
  });

  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { toast.success("角色已更新"); setRoleChangeTarget(null); setViewingUserId(null); refreshAll(); },
    onError: (e: any) => toast.error(`更新失敗：${e.message}`),
  });

  const updateUserMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success("用戶資料已更新"); setEditingUser(null); refetch(); },
    onError: (e: any) => toast.error(`更新失敗：${e.message}`),
  });

  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => { toast.success("密碼已重置"); setResetPasswordUserId(null); },
    onError: (e: any) => toast.error(`重置失敗：${e.message}`),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { toast.success("用戶已刪除"); setDeletingUserId(null); refreshAll(); },
    onError: (e: any) => toast.error(`刪除失敗：${e.message}`),
  });

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="總用戶數" value={stats?.total ?? 0} icon={Users} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="管理員" value={stats?.adminCount ?? 0} icon={Shield} color="bg-amber-500/20 text-amber-400" />
        <StatCard label="普通用戶" value={stats?.userCount ?? 0} icon={User} color="bg-muted text-muted-foreground" />
        <StatCard label="密碼登入" value={stats?.passwordCount ?? 0} icon={Lock} color="bg-purple-500/20 text-purple-400" />
        <StatCard label="Google 登入" value={stats?.googleCount ?? 0} icon={Globe} color="bg-green-500/20 text-green-400" />
        <StatCard label="已封鎖" value={stats?.blockedCount ?? 0} icon={Ban} color="bg-red-500/20 text-red-400" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋 Email 或名稱..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter || "all"} onValueChange={(v) => { setRoleFilter(v === "all" ? "" : v as any); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
                <SelectItem value="user">普通用戶</SelectItem>
              </SelectContent>
            </Select>
            <Select value={loginMethodFilter || "all"} onValueChange={(v) => { setLoginMethodFilter(v === "all" ? "" : v as any); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="登入方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方式</SelectItem>
                <SelectItem value="password">密碼登入</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="帳號狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="blocked">已封鎖</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={refreshAll} variant="outline" size="icon" className="shrink-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card>
        <CardHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">用戶列表</CardTitle>
            <CardDescription className="text-xs">
              共 {userList?.total ?? 0} 個用戶，第 {page} / {userList?.totalPages ?? 1} 頁
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-xs">ID</TableHead>
                  <TableHead className="text-xs">用戶</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">角色</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">狀態</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">登入方式</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">註冊時間</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">最後登入</TableHead>
                  <TableHead className="text-xs text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <div className="h-8 bg-muted rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : userList?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">沒有找到符合條件的用戶</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  userList?.users.map((user: any) => (
                    <TableRow key={user.id} className={user.isBlocked ? "opacity-60" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{user.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                              {(user.name || user.email)?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user.name || "（未設定）"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge isBlocked={user.isBlocked} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {user.loginMethod === "password" ? "密碼" : "Google"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("zh-HK")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(user.lastSignedIn).toLocaleDateString("zh-HK")}
                      </TableCell>
                      <TableCell>
                        {/* Desktop: icon buttons */}
                        <div className="hidden sm:flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="查看詳情" onClick={() => setViewingUserId(user.id)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="編輯" onClick={() => setEditingUser(user)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {user.loginMethod === "password" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="重置密碼" onClick={() => setResetPasswordUserId(user.id)}>
                              <Key className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {user.isBlocked ? (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-500 hover:text-green-600" title="解除封鎖" onClick={() => setUnblockingUserId(user.id)}>
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600" title="封鎖帳號" onClick={() => setBlockingUserId(user.id)}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="刪除用戶" onClick={() => setDeletingUserId(user.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {/* Mobile: dropdown menu */}
                        <div className="flex sm:hidden items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setViewingUserId(user.id)}>
                                <Eye className="w-3.5 h-3.5 mr-2" />查看詳情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingUser(user)}>
                                <Edit className="w-3.5 h-3.5 mr-2" />編輯
                              </DropdownMenuItem>
                              {user.loginMethod === "password" && (
                                <DropdownMenuItem onClick={() => setResetPasswordUserId(user.id)}>
                                  <Key className="w-3.5 h-3.5 mr-2" />重置密碼
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {user.isBlocked ? (
                                <DropdownMenuItem className="text-green-600" onClick={() => setUnblockingUserId(user.id)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-2" />解除封鎖
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-orange-600" onClick={() => setBlockingUserId(user.id)}>
                                  <Ban className="w-3.5 h-3.5 mr-2" />封鎖帳號
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingUserId(user.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" />刪除用戶
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {userList && userList.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">第 {page} / {userList.totalPages} 頁</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setPage(Math.min(userList.totalPages, page + 1))} disabled={page === userList.totalPages}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserDetailDialog
        userId={viewingUserId}
        onClose={() => setViewingUserId(null)}
        onBlock={(id) => { setViewingUserId(null); setBlockingUserId(id); }}
        onUnblock={(id) => unblockMutation.mutate({ userId: id })}
        onChangeRole={(id, role) => setRoleChangeTarget({ userId: id, role })}
      />

      <BlockDialog
        userId={blockingUserId}
        onConfirm={(reason) => blockingUserId && blockMutation.mutate({ userId: blockingUserId, reason: reason || undefined })}
        onClose={() => setBlockingUserId(null)}
      />

      <AlertDialog open={!!unblockingUserId} onOpenChange={(open) => !open && setUnblockingUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle className="w-5 h-5" /> 解除封鎖
            </AlertDialogTitle>
            <AlertDialogDescription>確定要解除此用戶的封鎖嗎？解封後用戶可以正常登入平台。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => unblockingUserId && unblockMutation.mutate({ userId: unblockingUserId })} className="bg-green-600 hover:bg-green-700">
              確認解封
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChangeRoleDialog
        userId={roleChangeTarget?.userId ?? null}
        targetRole={roleChangeTarget?.role ?? null}
        onConfirm={() => roleChangeTarget && updateRoleMutation.mutate({ userId: roleChangeTarget.userId, role: roleChangeTarget.role })}
        onClose={() => setRoleChangeTarget(null)}
      />

      <EditUserDialog
        user={editingUser}
        onSave={(name, email) => editingUser && updateUserMutation.mutate({ userId: editingUser.id, name: name || undefined, email })}
        onClose={() => setEditingUser(null)}
      />

      <ResetPasswordDialog
        userId={resetPasswordUserId}
        onSave={(pw) => {
          if (pw.length < 8) { toast.error("密碼長度至少 8 個字符"); return; }
          resetPasswordUserId && resetPasswordMutation.mutate({ userId: resetPasswordUserId, newPassword: pw });
        }}
        onClose={() => setResetPasswordUserId(null)}
      />

      <AlertDialog open={!!deletingUserId} onOpenChange={(open) => !open && setDeletingUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> 確認刪除用戶
            </AlertDialogTitle>
            <AlertDialogDescription>此操作無法撤銷。刪除後用戶的所有資料將永久移除。建議使用「封鎖」代替刪除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingUserId && deleteUserMutation.mutate({ userId: deletingUserId })} className="bg-destructive hover:bg-destructive/90">
              {deleteUserMutation.isPending ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


