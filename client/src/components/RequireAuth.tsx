import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        載入中…
      </div>
    )
  }

  if (!user) {
    window.location.href = '/login-new'
    return null
  }

  return <>{children}</>
}
