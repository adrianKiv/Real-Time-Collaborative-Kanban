// Fractional indexing: a task's order value lives between its neighbours.
export function positionBetween(prev, next) {
  if (prev == null && next == null) return 1000
  if (prev == null) return next - 1000
  if (next == null) return prev + 1000
  return (prev + next) / 2
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatDueDate(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function isOverdue(iso) {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() < Date.now() && date.toDateString() !== new Date().toDateString()
}

export const PRIORITIES = ['low', 'medium', 'high']

export const priorityStyles = {
  low: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  high: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
}
