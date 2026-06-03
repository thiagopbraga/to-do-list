# Specs — StickyFlow

Índice das especificações funcionais do **StickyFlow**, derivadas do
[PRD](../PRD.md) e da [RFC](../RFC.md).

## Como ler

Cada funcionalidade tem sua própria pasta `spec-[funcionalidade]/` contendo:

```
spec-[funcionalidade]/
├── [funcionalidade].md   # a spec (requisitos com IDs rastreáveis)
└── tasks/
    └── [TASK].md         # tarefas atômicas com critérios de verificação
```

Cada requisito tem um ID rastreável (ex.: `DND-03`) e cada tarefa referencia os
requisitos que cobre, garantindo rastreabilidade PRD/RFC → spec → tarefa.

**Testes:** cada spec conclui com uma task de testes (`[PREFIXO]-T0x-testes.md`)
cobrindo os requisitos daquela funcionalidade. A estratégia de testes da
aplicação (ambiente, E2E e cobertura) vive na spec transversal
[Testes Gerais](spec-testes-gerais/testes-gerais.md).

## Ordem de implementação sugerida

A **Fundação** é bloqueante: deve vir antes de tudo. Depois, o MVP. As features
diferenciadas (🔮) ficam para depois do MVP.

| # | Spec | Status | Prefixo | Depende de |
| --- | --- | --- | --- | --- |
| 0 | [Fundação & Arquitetura](spec-fundacao-arquitetura/fundacao-arquitetura.md) | MVP · base | `FND` | — |
| 1 | [Persistência em localStorage](spec-persistencia-local/persistencia-local.md) | MVP | `PER` | FND |
| 2 | [Criação Rápida](spec-criacao-rapida/criacao-rapida.md) | MVP | `CRI` | FND |
| 3 | [Edição Direta](spec-edicao-direta/edicao-direta.md) | MVP | `EDI` | FND |
| 4 | [Drag and Drop](spec-drag-and-drop/drag-and-drop.md) | MVP | `DND` | FND, PER |
| 5 | [Seleção Múltipla](spec-selecao-multipla/selecao-multipla.md) | MVP | `SEL` | FND, EDI, DND |
| 6 | [Categorização Visual (Cor)](spec-categorizacao-visual/categorizacao-visual.md) | MVP | `COR` | FND |
| 7 | [Exportação de Dados](spec-exportacao-dados/exportacao-dados.md) | MVP | `EXP` | FND |
| 8 | [Importação de Dados](spec-importacao-dados/importacao-dados.md) | MVP | `IMP` | FND, PER |
| 9 | [Envelhecimento Visual (Decay)](spec-envelhecimento-visual/envelhecimento-visual.md) | 🔮 Futuro | `DEC` | FND, EDI, DND |
| 10 | [Lixeira Tátil](spec-lixeira-tatil/lixeira-tatil.md) | 🔮 Futuro | `LIX` | DND, FND |
| 11 | [Empilhamento (Grouping)](spec-empilhamento/empilhamento.md) | 🔮 Futuro | `GRP` | DND, FND |
| 12 | [Alinhamento Magnético](spec-alinhamento-magnetico/alinhamento-magnetico.md) | 🔮 Futuro | `MAG` | FND, PER |
| T | [Testes Gerais](spec-testes-gerais/testes-gerais.md) | MVP · transversal | `TST` | FND (+ features) |

## Legenda de status

- **MVP** — escopo essencial (PRD §3).
- **🔮 Futuro / Backlog** — features diferenciadas (PRD §4), planejadas para depois do MVP.

## Decisões registradas

- **localStorage** (não IndexedDB) — RFC §6.
- **DOM + `translate3d`** (não Canvas) — RFC §6.
- **Importação = sobrescrita** no MVP (merge é ideia futura).
- **Travamento em colunas Kanban** mencionado no PRD §3 → fora do MVP (ideia futura).
- **Texto puro / anti-XSS** — RFC §7, aplicado em [EDI](spec-edicao-direta/edicao-direta.md) e [IMP](spec-importacao-dados/importacao-dados.md).
- **Stack de testes** — Vitest + React Testing Library (unitário/componente) e Playwright (E2E); detalhes em [Testes Gerais](spec-testes-gerais/testes-gerais.md).
- **Seleção múltipla não persistida** — seleção é estado transitório de UI, documentado em [SEL](spec-selecao-multipla/selecao-multipla.md).
