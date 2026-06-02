# Spec: Fundação & Arquitetura

> **Status:** MVP — Fundação (bloqueante para todas as demais specs)
> **Prefixo de requisitos:** `FND`
> **Origem:** [PRD §6](../../PRD.md) · [RFC §3, §4](../../RFC.md)

## 1. Visão Geral

Esta spec define a base técnica do **StickyFlow**: setup do projeto, stack,
modelo de dados versionado, tipos e o store de estado global. Nenhuma feature
deve ser implementada antes que esta fundação esteja pronta, pois todas
dependem do schema e do store definidos aqui.

## 2. Objetivos

- Projeto SPA 100% client-side, sem backend.
- Stack consolidada e instalada (React + Vite + TypeScript + Tailwind + Zustand + dnd-kit).
- Schema de dados estrito e **versionado** (`version: "1.0"`).
- Store central de estado reativo, desacoplado dos componentes.
- Tipos/contratos compartilhados por todas as features.

## 3. Não-Objetivos

- Qualquer feature funcional de UI (criação, edição, DnD, etc.) — vive em outras specs.
- Sincronização em nuvem, autenticação, multiplayer (fora do MVP — ver [RFC §2](../../RFC.md)).

## 4. Stack Técnica

| Camada | Tecnologia | Motivo |
| --- | --- | --- |
| Core | React + Vite + TypeScript | Componentização e DX rápida |
| Estado | Zustand | Reatividade fora de componentes, sem boilerplate |
| Drag & Drop | `@dnd-kit/core` | Colisão eficiente, `translate3d`, acessibilidade |
| Estilo | Tailwind CSS | Animações, rotações e cores via utility classes |
| Armazenamento | Web Storage API (`localStorage`) | Persistência local imediata |
| Arquivos | File API nativa (`Blob`, `FileReader`) | Import/export sem backend |

## 5. Modelo de Dados (Schema v1.0)

Contrato canônico — **fonte única de verdade** para `localStorage`, import e export.

```jsonc
{
  "version": "1.0",
  "board": {
    "lastModified": "ISO-8601",
    "theme": "light" | "dark"
  },
  "notes": [
    {
      "id": "uuid-v4",
      "text": "string",
      "color": "yellow" | "pink" | "blue" | "green" | "purple" | "orange",
      "position": { "x": 0, "y": 0 },
      "zIndex": 0,
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "groupId": "string | null"
    }
  ]
}
```

## 6. Requisitos

### Funcionais

- **FND-01** — O projeto deve inicializar como SPA client-side (sem chamadas a servidor).
- **FND-02** — Deve existir um tipo/contrato `BoardState` e `Note` correspondente ao schema v1.0.
- **FND-03** — O store global deve expor `board` e `notes`, além de ações para mutação (`addNote`, `updateNote`, `removeNote`, `setNotes`, `replaceState`).
- **FND-04** — Toda nota criada deve ter `id` único (UUID v4), `createdAt`, `updatedAt` e `zIndex` coerentes.
- **FND-05** — O schema deve conter `version` para suportar migração futura na importação (ver [IMP](../spec-importacao-dados/importacao-dados.md)).
- **FND-06** — Deve existir uma paleta de cores fechada e tipada (enum) reutilizável pelas features.

### Não-Funcionais

- **FND-NF-01** — Tipos estritos (TypeScript `strict: true`); zero `any` no contrato de dados.
- **FND-NF-02** — Store desacoplado da árvore React (mutável fora de componentes, conforme [RFC §3](../../RFC.md)).
- **FND-NF-03** — Estrutura de pastas previsível e documentada (`src/components`, `src/store`, `src/lib`, `src/types`).

## 7. Dependências

Nenhuma. Esta é a spec raiz. **Todas as outras dependem dela.**

## 8. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| FND-T01 | [Setup do projeto e stack](tasks/FND-T01-setup-projeto.md) | FND-01, FND-NF-03 |
| FND-T02 | [Tipos e schema v1.0](tasks/FND-T02-tipos-schema.md) | FND-02, FND-05, FND-06 |
| FND-T03 | [Store global (Zustand)](tasks/FND-T03-store-global.md) | FND-03, FND-04 |
| FND-T04 | [Layout base do board](tasks/FND-T04-layout-board.md) | FND-01, FND-NF-02 |
| FND-T05 | [Testes (store e schema)](tasks/FND-T05-testes.md) | FND-02..06 |

## 9. Critérios de Aceite

- `npm run dev` sobe a aplicação com um board vazio renderizado.
- O store pode criar/atualizar/remover notas em memória e os tipos compilam sem erro.
- Nenhuma requisição de rede é feita ao abrir a aplicação.
