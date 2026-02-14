import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const useAdmin = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // 獲取 Supabase Auth 用戶
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // 直接使用 Supabase Auth 用戶數據
        // 管理員判斷：檢查 email 是否為管理員郵箱
        const adminEmails = ['xyz.asia.co@gmail.com']
        const isAdminUser = adminEmails.includes(authUser.email || '')

        setUser({
          id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata,
        })
        setIsAdmin(isAdminUser)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()

    // 監聽認證狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useAdmin] Auth state changed:', event, session?.user?.email)
      
      // 只在特定事件時重新檢查
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        await checkAdmin()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { isAdmin, loading, user }
}
