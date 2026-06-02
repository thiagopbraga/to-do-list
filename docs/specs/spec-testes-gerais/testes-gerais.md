# Spec: Testes Gerais da Aplicação

> **Status:** MVP — Transversal (suporta todas as specs)
> **Prefixo de requisitos:** `TST`
> **Origem:** [PRD §5](../../PRD.md) · [RFC §5, §7](../../RFC.md)

## 1. Visão Geral

Define a **estratégia de testes** do StickyFlow: ferramentas, convenções,
pirâmide de testes e os fluxos ponta-a-ponta (E2E) que cobrem a aplicação como
um todo. Cada spec funcional possui sua própria task de testes (unitários/
componente); esta spec cuida do **ambiente**, dos **testes E2E integrados** e
da **qualidade/cobertura**.

## 2. Objetivos

- Padronizar a stack e as convenções de teste do projeto.
- Garantir testes unitários/componente por funcionalidade (referenciados em cada spec).
- Cobrir os fluxos críticos com testes E2E (criar → editar → mover → cor → exportar → importar → recarregar).
- Definir metas de cobertura e execução em CI.

## 3. Não-Objetivos

- Testes de carga/stress (fora do MVP).
- Testes visuais (visual regression) — ideia futura opcional.

## 4. Stack de Testes

| Camada | Ferramenta | Uso |
| --- | --- | --- |
| Unitário / Componente | **Vitest** + **React Testing Library** | Lógica pura (store, libs) e componentes React |
| DOM simulado | **jsdom** / **happy-dom** | Ambiente para testes de componente |
| E2E | **Playwright** | Fluxos completos no navegador real |
| Cobertura | **Vitest coverage (v8)** | Métricas e thresholds |

> A escolha alinha-se ao setup Vite + React + TS da [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md).

## 5. Pirâmide e Convenções

- **Base (muitos):** unitários de `src/lib/*` e do store (`boardStore`).
- **Meio:** testes de componente (`Note`, `Board`, `Toolbar`, modais).
- **Topo (poucos):** E2E dos fluxos críticos.
- Convenção de nome: `*.test.ts(x)` ao lado do código; E2E em `e2e/*.spec.ts`.
- Testes determinísticos: mockar tempo (`vi.useFakeTimers`) para debounce/decay e datas (`createdAt`/`updatedAt`).
- Mockar `localStorage` em unitários; usar storage real do browser nos E2E.

## 6. Requisitos

### Funcionais

- **TST-01** — Ambiente de testes configurado (Vitest + RTL + Playwright) com scripts `test`, `test:watch`, `test:e2e`, `coverage`.
- **TST-02** — Cada spec funcional possui ao menos uma task de testes cobrindo seus requisitos (rastreabilidade requisito → teste).
- **TST-03** — Suíte E2E cobrindo os fluxos críticos do MVP:
  - Criar nota (duplo clique) e editar texto.
  - Mover nota (drag) e validar nova posição após reload.
  - Trocar cor.
  - Exportar e reimportar (round-trip) restaurando o quadro.
  - Persistência: recarregar a página mantém o estado.
  - Importar arquivo inválido → toast de erro, quadro intacto.
- **TST-04** — Teste de segurança: texto com markup malicioso não é executado (anti-XSS, [RFC §7](../../RFC.md)).

### Não-Funcionais

- **TST-NF-01** — Cobertura mínima alvo: 80% em `src/lib` e no store; relatório gerado no `coverage`.
- **TST-NF-02** — Suíte executável em CI de forma headless e determinística.
- **TST-NF-03** — Tempo de execução da suíte unitária mantido baixo (segundos), sem flaky tests.

## 7. Mapa de Cobertura por Spec

| Spec | Task de testes | Foco |
| --- | --- | --- |
| [Fundação](../spec-fundacao-arquitetura/fundacao-arquitetura.md) | FND-T05 | store + schema |
| [Persistência](../spec-persistencia-local/persistencia-local.md) | PER-T04 | storage, debounce, hidratação |
| [Criação Rápida](../spec-criacao-rapida/criacao-rapida.md) | CRI-T04 | duplo clique, defaults, foco |
| [Edição Direta](../spec-edicao-direta/edicao-direta.md) | EDI-T04 | edição, bind, anti-XSS |
| [Drag and Drop](../spec-drag-and-drop/drag-and-drop.md) | DND-T04 | posição, zIndex, clique vs arraste |
| [Categorização (Cor)](../spec-categorizacao-visual/categorizacao-visual.md) | COR-T03 | troca de cor, fallback |
| [Exportação](../spec-exportacao-dados/exportacao-dados.md) | EXP-T04 | serialização, download |
| [Importação](../spec-importacao-dados/importacao-dados.md) | IMP-T05 | validação, confirmação, erro |
| [Decay](../spec-envelhecimento-visual/envelhecimento-visual.md) 🔮 | DEC-T03 | cálculo de idade/faixas |
| [Lixeira](../spec-lixeira-tatil/lixeira-tatil.md) 🔮 | LIX-T03 | colisão, remoção |
| [Empilhamento](../spec-empilhamento/empilhamento.md) 🔮 | GRP-T03 | colisão, groupId |
| [Alinhamento](../spec-alinhamento-magnetico/alinhamento-magnetico.md) 🔮 | MAG-T03 | grid determinístico |

## 8. Tarefas

| ID | Tarefa | Requisitos |
| --- | --- | --- |
| TST-T01 | [Setup do ambiente de testes](tasks/TST-T01-setup-ambiente.md) | TST-01, TST-NF-02 |
| TST-T02 | [Suíte E2E dos fluxos críticos](tasks/TST-T02-e2e-fluxos-criticos.md) | TST-03, TST-04 |
| TST-T03 | [Cobertura e execução em CI](tasks/TST-T03-cobertura-ci.md) | TST-02, TST-NF-01, TST-NF-02, TST-NF-03 |

## 9. Critérios de Aceite

- `npm run test` roda os unitários/componente; `npm run test:e2e` roda os E2E.
- Os fluxos críticos do MVP passam de ponta a ponta.
- Relatório de cobertura gerado e thresholds verificados.
- Texto malicioso importado não executa (teste anti-XSS verde).
