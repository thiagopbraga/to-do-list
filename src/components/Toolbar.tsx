export function Toolbar() {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-300 bg-stone-100 px-4"
      data-testid="toolbar"
      aria-label="Barra de ferramentas"
    >
      <span className="text-sm font-semibold text-stone-700">StickyFlow</span>
      {/* Slots para exportar, importar e alinhar (features futuras) */}
    </header>
  )
}
