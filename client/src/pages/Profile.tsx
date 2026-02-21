import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, User, Lock, Link as LinkIcon } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    setLocation('/login');
    return null;
  }

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('個人資料已更新');
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success('密碼已更新');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(`密碼更新失敗：${error.message}`);
    },
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileMutation.mutateAsync({ name });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('新密碼不一致');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('密碼至少需要 8 個字符');
      return;
    }

    await changePasswordMutation.mutateAsync({
      currentPassword,
      newPassword,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">個人資料</h1>
          <p className="text-white/70">管理您的帳號設定</p>
        </div>

        <div className="mb-6 flex justify-center">
          <Avatar className="w-24 h-24">
            <AvatarFallback className="bg-[#ffed00] text-[#06038d] text-3xl font-bold">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              基本資料
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="w-4 h-4 mr-2" />
              密碼
            </TabsTrigger>
            <TabsTrigger value="connections">
              <LinkIcon className="w-4 h-4 mr-2" />
              連結帳號
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>基本資料</CardTitle>
                <CardDescription>更新您的個人資訊</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">電郵地址</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-gray-500">電郵地址無法修改</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">姓名</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="您的姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="w-full"
                  >
                    {updateProfileMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    保存變更
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>修改密碼</CardTitle>
                <CardDescription>更新您的登入密碼</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">目前密碼</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="輸入目前密碼"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密碼</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="至少 8 個字符"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">確認新密碼</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="再次輸入新密碼"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className="w-full"
                  >
                    {changePasswordMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    更新密碼
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections">
            <Card>
              <CardHeader>
                <CardTitle>連結帳號</CardTitle>
                <CardDescription>管理您的 OAuth 連結</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <div>
                      <p className="font-medium">Google</p>
                      <p className="text-sm text-gray-500">連結您的 Google 帳號</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    連結
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <div>
                      <p className="font-medium">Facebook</p>
                      <p className="text-sm text-gray-500">連結您的 Facebook 帳號</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    連結
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 連結 OAuth 帳號後，您可以使用這些帳號快速登入
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
