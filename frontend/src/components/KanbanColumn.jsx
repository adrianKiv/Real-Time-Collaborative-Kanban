import { useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { errorMessage } from '../api/axios.js'
import TaskCard from './TaskCard.jsx'

// Droppable ids must be distinguishable from task ids (numbers).
export const columnDropId = (columnId) => `col-${columnId}`
export const isColumnDropId = (id) => typeof id === 'string' && id.startsWith('col-')
export const columnSortableId = (columnId) => `column-${columnId}`
export const isColumnSortableId = (id) => typeof id === 'string' && id.startsWith('column-')

export default function KanbanColumn({
  column,
  onAddTask,
  onOpenTask,
  onUpdateColumn,
  onDeleteColumn,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(column.title)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnSortableId(column.id),
    data: { type: 'column', columnId: column.id },
  })
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: columnDropId(column.id),
    data: { columnId: column.id },
  })

  useEffect(() => {
    setTitle(column.title)
  }, [column.title])

  async function saveTitle(event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('A column title is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onUpdateColumn(column, title.trim())
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, 'Unable to update the column'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : undefined,
      }}
      className="flex h-full max-h-full w-[19rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-edge/60 bg-panel/60 sm:w-[20rem]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-edge/50 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${column.title} column`}
            className="touch-none rounded p-0.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {editing ? (
            <form onSubmit={saveTitle} className="flex min-w-0 items-center gap-1">
              <input
                autoFocus
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Column title"
                className="min-w-0 w-32 rounded border border-edge bg-ink/70 px-2 py-1 text-xs outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={saving}
                aria-label="Save column title"
                className="rounded p-1 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle(column.title)
                  setEditing(false)
                  setError('')
                }}
                aria-label="Cancel column title edit"
                className="rounded p-1 text-slate-400 hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <h3 className="truncate text-sm font-semibold tracking-tight text-slate-200">
              {column.title}
            </h3>
          )}
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted">
            {column.tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setEditing(true)
                }}
                title="Rename column"
                aria-label={`Rename ${column.title} column`}
                className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteColumn(column)}
                title="Delete column"
                aria-label={`Delete ${column.title} column`}
                className="rounded-md p-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onAddTask(column)}
                title="Add task"
                aria-label={`Add task to ${column.title}`}
                className="rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-brand"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <div
        ref={setDropNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-3 transition ${
          isOver ? 'bg-brand/5 ring-1 ring-inset ring-brand/30' : ''
        }`}
      >
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <p className="m-auto py-6 text-center text-xs text-slate-500">Drop tasks here</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAddTask(column)}
        className="flex items-center gap-1.5 rounded-b-2xl border-t border-edge/50 px-4 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
      >
        <Plus className="h-3.5 w-3.5" /> Add a task
      </button>
    </section>
  )
}
