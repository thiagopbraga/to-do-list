import { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import {
  DotsIcon,
  DownloadIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from './icons'

type HeaderProps = {
  title: string
  subtitle?: string
  query: string
  onQueryChange: (query: string) => void
  onExport: () => void
  onImport: () => void
}

export function Header({
  title,
  subtitle,
  query,
  onQueryChange,
  onExport,
  onImport,
}: HeaderProps) {
  const theme = useTaskStore((state) => state.settings.theme)
  const setTheme = useTaskStore((state) => state.setTheme)
  const clearCompleted = useTaskStore((state) => state.clearCompleted)
  const doneCount = useTaskStore(
    (state) => state.tasks.filter((task) => task.done).length,
  )

  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const closeSearch = () => {
    setSearchOpen(false)
    onQueryChange('')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <SearchIcon className="size-4.5 shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeSearch()
              }}
              placeholder="Buscar tarefas…"
              aria-label="Buscar tarefas"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fechar busca"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <XIcon className="size-4.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                {title}
              </h1>
              {subtitle && (
                <p className="-mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <SearchIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              {theme === 'light' ? (
                <MoonIcon className="size-5" />
              ) : (
                <SunIcon className="size-5" />
              )}
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Mais opções"
                aria-expanded={menuOpen}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <DotsIcon className="size-5" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  <MenuItem
                    icon={<DownloadIcon className="size-4" />}
                    label="Exportar backup"
                    onClick={() => {
                      setMenuOpen(false)
                      onExport()
                    }}
                  />
                  <MenuItem
                    icon={<UploadIcon className="size-4" />}
                    label="Importar backup"
                    onClick={() => {
                      setMenuOpen(false)
                      onImport()
                    }}
                  />
                  {doneCount > 0 && (
                    <MenuItem
                      icon={<TrashIcon className="size-4" />}
                      label={`Limpar concluídas (${doneCount})`}
                      destructive
                      onClick={() => {
                        setMenuOpen(false)
                        if (
                          window.confirm(
                            `Excluir permanentemente ${doneCount} tarefa(s) concluída(s)?`,
                          )
                        ) {
                          clearCompleted()
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm ${
        destructive
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
