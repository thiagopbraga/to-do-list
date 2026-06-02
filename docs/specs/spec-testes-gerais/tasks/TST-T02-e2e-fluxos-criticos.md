# TST-T02 — Suíte E2E dos fluxos críticos

> **Spec:** [Testes Gerais](../testes-gerais.md)
> **Requisitos:** TST-03, TST-04
> **Dependências:** TST-T01, e as features do MVP implementadas

## Objetivo

Cobrir com Playwright os fluxos ponta-a-ponta que validam a aplicação como um
todo.

## Cenários (E2E)

1. **Criar + editar:** duplo clique cria nota → digitar texto → recarregar → texto persiste.
2. **Mover:** arrastar nota → soltar → recarregar → posição persiste.
3. **Cor:** trocar cor → recarregar → cor persiste.
4. **Round-trip de backup:** exportar `.json` → limpar/alterar quadro → importar o arquivo → quadro restaurado idêntico.
5. **Persistência:** estado completo sobrevive a reload.
6. **Importação inválida:** importar arquivo corrompido → toast "Arquivo inválido" → quadro intacto.
7. **Anti-XSS (TST-04):** importar/editar nota com `<script>`/`<img onerror>` → texto exibido literal, sem execução.

## Critérios de Verificação (DoD)

- [ ] Todos os cenários acima passam de forma determinística (sem flaky).
- [ ] Round-trip export→import preserva notas, posições, cores e zIndex.
- [ ] Cenário anti-XSS verde.

## Arquivos afetados (estimado)

`e2e/board.spec.ts`, `e2e/backup.spec.ts`, `e2e/security.spec.ts`
