import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const useAdmin = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        console.log('[useAdmin] Checking admin status...')
        
        // 先檢查 session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[useAdmin] Session check:', {
          hasSession: !!session,
          user: session?.user?.email,
          error: sessionError?.message,
        })

        // 獲取 Supabase Auth 用戶
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        console.log('[useAdmin] User check:', {
          hasUser: !!authUser,
          email: authUser?.email,
          error: authError?.message,
        })
        
        if (authError || !authUser) {
          console.warn('[useAdmin] No authenticated user found')
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // 直接使用 Supabase Auth 用戶數據
        // 管理員判斷：檢查 email 是否為管理員郵箱
        const adminEmails = ['xyz.asia.co@gmail.com']
        const isAdminUser = adminEmails.includes(authUser.email || '')

        console.log('[useAdmin] Admin check result:', {
          email: authUser.email,
          isAdmin: isAdminUser,
        })

        setUser({
          id: authUser.id,
          email: authUser.email,
          user_metadata: authUser.user_metadata,
          app_metadata: authUser.app_metadata,
        })
        setIsAdmin(isAdminUser)
      } catch (error) {
        console.error('[useAdmin] Error checking admin status:', error)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()

    // 監聽認證狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useAdmin] Auth state changed:', {
        event,
        user: session?.user?.email,
        hasSession: !!session,
      })
      
      // 只在特定事件時重新檢查
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        console.log('[useAdmin] Re-checking admin status due to:', event)
        await checkAdmin()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { isAdmin, loading, user }
}
