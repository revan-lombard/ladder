export default function SetupNotice() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center gap-4">
      <div className="text-5xl">🪜</div>
      <h1 className="text-2xl font-bold">LADDER isn't connected yet</h1>
      <p className="text-white/60 max-w-md">
        Set <code className="text-rung">VITE_SUPABASE_URL</code> and{' '}
        <code className="text-rung">VITE_SUPABASE_ANON_KEY</code> in{' '}
        <code>.env.local</code> (local) or as repository secrets (deploys),
        then rebuild.
      </p>
    </div>
  )
}
