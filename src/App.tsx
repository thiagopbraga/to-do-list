import { useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { Header } from './components/Header'
import { ListFormDialog, type ListDialogMode } from './components/ListFormDialog'
import { ListsPanel } from './components/ListsPanel'
import { QuickAdd } from './components/QuickAdd'
import { Sidebar } from './components/Sidebar'
import { SMART_VIEW_META } from './lib/smartViews'
import { TaskEditor, type EditorMode } from './components/TaskEditor'
import { TaskItem } from './components/TaskItem'
import { downloadBackup, readBackupFile } from './lib/backup'
import { formatDateHeading, todayKey } from './lib/dates'
import {
  filterByQuery,
  selectAllOpen,
  selectByList,
  selectDone,
  selectScheduled,
  selectToday,
} from './lib/views'
import { toAppState, useTaskStore } from './store/taskStore'
import type { Task, TaskList, ViewSelection } from './types/task'
import {
  CalendarCheckIcon,
  CalendarIcon,
  CircleCheckIcon,
  ListIcon,
} from './components/icons'

export default function App() {
  const tasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const toggleTask = useTaskStore((state) => state.toggleTask)
  const replaceState = useTaskStore((state) => state.replaceState)
  const theme = useTaskStore((state) => state.settings.theme)

  const [selection, setSelection] = useState<ViewSelection>({
    kind: 'smart',
    view: 'today',
  })
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const [listDialog, setListDialog] = useState<ListDialogMode | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const listById = new Map(lists.map((list) => [list.id, list]))
  const openTask = (task: Task) => setEditor({ type: 'edit', task })

  const handleExport = () => {
    downloadBackup(toAppState(useTaskStore.getState()))
  }

  const handleImportFile = async (file: File) => {
    const result = await readBackupFile(file)
    if (!result.ok) {
      window.alert(
        result.error === 'invalid-json'
          ? 'Arquivo inválido: não é um JSON válido.'
          : 'Arquivo inválido: não parece um backup do TaskFlow.',
      )
      return
    }
    const confirmed = window.confirm(
      `Importar backup com ${result.state.tasks.length} tarefa(s)? Isso substitui os dados atuais.`,
    )
    if (confirmed) replaceState(result.state)
  }

  const { title, subtitle } = headerMeta(selection, listById, tasks)

  const showQuickAdd =
    selection.kind === 'list' ||
    (selection.kind === 'smart' && selection.view !== 'done')

  const quickAddListId = selection.kind === 'list' ? selection.listId : undefined
  const quickAddDueDate =
    selection.kind === 'smart' && selection.view === 'today' ? todayKey() : null

  return (
    <div className="flex h-svh bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar
        selection={selection}
        onSelect={setSelection}
        onNewList={() => setListDialog({ type: 'new' })}
        onEditList={(list) => setListDialog({ type: 'edit', list })}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          subtitle={subtitle}
          query={query}
          onQueryChange={setQuery}
          onExport={handleExport}
          onImport={() => importInputRef.current?.click()}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 pt-4 pb-48 md:pb-36">
            {selection.kind === 'lists-index' ? (
              <ListsPanel
                onSelect={setSelection}
                onNewList={() => setListDialog({ type: 'new' })}
                onEditList={(list) => setListDialog({ type: 'edit', list })}
                onExport={handleExport}
                onImport={() => importInputRef.current?.click()}
              />
            ) : (
              <ViewContent
                selection={selection}
                tasks={tasks}
                query={query}
                listById={listById}
                onToggle={toggleTask}
                onOpen={openTask}
              />
            )}
          </div>
        </main>

        {showQuickAdd && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-5">
            <div className="pointer-events-auto mx-auto max-w-3xl px-4">
              <QuickAdd
                key={`${title}:${quickAddListId ?? ''}`}
                listId={quickAddListId}
                defaultDueDate={quickAddDueDate}
              />
            </div>
          </div>
        )}

        <BottomNav selection={selection} onSelect={setSelection} />
      </div>

      {editor && <TaskEditor mode={editor} onClose={() => setEditor(null)} />}
      {listDialog && (
        <ListFormDialog
          mode={listDialog}
          onClose={() => setListDialog(null)}
          onDeleted={(listId) => {
            if (selection.kind === 'list' && selection.listId === listId) {
              setSelection({ kind: 'lists-index' })
            }
          }}
        />
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Importar backup"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleImportFile(file)
        }}
      />
    </div>
  )
}

function headerMeta(
  selection: ViewSelection,
  listById: Map<string, TaskList>,
  tasks: Task[],
): { title: string; subtitle?: string } {
  const openCount = tasks.filter((task) => !task.done).length
  if (selection.kind === 'lists-index') {
    return { title: 'Listas', subtitle: `${openCount} tarefa(s) aberta(s)` }
  }
  if (selection.kind === 'list') {
    const list = listById.get(selection.listId)
    const count = tasks.filter(
      (task) => !task.done && task.listId === selection.listId,
    ).length
    return {
      title: list?.name ?? 'Lista',
      subtitle: `${count} tarefa(s) aberta(s)`,
    }
  }
  const label = SMART_VIEW_META[selection.view].label
  if (selection.view === 'done') {
    const doneCount = tasks.filter((task) => task.done).length
    return { title: label, subtitle: `${doneCount} concluída(s)` }
  }
  return { title: label, subtitle: `${openCount} tarefa(s) aberta(s)` }
}

