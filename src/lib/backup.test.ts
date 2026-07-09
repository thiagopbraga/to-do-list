import { describe, expect, it } from 'vitest'
import { createAppStateFactory, createTaskFactory } from '../test/factories'
import { buildBackupFilename, parseBackup, readBackupFile } from './backup'
import { serializeState } from './storage'

describe('buildBackupFilename', () => {
  it('inclui a data local no nome', () => {
    expect(buildBackupFilename(new Date(2026, 6, 9))).toBe(
      'taskflow-backup-2026-07-09.json',
    )
  })
})

describe('parseBackup', () => {
  it('aceita backup válido', () => {
    const state = createAppStateFactory({ tasks: [createTaskFactory()] })
    const result = parseBackup(serializeState(state))
    expect(result).toEqual({ ok: true, state })
  })

  it('distingue JSON inválido de schema inválido', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'invalid-json' })
    expect(parseBackup('{"version":"1.0"}')).toEqual({
      ok: false,
      error: 'invalid-schema',
    })
  })
})

describe('readBackupFile', () => {
  it('lê e valida um arquivo', async () => {
    const state = createAppStateFactory()
    const file = new File([serializeState(state)], 'backup.json', {
      type: 'application/json',
    })
    const result = await readBackupFile(file)
    expect(result.ok).toBe(true)
  })

  it('retorna erro para conteúdo inválido', async () => {
    const file = new File(['not json'], 'backup.json')
    const result = await readBackupFile(file)
    expect(result).toEqual({ ok: false, error: 'invalid-json' })
  })
})
