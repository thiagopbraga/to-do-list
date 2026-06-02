const DAY_IN_MS = 24 * 60 * 60 * 1000

export const NOTE_DECAY_THRESHOLDS_MS = {
  fading: 3 * DAY_IN_MS,
  old: 14 * DAY_IN_MS,
} as const

export const NOTE_DECAY_MIN_SATURATION_FOR_CONTRAST = 0.7

export const NOTE_DECAY_VISUALS = {
  fresh: {
    saturation: 1,
  },
  fading: {
    saturation: 0.85,
  },
  old: {
    saturation: NOTE_DECAY_MIN_SATURATION_FOR_CONTRAST,
  },
} as const

export type NoteDecayStage = keyof typeof NOTE_DECAY_VISUALS

export type NoteDecayVisual = {
  ageInDays: number
  filter: string
  saturation: number
  stage: NoteDecayStage
}

function toTimestamp(value: string | number | Date): number | null {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getNoteDecayStage(ageInMs: number): NoteDecayStage {
  if (ageInMs >= NOTE_DECAY_THRESHOLDS_MS.old) return 'old'
  if (ageInMs >= NOTE_DECAY_THRESHOLDS_MS.fading) return 'fading'
  return 'fresh'
}

export function getNoteVisualDecay(
  updatedAt: string,
  now: string | number | Date = new Date(),
): NoteDecayVisual {
  const nowTimestamp = toTimestamp(now)
  const updatedAtTimestamp = toTimestamp(updatedAt)
  const ageInMs =
    nowTimestamp === null || updatedAtTimestamp === null
      ? 0
      : Math.max(0, nowTimestamp - updatedAtTimestamp)
  const stage = getNoteDecayStage(ageInMs)
  const saturation = NOTE_DECAY_VISUALS[stage].saturation

  return {
    ageInDays: ageInMs / DAY_IN_MS,
    filter: saturation === 1 ? 'none' : `saturate(${saturation})`,
    saturation,
    stage,
  }
}
