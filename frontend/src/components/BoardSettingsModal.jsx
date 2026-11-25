import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { errorMessage } from '../api/axios.js'

export default function BoardSettingsModal({ open, board, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(board?.title ?? '')
    setDescription(board?.description ?? '')
    setError('')
    setBusy(false)
  }, [open, board?.id])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('A board title is required')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onSave({ title: title.trim(), description: description.trim() })
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Unable to update the board'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <section className="relative z-10 w-full max-w-lg rounded-2xl border border-edge/80 bg-panel shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">Edit board</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close board settings"
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
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Title
            </span>
            <input
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Description
            </span>
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-y rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
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
              disabled={busy || !title.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-soft disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
