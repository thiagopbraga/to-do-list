import { useRef, useState, type ChangeEvent } from 'react'
import { exportBoard } from '../lib/export'
import { parseImport, readImportFile } from '../lib/import'
import { useBoardStore } from '../store/boardStore'
import type { BoardState } from '../types/board'

type Feedback = {
  type: 'error' | 'success'
  message: string
}

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingImport, setPendingImport] = useState<BoardState | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  function handleExport() {
    exportBoard(useBoardStore.getState())
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    try {
      const payload = await readImportFile(file)
      const result = parseImport(payload)

      if (!result.ok) {
        setPendingImport(null)
        setFeedback({ type: 'error', message: result.message })
        return
      }

      setPendingImport(result.state)
      setFeedback(null)
    } catch {
      setPendingImport(null)
      setFeedback({ type: 'error', message: 'Arquivo inválido' })
    }
  }

  function handleCancelImport() {
    setPendingImport(null)
  }

  function handleConfirmImport() {
    if (!pendingImport) return

    useBoardStore.getState().replaceState(pendingImport)
    setPendingImport(null)
    setFeedback({ type: 'success', message: 'Quadro restaurado' })
  }

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-300 bg-stone-100 px-4"
      data-testid="toolbar"
      aria-label="Barra de ferramentas"
    >
      <span className="text-sm font-semibold text-stone-700">StickyFlow</span>
      <button
        type="button"
        className="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
        onClick={handleExport}
      >
        Exportar
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="sr-only"
        aria-label="Selecionar arquivo de importação"
        onChange={handleImportChange}
      />
      <button
        type="button"
        className="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
        onClick={handleImportClick}
      >
        Importar
      </button>
      {feedback ? (
        <p
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={
            feedback.type === 'error'
              ? 'ml-auto rounded-md border border-red-300 bg-red-50 px-3 py-1 text-sm font-medium text-red-700'
              : 'ml-auto rounded-md border border-green-300 bg-green-50 px-3 py-1 text-sm font-medium text-green-700'
          }
        >
          {feedback.message}
        </p>
      ) : null}
      {pendingImport ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-confirm-title"
          className="absolute left-1/2 top-16 z-50 w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg border border-stone-300 bg-white p-4 shadow-xl"
        >
          <h2 id="import-confirm-title" className="text-base font-semibold text-stone-900">
            Substituir quadro atual?
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Isso apagará seu quadro atual e restaurará {pendingImport.notes.length}{' '}
            nota{pendingImport.notes.length === 1 ? '' : 's'} do arquivo importado.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
              onClick={handleCancelImport}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 bg-red-600 px-3 py-1 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              onClick={handleConfirmImport}
            >
              Importar e substituir
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}
