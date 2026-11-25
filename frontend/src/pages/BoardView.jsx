import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  SortableContext,
} from '@dnd-kit/sortable'
import { ArrowLeft, GripVertical, Loader2, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import api, { errorMessage } from '../api/axios.js'
import { useAuth } from '../context/AuthContext.jsx'
import BoardSettingsModal from '../components/BoardSettingsModal.jsx'
import KanbanColumn, {
  columnSortableId,
  isColumnDropId,
  isColumnSortableId,
} from '../components/KanbanColumn.jsx'
import TaskCard, { Avatar } from '../components/TaskCard.jsx'
import TaskModal from '../components/TaskModal.jsx'
import InviteMemberModal from '../components/InviteMemberModal.jsx'
import { positionBetween } from '../utils/helpers.js'
import useBoardWebSocket from '../hooks/useBoardWebSocket.js'

const byPosition = (a, b) => a.position - b.position

function boardCollisionDetection(args) {
  if (args.active.data.current?.type === 'column') {
    const columnContainers = args.droppableContainers.filter((container) =>
      isColumnSortableId(container.id),
    )
    return closestCorners({ ...args, droppableContainers: columnContainers })
  }
  return closestCorners(args)
}

function normalizeColumns(columns = []) {
  return [...columns]
    .sort(byPosition)
    .map((column) => ({ ...column, tasks: [...(column.tasks ?? [])].sort(byPosition) }))
}

function replaceTask(columns, saved) {
  return columns.map((column) => {
    const hasTask = column.tasks.some((task) => task.id === saved.id)
    if (column.id !== saved.column_id) {
      return hasTask ? { ...column, tasks: column.tasks.filter((task) => task.id !== saved.id) } : column
    }
    const others = column.tasks.filter((task) => task.id !== saved.id)
    return { ...column, tasks: [...others, saved].sort(byPosition) }
  })
}

export default function BoardView() {
  const { boardId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [board, setBoard] = useState(null)
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [activeColumnId, setActiveColumnId] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false)
  const [deletingBoard, setDeletingBoard] = useState(false)
  const [taskModal, setTaskModal] = useState({ open: false, task: null, columnId: null, columnTitle: '' })
  const [newColumn, setNewColumn] = useState({ open: false, title: '', busy: false })
  const previouslyConnected = useRef(false)
  const boardScrollerRef = useRef(null)
  const boardContentRef = useRef(null)
  const bottomScrollerRef = useRef(null)
  const [scrollMetrics, setScrollMetrics] = useState({ content: 0, viewport: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const loadBoard = useCallback(async () => {
    try {
      const { data } = await api.get(`/boards/${boardId}`)
      const next = data.data.board
      setBoard(next)
      setColumns(normalizeColumns(next.columns))
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'Unable to load this board'))
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    setLoading(true)
    loadBoard()
  }, [loadBoard])

  const handleBoardEvent = useCallback(({ event, payload }) => {
    if (!payload) return

    switch (event) {
      case 'BOARD_UPDATED':
        setBoard((previous) =>
          previous ? { ...previous, title: payload.title, description: payload.description } : previous,
        )
        break
      case 'BOARD_DELETED':
        navigate('/', { replace: true })
        break
      case 'TASK_CREATED':
      case 'TASK_UPDATED':
      case 'TASK_MOVED':
        setColumns((previous) => replaceTask(previous, payload))
        break
      case 'TASK_DELETED':
        setColumns((previous) =>
          previous.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.id !== payload.id),
          })),
        )
        break
      case 'COLUMN_CREATED':
        setColumns((previous) => {
          const existing = previous.find((column) => column.id === payload.id)
          const column = {
            ...payload,
            tasks: existing?.tasks ?? payload.tasks ?? [],
          }
          return normalizeColumns([...previous.filter((item) => item.id !== payload.id), column])
        })
        break
      case 'COLUMN_UPDATED':
      case 'COLUMN_MOVED':
        setColumns((previous) =>
          normalizeColumns(
            previous.map((column) =>
              column.id === payload.id ? { ...column, ...payload, tasks: column.tasks } : column,
            ),
          ),
        )
        break
      case 'COLUMN_DELETED':
        setColumns((previous) => previous.filter((column) => column.id !== payload.id))
        break
      case 'MEMBER_ADDED':
        setBoard((previous) => {
          if (!previous) return previous
          const members = previous.members ?? []
          return {
            ...previous,
            members: [
              ...members.filter((member) => member.user_id !== payload.user_id),
              payload,
            ],
          }
        })
        break
      default:
        break
    }
  }, [navigate])

  const activeBoardId =
    !loading && board && String(board.id) === String(boardId) ? boardId : null
  const { isLive } = useBoardWebSocket(activeBoardId, handleBoardEvent)

  useEffect(() => {
    if (!isLive) return
    if (previouslyConnected.current) loadBoard()
    previouslyConnected.current = true
  }, [isLive, loadBoard])

  // A move failure reverts the optimistic card and shows a short-lived banner.
  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(''), 5000)
    return () => clearTimeout(timer)
  }, [banner])

  useEffect(() => {
    const viewport = boardScrollerRef.current
    const content = boardContentRef.current
    if (!viewport || !content) return undefined

    const updateScrollMetrics = () => {
      const next = { content: viewport.scrollWidth, viewport: viewport.clientWidth }
      setScrollMetrics((previous) =>
        previous.content === next.content && previous.viewport === next.viewport ? previous : next,
      )
    }

    const observer = new ResizeObserver(updateScrollMetrics)
    observer.observe(viewport)
    observer.observe(content)
    window.addEventListener('resize', updateScrollMetrics)
    updateScrollMetrics()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScrollMetrics)
    }
  }, [columns.length, newColumn.open])

  function syncBottomScroll() {
    if (boardScrollerRef.current && bottomScrollerRef.current) {
      boardScrollerRef.current.scrollLeft = bottomScrollerRef.current.scrollLeft
    }
  }

  function syncBoardScroll() {
    if (boardScrollerRef.current && bottomScrollerRef.current) {
      bottomScrollerRef.current.scrollLeft = boardScrollerRef.current.scrollLeft
    }
  }

  const activeTask = useMemo(() => {
    if (activeId == null) return null
    for (const column of columns) {
      const found = column.tasks.find((task) => task.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, columns])
  const activeColumn = useMemo(
    () => columns.find((column) => column.id === activeColumnId) ?? null,
    [activeColumnId, columns],
  )

  const isAdmin = board?.members?.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  )

  // ---- drag & drop -------------------------------------------------------

  async function handleColumnDragEnd({ active, over }) {
    setActiveColumnId(null)
    if (!over || active.id === over.id) return

    const sourceId = Number(active.data.current?.columnId)
    const targetId = Number(over.data.current?.columnId ?? String(over.id).replace('column-', ''))
    const fromIndex = columns.findIndex((column) => column.id === sourceId)
    const toIndex = columns.findIndex((column) => column.id === targetId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const snapshot = columns
    const reordered = arrayMove(columns, fromIndex, toIndex)
    const moved = reordered[toIndex]
    const newPosition = positionBetween(
      toIndex > 0 ? reordered[toIndex - 1].position : null,
      toIndex < reordered.length - 1 ? reordered[toIndex + 1].position : null,
    )
    setColumns(
      normalizeColumns(
        reordered.map((column) =>
          column.id === moved.id ? { ...column, position: newPosition } : column,
        ),
      ),
    )

    try {
      const { data } = await api.patch(`/columns/${moved.id}/move`, {
        new_position: newPosition,
      })
      const saved = data.data.column
      setColumns((previous) =>
        normalizeColumns(
          previous.map((column) =>
            column.id === saved.id ? { ...column, ...saved, tasks: column.tasks } : column,
          ),
        ),
      )
    } catch (err) {
      setColumns(snapshot)
      setBanner(errorMessage(err, 'Could not move the column — change reverted'))
    }
  }

  async function handleDragEnd({ active, over }) {
    if (active.data.current?.type === 'column') {
      await handleColumnDragEnd({ active, over })
      return
    }
    setActiveId(null)
    if (!over || active.id === over.id) return

    const taskId = Number(active.id)
    const source = columns.find((column) => column.tasks.some((task) => task.id === taskId))
    if (!source) return
    const task = source.tasks.find((item) => item.id === taskId)

    let targetId
    const overIsColumn =
      isColumnDropId(over.id) ||
      isColumnSortableId(over.id) ||
      over.data.current?.type === 'column'
    if (overIsColumn) {
      targetId = Number(
        over.data.current?.columnId ??
          (isColumnDropId(over.id) ? over.id.slice(4) : String(over.id).replace('column-', '')),
      )
    } else {
      const overColumn = columns.find((column) =>
        column.tasks.some((item) => item.id === Number(over.id)),
      )
      if (!overColumn) return
      targetId = overColumn.id
    }
    const target = columns.find((column) => column.id === targetId)
    if (!target) return

    // Neighbours are taken from the target column without the dragged card.
    const remaining = target.tasks.filter((item) => item.id !== taskId)
    let insertAt
    if (overIsColumn) {
      insertAt = remaining.length
    } else {
      const overIndex = remaining.findIndex((item) => item.id === Number(over.id))
      insertAt = overIndex === -1 ? remaining.length : overIndex
      if (source.id === target.id) {
        const fromIndex = target.tasks.findIndex((item) => item.id === taskId)
        const hoverIndex = target.tasks.findIndex((item) => item.id === Number(over.id))
        if (hoverIndex > fromIndex) insertAt = overIndex + 1
      }
    }

    // Fractional indexing: slip the card between its two new neighbours.
    const newPosition = positionBetween(
      insertAt > 0 ? remaining[insertAt - 1].position : null,
      insertAt < remaining.length ? remaining[insertAt].position : null,
    )
    const ordered = [
      ...remaining.slice(0, insertAt),
      { ...task, column_id: target.id, position: newPosition },
      ...remaining.slice(insertAt),
    ].sort(byPosition)

    // Dropping a card back onto its own slot must not hit the API.
    if (
      source.id === target.id &&
      target.tasks.map((item) => item.id).join() === ordered.map((item) => item.id).join()
    ) {
      return
    }

    const snapshot = columns
    setColumns((prev) =>
      prev.map((column) => {
        if (column.id === source.id && source.id === target.id) {
          return { ...column, tasks: ordered }
        }
        if (column.id === source.id) {
          return { ...column, tasks: column.tasks.filter((item) => item.id !== taskId) }
        }
        if (column.id === target.id) {
          return { ...column, tasks: ordered }
        }
        return column
      }),
    )

    try {
      const { data } = await api.patch(`/tasks/${taskId}/move`, {
        to_column_id: target.id,
        new_position: newPosition,
      })
      setColumns((prev) => replaceTask(prev, data.data.task))
    } catch (err) {
      setColumns(snapshot)
      setBanner(errorMessage(err, 'Could not move the task — change reverted'))
    }
  }

  // ---- task & column mutations ------------------------------------------

  async function saveTask(payload, task) {
    if (task) {
      const { data } = await api.put(`/tasks/${task.id}`, payload)
      setColumns((prev) => replaceTask(prev, data.data.task))
      return
    }
    const { data } = await api.post(`/columns/${taskModal.columnId}/tasks`, payload)
    const saved = data.data.task
    setColumns((prev) => replaceTask(prev, saved))
  }

  async function deleteTask(task) {
    await api.delete(`/tasks/${task.id}`)
    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        tasks: column.tasks.filter((item) => item.id !== task.id),
      })),
    )
  }

  async function createColumn(event) {
    event.preventDefault()
    const title = newColumn.title.trim()
    if (!title) return
    setNewColumn((prev) => ({ ...prev, busy: true }))
    try {
      const { data } = await api.post(`/boards/${boardId}/columns`, { title })
      const created = data.data.column
      setColumns((prev) =>
        normalizeColumns([
          ...prev.filter((column) => column.id !== created.id),
          { ...created, tasks: created.tasks ?? [] },
        ]),
      )
      setNewColumn({ open: false, title: '', busy: false })
    } catch (err) {
      setBanner(errorMessage(err, 'Unable to add the column'))
      setNewColumn((prev) => ({ ...prev, busy: false }))
    }
  }

  async function updateColumn(column, title) {
    const { data } = await api.put(`/columns/${column.id}`, { title })
    const saved = data.data.column
    setColumns((previous) =>
      previous.map((item) =>
        item.id === saved.id ? { ...item, ...saved, tasks: item.tasks } : item,
      ),
    )
  }

  async function deleteColumn(column) {
    const confirmed = window.confirm(
      `Delete "${column.title}" and all of its tasks? This cannot be undone.`,
    )
    if (!confirmed) return

    try {
      await api.delete(`/columns/${column.id}`)
      setColumns((previous) => previous.filter((item) => item.id !== column.id))
    } catch (err) {
      setBanner(errorMessage(err, 'Unable to delete the column'))
    }
  }

  async function saveBoard(payload) {
    const { data } = await api.put(`/boards/${boardId}`, payload)
    setBoard(data.data.board)
  }

  async function deleteBoard() {
    const confirmed = window.confirm(
      `Delete "${board.title}" and all of its columns and tasks? This cannot be undone.`,
    )
    if (!confirmed) return

    setDeletingBoard(true)
    try {
      await api.delete(`/boards/${boardId}`)
      navigate('/', { replace: true })
    } catch (err) {
      setBanner(errorMessage(err, 'Unable to delete the board'))
      setDeletingBoard(false)
    }
  }

  async function inviteMember(email) {
    const { data } = await api.post(`/boards/${boardId}/members`, { email })
    const member = data.data.member
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            members: [
              ...(prev.members ?? []).filter((item) => item.user_id !== member.user_id),
              member,
            ],
          }
        : prev,
    )
  }

  // ---- render ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading board…
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-rose-300">{error || 'Board not found'}</p>
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to boards
        </Link>
      </div>
    )
  }

  const members = board.members ?? []

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-edge/60 bg-ink/85 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="rounded-lg border border-edge/70 p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
              title="Back to boards"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-slate-100">
                {board.title}
              </h1>
              {board.description && (
                <p className="truncate text-xs text-muted">{board.description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${
                isLive
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-edge/70 bg-panel/60 text-slate-400'
              }`}
              role="status"
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-slate-500'
                }`}
              />
              {isLive ? 'Live' : 'Reconnecting'}
            </span>
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((member) => (
                <span key={member.user_id} className="rounded-full ring-2 ring-ink">
                  <Avatar
                    user={member.user}
                    size="md"
                    title={`${member.user?.name ?? 'Member'} · ${member.role}`}
                  />
                </span>
              ))}
              {members.length > 5 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-2 text-[10px] font-semibold text-slate-300 ring-2 ring-ink">
                  +{members.length - 5}
                </span>
              )}
            </div>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setBoardSettingsOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand/50 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Board
                </button>
                <button
                  type="button"
                  onClick={deleteBoard}
                  disabled={deletingBoard}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
                >
                  {deletingBoard ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete Board
                </button>
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand/50 hover:text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite Member
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollisionDetection}
          onDragStart={({ active }) => {
            if (active.data.current?.type === 'column') {
              setActiveColumnId(Number(active.data.current.columnId))
              setActiveId(null)
            } else {
              setActiveColumnId(null)
              setActiveId(Number(active.id))
            }
          }}
          onDragCancel={() => {
            setActiveId(null)
            setActiveColumnId(null)
          }}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={boardScrollerRef}
            onScroll={syncBoardScroll}
            className="scrollbar-hidden min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div
              ref={boardContentRef}
              className="flex h-full w-max min-w-full items-stretch gap-4 px-4 py-5 sm:px-6"
            >
              <SortableContext
                items={columns.map((column) => columnSortableId(column.id))}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    onAddTask={(target) =>
                      setTaskModal({
                        open: true,
                        task: null,
                        columnId: target.id,
                        columnTitle: target.title,
                      })
                    }
                    onOpenTask={(task) => {
                      const parent = columns.find((item) =>
                        item.tasks.some((entry) => entry.id === task.id),
                      )
                      setTaskModal({
                        open: true,
                        task,
                        columnId: task.column_id,
                        columnTitle: parent?.title ?? '',
                      })
                    }}
                    onUpdateColumn={updateColumn}
                    onDeleteColumn={deleteColumn}
                  />
                ))}
              </SortableContext>

              {newColumn.open ? (
                <form
                  onSubmit={createColumn}
                  className="w-[19rem] shrink-0 rounded-2xl border border-brand/40 bg-panel/70 p-3 sm:w-[20rem]"
                >
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-medium text-slate-300">New column</span>
                    <button
                      type="button"
                      onClick={() => setNewColumn({ open: false, title: '', busy: false })}
                      className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    autoFocus
                    maxLength={160}
                    value={newColumn.title}
                    onChange={(event) =>
                      setNewColumn((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Column title"
                    className="w-full rounded-lg border border-edge bg-ink/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                  <button
                    type="submit"
                    disabled={newColumn.busy || !newColumn.title.trim()}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-soft disabled:opacity-50"
                  >
                    {newColumn.busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Add column
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setNewColumn({ open: true, title: '', busy: false })}
                  className="flex w-[19rem] shrink-0 flex-col items-start justify-start gap-2 rounded-2xl border border-dashed border-edge bg-panel/30 p-3 text-xs font-medium text-slate-400 transition hover:border-brand/40 hover:text-slate-100 sm:w-[20rem]"
                >
                  <Plus className="h-4 w-4" /> Add Column
                </button>
              )}
            </div>
          </div>

          <div
            ref={bottomScrollerRef}
            onScroll={syncBottomScroll}
            aria-label="Scroll columns horizontally"
            role="region"
            className={`horizontal-scrollbar h-3 w-full shrink-0 overflow-x-auto overflow-y-hidden ${
              scrollMetrics.content > scrollMetrics.viewport ? '' : 'invisible'
            }`}
          >
            <div style={{ width: `${scrollMetrics.content}px` }} className="h-px" />
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeTask ? (
              <div className="w-[18rem]">
                <TaskCard task={activeTask} overlay />
              </div>
            ) : activeColumn ? (
              <div className="w-[19rem] rounded-2xl border border-brand/50 bg-panel p-4 shadow-2xl shadow-black/50 sm:w-[20rem]">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  {activeColumn.title}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {activeColumn.tasks.length} tasks
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {banner && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-xs text-rose-200 shadow-lg shadow-black/40">
          {banner}
        </div>
      )}

      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        columnTitle={taskModal.columnTitle}
        members={members}
        onClose={() => setTaskModal({ open: false, task: null, columnId: null, columnTitle: '' })}
        onSave={saveTask}
        onDelete={deleteTask}
      />

      <BoardSettingsModal
        open={boardSettingsOpen}
        board={board}
        onClose={() => setBoardSettingsOpen(false)}
        onSave={saveBoard}
      />

      <InviteMemberModal
        open={inviteOpen}
        boardTitle={board.title}
        onClose={() => setInviteOpen(false)}
        onInvite={inviteMember}
      />
    </div>
  )
}
