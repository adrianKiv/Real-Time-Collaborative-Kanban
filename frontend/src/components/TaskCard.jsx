import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, GripVertical, UserRound } from 'lucide-react'
import { formatDueDate, initials, isOverdue, priorityStyles } from '../utils/helpers.js'

export function PriorityBadge({ priority = 'medium' }) {
  const style = priorityStyles[priority] ?? priorityStyles.medium
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style}`}
    >
      {priority}
    </span>
  )
}

export function Avatar({ user, size = 'sm', title }) {
  const dimension = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  if (!user) {
    return (
      <span
        title={title ?? 'Unassigned'}
        className={`flex ${dimension} items-center justify-center rounded-full border border-dashed border-slate-600 text-slate-400`}
      >
        <UserRound className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span
      title={title ?? user.name}
      className={`flex ${dimension} items-center justify-center rounded-full bg-brand/20 font-semibold text-indigo-200 ring-1 ring-inset ring-brand/30`}
    >
      {initials(user.name)}
    </span>
  )
}

function TaskCardContent({
  task,
  onOpen,
  overlay = false,
  isDragging = false,
  nodeRef,
  style,
  attributes,
  listeners,
}) {
  const due = formatDueDate(task.due_date)
  const late = isOverdue(task.due_date)

  return (
    <article
      ref={nodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!overlay && !isDragging) onOpen?.(task)
      }}
      className={`group cursor-grab touch-none rounded-xl border border-edge/80 bg-panel-2/90 p-3 text-left shadow-sm shadow-black/20 outline-none transition hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 border-brand/60 shadow-xl shadow-black/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-300" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium leading-snug text-slate-100">{task.title}</h4>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{task.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pl-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {due && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                late
                  ? 'bg-rose-500/10 text-rose-300 ring-rose-500/30'
                  : 'bg-slate-500/10 text-slate-300 ring-slate-500/25'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {due}
            </span>
          )}
        </div>
        <Avatar user={task.assignee} />
      </div>
    </article>
  )
}

function SortableTaskCard({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.column_id },
  })

  return (
    <TaskCardContent
      task={task}
      onOpen={onOpen}
      isDragging={isDragging}
      nodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      attributes={attributes}
      listeners={listeners}
    />
  )
}

export default function TaskCard({ task, onOpen, overlay = false }) {
  if (overlay) return <TaskCardContent task={task} overlay />
  return <SortableTaskCard task={task} onOpen={onOpen} />
}
