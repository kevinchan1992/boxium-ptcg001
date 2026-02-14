import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const useAdmin = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // 1. 獲取 Supabase Auth 用戶
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // 2. 從 user_profiles 表中獲取用戶資料
        let { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_id', authUser.id)
          .single()

        // 3. 如果 profile 不存在，自動創建
        if (profileError && profileError.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              auth_id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
              role: authUser.email === 'xyz.asia.co@gmail.com' ? 'admin' : 'user',
            })
            .select()
            .single()

          if (insertError) {
            console.error('Failed to create user profile:', insertError)
            setUser(null)
            setIsAdmin(false)
            setLoading(false)
            return
          }

          profile = newProfile
        } else if (profileError) {
          console.error('Failed to fetch user profile:', profileError)
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // 4. 設置用戶資料和管理員狀態
        setUser({
          id: profile.id,
          auth_id: profile.auth_id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
        })
        setIsAdmin(profile.role === 'admin')
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { isAdmin, loading, user }
}
