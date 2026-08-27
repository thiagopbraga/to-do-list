import { useEffect, useState } from 'react'
import { addDaysToKey, todayKey } from '../lib/dates'
import { PRIORITY_LABELS, RECURRENCE_LABELS } from '../lib/labels'
import { useTaskStore } from '../store/taskStore'
import {
  PRIORITIES,
  RECURRENCES,
  type Priority,
  type Recurrence,
  type Task,
  type TaskInput,
} from '../types/task'
import { TrashIcon, XIcon } from './icons'

export type EditorMode =
  | { type: 'new'; defaults?: TaskInput }
  | { type: 'edit'; task: Task }

type TaskEditorProps = {
  mode: EditorMode
  onClose: () => void
}

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:[color-scheme:dark]'

const LABEL_CLASS =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'

export function TaskEditor({ mode, onClose }: TaskEditorProps) {
  const lists = useTaskStore((state) => state.lists)
  const addTask = useTaskStore((state) => state.addTask)
  const updateTask = useTaskStore((state) => state.updateTask)
  const removeTask = useTaskStore((state) => state.removeTask)

  const initial: TaskInput =
    mode.type === 'edit' ? mode.task : (mode.defaults ?? {})

  const [title, setTitle] = useState(initial.title ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [listId, setListId] = useState(initial.listId ?? lists[0]?.id ?? '')
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [dueTime, setDueTime] = useState(initial.dueTime ?? '')
  const [recurrence, setRecurrence] = useState<Recurrence>(
    initial.recurrence ?? 'none',
  )
  const [priority, setPriority] = useState<Priority>(initial.priority ?? 'none')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const canSave = title.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    const patch = {
      title: title.trim(),
      notes: notes.trim(),
      listId,
      dueDate: dueDate || null,
      dueTime: dueDate && dueTime ? dueTime : null,
      recurrence: dueDate ? recurrence : ('none' as Recurrence),
      priority,
    }
    if (mode.type === 'edit') {
      updateTask(mode.task.id, patch)
    } else {
      addTask(patch)
    }
    onClose()
  }

  const handleDelete = () => {
    if (mode.type !== 'edit') return
    removeTask(mode.task.id)
    onClose()
  }

  const today = todayKey()

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-[2px] md:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode.type === 'edit' ? 'Editar tarefa' : 'Nova tarefa'}
        className="editor-sheet flex max-h-[92svh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-2xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 pt-4 pb-2 md:px-6">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {mode.type === 'edit' ? 'Editar tarefa' : 'Nova tarefa'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <XIcon className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 md:px-6">
          <div>
            <label className={LABEL_CLASS} htmlFor="task-title">
              Título
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSave()
              }}
              placeholder="O que precisa ser feito?"
              autoFocus
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="task-notes">
              Anotações
            </label>
            <textarea
              id="task-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Detalhes, links, subitens…"
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="task-date">
                Data
              </label>
              <input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="task-time">
                Hora
              </label>
              <input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                disabled={!dueDate}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <QuickDateChip
              label="Hoje"
              active={dueDate === today}
              onClick={() => setDueDate(today)}
            />
            <QuickDateChip
              label="Amanhã"
              active={dueDate === addDaysToKey(today, 1)}
              onClick={() => setDueDate(addDaysToKey(today, 1))}
            />
            <QuickDateChip
              label="Próx. semana"
              active={dueDate === addDaysToKey(today, 7)}
              onClick={() => setDueDate(addDaysToKey(today, 7))}
            />
            {dueDate && (
              <QuickDateChip
                label="Sem data"
                active={false}
                onClick={() => {
                  setDueDate('')
                  setDueTime('')
                  setRecurrence('none')
                }}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="task-recurrence">
                Repetição
              </label>
              <select
                id="task-recurrence"
                value={recurrence}
                onChange={(event) =>
                  setRecurrence(event.target.value as Recurrence)
                }
                disabled={!dueDate}
                className={FIELD_CLASS}
              >
                {RECURRENCES.map((rule) => (
                  <option key={rule} value={rule}>
                    {RECURRENCE_LABELS[rule]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="task-list">
                Lista
              </label>
              <select
                id="task-list"
                value={listId}
                onChange={(event) => setListId(event.target.value)}
                className={FIELD_CLASS}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={LABEL_CLASS}>Prioridade</span>
            <div
              role="radiogroup"
              aria-label="Prioridade"
              className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-700"
            >
              {PRIORITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={priority === level}
                  onClick={() => setPriority(level)}
                  className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                    priority === level
                      ? 'bg-white font-medium text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {PRIORITY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 dark:border-slate-700">
          {mode.type === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <TrashIcon className="size-4" />
              Excluir
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
          >
            {mode.type === 'edit' ? 'Salvar' : 'Adicionar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function QuickDateChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
          : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}
