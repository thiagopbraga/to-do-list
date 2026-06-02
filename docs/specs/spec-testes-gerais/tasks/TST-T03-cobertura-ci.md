# TST-T03 — Cobertura e execução em CI

> **Spec:** [Testes Gerais](../testes-gerais.md)
> **Requisitos:** TST-02, TST-NF-01, TST-NF-02, TST-NF-03
> **Dependências:** TST-T01

## Objetivo

Garantir métricas de cobertura, rastreabilidade requisito→teste e execução
automatizada/headless.

## Passos

1. Habilitar cobertura no Vitest (provider `v8`) com relatório `text` + `html`.
2. Definir thresholds: mínimo 80% em `src/lib` e no store (TST-NF-01).
3. Verificar que cada spec funcional tem sua task de testes implementada (TST-02).
4. Configurar pipeline CI executando unitários + E2E headless de forma determinística.

## Critérios de Verificação (DoD)

- [ ] `npm run coverage` gera relatório e falha abaixo do threshold.
- [ ] CI roda toda a suíte em modo headless, sem flaky.
- [ ] Cada requisito de feature tem ao menos um teste associado.

## Arquivos afetados (estimado)

`vitest.config.ts`, configuração de CI (ex.: `.github/workflows/ci.yml`)
