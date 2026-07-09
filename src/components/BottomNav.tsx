import { countToday } from '../lib/views'
import { useTaskStore } from '../store/taskStore'
import type { ViewSelection } from '../types/task'
import {
  CalendarCheckIcon,
  CalendarIcon,
  ListIcon,
  DotsIcon,
} from './icons'

type BottomNavProps = {
  selection: ViewSelection
  onSelect: (selection: ViewSelection) => void
}

const TABS = [
  {
    key: 'today',
    label: 'Hoje',
    icon: CalendarCheckIcon,
    selection: { kind: 'smart', view: 'today' } as ViewSelection,
  },
  {
    key: 'scheduled',
    label: 'Agendadas',
    icon: CalendarIcon,
    selection: { kind: 'smart', view: 'scheduled' } as ViewSelection,
  },
  {
    key: 'all',
    label: 'Todas',
    icon: ListIcon,
    selection: { kind: 'smart', view: 'all' } as ViewSelection,
  },
  {
    key: 'lists',
    label: 'Listas',
    icon: DotsIcon,
    selection: { kind: 'lists-index' } as ViewSelection,
  },
] as const

function isTabActive(tab: (typeof TABS)[number], selection: ViewSelection): boolean {
  if (tab.selection.kind === 'smart') {
    return selection.kind === 'smart' && selection.view === tab.selection.view
  }
  // Aba "Listas" cobre o índice, listas individuais e Concluídas.
  return (
    selection.kind === 'lists-index' ||
    selection.kind === 'list' ||
    (selection.kind === 'smart' && selection.view === 'done')
  )
}

export function BottomNav({ selection, onSelect }: BottomNavProps) {
  const tasks = useTaskStore((state) => state.tasks)
  const todayCount = countToday(tasks)

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = isTabActive(tab, selection)
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.selection)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 px-2 pt-2 pb-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <span className="relative">
                <TabIcon className="size-5.5" />
                {tab.key === 'today' && todayCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                    {todayCount > 99 ? '99+' : todayCount}
                  </span>
                )}
              </span>
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
