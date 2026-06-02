# Spec: Envelhecimento Visual (Decay)

> **Status:** 🔮 Futuro / Backlog (feature diferenciada — pós-MVP)
> **Prefixo de requisitos:** `DEC`
> **Origem:** [PRD §4](../../PRD.md)

## 1. Visão Geral

Post-its sem modificações por muito tempo começam a **desbotar levemente**,
dando uma noção visual de "idade" da tarefa. Baseia-se em `updatedAt`.

## 2. Objetivos

- Calcular a "idade" de cada nota a partir de `updatedAt`.
- Aplicar efeito visual gradual (opacidade/saturação) conforme a idade.
- Efeito puramente visual — **não** altera os dados persistidos.

## 3. Não-Objetivos

- Excluir/arquivar notas antigas automaticamente.
- Persistir o nível de decay (é derivado, calculado em runtime).

## 4. Requisitos

### Funcionais

- **DEC-01** — A idade da nota é derivada de `now - updatedAt`.
- **DEC-02** — Definir faixas de decay (ex.: fresca < 3d, desbotando 3–14d, antiga > 14d) — valores a calibrar.
- **DEC-03** — Aplicar estilo gradual (ex.: redução de saturação/opacidade) conforme a faixa.
- **DEC-04** — Qualquer edição/movimentação reseta o decay (pois atualiza `updatedAt`).

### Não-Funcionais

- **DEC-NF-01** — O cálculo não pode degradar a performance com muitas notas (memoização/CSS).
- **DEC-NF-02** — Efeito apenas visual; não escreve no store/localStorage.

## 5. Regras / Edge Cases

- Limites das faixas devem ser parametrizáveis (constantes).
- Acessibilidade: decay não pode reduzir o contraste a ponto de tornar o texto ilegível (definir piso).

## 6. Dependências

- [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md) — `updatedAt`.
- [Edição](../spec-edicao-direta/edicao-direta.md) / [DnD](../spec-drag-and-drop/drag-and-drop.md) — atualizam `updatedAt` (reset).

## 7. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| DEC-T01 | [Cálculo da idade e faixas de decay](tasks/DEC-T01-calculo-decay.md) | DEC-01, DEC-02, DEC-04, DEC-NF-02 |
| DEC-T02 | [Estilo visual gradual](tasks/DEC-T02-estilo-visual.md) | DEC-03, DEC-NF-01 |
| DEC-T03 | [Testes (decay)](tasks/DEC-T03-testes.md) | DEC-01/02/04, DEC-NF-02 |

## 8. Critérios de Aceite

- Notas antigas aparecem desbotadas; editar uma volta ao estado "fresco".
- Texto continua legível mesmo no decay máximo.
