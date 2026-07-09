# TaskFlow ✓

Lista de tarefas prática para o dia a dia, com **agendamento**, **recorrência**,
**prioridades** e **listas** — layout **mobile-first** que também funciona muito
bem no desktop. Os dados ficam no seu navegador (localStorage), sem conta e sem
servidor.

## Funcionalidades

- **Hoje** — atrasadas + tarefas do dia, num só lugar. Tarefa criada nessa visão
  já nasce agendada para hoje.
- **Agendadas** — agenda agrupada por dia (Hoje, Amanhã, dias seguintes).
- **Todas** — tudo que está aberto, agrupado por lista.
- **Concluídas** — histórico de conclusões, com opção de limpar.
- **Agendamento** — data e hora opcionais por tarefa; atrasadas ficam em
  destaque vermelho.
- **Recorrência** — diária, dias úteis, semanal, mensal ou anual. Ao concluir,
  a tarefa é reagendada para a próxima ocorrência (nunca para o passado) e a
  conclusão fica registrada no histórico.
- **Prioridades** — alta/média/baixa, refletidas na cor do checkbox e na
  ordenação.
- **Listas** — organize por contexto (ex.: Trabalho, Mercado), com cores.
  A lista "Entrada" é a caixa de entrada padrão.
- **Quick add** — barra fixa para adicionar tarefa com data (Hoje/Amanhã) e
  prioridade em um toque; o editor completo abre ao tocar na tarefa.
- **Busca** — por título e anotações, ignorando acentos.
- **Modo escuro**, **backup** (exportar/importar JSON) e **migração automática**
  dos dados do antigo StickyFlow.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes unitários (vitest)
npm run coverage   # unitários com cobertura (mínimo 80%)
npm run test:e2e   # Playwright (projetos desktop e mobile)
npm run lint       # eslint
npm run build      # build de produção em dist/
```

Para o e2e reaproveitar um Chromium já instalado no ambiente:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium npm run test:e2e
```

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand · Vitest ·
Testing Library · Playwright

## Arquitetura

```
src/
  types/task.ts        # domínio: Task, TaskList, AppState (schema 2.0)
  lib/dates.ts         # chaves de data locais, recorrência, rótulos pt-BR
  lib/views.ts         # seletores: Hoje, Agendadas, ordenação, busca
  lib/storage.ts       # persistência com debounce + migração do schema 1.0
  lib/backup.ts        # exportar/importar JSON validado
  store/taskStore.ts   # estado global (zustand) e ações
  components/          # UI mobile-first (bottom nav) + desktop (sidebar)
```

Decisões principais:

- Datas agendadas são guardadas como chave local `YYYY-MM-DD` (e hora `HH:mm`),
  não como ISO/UTC — evita tarefas "pulando" de dia por fuso horário.
- Concluir tarefa recorrente cria um registro concluído e reagenda a original,
  preservando o histórico.
- Todo estado importado/carregado passa por validação de schema; dados
  corrompidos nunca derrubam o app.
