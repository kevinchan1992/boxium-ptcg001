import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2 } from 'lucide-react'

export const AuthCallback = () => {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 等待 Supabase 處理 OAuth callback
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          window.location.href = '/login-new?error=auth_failed'
          return
        }

        if (!session) {
          console.warn('No session found after OAuth callback')
          window.location.href = '/login-new'
          return
        }

        console.log('Auth callback successful, user:', session.user.email)

        // 檢查 URL 中是否有 redirect 參數
        const params = new URLSearchParams(window.location.search)
        const redirect = params.get('redirect') || '/'

        // 重定向到目標頁面
        window.location.href = redirect
      } catch (err) {
        console.error('Unexpected error in auth callback:', err)
        window.location.href = '/login-new?error=unexpected'
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <div className="text-zinc-300 text-sm">登入處理中，請稍候……</div>
      </div>
    </div>
  )
}
