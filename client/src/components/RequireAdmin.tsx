import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAdmin } from '@/hooks/useAdmin'
import { Loader2 } from 'lucide-react'

interface RequireAdminProps {
  children: React.ReactNode
}

export const RequireAdmin = ({ children }: RequireAdminProps) => {
  const [, setLocation] = useLocation()
  const { isAdmin, loading } = useAdmin()

  useEffect(() => {
    if (!loading && !isAdmin) {
      setLocation('/')
    }
  }, [isAdmin, loading, setLocation])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
