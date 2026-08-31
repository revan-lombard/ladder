import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

/**
 * Password sign-in only — no signup, no magic links, no reset flow.
 * The two household accounts are created in the Supabase dashboard.
 */
export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    if (error) setError(error)
    setBusy(false)
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-2">
        <div className="text-6xl">🪜</div>
        <h1 className="text-3xl font-bold tracking-tight">LADDER</h1>
        <p className="text-white/50 text-sm">
          Build the life you want. One rung at a time.
        </p>
      </div>

      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <input
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 ring-rung/60"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 ring-rung/60"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-alert text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-rung text-ink font-bold py-3 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
