export const SCHEMA_VERSION = '1.0' as const

export type NoteColor =
  | 'yellow'
  | 'pink'
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'

export const NOTE_COLORS: readonly NoteColor[] = [
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
  'orange',
] as const

export type BoardTheme = 'light' | 'dark'

export type Position = {
  x: number
  y: number
}

export type Note = {
  id: string
  text: string
  color: NoteColor
  position: Position
  zIndex: number
  createdAt: string
  updatedAt: string
  groupId: string | null
}

export type BoardMeta = {
  lastModified: string
  theme: BoardTheme
}

export type BoardState = {
  version: typeof SCHEMA_VERSION
  board: BoardMeta
  notes: Note[]
}

export type NoteInput = Partial<
  Pick<Note, 'text' | 'color' | 'position' | 'groupId'>
>
