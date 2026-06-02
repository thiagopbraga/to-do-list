# Spec: Persistência em localStorage

> **Status:** MVP
> **Prefixo de requisitos:** `PER`
> **Origem:** [PRD §3, §5](../../PRD.md) · [RFC §5.1](../../RFC.md)

## 1. Visão Geral

Salvamento automático e não-bloqueante do estado do quadro no `localStorage`.
Ao reabrir/atualizar a página, o quadro é restaurado exatamente como foi deixado
(texto, cor, posição, zIndex).

## 2. Objetivos

- Auto-save de qualquer alteração (texto, cor, posição X/Y, zIndex, tema).
- Salvamento com **debounce de 500–1000ms** para não causar *jank* durante o drag.
- Hidratação do estado no boot da aplicação.

## 3. Não-Objetivos

- Formato de import/export (vive em [EXP](../spec-exportacao-dados/exportacao-dados.md) / [IMP](../spec-importacao-dados/importacao-dados.md)) — apesar de reusar o mesmo schema.
- IndexedDB (rejeitado na [RFC §6](../../RFC.md)).

## 4. Requisitos

### Funcionais

- **PER-01** — O estado completo (schema v1.0) deve ser persistido no `localStorage` sob uma chave fixa (ex.: `stickyflow:state`).
- **PER-02** — A escrita deve ser envolvida em **debounce de 500–1000ms**: só grava após o usuário parar de arrastar/digitar.
- **PER-03** — No boot, a aplicação deve **hidratar** o store a partir do `localStorage`, se houver dado válido.
- **PER-04** — Se não houver dado salvo (primeiro acesso), inicia com board vazio padrão.
- **PER-05** — Toda gravação deve atualizar `board.lastModified`.

### Não-Funcionais

- **PER-NF-01** — A movimentação deve manter 60fps; a persistência não pode bloquear o thread durante o arraste ([RFC §5.1](../../RFC.md)).
- **PER-NF-02** — Tratar `QuotaExceededError` (limite ~5MB) com aviso amigável, sem quebrar o layout ([PRD §5](../../PRD.md)).
- **PER-NF-03** — Dados corrompidos no `localStorage` não devem travar o boot (fallback para board vazio).

## 5. Regras / Edge Cases

- `localStorage` indisponível (modo privado/bloqueado) → app funciona em memória e avisa que não persistirá.
- JSON salvo inválido/corrompido → ignora, loga e inicia limpo.
- Versão de schema diferente → delega à lógica de migração ([IMP](../spec-importacao-dados/importacao-dados.md)).

## 6. Dependências

- [Fundação & Arquitetura](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — schema e store.

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| PER-T01 | [Camada de storage (serialize/parse)](tasks/PER-T01-camada-storage.md) | PER-01, PER-NF-02, PER-NF-03 |
| PER-T02 | [Auto-save com debounce](tasks/PER-T02-autosave-debounce.md) | PER-02, PER-05, PER-NF-01 |
| PER-T03 | [Hidratação no boot](tasks/PER-T03-hidratacao-boot.md) | PER-03, PER-04 |
| PER-T04 | [Testes (storage, debounce, hidratação)](tasks/PER-T04-testes.md) | PER-01..04, PER-NF-02/03 |

## 8. Critérios de Aceite

- Criar/mover/editar uma nota e atualizar a página → quadro reaparece idêntico.
- Durante o arraste contínuo não há gravações intermediárias (apenas após o debounce).
- Corromper manualmente a chave do `localStorage` → app abre vazio sem erro fatal.
