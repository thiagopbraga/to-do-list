import { SCHEMA_VERSION, type BoardState } from '../types/board'

const BACKUP_FILENAME_PREFIX = 'stickyflow-backup'

function toDatePart(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function serializeBoard(state: BoardState, exportedAt = new Date()): string {
  const payload: BoardState = {
    version: SCHEMA_VERSION,
    board: {
      ...state.board,
      lastModified: exportedAt.toISOString(),
    },
    notes: state.notes.map((note) => ({
      ...note,
      position: { ...note.position },
    })),
  }

  return JSON.stringify(payload, null, 2)
}

export function createBackupFilename(date = new Date()): string {
  return `${BACKUP_FILENAME_PREFIX}-${toDatePart(date)}.json`
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)

  try {
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export function exportBoard(state: BoardState, exportedAt = new Date()): void {
  downloadJson(serializeBoard(state, exportedAt), createBackupFilename(exportedAt))
}
