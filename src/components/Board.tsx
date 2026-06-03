import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { ALIGN_BOARD_EVENT, computeGrid } from '../lib/align'
import {
  getCenteredClampedNotePosition,
  getDraggedNotePosition,
  getElementSize,
} from '../lib/geometry'
import {
  findGroupingTarget,
  getDeckGroups,
  groupNoteForDrop,
  moveNoteForDrop,
  removeNoteAndCollapseDecks,
} from '../lib/grouping'
import { useBoardStore } from '../store/boardStore'
import type { NoteColor, Position } from '../types/board'
import { Deck } from './Deck'
import { NoteCard } from './NoteCard'
import { Trash, TRASH_DROPPABLE_ID } from './Trash'

const DRAG_ACTIVATION_DISTANCE = 5
const TRASH_CRUMPLE_DURATION_MS = 180

function hasSamePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}

export function Board() {
  const boardRef = useRef<HTMLElement | null>(null)
  const removalTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [crumplingNoteIds, setCrumplingNoteIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    () => new Set(),
  )
  const notes = useBoardStore((state) => state.notes)
  const addNote = useBoardStore((state) => state.addNote)
  const updateNote = useBoardStore((state) => state.updateNote)
  const setNotes = useBoardStore((state) => state.setNotes)
  const bringToFront = useBoardStore((state) => state.bringToFront)
  const deckGroups = useMemo(() => getDeckGroups(notes), [notes])
  const deckGroupIds = useMemo(
    () => new Set(deckGroups.map((deck) => deck.groupId)),
    [deckGroups],
  )
  const visibleNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          !note.groupId ||
          !deckGroupIds.has(note.groupId) ||
          expandedGroupIds.has(note.groupId),
      ),
    [deckGroupIds, expandedGroupIds, notes],
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE,
      },
    }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    const removalTimeouts = removalTimeoutsRef.current

    return () => {
      removalTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      removalTimeouts.clear()
    }
  }, [])

  const scheduleNoteRemoval = useCallback(
    (noteId: string) => {
      setCrumplingNoteIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.add(noteId)
        return nextIds
      })

      const previousTimeoutId = removalTimeoutsRef.current.get(noteId)
      if (previousTimeoutId) clearTimeout(previousTimeoutId)

      const timeoutId = setTimeout(() => {
        setNotes(
          removeNoteAndCollapseDecks(
            useBoardStore.getState().notes,
            noteId,
            new Date().toISOString(),
          ),
        )
        setSelectedNoteIds((currentIds) => {
          if (!currentIds.has(noteId)) return currentIds

          const nextIds = new Set(currentIds)
          nextIds.delete(noteId)
          return nextIds
        })
        removalTimeoutsRef.current.delete(noteId)
        setCrumplingNoteIds((currentIds) => {
          const nextIds = new Set(currentIds)
          nextIds.delete(noteId)
          return nextIds
        })
      }, TRASH_CRUMPLE_DURATION_MS)

      removalTimeoutsRef.current.set(noteId, timeoutId)
    },
    [setNotes],
  )

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const note = addNote({
        color: 'yellow',
        text: '',
        position: getCenteredClampedNotePosition(event, event.currentTarget),
      })

      setEditingNoteId(note.id)
      setSelectedNoteIds(new Set([note.id]))
    },
    [addNote],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const noteId = String(event.active.id)
      setSelectedNoteIds((currentIds) =>
        currentIds.has(noteId) ? currentIds : new Set([noteId]),
      )
      bringToFront(noteId)
    },
    [bringToFront],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const boardElement = boardRef.current
      if (!boardElement) return

      const noteId = String(event.active.id)
      const note = useBoardStore
        .getState()
        .notes.find((candidate) => candidate.id === noteId)
      if (!note) return

      if (event.over?.id === TRASH_DROPPABLE_ID) {
        scheduleNoteRemoval(noteId)
        return
      }

      if (event.over?.id === noteId) return

      const currentNotes = useBoardStore.getState().notes
      const droppedPosition = getDraggedNotePosition(
        note.position,
        event.delta,
        boardElement,
      )
      const groupingTarget = findGroupingTarget(
        currentNotes,
        noteId,
        droppedPosition,
      )
      const timestamp = new Date().toISOString()

      if (groupingTarget) {
        setNotes(
          groupNoteForDrop(
            currentNotes,
            noteId,
            groupingTarget.id,
            droppedPosition,
            timestamp,
          ),
        )
        return
      }

      setNotes(moveNoteForDrop(currentNotes, noteId, droppedPosition, timestamp))
    },
    [scheduleNoteRemoval, setNotes],
  )

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      updateNote(id, { text })
    },
    [updateNote],
  )

  const handleColorChange = useCallback(
    (id: string, color: NoteColor) => {
      updateNote(id, { color })
    },
    [updateNote],
  )

  const handleNoteSelect = useCallback(
    (id: string, mode: 'single' | 'toggle') => {
      setSelectedNoteIds((currentIds) => {
        if (mode === 'single') return new Set([id])

        const nextIds = new Set(currentIds)
        if (nextIds.has(id)) {
          nextIds.delete(id)
        } else {
          nextIds.add(id)
        }

        return nextIds
      })

      if (mode === 'toggle') setEditingNoteId(null)
    },
    [],
  )

  const handleAlignBoard = useCallback(() => {
    const boardElement = boardRef.current
    if (!boardElement || notes.length === 0) return

    const collapsedDecks = deckGroups.filter(
      (deck) => !expandedGroupIds.has(deck.groupId),
    )
    const collapsedGroupIds = new Set(
      collapsedDecks.map((deck) => deck.groupId),
    )
    const collapsedCoverIds = new Set(
      collapsedDecks.map((deck) => deck.coverNote.id),
    )
    const alignableNotes = notes.filter((note) => {
      if (!note.groupId || !collapsedGroupIds.has(note.groupId)) return true

      return collapsedCoverIds.has(note.id)
    })

    if (alignableNotes.length === 0) return

    const gridPositions = computeGrid(alignableNotes, getElementSize(boardElement))
    const deckPositions = new Map<string, Position>()
    for (const deck of collapsedDecks) {
      const position = gridPositions[deck.coverNote.id]
      if (position) deckPositions.set(deck.groupId, position)
    }

    const timestamp = new Date().toISOString()
    let hasPositionChanges = false
    const alignedNotes = notes.map((note) => {
      const position =
        note.groupId && collapsedGroupIds.has(note.groupId)
          ? deckPositions.get(note.groupId)
          : gridPositions[note.id]

      if (!position || hasSamePosition(note.position, position)) return note

      hasPositionChanges = true
      return {
        ...note,
        position,
        updatedAt: timestamp,
      }
    })

    if (hasPositionChanges) setNotes(alignedNotes)
  }, [deckGroups, expandedGroupIds, notes, setNotes])

  const handleEditEnd = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  const handleDeckToggle = useCallback((groupId: string) => {
    setExpandedGroupIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(groupId)) {
        nextIds.delete(groupId)
      } else {
        nextIds.add(groupId)
      }

      return nextIds
    })
  }, [])

  useEffect(() => {
    window.addEventListener(ALIGN_BOARD_EVENT, handleAlignBoard)

    return () => {
      window.removeEventListener(ALIGN_BOARD_EVENT, handleAlignBoard)
    }
  }, [handleAlignBoard])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <main
        ref={boardRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-stone-200"
        data-testid="board"
        aria-label="Quadro de post-its"
        onDoubleClick={handleDoubleClick}
      >
        {deckGroups.map((deck) => (
          <Deck
            key={deck.groupId}
            groupId={deck.groupId}
            notes={deck.notes}
            isExpanded={expandedGroupIds.has(deck.groupId)}
            onToggle={handleDeckToggle}
          />
        ))}
        {visibleNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isEditing={editingNoteId === note.id}
            isSelected={selectedNoteIds.has(note.id)}
            onEditStart={setEditingNoteId}
            onEditEnd={handleEditEnd}
            onSelect={handleNoteSelect}
            onTextChange={handleTextChange}
            onColorChange={handleColorChange}
            isCrumpling={crumplingNoteIds.has(note.id)}
          />
        ))}
        <Trash />
      </main>
    </DndContext>
  )
}
