import { useAuth } from '../hooks/useAuth'

export default function Settings() {
  const { session, signOut } = useAuth()

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold pt-2">Settings</h1>

      <div className="rounded-2xl bg-ink-soft p-4 space-y-1">
        <p className="text-white/40 text-xs uppercase tracking-widest">Account</p>
        <p>{session?.user.email}</p>
      </div>

      <div className="rounded-2xl bg-ink-soft p-6 text-center text-white/50">
        Accounts and category management land here in M3.
      </div>

      <button
        onClick={signOut}
        className="w-full rounded-xl bg-white/10 py-3 font-bold"
      >
        Sign out
      </button>
    </div>
  )
}
