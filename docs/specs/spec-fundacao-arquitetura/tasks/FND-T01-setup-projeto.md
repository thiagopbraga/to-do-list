# FND-T01 — Setup do projeto e stack

> **Spec:** [Fundação & Arquitetura](../fundacao-arquitetura.md)
> **Requisitos:** FND-01, FND-NF-03
> **Dependências:** nenhuma

## Objetivo

Inicializar o projeto SPA com toda a stack instalada e a estrutura de pastas
definida.

## Passos

1. Inicializar projeto com Vite + React + TypeScript (`strict: true`).
2. Instalar e configurar Tailwind CSS.
3. Instalar dependências: `zustand`, `@dnd-kit/core`, `@dnd-kit/utilities`.
4. Criar estrutura de pastas:
   - `src/components/` — componentes de UI
   - `src/store/` — store Zustand
   - `src/lib/` — utilitários (storage, file, validação)
   - `src/types/` — contratos/tipos
5. Configurar scripts `dev`, `build`, `preview` e lint.

## Critérios de Verificação (DoD)

- [ ] `npm run dev` inicia sem erros e renderiza uma página em branco.
- [ ] Tailwind aplica classes utilitárias corretamente (teste com uma classe visível).
- [ ] `tsconfig` com `strict: true`.
- [ ] Estrutura de pastas criada conforme FND-NF-03.

## Arquivos afetados (estimado)

`package.json`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, `src/`
