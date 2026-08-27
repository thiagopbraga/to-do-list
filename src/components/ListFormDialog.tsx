import { useEffect, useState } from 'react'
import { LIST_COLOR_DOT } from '../lib/labels'
import { useTaskStore } from '../store/taskStore'
import {
  INBOX_LIST_ID,
  LIST_COLORS,
  type ListColor,
  type TaskList,
} from '../types/task'
import { TrashIcon, XIcon } from './icons'

export type ListDialogMode = { type: 'new' } | { type: 'edit'; list: TaskList }

type ListFormDialogProps = {
  mode: ListDialogMode
  onClose: () => void
  /** Chamado após excluir a lista, para sair da visão dela se necessário. */
  onDeleted?: (listId: string) => void
}

export function ListFormDialog({ mode, onClose, onDeleted }: ListFormDialogProps) {
  const addList = useTaskStore((state) => state.addList)
  const updateList = useTaskStore((state) => state.updateList)
  const removeList = useTaskStore((state) => state.removeList)

  const [name, setName] = useState(mode.type === 'edit' ? mode.list.name : '')
  const [color, setColor] = useState<ListColor>(
    mode.type === 'edit' ? mode.list.color : 'blue',
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const canSave = name.trim().length > 0
  const isInbox = mode.type === 'edit' && mode.list.id === INBOX_LIST_ID

  const handleSave = () => {
    if (!canSave) return
    if (mode.type === 'edit') {
      updateList(mode.list.id, { name: name.trim(), color })
    } else {
      addList(name.trim(), color)
    }
    onClose()
  }

  const handleDelete = () => {
    if (mode.type !== 'edit' || isInbox) return
    const confirmed = window.confirm(
      `Excluir a lista "${mode.list.name}"? As tarefas dela serão movidas para a Entrada.`,
    )
    if (!confirmed) return
    removeList(mode.list.id)
    onDeleted?.(mode.list.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-[2px] md:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode.type === 'edit' ? 'Editar lista' : 'Nova lista'}
        className="editor-sheet w-full rounded-t-2xl bg-white p-4 shadow-xl md:max-w-sm md:rounded-2xl md:p-6 dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {mode.type === 'edit' ? 'Editar lista' : 'Nova lista'}
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

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSave()
          }}
          placeholder="Nome da lista"
          aria-label="Nome da lista"
          autoFocus
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />

        <div
          role="radiogroup"
          aria-label="Cor da lista"
          className="mt-4 flex flex-wrap gap-2"
        >
          {LIST_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={color === option}
              aria-label={`Cor ${option}`}
              onClick={() => setColor(option)}
              className={`size-8 rounded-full ${LIST_COLOR_DOT[option]} transition-transform ${
                color === option
                  ? 'scale-110 ring-2 ring-slate-800 ring-offset-2 dark:ring-white dark:ring-offset-slate-800'
                  : 'opacity-70 hover:opacity-100'
              }`}
            />
          ))}
        </div>

        <footer className="mt-5 flex items-center justify-between gap-3 pb-[max(0px,env(safe-area-inset-bottom))]">
          {mode.type === 'edit' && !isInbox ? (
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
            {mode.type === 'edit' ? 'Salvar' : 'Criar lista'}
          </button>
        </footer>
      </div>
    </div>
  )
}
