import { useRef, useState } from 'react'
import { addDaysToKey, formatDueLabel, todayKey } from '../lib/dates'
import { PRIORITY_FLAG_CLASS } from '../lib/labels'
import { useTaskStore } from '../store/taskStore'
import type { Priority } from '../types/task'
import { CalendarIcon, FlagIcon, PlusIcon } from './icons'

type QuickAddProps = {
  /** Lista de destino (quando a visão ativa é uma lista). */
  listId?: string
  /** Data pré-selecionada (ex.: hoje na visão Hoje). */
  defaultDueDate?: string | null
}

const PRIORITY_CYCLE: Priority[] = ['none', 'high', 'medium', 'low']

export function QuickAdd({ listId, defaultDueDate = null }: QuickAddProps) {
  const addTask = useTaskStore((state) => state.addTask)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate)
  const [priority, setPriority] = useState<Priority>('none')
  const inputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const today = todayKey()
  const tomorrow = addDaysToKey(today, 1)

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    addTask({ title: trimmed, listId, dueDate, priority })
    setTitle('')
    setPriority('none')
    setDueDate(defaultDueDate)
    inputRef.current?.focus()
  }

  const cycleDate = () => {
    if (dueDate === null) setDueDate(today)
    else if (dueDate === today) setDueDate(tomorrow)
    else if (dueDate === tomorrow) setDueDate(null)
    else setDueDate(null)
  }

  const cyclePriority = () => {
    const index = PRIORITY_CYCLE.indexOf(priority)
    setPriority(PRIORITY_CYCLE[(index + 1) % PRIORITY_CYCLE.length])
  }

  return (
    <form
      data-testid="quick-add"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-1.5 shadow-lg shadow-slate-900/5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800"
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Adicionar tarefa…"
        aria-label="Adicionar tarefa"
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
      />

      <div className="relative">
        <button
          type="button"
          onClick={cycleDate}
          onDoubleClick={() => dateInputRef.current?.showPicker?.()}
          aria-label="Alternar data (Hoje, Amanhã, sem data)"
          title="Toque: Hoje → Amanhã → sem data · Duplo toque: escolher data"
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            dueDate
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700'
          }`}
        >
          <CalendarIcon className="size-4" />
          {dueDate && <span>{formatDueLabel(dueDate)}</span>}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          tabIndex={-1}
          aria-label="Escolher data"
          value={dueDate ?? ''}
          onChange={(event) => setDueDate(event.target.value || null)}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>

      <button
        type="button"
        onClick={cyclePriority}
        aria-label="Alternar prioridade"
        title="Prioridade: nenhuma → alta → média → baixa"
        className={`rounded-lg p-1.5 transition-colors ${
          priority === 'none'
            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700'
            : `${PRIORITY_FLAG_CLASS[priority]} bg-slate-100 dark:bg-slate-700`
        }`}
      >
        <FlagIcon className="size-4" />
      </button>

      <button
        type="submit"
        disabled={!title.trim()}
        aria-label="Adicionar"
        className="rounded-lg bg-blue-600 p-2 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40"
      >
        <PlusIcon className="size-4" />
      </button>
    </form>
  )
}
