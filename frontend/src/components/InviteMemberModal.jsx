import { useEffect, useState } from 'react'
import { Loader2, Mail, UserPlus, X } from 'lucide-react'
import { errorMessage } from '../api/axios.js'

export default function InviteMemberModal({ open, boardTitle, onClose, onInvite }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setError('')
    setBusy(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onInvite(email.trim())
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Unable to invite that member'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-edge/80 bg-panel shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-3 border-b border-edge/60 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Invite a member</h2>
            {boardTitle && <p className="truncate text-xs text-muted">{boardTitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted">
            The person must already have an account. They join as a <span className="text-slate-300">member</span>;
            only board admins can invite.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Email
            </span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                className="w-full rounded-lg border border-edge bg-ink/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </label>

          <footer className="flex justify-end gap-2 border-t border-edge/60 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-brand-soft disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Send invite
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
