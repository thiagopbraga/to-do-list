import { NOTE_CARD_SIZE } from '../lib/geometry'
import { getDeckCoverNote } from '../lib/grouping'
import { getNoteColorClasses } from '../lib/noteColors'
import type { Note } from '../types/board'

type DeckProps = {
  groupId: string
  notes: Note[]
  isExpanded: boolean
  onToggle: (groupId: string) => void
}

export function Deck({ groupId, notes, isExpanded, onToggle }: DeckProps) {
  const coverNote = getDeckCoverNote(notes)
  const toggleLabel = isExpanded ? 'Recolher deck' : 'Expandir deck'

  return (
    <article
      className={`absolute rounded-sm shadow-lg transition-[left,top,transform,box-shadow] duration-200 ease-out ${getNoteColorClasses(coverNote.color)} ${
        isExpanded ? 'ring-2 ring-stone-700/40' : ''
      }`}
      style={{
        left: coverNote.position.x,
        top: coverNote.position.y,
        zIndex: coverNote.zIndex + 1,
        width: NOTE_CARD_SIZE.width,
        height: NOTE_CARD_SIZE.height,
        transform: isExpanded ? 'translate3d(12px, -12px, 0)' : 'rotate(-1deg)',
      }}
      data-testid={`deck-${groupId}`}
      aria-label={`Deck com ${notes.length} notas`}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div
        className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-sm border border-stone-700/20 bg-stone-50/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded-sm border border-stone-700/20 bg-stone-50/30"
        aria-hidden="true"
      />
      <button
        type="button"
        className="relative flex h-full w-full flex-col justify-between rounded-sm p-3 text-left text-sm text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
        aria-expanded={isExpanded}
        aria-label={`${toggleLabel} com ${notes.length} notas`}
        onClick={(event) => {
          event.stopPropagation()
          onToggle(groupId)
        }}
      >
        <span className="inline-flex w-fit rounded-full bg-stone-900/75 px-2 py-1 text-xs font-semibold text-white">
          {notes.length} notas
        </span>
        <span className="line-clamp-3 whitespace-pre-wrap wrap-break-word">
          {coverNote.text || 'Deck sem título'}
        </span>
        <span className="text-xs font-semibold text-stone-700">
          {toggleLabel}
        </span>
      </button>
    </article>
  )
}
