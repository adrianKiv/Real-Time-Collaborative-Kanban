import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Columns3, Loader2, LogOut, Plus, Users, X } from 'lucide-react'
import api, { errorMessage } from '../api/axios.js'
import { useAuth } from '../context/AuthContext.jsx'
import { initials } from '../utils/helpers.js'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get('/boards')
      .then(({ data }) => {
        if (!cancelled) setBoards(data.data.boards ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Unable to load boards'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/boards', {
        title: form.title.trim(),
        description: form.description.trim(),
      })
      navigate(`/boards/${data.data.board.id}`)
    } catch (err) {
      setError(errorMessage(err, 'Unable to create the board'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-edge/60 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-ink">
              K
            </span>
            <span className="text-sm font-semibold tracking-tight">Kiv Kanban</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-edge/70 bg-panel/60 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-[10px] font-semibold text-brand">
                {initials(user?.name)}
              </span>
              <span className="text-xs text-slate-300">{user?.name}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
              className="flex items-center gap-1.5 rounded-lg border border-edge/70 px-3 py-1.5 text-xs text-muted transition hover:border-rose-500/40 hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your boards</h1>
            <p className="mt-1 text-sm text-muted">
              {boards.length} board{boards.length === 1 ? '' : 's'} you collaborate on
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-brand-soft"
          >
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Cancel' : 'New board'}
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mt-6 grid gap-3 rounded-xl border border-edge/70 bg-panel/70 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
          >
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-300">Title</span>
              <input
                required
                maxLength={160}
                autoFocus
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Thesis sprint"
                className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-300">Description</span>
              <input
                maxLength={2000}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="What is this board for?"
                className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !form.title.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </form>
        )}

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading boards…
          </div>
        ) : boards.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-edge/80 bg-panel/40 p-10 text-center">
            <p className="text-sm font-medium text-slate-200">No boards yet</p>
            <p className="mt-1 text-sm text-muted">
              Create your first board — it comes with To Do, In Progress and Done.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  to={`/boards/${board.id}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-edge/70 bg-panel/70 p-5 transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-panel-2/80 hover:shadow-xl hover:shadow-black/30"
                >
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-slate-100">
                      {board.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                      {board.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1" title="Board members">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {board.member_count ?? board.members?.length ?? 0}{' '}
                        {(board.member_count ?? board.members?.length ?? 0) === 1
                          ? 'member'
                          : 'members'}
                      </span>
                      <span className="flex items-center gap-1" title="Board columns">
                        <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                        {board.column_count ?? board.columns?.length ?? 0}{' '}
                        {(board.column_count ?? board.columns?.length ?? 0) === 1
                          ? 'column'
                          : 'columns'}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
