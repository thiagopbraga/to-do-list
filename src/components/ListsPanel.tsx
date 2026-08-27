import { LIST_COLOR_DOT } from '../lib/labels'
import { countByList } from '../lib/views'
import { useTaskStore } from '../store/taskStore'
import type { TaskList, ViewSelection } from '../types/task'
import {
  ChevronRightIcon,
  CircleCheckIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
} from './icons'

type ListsPanelProps = {
  onSelect: (selection: ViewSelection) => void
  onNewList: () => void
  onEditList: (list: TaskList) => void
  onExport: () => void
  onImport: () => void
}

/** Índice de listas usado na aba "Listas" do mobile. */
export function ListsPanel({
  onSelect,
  onNewList,
  onEditList,
  onExport,
  onImport,
}: ListsPanelProps) {
  const lists = useTaskStore((state) => state.lists)
  const tasks = useTaskStore((state) => state.tasks)
  const doneCount = tasks.filter((task) => task.done).length

  return (
    <div className="space-y-5">
      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {lists.map((list) => (
          <li
            key={list.id}
            className="border-b border-slate-100 last:border-b-0 dark:border-slate-700/60"
          >
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect({ kind: 'list', listId: list.id })}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/40"
              >
                <span
                  className={`size-3 shrink-0 rounded-full ${LIST_COLOR_DOT[list.color]}`}
                />
                <span className="min-w-0 flex-1 truncate">{list.name}</span>
                <span className="text-sm text-slate-400">
                  {countByList(tasks, list.id) || ''}
                </span>
                <ChevronRightIcon className="size-4 text-slate-300 dark:text-slate-600" />
              </button>
              <button
                type="button"
                onClick={() => onEditList(list)}
                aria-label={`Editar lista ${list.name}`}
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <PencilIcon className="size-4" />
              </button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onNewList}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <PlusIcon className="size-4" />
            Nova lista
          </button>
        </li>
      </ul>

      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <li className="border-b border-slate-100 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => onSelect({ kind: 'smart', view: 'done' })}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/40"
          >
            <CircleCheckIcon className="size-4.5 text-green-600 dark:text-green-400" />
            <span className="flex-1">Concluídas</span>
            <span className="text-sm text-slate-400">{doneCount || ''}</span>
            <ChevronRightIcon className="size-4 text-slate-300 dark:text-slate-600" />
          </button>
        </li>
        <li className="border-b border-slate-100 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onExport}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/40"
          >
            <DownloadIcon className="size-4.5 text-slate-400" />
            Exportar backup
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onImport}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/40"
          >
            <UploadIcon className="size-4.5 text-slate-400" />
            Importar backup
          </button>
        </li>
      </ul>
    </div>
  )
}
