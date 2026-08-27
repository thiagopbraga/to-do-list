import { isAppState, serializeState } from './storage'
import type { AppState } from '../types/task'

export function buildBackupFilename(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `taskflow-backup-${year}-${month}-${day}.json`
}

/** Baixa o estado atual como arquivo JSON. */
export function downloadBackup(state: AppState, now: Date = new Date()): void {
  const blob = new Blob([serializeState(state)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildBackupFilename(now)
  anchor.click()
  URL.revokeObjectURL(url)
}

export type ImportResult =
  | { ok: true; state: AppState }
  | { ok: false; error: 'invalid-json' | 'invalid-schema' }

/** Valida o conteúdo de um arquivo de backup. */
export function parseBackup(payload: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
  if (!isAppState(parsed)) {
    return { ok: false, error: 'invalid-schema' }
  }
  return { ok: true, state: parsed }
}

export function readBackupFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(parseBackup(String(reader.result ?? '')))
    }
    reader.onerror = () => {
      resolve({ ok: false, error: 'invalid-json' })
    }
    reader.readAsText(file)
  })
}
