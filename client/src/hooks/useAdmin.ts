import { trpc } from '@/lib/trpc'

export const useAdmin = () => {
  const { data: user, isLoading: loading } = trpc.auth.me.useQuery()
  
  const isAdmin = user?.role === 'admin'

  return { isAdmin, loading, user }
}
