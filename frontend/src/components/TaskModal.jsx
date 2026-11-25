import { useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { PRIORITIES, priorityStyles } from '../utils/helpers.js'
import { errorMessage } from '../api/axios.js'

// yyyy-mm-dd for <input type="date">, from the API's RFC3339 timestamp.
function toDateInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

// The API treats a zero timestamp as "clear the due date".
const ZERO_TIME = '0001-01-01T00:00:00Z'

export default function TaskModal({ open, task, columnTitle, members, onClose, onSave, onDelete }) {
  const isEdit = Boolean(task)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigneeId: '',
    dueDate: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const submitLock = useRef(false)

  // Reset the form whenever the modal opens for a different task.
  useEffect(() => {
    if (!open) return
    setForm({
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      assigneeId: task?.assignee_id ?? '',
      dueDate: toDateInput(task?.due_date),
    })
    setError('')
    setBusy(false)
    setConfirmDelete(false)
    submitLock.current = false
  }, [open, task])

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
    if (submitLock.current) return
    if (!form.title.trim()) {
      setError('A title is required')
      return
    }
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
      }
      if (isEdit) {
        // Pointer DTO: 0 / zero-time are the documented "clear" sentinels.
        payload.assignee_id = form.assigneeId ? Number(form.assigneeId) : 0
        payload.due_date = form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : ZERO_TIME
      } else {
        if (form.assigneeId) payload.assignee_id = Number(form.assigneeId)
        if (form.dueDate) payload.due_date = new Date(`${form.dueDate}T12:00:00`).toISOString()
      }
      await onSave(payload, task)
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Unable to save the task'))
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onDelete(task)
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Unable to delete the task'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-edge/80 bg-panel shadow-2xl shadow-black/60 sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-edge/60 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">
              {isEdit ? 'Edit task' : 'New task'}
            </h2>
            {columnTitle && <p className="truncate text-xs text-muted">in {columnTitle}</p>}
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

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Title
            </span>
            <input
              autoFocus
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Description
            </span>
            <textarea
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Add more detail…"
              className="w-full resize-y rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                Priority
              </span>
              <div className="flex gap-1.5">
                {PRIORITIES.map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, priority }))}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition ${
                      form.priority === priority
                        ? `border-transparent ring-1 ring-inset ${priorityStyles[priority]}`
                        : 'border-edge text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                Assignee
              </span>
              <select
                value={form.assigneeId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assigneeId: event.target.value }))
                }
                className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user?.name ?? `User #${member.user_id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Due date
            </span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 [color-scheme:dark]"
            />
          </label>

          <footer className="flex items-center justify-between gap-3 border-t border-edge/60 pt-4">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  confirmDelete
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-200'
                    : 'border-edge text-slate-400 hover:border-rose-500/40 hover:text-rose-300'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
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
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-soft disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}
