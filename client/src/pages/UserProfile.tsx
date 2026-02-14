import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Mail, Calendar, Heart, Lock } from "lucide-react";
import { toast } from "sonner";

export default function UserProfile() {
  const [, setLocation] = useLocation();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Get current user
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Get favorites count
  const { data: favoritesData } = trpc.favorites.list.useQuery(undefined, {
    enabled: !!user,
  });

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Update profile mutation
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("個人資料已更新");
      setIsEditingProfile(false);
      trpc.useUtils().auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "更新失敗");
    },
  });

  // Change password mutation
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("密碼已更新");
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "密碼更新失敗");
    },
  });

  // Initialize profile data when user loads
  useState(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("新密碼與確認密碼不符");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("密碼長度至少 6 個字符");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">
              請先登入以查看個人資料
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
            >
              前往登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">個人資料</h1>
          <p className="text-muted-foreground mt-2">
            管理您的帳號設定和個人信息
          </p>
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditingProfile ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      用戶名
                    </label>
                    <p className="text-foreground mt-1">{user.username || "未設置"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      姓名
                    </label>
                    <p className="text-foreground mt-1">{user.name || "未設置"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      電子郵件
                    </label>
                    <p className="text-foreground mt-1">{user.email || "未設置"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      註冊時間
                    </label>
                    <p className="text-foreground mt-1">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-TW") : "未知"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  variant="outline"
                >
                  編輯資料
                </Button>
              </>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    姓名
                  </label>
                  <Input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder="輸入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    電子郵件
                  </label>
                  <Input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="輸入電子郵件"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "保存"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingProfile(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Favorites Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              收藏統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {favoritesData?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">收藏卡牌</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {user.loginMethod === "local" ? "本地" : "OAuth"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">登入方式</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <Button
                  onClick={() => setLocation("/favorites")}
                  variant="outline"
                  className="w-full"
                >
                  查看收藏
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card (only for local auth users) */}
        {user.loginMethod === "local" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                更改密碼
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <Button
                  onClick={() => setIsChangingPassword(true)}
                  variant="outline"
                >
                  更改密碼
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      當前密碼
                    </label>
                    <Input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      required
                      placeholder="輸入當前密碼"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      新密碼
                    </label>
                    <Input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      required
                      placeholder="輸入新密碼（至少 6 個字符）"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      確認新密碼
                    </label>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      required
                      placeholder="再次輸入新密碼"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          更新中...
                        </>
                      ) : (
                        "更新密碼"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
