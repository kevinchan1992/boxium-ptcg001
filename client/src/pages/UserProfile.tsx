import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Mail, Calendar, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function UserProfile() {
  const [, setLocation] = useLocation();
  const { user, loading, signOut } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    username: "",
    avatar_url: "",
  });

  // Load user profile from Supabase
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
      } else {
        setProfile(data);
        setProfileData({
          username: data?.username || '',
          avatar_url: data?.avatar_url || '',
        });
      }
      setProfileLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        username: profileData.username,
        avatar_url: profileData.avatar_url,
      })
      .eq('id', user.id);

    if (error) {
      toast.error('更新失敗：' + error.message);
    } else {
      toast.success('個人資料已更新');
      setIsEditingProfile(false);
      // Reload profile
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('已登出');
    setLocation('/');
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!user) {
    setLocation('/login-new');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-yellow-400 mb-8 text-center">
          個人資料
        </h1>

        <Card className="bg-blue-950/50 border-yellow-400/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <User className="w-5 h-5" />
              基本資料
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400">用戶名</label>
                {isEditingProfile ? (
                  <Input
                    value={profileData.username}
                    onChange={(e) =>
                      setProfileData({ ...profileData, username: e.target.value })
                    }
                    className="bg-blue-900/50 border-yellow-400/30 text-white"
                  />
                ) : (
                  <p className="text-white">{profile?.username || '未設置'}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-zinc-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  電子郵件
                </label>
                <p className="text-white">{user.email}</p>
              </div>

              <div>
                <label className="text-sm text-zinc-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  註冊時間
                </label>
                <p className="text-white">
                  {new Date(user.created_at).toLocaleDateString('zh-TW')}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {isEditingProfile ? (
                <>
                  <Button
                    onClick={handleUpdateProfile}
                    className="bg-yellow-400 hover:bg-yellow-500 text-blue-950"
                  >
                    儲存
                  </Button>
                  <Button
                    onClick={() => setIsEditingProfile(false)}
                    variant="outline"
                    className="border-yellow-400/30 text-yellow-400"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-blue-950"
                >
                  編輯資料
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-400/30 text-red-400 hover:bg-red-400/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            登出
          </Button>
        </div>
      </div>
    </div>
  );
}