type ViewContentProps = {
  selection: Exclude<ViewSelection, { kind: 'lists-index' }>
  tasks: Task[]
  query: string
  listById: Map<string, TaskList>
  onToggle: (id: string) => void
  onOpen: (task: Task) => void
}

function ViewContent({
  selection,
  tasks,
  query,
  listById,
  onToggle,
  onOpen,
}: ViewContentProps) {
  const itemProps = (task: Task, showList = true, showDue = true) => ({
    task,
    list: listById.get(task.listId),
    showList,
    showDue,
    onToggle,
    onOpen,
  })

  if (selection.kind === 'list') {
    const listTasks = filterByQuery(selectByList(tasks, selection.listId), query)
    if (listTasks.length === 0) {
      return (
        <EmptyState
          icon={<ListIcon className="size-8" />}
          message={query ? 'Nada encontrado.' : 'Nenhuma tarefa nesta lista. Adicione a primeira!'}
        />
      )
    }
    return (
      <ul className="space-y-2">
        {listTasks.map((task) => (
          <TaskItem key={task.id} {...itemProps(task, false)} />
        ))}
      </ul>
    )
  }

  if (selection.view === 'today') {
    const { overdue, today } = selectToday(tasks)
    const filteredOverdue = filterByQuery(overdue, query)
    const filteredToday = filterByQuery(today, query)
    if (filteredOverdue.length === 0 && filteredToday.length === 0) {
      return (
        <EmptyState
          icon={<CalendarCheckIcon className="size-8" />}
          message={query ? 'Nada encontrado.' : 'Tudo em dia por hoje! 🎉'}
        />
      )
    }
    return (
      <div className="space-y-5">
        {filteredOverdue.length > 0 && (
          <Section
            title="Atrasadas"
            titleClass="text-red-600 dark:text-red-400"
            tasks={filteredOverdue}
            renderItem={(task) => (
              <TaskItem key={task.id} {...itemProps(task)} />
            )}
          />
        )}
        {filteredToday.length > 0 && (
          <Section
            title="Hoje"
            tasks={filteredToday}
            renderItem={(task) => (
              <TaskItem key={task.id} {...itemProps(task, true, false)} />
            )}
          />
        )}
      </div>
    )
  }

  if (selection.view === 'scheduled') {
    const sections = selectScheduled(tasks)
      .map((section) => ({
        ...section,
        tasks: filterByQuery(section.tasks, query),
      }))
      .filter((section) => section.tasks.length > 0)
    if (sections.length === 0) {
      return (
        <EmptyState
          icon={<CalendarIcon className="size-8" />}
          message={
            query
              ? 'Nada encontrado.'
              : 'Nenhuma tarefa agendada. Defina uma data ao criar uma tarefa.'
          }
        />
      )
    }
    return (
      <div className="space-y-5">
        {sections.map((section) => (
          <Section
            key={section.key}
            title={formatDateHeading(section.key)}
            titleClass={
              section.key < todayKey()
                ? 'text-red-600 dark:text-red-400'
                : undefined
            }
            tasks={section.tasks}
            renderItem={(task) => (
              <TaskItem key={task.id} {...itemProps(task, true, false)} />
            )}
          />
        ))}
      </div>
    )
  }

  if (selection.view === 'done') {
    const doneTasks = filterByQuery(selectDone(tasks), query)
    if (doneTasks.length === 0) {
      return (
        <EmptyState
          icon={<CircleCheckIcon className="size-8" />}
          message={query ? 'Nada encontrado.' : 'Nenhuma tarefa concluída ainda.'}
        />
      )
    }
    return (
      <ul className="space-y-2">
        {doneTasks.map((task) => (
          <TaskItem key={task.id} {...itemProps(task)} />
        ))}
      </ul>
    )
  }

  // Visão "Todas": agrupada por lista.
  const openByList = [...listById.values()]
    .map((list) => ({
      list,
      tasks: filterByQuery(selectAllOpen(tasks).filter((task) => task.listId === list.id), query),
    }))
    .filter((group) => group.tasks.length > 0)

  if (openByList.length === 0) {
    return (
      <EmptyState
        icon={<ListIcon className="size-8" />}
        message={query ? 'Nada encontrado.' : 'Nenhuma tarefa aberta. Que tal planejar o dia?'}
      />
    )
  }
  return (
    <div className="space-y-5">
      {openByList.map((group) => (
        <Section
          key={group.list.id}
          title={group.list.name}
          tasks={group.tasks}
          renderItem={(task) => (
            <TaskItem key={task.id} {...itemProps(task, false)} />
          )}
        />
      ))}
    </div>
  )
}

function Section({
  title,
  titleClass,
  tasks,
  renderItem,
}: {
  title: string
  titleClass?: string
  tasks: Task[]
  renderItem: (task: Task) => React.ReactNode
}) {
  return (
    <section>
      <h2
        className={`mb-2 px-1 text-sm font-semibold ${
          titleClass ?? 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {title}
      </h2>
      <ul className="space-y-2">{tasks.map(renderItem)}</ul>
    </section>
  )
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode
  message: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-400 dark:text-slate-500">
      {icon}
      <p className="max-w-60 text-sm">{message}</p>
    </div>
  )
}
