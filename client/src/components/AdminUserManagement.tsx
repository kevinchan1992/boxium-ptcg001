import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, RefreshCw, UserCog, Edit, Trash2, Key, Shield, User, Mail, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function AdminUserManagement() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"admin" | "user" | undefined>();
  const [loginMethodFilter, setLoginMethodFilter] = useState<"password" | "google" | undefined>();
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Queries
  const { data: userList, isLoading: isLoadingUsers, refetch: refetchUsers } = trpc.admin.getUserList.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    role: roleFilter,
    loginMethod: loginMethodFilter,
  });

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = trpc.admin.getUserStats.useQuery();

  // Mutations
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("用戶角色已更新");
      refetchUsers();
      refetchStats();
    },
    onError: (error: any) => {
      toast.error(`錯誤：${error.message}`);
    },
  });

  const updateUserMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("用戶信息已更新");
      setEditingUser(null);
      refetchUsers();
    },
    onError: (error: any) => {
      toast.error(`錯誤：${error.message}`);
    },
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("用戶已刪除");
      setDeletingUserId(null);
      refetchUsers();
      refetchStats();
    },
    onError: (error: any) => {
      toast.error(`錯誤：${error.message}`);
    },
  });

  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("密碼已重置");
      setResetPasswordUserId(null);
      setNewPassword("");
    },
    onError: (error: any) => {
      toast.error(`錯誤：${error.message}`);
    },
  });

  // Handlers
  const handleRoleToggle = (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (window.confirm(`確定要將此用戶角色改為 ${newRole === "admin" ? "管理員" : "普通用戶"} 嗎？`)) {
      updateRoleMutation.mutate({ userId, role: newRole });
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      userId: editingUser.id,
      name: editName || undefined,
      email: editEmail,
    });
  };

  const handleDeleteUser = (userId: number) => {
    deleteUserMutation.mutate({ userId });
  };

  const handleResetPassword = () => {
    if (!resetPasswordUserId || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error("密碼長度至少 8 個字符");
      return;
    }
    resetPasswordMutation.mutate({ userId: resetPasswordUserId, newPassword });
  };

  const handleRefresh = () => {
    refetchUsers();
    refetchStats();
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardDescription className="text-xs sm:text-sm">總用戶數</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardDescription className="text-xs sm:text-sm">管理員</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{stats?.adminCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardDescription className="text-xs sm:text-sm">普通用戶</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{stats?.userCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardDescription className="text-xs sm:text-sm">密碼登入</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{stats?.passwordCount || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardDescription className="text-xs sm:text-sm">Google 登入</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{stats?.googleCount || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜尋 Email 或名稱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>
            <Select value={roleFilter || "all"} onValueChange={(v) => setRoleFilter(v === "all" ? undefined : v as any)}>
              <SelectTrigger className="w-full sm:w-[150px] text-sm">
                <SelectValue placeholder="角色篩選" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
                <SelectItem value="user">普通用戶</SelectItem>
              </SelectContent>
            </Select>
            <Select value={loginMethodFilter || "all"} onValueChange={(v) => setLoginMethodFilter(v === "all" ? undefined : v as any)}>
              <SelectTrigger className="w-full sm:w-[150px] text-sm">
                <SelectValue placeholder="登入方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方式</SelectItem>
                <SelectItem value="password">密碼登入</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="text-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* User List Table */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-base sm:text-lg">用戶列表</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            共 {userList?.total || 0} 個用戶，第 {page} / {userList?.totalPages || 1} 頁
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">ID</TableHead>
                  <TableHead className="text-xs sm:text-sm">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">名稱</TableHead>
                  <TableHead className="text-xs sm:text-sm">角色</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">登入方式</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">註冊時間</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden lg:table-cell">最後登入</TableHead>
                  <TableHead className="text-xs sm:text-sm">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs sm:text-sm py-8">
                      載入中...
                    </TableCell>
                  </TableRow>
                ) : userList?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs sm:text-sm py-8">
                      沒有找到用戶
                    </TableCell>
                  </TableRow>
                ) : (
                  userList?.users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-xs sm:text-sm">{user.id}</TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{user.name || "-"}</TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className="cursor-pointer text-xs"
                          onClick={() => handleRoleToggle(user.id, user.role)}
                        >
                          {user.role === "admin" ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              管理員
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 mr-1" />
                              用戶
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {user.loginMethod === "password" ? "密碼" : "Google"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatDate(user.lastSignedIn)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          {user.loginMethod === "password" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setResetPasswordUserId(user.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Key className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingUserId(user.id)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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
            <div className="flex justify-center gap-2 p-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="text-xs sm:text-sm"
              >
                上一頁
              </Button>
              <span className="flex items-center px-3 text-xs sm:text-sm">
                {page} / {userList.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(Math.min(userList.totalPages, page + 1))}
                disabled={page === userList.totalPages}
                className="text-xs sm:text-sm"
              >
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">編輯用戶</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">修改用戶的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-xs sm:text-sm">名稱</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="輸入用戶名稱"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="edit-email" className="text-xs sm:text-sm">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="輸入 Email"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} className="text-xs sm:text-sm">
              取消
            </Button>
            <Button onClick={handleSaveUser} disabled={updateUserMutation.isPending} className="text-xs sm:text-sm">
              {updateUserMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => !open && setResetPasswordUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">重置密碼</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">為用戶設置新密碼（至少 8 個字符）</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-password" className="text-xs sm:text-sm">新密碼</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="輸入新密碼"
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUserId(null)} className="text-xs sm:text-sm">
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending} className="text-xs sm:text-sm">
              {resetPasswordMutation.isPending ? "重置中..." : "重置密碼"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deletingUserId} onOpenChange={(open) => !open && setDeletingUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">確認刪除</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              確定要刪除此用戶嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs sm:text-sm">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUserId && handleDeleteUser(deletingUserId)}
              className="bg-red-500 hover:bg-red-600 text-xs sm:text-sm"
            >
              {deleteUserMutation.isPending ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
