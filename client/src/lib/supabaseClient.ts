import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 自定義 storage adapter，添加錯誤處理和日誌
const customStorage = {
  getItem: (key: string) => {
    try {
      const value = window.localStorage.getItem(key)
      console.log('[Supabase Storage] getItem:', key, value ? 'found' : 'not found')
      return value
    } catch (error) {
      console.error('[Supabase Storage] getItem error:', error)
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value)
      console.log('[Supabase Storage] setItem:', key, 'success')
    } catch (error) {
      console.error('[Supabase Storage] setItem error:', error)
      // 如果 localStorage 被阻擋，嘗試使用 sessionStorage
      try {
        window.sessionStorage.setItem(key, value)
        console.warn('[Supabase Storage] Fallback to sessionStorage for:', key)
      } catch (fallbackError) {
        console.error('[Supabase Storage] sessionStorage fallback failed:', fallbackError)
      }
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key)
      console.log('[Supabase Storage] removeItem:', key)
    } catch (error) {
      console.error('[Supabase Storage] removeItem error:', error)
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? customStorage : undefined,
    flowType: 'pkce', // 使用 PKCE 流程提高安全性
    debug: true, // 啟用調試模式
  },
})

// 監聽認證狀態變化並記錄日誌
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Supabase Auth] State changed:', {
      event,
      user: session?.user?.email,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    })
  })
}
