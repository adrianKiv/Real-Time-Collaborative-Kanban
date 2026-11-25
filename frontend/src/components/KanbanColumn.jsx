import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import TaskCard from './TaskCard.jsx'

// Droppable ids must be distinguishable from task ids (numbers).
export const columnDropId = (columnId) => `col-${columnId}`
export const isColumnDropId = (id) => typeof id === 'string' && id.startsWith('col-')

export default function KanbanColumn({ column, onAddTask, onOpenTask }) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDropId(column.id),
    data: { columnId: column.id },
  })

  return (
    <section className="flex h-full max-h-full w-[19rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-edge/60 bg-panel/60 sm:w-[20rem]">
      <header className="flex items-center justify-between gap-2 border-b border-edge/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold tracking-tight text-slate-200">
            {column.title}
          </h3>
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted">
            {column.tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddTask(column)}
          title="Add task"
          className="rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-brand"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-3 transition ${
          isOver ? 'bg-brand/5 ring-1 ring-inset ring-brand/30' : ''
        }`}
      >
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
