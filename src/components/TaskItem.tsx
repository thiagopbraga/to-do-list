import { formatDueLabel, isOverdue } from '../lib/dates'
import {
  LIST_COLOR_DOT,
  PRIORITY_CHECKBOX_CLASS,
  PRIORITY_FLAG_CLASS,
  RECURRENCE_BADGES,
} from '../lib/labels'
import type { Task, TaskList } from '../types/task'
import { CheckIcon, ClockIcon, FlagIcon, NoteIcon, RepeatIcon } from './icons'

type TaskItemProps = {
  task: Task
  list?: TaskList
  showList?: boolean
  showDue?: boolean
  onToggle: (id: string) => void
  onOpen: (task: Task) => void
}

export function TaskItem({
  task,
  list,
  showList = true,
  showDue = true,
  onToggle,
  onOpen,
}: TaskItemProps) {
  const overdue = isOverdue(task)
  const hasMeta =
    (showDue && task.dueDate) ||
    task.dueTime ||
    task.recurrence !== 'none' ||
    (showList && list) ||
    task.priority !== 'none' ||
    task.notes

  return (
    <li
      data-testid="task-item"
      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.done
            ? 'border-green-500 bg-green-500 text-white'
            : `${PRIORITY_CHECKBOX_CLASS[task.priority]} text-transparent hover:text-slate-300 dark:hover:text-slate-500`
        }`}
      >
        <CheckIcon className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`truncate text-[15px] leading-6 ${
            task.done
              ? 'text-slate-400 line-through dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {task.title || 'Sem título'}
        </p>

        {hasMeta && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {showDue && task.dueDate && (
              <span
                className={
                  overdue
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {formatDueLabel(task.dueDate)}
              </span>
            )}
            {task.dueTime && (
              <span
                className={`inline-flex items-center gap-1 ${
                  overdue
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ClockIcon className="size-3" />
                {task.dueTime}
              </span>
            )}
            {task.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <RepeatIcon className="size-3" />
                {RECURRENCE_BADGES[task.recurrence]}
              </span>
            )}
            {task.priority !== 'none' && (
              <FlagIcon
                className={`size-3 ${PRIORITY_FLAG_CLASS[task.priority]}`}
              />
            )}
            {task.notes && (
              <NoteIcon className="size-3 text-slate-400 dark:text-slate-500" />
            )}
            {showList && list && (
              <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                <span
                  className={`size-1.5 rounded-full ${LIST_COLOR_DOT[list.color]}`}
                />
                {list.name}
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  )
}
