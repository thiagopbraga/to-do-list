export function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {}

  return {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      store = {}
    },
    getItem(key: string) {
      return store[key] ?? null
    },
    key(index: number) {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
    removeItem(key: string) {
      delete store[key]
    },
    setItem(key: string, value: string) {
      store[key] = value
    },
  }
}

export function installLocalStorageMock(): Storage {
  const mock = createLocalStorageMock()
  vi.stubGlobal('localStorage', mock)
  return mock
}
