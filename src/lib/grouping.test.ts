import { describe, expect, it } from 'vitest'
import { createNoteFactory } from '../test/factories'
import {
  collapseSingletonDecks,
  findGroupingTarget,
  getDeckGroups,
  groupNoteForDrop,
  moveNoteForDrop,
  removeNoteAndCollapseDecks,
} from './grouping'

const TIMESTAMP = '2026-06-02T15:00:00.000Z'
const NOTE_SIZE = { width: 100, height: 100 }

describe('grouping', () => {
  it('detecta colisão quando o centro da nota solta cai dentro do alvo', () => {
    const dragged = createNoteFactory({
      id: 'dragged',
      position: { x: 0, y: 0 },
    })
    const target = createNoteFactory({
      id: 'target',
      position: { x: 100, y: 100 },
    })

    expect(
      findGroupingTarget(
        [dragged, target],
        dragged.id,
        { x: 50, y: 50 },
        NOTE_SIZE,
      )?.id,
    ).toBe('target')
    expect(
      findGroupingTarget(
        [dragged, target],
        dragged.id,
        { x: 49, y: 50 },
        NOTE_SIZE,
      ),
    ).toBeNull()
  })

  it('escolhe alvo determinístico por zIndex, updatedAt e id', () => {
    const dragged = createNoteFactory({ id: 'dragged' })
    const older = createNoteFactory({
      id: 'older',
      position: { x: 100, y: 100 },
      zIndex: 2,
      updatedAt: '2026-06-02T14:00:00.000Z',
    })
    const newer = createNoteFactory({
      id: 'newer',
      position: { x: 100, y: 100 },
      zIndex: 2,
      updatedAt: '2026-06-02T14:30:00.000Z',
    })
    const front = createNoteFactory({
      id: 'front',
      position: { x: 100, y: 100 },
      zIndex: 3,
      updatedAt: '2026-06-02T13:00:00.000Z',
    })

    expect(
      findGroupingTarget(
        [dragged, older, newer, front],
        dragged.id,
        { x: 100, y: 100 },
        NOTE_SIZE,
      )?.id,
    ).toBe('front')

    expect(
      findGroupingTarget(
        [dragged, older, newer],
        dragged.id,
        { x: 100, y: 100 },
        NOTE_SIZE,
      )?.id,
    ).toBe('newer')
  })

  it('agrupa notas sem groupId usando id estável do alvo', () => {
    const notes = [
      createNoteFactory({ id: 'dragged' }),
      createNoteFactory({ id: 'target' }),
    ]

    const result = groupNoteForDrop(
      notes,
      'dragged',
      'target',
      { x: 120, y: 130 },
      TIMESTAMP,
    )

    expect(result).toMatchObject([
      {
        id: 'dragged',
        groupId: 'group:target',
        position: { x: 120, y: 130 },
        updatedAt: TIMESTAMP,
      },
      {
        id: 'target',
        groupId: 'group:target',
        updatedAt: TIMESTAMP,
      },
    ])
  })

  it('desagrupa nota movida para fora e desfaz deck com uma nota', () => {
    const notes = [
      createNoteFactory({ id: 'remaining', groupId: 'deck-1' }),
      createNoteFactory({ id: 'dragged', groupId: 'deck-1' }),
    ]

    const result = moveNoteForDrop(
      notes,
      'dragged',
      { x: 300, y: 320 },
      TIMESTAMP,
    )

    expect(result).toMatchObject([
      { id: 'remaining', groupId: null, updatedAt: TIMESTAMP },
      {
        id: 'dragged',
        groupId: null,
        position: { x: 300, y: 320 },
        updatedAt: TIMESTAMP,
      },
    ])
  })

  it('ignora agrupamento sobre a própria nota', () => {
    const notes = [createNoteFactory({ id: 'same', groupId: null })]

    expect(
      groupNoteForDrop(notes, 'same', 'same', { x: 100, y: 100 }, TIMESTAMP),
    ).toEqual(notes)
  })

  it('remove nota e normaliza singleton residual', () => {
    const notes = [
      createNoteFactory({ id: 'removed', groupId: 'deck-1' }),
      createNoteFactory({ id: 'remaining', groupId: 'deck-1' }),
    ]

    expect(removeNoteAndCollapseDecks(notes, 'removed', TIMESTAMP)).toMatchObject([
      { id: 'remaining', groupId: null, updatedAt: TIMESTAMP },
    ])
  })

  it('lista apenas decks reais com capa ordenada por topo visual', () => {
    const notes = [
      createNoteFactory({ id: 'solo', groupId: 'solo' }),
      createNoteFactory({ id: 'back', groupId: 'deck-1', zIndex: 1 }),
      createNoteFactory({ id: 'cover', groupId: 'deck-1', zIndex: 5 }),
    ]

    expect(collapseSingletonDecks(notes, TIMESTAMP)[0].groupId).toBeNull()
    expect(getDeckGroups(notes)).toMatchObject([
      {
        groupId: 'deck-1',
        coverNote: { id: 'cover' },
        notes: [{ id: 'cover' }, { id: 'back' }],
      },
    ])
  })
})
