import { LIST_COLOR_DOT } from '../lib/labels'
import { SMART_VIEW_META } from '../lib/smartViews'
import { countByList, countToday } from '../lib/views'
import { useTaskStore } from '../store/taskStore'
import type { SmartView, TaskList, ViewSelection } from '../types/task'
import { PencilIcon, PlusIcon } from './icons'

type SidebarProps = {
  selection: ViewSelection
  onSelect: (selection: ViewSelection) => void
  onNewList: () => void
  onEditList: (list: TaskList) => void
}

export function Sidebar({
  selection,
  onSelect,
  onNewList,
  onEditList,
}: SidebarProps) {
  const lists = useTaskStore((state) => state.lists)
  const tasks = useTaskStore((state) => state.tasks)
  const todayCount = countToday(tasks)

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white/60 p-3 md:flex dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-4 flex items-center gap-2 px-2 pt-1">
        <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          ✓
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
          TaskFlow
        </span>
      </div>

      <nav aria-label="Visões" className="space-y-0.5">
        {(Object.keys(SMART_VIEW_META) as SmartView[]).map((view) => {
          const meta = SMART_VIEW_META[view]
          const active = selection.kind === 'smart' && selection.view === view
          const ViewIcon = meta.icon
          return (
            <button
              key={view}
              type="button"
              onClick={() => onSelect({ kind: 'smart', view })}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                active
                  ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
              }`}
            >
              <ViewIcon className="size-4.5" />
              <span className="flex-1 text-left">{meta.label}</span>
              {view === 'today' && todayCount > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  {todayCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-5 mb-1 flex items-center justify-between px-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Listas
        </span>
        <button
          type="button"
          onClick={onNewList}
          aria-label="Nova lista"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      <nav aria-label="Listas" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {lists.map((list) => {
          const active =
            selection.kind === 'list' && selection.listId === list.id
          const count = countByList(tasks, list.id)
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => onSelect({ kind: 'list', listId: list.id })}
              aria-current={active ? 'page' : undefined}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                active
                  ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`size-2.5 shrink-0 rounded-full ${LIST_COLOR_DOT[list.color]}`}
              />
              <span className="flex-1 truncate text-left">{list.name}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Editar lista ${list.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onEditList(list)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation()
                    onEditList(list)
                  }
                }}
                className="hidden rounded p-0.5 text-slate-400 hover:text-slate-600 group-hover:block dark:hover:text-slate-200"
              >
                <PencilIcon className="size-3.5" />
              </span>
              {count > 0 && (
                <span className="text-xs text-slate-400 group-hover:hidden dark:text-slate-500">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
