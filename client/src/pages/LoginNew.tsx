import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const LoginNew = () => {
  const { signInWithProvider, signInWithEmail, signUpWithEmail } = useAuth()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (tab === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message ?? '登入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 shadow-xl border border-zinc-800">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-white">BOXIUM PTCG</div>
          <div className="text-zinc-400 mt-1 text-sm">使用 Manus 風格的快速登入體驗</div>
        </div>

        {/* OAuth 按鈕 */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => signInWithProvider('google')}
            className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 rounded-xl font-medium hover:bg-zinc-100 transition"
          >
            <span>以 Google 登入</span>
          </button>
          <button
            onClick={() => signInWithProvider('apple')}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-white py-2.5 rounded-xl font-medium hover:bg-zinc-700 transition"
          >
            <span>以 Apple 登入</span>
          </button>
          <button
            onClick={() => signInWithProvider('facebook')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-500 transition"
          >
            <span>以 Facebook 登入</span>
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 h-px bg-zinc-700" />
          <span className="px-3 text-xs text-zinc-500">或 使用 Email</span>
          <div className="flex-1 h-px bg-zinc-700" />
        </div>

        {/* Email 登入/註冊切換 */}
        <div className="flex mb-4 text-sm">
          <button
            className={`flex-1 py-2 rounded-xl ${
              tab === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
            onClick={() => setTab('login')}
          >
            登入
          </button>
          <button
            className={`flex-1 py-2 rounded-xl ${
              tab === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
            }`}
            onClick={() => setTab('signup')}
          >
            註冊
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="密碼"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-black font-semibold py-2.5 rounded-xl mt-1 transition"
          >
            {tab === 'login' ? '登入' : '建立帳戶'}
          </button>
        </form>
      </div>
    </div>
  )
}
