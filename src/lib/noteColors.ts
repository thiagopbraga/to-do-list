import { NOTE_COLORS, type NoteColor } from '../types/board'

export const NOTE_COLOR_CLASSES = {
  yellow: 'border border-yellow-300 bg-yellow-200 shadow-yellow-200/40',
  pink: 'border border-pink-300 bg-pink-200 shadow-pink-200/40',
  blue: 'border border-blue-300 bg-blue-200 shadow-blue-200/40',
  green: 'border border-green-300 bg-green-200 shadow-green-200/40',
  purple: 'border border-purple-300 bg-purple-200 shadow-purple-200/40',
  orange: 'border border-orange-300 bg-orange-200 shadow-orange-200/40',
} as const satisfies Record<NoteColor, string>

const NOTE_COLOR_SET: ReadonlySet<string> = new Set(NOTE_COLORS)

function isKnownNoteColor(color: unknown): color is NoteColor {
  return typeof color === 'string' && NOTE_COLOR_SET.has(color)
}

export function normalizeNoteColor(color: unknown): NoteColor {
  return isKnownNoteColor(color) ? color : 'yellow'
}

export function getNoteColorClasses(color: unknown): string {
  return NOTE_COLOR_CLASSES[normalizeNoteColor(color)]
}
