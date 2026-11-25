import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { errorMessage } from '../api/axios.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(form.email.trim(), form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-ink shadow-lg shadow-brand/30">
            K
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your Kanban workspace.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-edge/70 bg-panel/80 p-6 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          No account?{' '}
          <Link to="/register" className="font-medium text-brand hover:text-brand-soft">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
