import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const AuthCallback = () => {
  useEffect(() => {
    const handleCallback = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login-new'
        return
      }

      // 檢查 profile 是否存在
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // 創建 user profile
        await supabase.from('user_profiles').insert({
          id: user.id,
          username: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url || null,
          locale: navigator.language || 'zh-HK',
          region: 'HK',
          favorite_language: 'jp'
        })

        // 建立 identity 資料（如果是 OAuth）
        if (user.app_metadata?.provider && user.user_metadata?.sub) {
          await supabase.from('user_identities').insert({
            user_id: user.id,
            provider: user.app_metadata.provider,
            provider_user_id: user.user_metadata.sub,
            email: user.email
          })
        }
      }

      // 完成後跳回首頁
      window.location.href = '/'
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-zinc-300 text-sm">登入處理中，請稍候……</div>
    </div>
  )
}
