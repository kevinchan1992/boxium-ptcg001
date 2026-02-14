import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Shield, User as UserIcon, Loader2 } from "lucide-react";

type User = {
  id: number;
  email: string;
  name: string | null;
  role: "admin" | "user";
  createdAt: Date;
  lastSignedIn: Date;
};

export function AdminUserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user" as "admin" | "user" });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.getAllUsers.useQuery();

  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("用戶角色已更新");
      utils.admin.getAllUsers.invalidate();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const updateProfileMutation = trpc.admin.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success("用戶資料已更新");
      utils.admin.getAllUsers.invalidate();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("用戶已刪除");
      utils.admin.getAllUsers.invalidate();
    },
    onError: (error) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email,
      role: user.role,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;

    // Update role if changed
    if (editForm.role !== editingUser.role) {
      updateRoleMutation.mutate({
        userId: editingUser.id,
        role: editForm.role,
      });
    }

    // Update profile if changed
    if (editForm.name !== editingUser.name || editForm.email !== editingUser.email) {
      updateProfileMutation.mutate({
        userId: editingUser.id,
        name: editForm.name || undefined,
        email: editForm.email || undefined,
      });
    }
  };

  const handleDeleteUser = (userId: number, userName: string) => {
    if (confirm(`確定要刪除用戶 "${userName}" 嗎？此操作無法撤銷。`)) {
      deleteUserMutation.mutate({ userId });
    }
  };

  const filteredUsers = users?.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">用戶管理</h2>
        <p className="text-muted-foreground">管理系統中的所有用戶</p>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <Input
            type="text"
            placeholder="搜尋用戶（郵箱或姓名）..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用戶</TableHead>
                  <TableHead>郵箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>註冊時間</TableHead>
                  <TableHead>最後登入</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "未設置"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === "admin" ? (
                            <>
                              <Shield className="w-4 h-4 text-orange-500" />
                              <span className="text-orange-600 font-semibold">管理員</span>
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-4 h-4 text-blue-500" />
                              <span className="text-blue-600">普通用戶</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString('zh-TW')}</TableCell>
                      <TableCell>{new Date(user.lastSignedIn).toLocaleDateString('zh-TW')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      沒有找到用戶
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯用戶</DialogTitle>
            <DialogDescription>修改用戶資料和權限設置</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="輸入姓名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">郵箱</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="輸入郵箱"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: "admin" | "user") => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用戶</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateRoleMutation.isPending || updateProfileMutation.isPending}
            >
              {(updateRoleMutation.isPending || updateProfileMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
